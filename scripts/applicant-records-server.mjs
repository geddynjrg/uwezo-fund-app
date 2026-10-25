import http from 'node:http';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';

const PORT = 3015;
const PORTAL = process.env.RECORDS_PORTAL || 'portal';
const SECRET_COLUMN = /password|secret|token|otp_?code|otp_?hash|verifier/i;
const SKIP_TABLES = new Set([
  'refresh_tokens',
  'otp_requests',
  'ecitizen_pkce_states',
  'sync_queue',
  'lms_sync_queues',
  'counties',
  'constituencies',
  'wards',
  'counties_cache',
  'taxonomy_terms',
  'taxonomy_vocabularies',
]);

function parseDatabaseUrl(raw) {
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
  };
}

function ident(name) {
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error('Unexpected database name.');
  return `\`${name}\``;
}

function verifyJwt(token, secret) {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const expected = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  const actual = Buffer.from(parts[2]);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !crypto.timingSafeEqual(actual, wanted)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.exp && Number(payload.exp) * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function plain(value) {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) {
    return value.length > 400 ? `[file ${value.length} bytes kept on the server]` : value.toString('utf8');
  }
  if (value && typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string' && value.length > 20000) return `[kept on the server, ${value.length} characters]`;
  return value == null ? '' : value;
}

function sanitize(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (SECRET_COLUMN.test(key)) continue;
    const next = plain(value);
    out[key] = next == null ? '' : String(next);
  }
  return out;
}

function phoneVariants(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 9) return [];
  const local = digits.startsWith('254') ? `0${digits.slice(3)}` : digits.startsWith('0') ? digits : `0${digits.slice(-9)}`;
  const international = `254${local.slice(1)}`;
  return [...new Set([local, international, `+${international}`, digits])];
}

function corsHeaders(origin) {
  const allow = !origin || /localhost|capacitor:\/\/|\.uwezo\.go\.ke$/i.test(origin) ? origin || '*' : '';
  if (!allow) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Loans-Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  };
}

function bearer(header) {
  const match = /^Bearer\s+(\S+)$/i.exec(String(header || ''));
  return match ? match[1] : '';
}

const pool = mysql.createPool({
  ...parseDatabaseUrl(process.env.DATABASE_URL || ''),
  connectionLimit: 4,
  connectTimeout: 8000,
  dateStrings: true,
});

async function columnMap(connection) {
  const [rows] = await connection.query(
    'SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()',
  );
  const map = new Map();
  for (const row of rows) {
    const table = String(row.tableName);
    if (SKIP_TABLES.has(table)) continue;
    if (!map.has(table)) map.set(table, new Set());
    map.get(table).add(String(row.columnName));
  }
  return map;
}

async function selectIn(connection, table, column, values) {
  const unique = [...new Set(values.map((value) => String(value)).filter(Boolean))].slice(0, 200);
  if (!unique.length) return [];
  const [rows] = await connection.query(
    `SELECT * FROM ${ident(table)} WHERE ${ident(column)} IN (${unique.map(() => '?').join(',')}) LIMIT 300`,
    unique,
  );
  return rows.map(sanitize);
}

function addRows(bucket, table, rows) {
  if (!rows.length) return;
  if (!bucket.has(table)) bucket.set(table, new Map());
  const saved = bucket.get(table);
  for (const row of rows) {
    const id = row.id || `${saved.size}`;
    saved.set(String(id), row);
  }
}

async function userFromToken(connection, token) {
  const payload = verifyJwt(token, process.env.JWT_SECRET || '');
  if (payload?.sub && /^[A-Za-z0-9_-]{8,80}$/.test(String(payload.sub))) {
    return { userId: String(payload.sub) };
  }
  const api = String(process.env.API_URL || '').replace(/\/$/, '');
  if (!api) return null;
  const response = await fetch(`${api}/api/v1/user/profile`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) return null;
  const body = await response.json();
  const email = String(body?.data?.email || body?.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) return null;
  const [rows] = await connection.query('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1', [email]);
  const id = rows[0]?.id;
  return id ? { userId: String(id) } : null;
}

async function recordsForToken(token) {
  const connection = await pool.getConnection();
  try {
    const identity = await userFromToken(connection, token);
    if (!identity) return null;
    const columns = await columnMap(connection);
    const bucket = new Map();
    const users = await selectIn(connection, 'users', 'id', [identity.userId]);
    if (!users.length) return null;
    addRows(bucket, 'users', users);
    const user = users[0];
    for (const [table, names] of columns) {
      if (table === 'users') continue;
      const column = names.has('userId') ? 'userId' : names.has('user_id') ? 'user_id' : '';
      if (!column) continue;
      addRows(bucket, table, await selectIn(connection, table, column, [identity.userId]));
    }
    const groupIds = [...(bucket.get('group_applications')?.keys() || []), ...(bucket.get('applications')?.keys() || [])];
    const phones = phoneVariants(user.phoneNumber || user.phone_number || '');
    const idNumbers = [user.idNumber, user.id_number].map((value) => String(value || '')).filter(Boolean);
    const emails = [user.email].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
    const memberColumns = columns.get('group_members');
    if (memberColumns) {
      const clauses = [];
      const params = [];
      if (emails.length && memberColumns.has('email')) {
        clauses.push(`LOWER(email) IN (${emails.map(() => '?').join(',')})`);
        params.push(...emails);
      }
      if (idNumbers.length && memberColumns.has('idNo')) {
        clauses.push(`idNo IN (${idNumbers.map(() => '?').join(',')})`);
        params.push(...idNumbers);
      }
      if (phones.length && memberColumns.has('mobile')) {
        clauses.push(`mobile IN (${phones.map(() => '?').join(',')})`);
        params.push(...phones);
      }
      if (clauses.length) {
        const [rows] = await connection.query(
          `SELECT * FROM ${ident('group_members')} WHERE ${clauses.join(' OR ')} LIMIT 200`,
          params,
        );
        addRows(bucket, 'group_members', rows.map(sanitize));
      }
    }
    const memberIds = [...(bucket.get('group_members')?.values() || [])].map((row) => row.id).filter(Boolean);
    if (columns.get('individual_applications')?.has('memberId')) {
      addRows(bucket, 'individual_applications', await selectIn(connection, 'individual_applications', 'memberId', memberIds));
    }
    const individualIds = [...(bucket.get('individual_applications')?.keys() || [])];
    const applicationIds = [...new Set([...groupIds, ...individualIds])];
    for (const [table, names] of columns) {
      if (bucket.has(table) && table !== 'group_members') continue;
      const links = [
        ['applicationId', applicationIds],
        ['application_id', applicationIds],
        ['groupApplicationId', groupIds],
        ['individualApplicationId', individualIds],
        ['memberId', memberIds],
      ];
      for (const [column, values] of links) {
        if (!names.has(column) || !values.length) continue;
        if (table === 'group_members' && column === 'applicationId') {
          const owned = [...(bucket.get('group_applications')?.keys() || [])];
          addRows(bucket, table, await selectIn(connection, table, column, owned));
          continue;
        }
        addRows(bucket, table, await selectIn(connection, table, column, values));
      }
    }
    return [...bucket.entries()].map(([name, rows]) => ({ name, rows: [...rows.values()] }));
  } finally {
    connection.release();
  }
}

function send(res, status, origin, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders(origin) });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }
  const url = new URL(req.url || '/', 'http://records.local');
  if (url.pathname !== '/records') {
    send(res, 404, origin, { ok: false });
    return;
  }
  try {
    const token = bearer(req.headers.authorization);
    const tables = await recordsForToken(token);
    if (!tables) {
      send(res, 401, origin, { ok: false, detail: 'Sign in again to refresh the records on this phone.' });
      return;
    }
    let loansTables = [];
    const loansHeader = req.headers['x-loans-authorization'];
    if (PORTAL === 'majuu' && loansHeader) {
      try {
        const response = await fetch('http://uwezo-prod-web:3015/records', {
          headers: { Authorization: String(loansHeader), Accept: 'application/json' },
          signal: AbortSignal.timeout(20000),
        });
        const data = await response.json();
        if (data?.ok && Array.isArray(data.tables)) loansTables = data.tables;
      } catch {
        loansTables = [];
      }
    }
    send(res, 200, origin, { ok: true, tables, loansTables });
  } catch {
    send(res, 500, origin, { ok: false, detail: 'Records could not be read.' });
  }
});

server.listen(PORT, '0.0.0.0');
