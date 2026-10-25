import { Capacitor, CapacitorHttp } from '@capacitor/core';

export type LmsRole = 'constituency' | 'headquarters' | 'secretariat' | 'accountant' | 'staff';

const CACHE_KEY = 'uwezo.lms.cache';

export type LmsPage = { id: string; group: string; title: string; path: string };

export type LmsSummary = { label: string; value: string; note: string };
export type LmsTable = { title: string; headers: string[]; rows: string[][] };
export type LmsField = { key: string; label: string; value: string };
export type LmsPageView = { summary: LmsSummary[]; tables: LmsTable[]; notes: string[]; fields: LmsField[]; actions: string[] };
export type LmsMapping = { found: boolean; role: LmsRole; constituency: string; base: string };
export type LmsCompareRow = { label: string; server: string; phone: string; different: boolean };

export type LmsCache = {
  email: string;
  role: LmsRole;
  fetchedAt: string;
  detail: string;
  pages: Record<string, LmsPageView>;
  menu?: LmsPage[];
  host?: string;
  cookie?: string;
};

const LMS_HOSTS = ['https://lms.uwezo.go.ke', 'https://lms-staging.uwezo.go.ke'];

const CONSTITUENCY_SUFFIXES: { id: string; group: string; title: string; suffix: string }[] = [
  { id: 'dashboard', group: 'Constituency', title: 'Dashboard', suffix: '/dashboard' },
  { id: 'groups', group: 'Groups', title: 'Groups Information', suffix: '/groups' },
  { id: 'group-members', group: 'Groups', title: 'Group Members', suffix: '/groups/members' },
  { id: 'contagious', group: 'Groups', title: 'Contagious Members', suffix: '/groups/multi-group-members' },
  { id: 'loan-phase', group: 'Loans', title: 'Loan Phase', suffix: '/loans/phases' },
  { id: 'group-loans', group: 'Loans', title: 'Group Loans', suffix: '/loans' },
  { id: 'receipts', group: 'Loans', title: 'Receipts', suffix: '/loans/receipts' },
  { id: 'applications', group: 'Applications', title: 'Applications', suffix: '/applications' },
  { id: 'tasks', group: 'Applications', title: 'Tasks', suffix: '/applications/phases' },
  { id: 'applied-loans', group: 'Applications', title: 'Applied Loans', suffix: '/applications/loans' },
  { id: 'upload', group: 'Reports', title: 'Upload Data', suffix: '/reports/data-upload' },
  { id: 'volume', group: 'Reports', title: 'Apps by Constituency', suffix: '/reports/application-volume' },
  { id: 'report', group: 'Reports', title: 'Generate Report', suffix: '/reports/dynamic-report' },
  { id: 'ledger', group: 'Reports', title: 'Loan Submission / Ledger (F.5)', suffix: '/reports/loan-sub-form' },
  { id: 'restore', group: 'Reports', title: 'Restore Deleted Data', suffix: '/reports/restore-deleted-data' },
  { id: 'audit', group: 'Reports', title: 'Audit Trail', suffix: '/reports/audit-trail' },
  { id: 'disbursement', group: 'Reports', title: 'Disbursement Reports', suffix: '/reports/disbursement' },
  { id: 'sector', group: 'Reports', title: 'Sectoral Analysis', suffix: '/reports/dynamic-report?view=sector' },
  { id: 'users', group: 'County', title: 'Users', suffix: '/../users' },
  { id: 'add-user', group: 'County', title: 'Add User', suffix: '/../users/add' },
  { id: 'county-audit', group: 'County', title: 'County Audit Trail', suffix: '/../audit-trail' },
  { id: 'help', group: 'Help', title: 'Help', suffix: '/help' },
];

export function constituencyMenu(basePath: string): LmsPage[] {
  const base = basePath.replace(/\/$/, '');
  const county = base.split('/').filter(Boolean)[0] || '';
  return CONSTITUENCY_SUFFIXES.flatMap((item) => {
    if (item.suffix === '/help') return [{ id: item.id, group: item.group, title: item.title, path: '/help' }];
    if (!base) {
      if (item.id === 'dashboard') return [{ id: item.id, group: item.group, title: item.title, path: '/dashboard' }];
      return [];
    }
    if (item.suffix.startsWith('/../')) {
      return county ? [{ id: item.id, group: item.group, title: item.title, path: `/${county}${item.suffix.slice(3)}` }] : [];
    }
    const suffix = item.suffix.split('?')[0];
    return [{ id: item.id, group: item.group, title: item.title, path: `${base}${suffix}` }];
  });
}

export const LMS_PAGES: Record<LmsRole, LmsPage[]> = {
  constituency: constituencyMenu(''),
  headquarters: [
    { id: 'dashboard', group: 'Headquarters', title: 'HQ Dashboard', path: '/dashboard' },
    { id: 'applications', group: 'Submissions', title: 'Applications', path: '/hq/applications' },
    { id: 'tasks', group: 'Submissions', title: 'Approval Tasks', path: '/hq/applications/approval-tasks' },
    { id: 'allocations', group: 'Headquarters', title: 'Allocations', path: '/hq/allocations' },
    { id: 'groups', group: 'Groups', title: 'Groups', path: '/hq/groups/list' },
    { id: 'group-loans', group: 'Loans', title: 'Group Loans', path: '/hq/loans/group-loans' },
    { id: 'receipts', group: 'Loans', title: 'Receipts', path: '/hq/loans/receipts' },
    { id: 'volume', group: 'Reports', title: 'Apps by Constituency', path: '/hq/reports/application-volume' },
    { id: 'report', group: 'Reports', title: 'Generate Report', path: '/hq/reports' },
    { id: 'aging', group: 'Headquarters', title: 'Phase Aging', path: '/phase-aging' },
    { id: 'help', group: 'Help', title: 'Help', path: '/help' },
  ],
  secretariat: [
    { id: 'phases', group: 'Secretariat', title: 'Phases', path: '/secretariat/phases' },
    { id: 'dashboard', group: 'Secretariat', title: 'National Dashboard', path: '/dashboard?national=1' },
    { id: 'volume', group: 'Reports', title: 'Application Volume', path: '/secretariat/application-volume' },
    { id: 'help', group: 'Help', title: 'Help', path: '/help' },
  ],
  accountant: [
    { id: 'phases', group: 'Accounts', title: 'Phases for Payment', path: '/accountant/phases' },
    { id: 'help', group: 'Help', title: 'Help', path: '/help' },
  ],
  staff: [
    { id: 'dashboard', group: 'LMS', title: 'Dashboard', path: '/dashboard' },
    { id: 'help', group: 'Help', title: 'Help', path: '/help' },
  ],
};

export function roleLabel(role: LmsRole): string {
  if (role === 'headquarters') return 'headquarters';
  if (role === 'accountant') return 'accountant';
  if (role === 'secretariat') return 'secretariat';
  if (role === 'constituency') return 'constituency officer';
  return 'staff';
}

export function loadLmsCache(email: string): LmsCache | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || '') as LmsCache;
    if (parsed.email !== email) return null;
    const pages: Record<string, LmsPageView> = {};
    for (const [path, value] of Object.entries(parsed.pages || {})) {
      if (value && typeof value === 'object' && Array.isArray((value as LmsPageView).tables)) pages[path] = value;
    }
    return { ...parsed, pages };
  } catch {
    return null;
  }
}

export function saveLmsCache(cache: LmsCache) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

function roleFromPage(url: string, html: string): LmsRole {
  let path = url;
  try {
    path = new URL(url, 'https://lms.uwezo.go.ke').pathname;
  } catch {
    path = url;
  }
  if (path.startsWith('/accountant')) return 'accountant';
  if (path.startsWith('/secretariat')) return 'secretariat';
  if (path.startsWith('/hq') || /href="[^"]*\/hq\//.test(html)) return 'headquarters';
  if (constituencyBase(url)) return 'constituency';
  return 'staff';
}

function constituencyBase(value: string): string {
  const match = /\/([a-z0-9-]+)\/([a-z0-9-]+)\/dashboard/i.exec(value);
  return match ? `/${match[1]}/${match[2]}` : '';
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&times;/g, ' ')
    .replace(/&rarr;|&larr;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCharCode(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, digits: string) => String.fromCharCode(parseInt(digits, 16)))
    .replace(/&amp;/g, '&');
}

function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function humanize(key: string): string {
  const last = key.split('.').pop() || key;
  return last.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
}

function fieldKey(attrs: string): string {
  return /wire:model(?:\.[\w.]+)?="([^"]+)"/.exec(attrs)?.[1] || '';
}

export function pageFields(html: string): LmsField[] {
  const body = contentHtml(html);
  const fields: LmsField[] = [];
  const choices = new Map<string, string[]>();
  const pushChoice = (attrs: string) => {
    const key = fieldKey(attrs);
    if (!key || key === 'selectedColumns') return;
    const type = (/type="([^"]+)"/i.exec(attrs)?.[1] || '').toLowerCase();
    if (type !== 'checkbox' && type !== 'radio') return;
    if (!/\schecked(?:\s|=|>|$)/i.test(attrs)) return;
    const value = decodeEntities(/value="([^"]*)"/.exec(attrs)?.[1] || 'yes');
    const list = choices.get(key) || [];
    list.push(value);
    choices.set(key, list);
  };
  for (const match of body.matchAll(/<input\b([^>]*)>/gi)) {
    const attrs = match[1];
    const type = (/type="([^"]+)"/i.exec(attrs)?.[1] || 'text').toLowerCase();
    if (type === 'checkbox' || type === 'radio') {
      pushChoice(attrs);
      continue;
    }
    if (type === 'hidden' || type === 'password' || type === 'file' || type === 'submit' || type === 'button') continue;
    const key = fieldKey(attrs);
    if (!key || key === '_token') continue;
    fields.push({ key, label: humanize(key), value: decodeEntities(/value="([^"]*)"/.exec(attrs)?.[1] || '') });
  }
  for (const match of body.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/gi)) {
    const key = fieldKey(match[1]);
    if (!key) continue;
    fields.push({ key, label: humanize(key), value: textOf(match[2]) });
  }
  for (const match of body.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    const key = fieldKey(match[1]);
    if (!key) continue;
    const selected = /<option\b[^>]*selected[^>]*>([\s\S]*?)<\/option>/i.exec(match[2]);
    fields.push({ key, label: humanize(key), value: textOf(selected?.[1] || '') });
  }
  for (const [key, values] of choices) fields.push({ key, label: humanize(key), value: values.join(', ') });
  const seen = new Set<string>();
  return fields.filter((field) => {
    if (seen.has(field.key)) return false;
    seen.add(field.key);
    return true;
  }).slice(0, 40);
}

export function pageActions(html: string): string[] {
  const body = contentHtml(html);
  const found: string[] = [];
  for (const match of body.matchAll(/wire:(?:click|submit)(?:\.[\w.]+)?="([A-Za-z_][\w]*)/g)) {
    const name = match[1];
    if (found.includes(name) || /^(toggle|select|clear|remove|reset|open|close|show|hide|set|updated)/i.test(name)) continue;
    if (/save|submit|update|store|create|approve|reject|restore|generate|preview|lock|unlock|pay|confirm|delete|upload/i.test(name)) found.push(name);
  }
  return found.slice(0, 8);
}

function contentHtml(html: string): string {
  const marked = /<div class="content-wrapper">([\s\S]*?)<\/div>\s*<!-- \/\.content-wrapper -->/i.exec(html);
  const start = html.search(/<div class="content-wrapper">/i);
  const end = html.search(/<footer class="main-footer/i);
  const body = marked?.[1] || (start >= 0 && end > start ? html.slice(start, end) : html);
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<ol class="breadcrumb[\s\S]*?<\/ol>/gi, ' ');
}

export function pageView(html: string): LmsPageView {
  const body = contentHtml(html);
  const summary: LmsSummary[] = [];
  for (const match of body.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>([\s\S]{0,700}?)<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const value = textOf(match[1]);
    const label = textOf(match[3]);
    const note = textOf(match[2].match(/<small[^>]*>([\s\S]*?)<\/small>/i)?.[1] || '');
    if (label || value) summary.push({ label: label || 'Figure', value, note });
  }
  for (const match of body.matchAll(/class="info-box-text"[^>]*>([\s\S]*?)<\/span>/gi)) {
    const label = textOf(match[1]);
    if (label) summary.push({ label, value: '', note: 'Assigned' });
  }
  const tables: LmsTable[] = [];
  for (const match of body.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const block = match[0];
    const headers = [...block.matchAll(/<th[\s\S]*?>([\s\S]*?)<\/th>/gi)].map((cell) => textOf(cell[1])).filter(Boolean).slice(0, 8);
    const rows = [...block.matchAll(/<tr[\s\S]*?>([\s\S]*?)<\/tr>/gi)].map((row) => (
      [...row[1].matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi)].map((cell) => textOf(cell[1]).slice(0, 120)).slice(0, 8)
    )).filter((cells) => cells.some(Boolean)).slice(0, 30);
    if (headers.length || rows.length) {
      const caption = textOf(block.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i)?.[1] || '');
      tables.push({ title: caption, headers, rows });
    }
    if (tables.length >= 3) break;
  }
  const notes = summary.length || tables.length
    ? []
    : [...body.matchAll(/<(?:h3|h5|p)[^>]*>([\s\S]*?)<\/(?:h3|h5|p)>/gi)]
      .map((item) => textOf(item[1]))
      .filter((item) => item.length > 20 && item.length < 280)
      .slice(0, 5);
  const seen = new Set<string>();
  return {
    summary: summary.filter((item) => {
      const key = `${item.label}|${item.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8),
    tables,
    notes,
    fields: pageFields(html),
    actions: pageActions(html),
  };
}

export function reportMethod(path: string): string {
  if (path.includes('application-volume')) return 'previewReport';
  if (path.includes('dynamic-report') || path.endsWith('/reports') || path.endsWith('/hq/reports')) return 'generateReport';
  return '';
}

function cookieHeader(setCookie: string): string {
  const kept = new Map<string, string>();
  const pieces = setCookie.split(/,(?=\s*[^;,\s]+=)/);
  for (const piece of pieces) {
    for (const segment of piece.split(';')) {
      const match = /^\s*([A-Za-z0-9_.-]+)=([^;\s].*)$/.exec(segment.trim());
      if (!match) continue;
      const name = match[1];
      const lower = name.toLowerCase();
      if (['path', 'domain', 'expires', 'max-age', 'samesite', 'secure', 'httponly'].includes(lower)) continue;
      if (name === 'XSRF-TOKEN' || name.endsWith('_session')) kept.set(name, match[2].trim());
    }
  }
  return [...kept.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

function bodyText(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data == null) return '';
  try {
    return JSON.stringify(data);
  } catch {
    return '';
  }
}

function headersOf(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value ?? '');
  }
  return out;
}

function sessionCookie(setCookie: string): string {
  const value = cookieHeader(setCookie);
  return /(?:^|; )[A-Za-z0-9_.-]*_session=/.test(value) ? value : '';
}

async function readText(url: string, cookie: string): Promise<{ status: number; url: string; setCookie: string; text: string }> {
  const headers: Record<string, string> = { Accept: 'text/html' };
  if (cookie) headers.Cookie = cookie;
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url,
      headers,
      connectTimeout: 20000,
      readTimeout: 20000,
    });
    const received = headersOf(response.headers);
    return {
      status: response.status,
      url: response.url || url,
      setCookie: received['set-cookie'] || '',
      text: bodyText(response.data),
    };
  }
  const response = await fetch(url, { headers, credentials: 'include', signal: AbortSignal.timeout(20000) });
  return { status: response.status, url: response.url, setCookie: '', text: await response.text() };
}

export async function lmsHostOnline(): Promise<boolean> {
  for (const host of LMS_HOSTS) {
    if (await hostAnswers(host)) return true;
  }
  return false;
}

async function hostAnswers(url: string): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.get({ url: `${url}/login`, connectTimeout: 8000, readTimeout: 8000, disableRedirects: true });
      return response.status > 0 && response.status < 500;
    }
    const response = await fetch(`${url}/login`, { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(8000) });
    return response.status < 500;
  } catch {
    return false;
  }
}

type HostLogin = {
  ok: boolean;
  role: LmsRole;
  cookie: string;
  html: string;
  detail: string;
  account?: { role?: string; constituency?: string; base?: string };
};

async function loginToHost(host: string, email: string, password: string): Promise<HostLogin> {
  const direct = await postForm(
    `${host}/app/password-session`,
    '',
    `${host}/login`,
    `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
  );
  if (direct.status !== 404 && direct.status !== 405) {
    let data: { ok?: boolean; detail?: string; role?: string; constituency?: string; base?: string } = {};
    try {
      data = JSON.parse(direct.text) as typeof data;
    } catch {
      data = {};
    }
    if (direct.status === 429) {
      return { ok: false, role: 'staff', cookie: '', html: '', detail: data.detail || 'Too many sign-in attempts. Wait a minute, then try the same password again.' };
    }
    if (data.ok) {
      return {
        ok: true,
        role: isRole(data.role) ? data.role : 'staff',
        cookie: sessionCookie(direct.setCookie),
        html: '',
        detail: '',
        account: data,
      };
    }
    return {
      ok: false,
      role: 'staff',
      cookie: '',
      html: '',
      detail: data.detail || 'The LMS database did not accept this email and password.',
    };
  }
  const loginPage = await readText(`${host}/login`, '');
  const token = /name="_token"\s+value="([^"]+)"/.exec(loginPage.text)?.[1] || '';
  if (!token) return { ok: false, role: 'staff', cookie: '', html: '', detail: `${host.replace('https://', '')} did not return a sign-in form.` };
  const cookie = cookieHeader(loginPage.setCookie);
  const body = `_token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  const formHeaders: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html', Referer: `${host}/login` };
  if (cookie) formHeaders.Cookie = cookie;
  const posted = Capacitor.isNativePlatform()
    ? await CapacitorHttp.post({
        url: `${host}/login`,
        headers: formHeaders,
        data: body,
        connectTimeout: 20000,
        readTimeout: 20000,
      })
    : await fetch(`${host}/login`, {
        method: 'POST',
        headers: formHeaders,
        body,
        credentials: 'include',
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
      });
  const postedHeaders = Capacitor.isNativePlatform() ? headersOf((posted as { headers?: unknown }).headers) : {};
  const postedStatus = Capacitor.isNativePlatform() ? Number((posted as { status?: number }).status || 0) : (posted as Response).status;
  const postedText = Capacitor.isNativePlatform()
    ? bodyText((posted as { data?: unknown }).data)
    : await (posted as Response).text();
  const location = postedHeaders.location || (Capacitor.isNativePlatform() ? String((posted as { url?: string }).url || '') : (posted as Response).url);
  const session = sessionCookie(postedHeaders['set-cookie'] || '');
  if (postedStatus === 429) {
    return { ok: false, role: 'staff', cookie: '', html: postedText, detail: 'Too many sign-in attempts. Wait a minute, then try the same password again.' };
  }
  const rejected = /credentials do not match|invalid email or password|these credentials|auth\.failed/i.test(postedText) || postedStatus === 422 || postedStatus === 419;
  const returnedToLogin = /\/login\/?(?:\?|$)/.test(location);
  const loginForm = /name="password"/.test(postedText) && /name="email"/.test(postedText) && !/content-wrapper/.test(postedText);
  if (rejected || returnedToLogin || (loginForm && postedStatus !== 302 && postedStatus !== 303)) {
    return { ok: false, role: 'staff', cookie: '', html: postedText, detail: 'The LMS database did not accept this email and password.' };
  }
  if (/content-wrapper/.test(postedText) && !loginForm) {
    return { ok: true, role: roleFromPage(location || `${host}/dashboard`, postedText), cookie: session, html: `${location}\n${postedText}`, detail: '' };
  }
  const nextUrl = location.startsWith('http')
    ? location
    : `${host}${location.startsWith('/') ? location : '/dashboard'}`;
  const landed = await readText(nextUrl, session);
  const landedLogin = /\/login\/?(?:\?|$)/.test(landed.url)
    || (/name="password"/.test(landed.text) && /name="email"/.test(landed.text) && !/content-wrapper/.test(landed.text));
  if (landedLogin) return { ok: false, role: 'staff', cookie: '', html: landed.text, detail: 'The LMS database did not accept this email and password.' };
  const html = `${landed.url}\n${landed.text}`;
  return { ok: true, role: roleFromPage(landed.url || nextUrl, landed.text), cookie: sessionCookie(landed.setCookie) || session, html, detail: '' };
}

function isRole(value: unknown): value is LmsRole {
  return value === 'constituency' || value === 'headquarters' || value === 'secretariat' || value === 'accountant' || value === 'staff';
}

export async function fetchStaffRole(host: string, email: string): Promise<LmsMapping> {
  const empty: LmsMapping = { found: false, role: 'staff', constituency: '', base: '' };
  try {
    const loaded = await readText(`${host}/app/staff-role?email=${encodeURIComponent(email)}`, '');
    const data = JSON.parse(loaded.text) as Partial<LmsMapping>;
    return {
      found: Boolean(data.found),
      role: isRole(data.role) ? data.role : 'staff',
      constituency: typeof data.constituency === 'string' ? data.constituency : '',
      base: typeof data.base === 'string' && /^\/[a-z0-9-]+\/[a-z0-9-]+$/.test(data.base) ? data.base : '',
    };
  } catch {
    return empty;
  }
}

export type OfficerProfile = {
  email: string;
  name: string;
  phone: string;
  idNumber: string;
  role: LmsRole;
  constituency: string;
  base: string;
};

export async function fetchOfficerProfile(host: string, cookie: string, email: string): Promise<OfficerProfile | null> {
  try {
    const loaded = await readText(`${host}/app/me`, cookie);
    const data = JSON.parse(loaded.text) as Partial<OfficerProfile> & { found?: boolean };
    if (!data || data.found === false || !data.role) return null;
    return {
      email: (data.email || email).trim().toLowerCase(),
      name: typeof data.name === 'string' ? data.name : '',
      phone: typeof data.phone === 'string' ? data.phone : '',
      idNumber: typeof data.idNumber === 'string' ? data.idNumber : '',
      role: isRole(data.role) ? data.role : 'staff',
      constituency: typeof data.constituency === 'string' ? data.constituency : '',
      base: typeof data.base === 'string' ? data.base : '',
    };
  } catch {
    return null;
  }
}

export function rememberMappedMenu(email: string, mapped: LmsMapping) {
  if (!mapped.found) return;
  const cached = loadLmsCache(email);
  const menu = mapped.role === 'constituency' ? constituencyMenu(mapped.base) : LMS_PAGES[mapped.role];
  saveLmsCache({
    email,
    role: mapped.role,
    fetchedAt: cached?.fetchedAt || new Date().toISOString(),
    detail: cached?.detail || `Signed in as ${roleLabel(mapped.role)}.`,
    pages: cached?.pages || {},
    menu,
    host: cached?.host,
    cookie: cached?.cookie,
  });
}

async function downloadMenu(
  host: string,
  email: string,
  role: LmsRole,
  base: string,
  constituency: string,
  cookie: string,
  lead: string,
): Promise<{ role: LmsRole; detail: string; constituency: string }> {
  const menu = role === 'constituency' ? constituencyMenu(base) : LMS_PAGES[role];
  const pages: Record<string, LmsPageView> = {};
  const seen = new Set<string>();
  let nextCookie = cookie;
  for (const page of menu) {
    if (!page.path || seen.has(page.path)) continue;
    seen.add(page.path);
    const loaded = await readText(`${host}${page.path}`, nextCookie);
    if (/\/login\/?(?:\?|$)/.test(loaded.url)) continue;
    nextCookie = cookieHeader(`${nextCookie}; ${loaded.setCookie}`) || nextCookie;
    pages[page.path] = pageView(loaded.text);
  }
  const detail = `${lead} Signed in to ${host.replace('https://', '')} as ${roleLabel(role)}. Figures and tables from each page are saved on this phone.`;
  const name = constituency || (role === 'constituency' ? (base.split('/').filter(Boolean)[1]?.replace(/-/g, ' ') || '') : '');
  saveLmsCache({ email, role, fetchedAt: new Date().toISOString(), detail, pages, menu, host, cookie: nextCookie });
  return { role, detail, constituency: name };
}

export async function syncLmsMailbox(email: string, password: string, options?: { refresh?: boolean }): Promise<{ authenticated: boolean; role: LmsRole; detail: string; constituency: string }> {
  const cached = loadLmsCache(email);
  let lastDetail = 'lms.uwezo.go.ke did not answer.';
  try {
    for (const host of LMS_HOSTS) {
      if (!(await hostAnswers(host))) continue;
      const signed = await loginToHost(host, email, password);
      if (!signed.ok) {
        lastDetail = signed.detail;
        continue;
      }
      const mapped = signed.account?.role
        ? {
            found: true,
            role: isRole(signed.account.role) ? signed.account.role : signed.role,
            constituency: signed.account.constituency || '',
            base: signed.account.base && /^\/[a-z0-9-]+\/[a-z0-9-]+$/.test(signed.account.base) ? signed.account.base : '',
          }
        : await fetchStaffRole(host, email);
      const landedUrl = signed.html.split('\n')[0] || '';
      const base = mapped.base || constituencyBase(landedUrl);
      const role = mapped.found ? mapped.role : signed.role;
      const keepPages = options?.refresh === false && cached && Object.keys(cached.pages || {}).length > 0;
      if (keepPages) {
        const menu = role === 'constituency' ? constituencyMenu(base) : LMS_PAGES[role];
        const detail = `Signed in to ${host.replace('https://', '')} as ${roleLabel(role)}. Officer details on this phone are still within 15 days.`;
        saveLmsCache({ ...cached, email, role, menu, host, cookie: signed.cookie, detail, fetchedAt: cached.fetchedAt });
        return { authenticated: true, role, detail, constituency: mapped.constituency };
      }
      try {
        const saved = await downloadMenu(host, email, role, base, mapped.constituency, signed.cookie, 'Signed in.');
        return { authenticated: true, role: saved.role, detail: saved.detail, constituency: saved.constituency };
      } catch {
        const menu = role === 'constituency' ? constituencyMenu(base) : LMS_PAGES[role];
        const detail = `Signed in to ${host.replace('https://', '')} as ${roleLabel(role)}. The page copy will finish when the connection is steady.`;
        saveLmsCache({ email, role, fetchedAt: new Date().toISOString(), detail, pages: cached?.pages || {}, menu, host, cookie: signed.cookie });
        return { authenticated: true, role, detail, constituency: mapped.constituency };
      }
    }
    return {
      authenticated: false,
      role: cached?.role || 'staff',
      constituency: '',
      detail: cached ? `${lastDetail} The last copy on this phone is kept.` : lastDetail,
    };
  } catch {
    return {
      authenticated: false,
      role: cached?.role || 'staff',
      constituency: '',
      detail: cached
        ? 'lms.uwezo.go.ke did not answer. This phone is showing the last downloaded copy.'
        : 'lms.uwezo.go.ke did not answer.',
    };
  }
}

async function postForm(url: string, cookie: string, referer: string, body: string): Promise<{ status: number; setCookie: string; text: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', Referer: referer };
  if (cookie) headers.Cookie = cookie;
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.post({
      url,
      headers,
      data: body,
      connectTimeout: 20000,
      readTimeout: 20000,
      disableRedirects: true,
    });
    const received = headersOf(response.headers);
    return { status: response.status, setCookie: received['set-cookie'] || '', text: bodyText(response.data) };
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
    credentials: 'include',
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
  });
  return { status: response.status, setCookie: response.headers.get('set-cookie') || '', text: await response.text() };
}

export async function openLmsFromZimbra(email: string, token: string): Promise<{ authenticated: boolean; role: LmsRole; detail: string; constituency: string }> {
  const cached = loadLmsCache(email);
  let last = 'The LMS did not open this mailbox session.';
  try {
    for (const host of LMS_HOSTS) {
      if (!(await hostAnswers(host))) continue;
      const posted = await postForm(
        `${host}/app/zimbra-session`,
        '',
        `${host}/login`,
        `email=${encodeURIComponent(email)}&authToken=${encodeURIComponent(token)}`,
      );
      let data: { ok?: boolean; role?: string; constituency?: string; base?: string; detail?: string; found?: boolean } = {};
      try {
        data = JSON.parse(posted.text) as typeof data;
      } catch {
        data = {};
      }
      if (!data.ok) {
        last = data.detail || (posted.status === 404 ? 'The LMS has no mailbox session yet.' : 'The LMS did not accept this mailbox.');
        const mapped = await fetchStaffRole(host, email);
        if (mapped.found) rememberMappedMenu(email, mapped);
        continue;
      }
      const role = isRole(data.role) ? data.role : 'staff';
      const saved = await downloadMenu(
        host,
        email,
        role,
        typeof data.base === 'string' ? data.base : '',
        data.constituency || '',
        cookieHeader(posted.setCookie),
        'Signed in with the mailbox.',
      );
      return { authenticated: true, role: saved.role, detail: saved.detail, constituency: saved.constituency };
    }
  } catch {
    last = 'lms.uwezo.go.ke did not answer.';
  }
  return { authenticated: false, role: cached?.role || 'staff', constituency: '', detail: cached ? `${last} The last copy on this phone is kept.` : last };
}

function xsrfToken(cookie: string): string {
  const raw = /XSRF-TOKEN=([^;]+)/.exec(cookie)?.[1] || '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function postJson(url: string, cookie: string, referer: string, data: unknown): Promise<{ status: number; text: string }> {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Livewire': '',
    Cookie: cookie,
    'X-XSRF-TOKEN': xsrfToken(cookie),
    Referer: referer,
  };
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.post({ url, headers, data, connectTimeout: 30000, readTimeout: 45000 });
    const raw = response.data;
    return { status: response.status, text: typeof raw === 'string' ? raw : JSON.stringify(raw ?? '') };
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
    credentials: 'include',
    signal: AbortSignal.timeout(45000),
  });
  return { status: response.status, text: await response.text() };
}

export const REPORT_FIELDS: { key: string; label: string; group: string }[] = [
  { key: 'groups.name', label: 'Group name', group: 'Groups' },
  { key: 'groups.code', label: 'Group code', group: 'Groups' },
  { key: 'groups.reg_number', label: 'Registration number', group: 'Groups' },
  { key: 'groups.bank', label: 'Bank', group: 'Groups' },
  { key: 'groups.account', label: 'Account', group: 'Groups' },
  { key: 'location.ward_name', label: 'Ward', group: 'Groups' },
  { key: 'location.constituency_name', label: 'Constituency', group: 'Groups' },
  { key: 'location.county_name', label: 'County', group: 'Groups' },
  { key: 'group_loans.loan_status', label: 'Loan status', group: 'Loans' },
  { key: 'group_loans.sector', label: 'Sector', group: 'Loans' },
  { key: 'group_loans.category', label: 'Category', group: 'Loans' },
  { key: 'group_loans.amount_applied', label: 'Amount applied', group: 'Loans' },
  { key: 'group_loans.amount_approved', label: 'Amount approved', group: 'Loans' },
  { key: 'group_loans.amount_issued', label: 'Amount issued', group: 'Loans' },
  { key: 'group_loans.amount_repaid', label: 'Amount repaid', group: 'Loans' },
  { key: 'group_loans.total_arrears', label: 'Arrears', group: 'Loans' },
  { key: 'group_loans.disbursement_date', label: 'Disbursement date', group: 'Loans' },
  { key: 'members.name', label: 'Member name', group: 'Members' },
  { key: 'members.number', label: 'Phone', group: 'Members' },
  { key: 'members.gender', label: 'Gender', group: 'Members' },
  { key: 'financed_loans_filter', label: 'Financed loans', group: 'Filter' },
  { key: 'all_loans_filter', label: 'All loans', group: 'Filter' },
  { key: 'pending_loans_filter', label: 'Pending disbursements', group: 'Filter' },
  { key: 'fully_repaid', label: 'Fully repaid', group: 'Filter' },
];

export const DEFAULT_REPORT_COLUMNS = [
  'groups.name',
  'groups.code',
  'location.constituency_name',
  'group_loans.loan_status',
  'group_loans.amount_issued',
  'group_loans.amount_repaid',
  'financed_loans_filter',
];

const DRAFT_KEY = 'uwezo.lms.drafts.v1';
const emptyView = (): LmsPageView => ({ summary: [], tables: [], notes: [], fields: [], actions: [] });

function draftId(email: string, path: string): string {
  return `${email.trim().toLowerCase()}|${path}`;
}

export function loadLmsDraft(email: string, path: string): Record<string, string> {
  try {
    const all = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') as Record<string, { values?: Record<string, string> }>;
    return all[draftId(email, path)]?.values || {};
  } catch {
    return {};
  }
}

export function saveLmsDraft(email: string, path: string, values: Record<string, string>) {
  let all: Record<string, unknown> = {};
  try {
    all = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') as Record<string, unknown>;
  } catch {
    all = {};
  }
  all[draftId(email, path)] = { values, savedAt: new Date().toISOString() };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(all));
}

function reportColumnSet(html: string): Set<string> {
  const selected = new Set<string>();
  for (const match of contentHtml(html).matchAll(/<input\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/selectedColumns/.test(tag) || !/\schecked(?:\s|=|>|$)/i.test(tag)) continue;
    const value = decodeEntities(/value="([^"]+)"/.exec(tag)?.[1] || '');
    if (value) selected.add(value);
  }
  return selected;
}

function columnList(values: Record<string, string>): string[] {
  const raw = (values.selectedColumns || DEFAULT_REPORT_COLUMNS.join(','))
    .split(',')
    .map((item) => item.trim())
    .filter((item) => REPORT_FIELDS.some((field) => field.key === item));
  const selected = raw.length ? raw : [...DEFAULT_REPORT_COLUMNS];
  if (!selected.some((key) => REPORT_FIELDS.find((field) => field.key === key)?.group !== 'Filter')) {
    selected.push('groups.name', 'group_loans.amount_issued');
  }
  return [...new Set(selected)];
}

function reportLabel(key: string): string {
  return REPORT_FIELDS.find((field) => field.key === key)?.label || humanize(key);
}

export async function reviewLmsDraft(email: string, path: string, values: Record<string, string>): Promise<{ ok: boolean; detail: string; rows: LmsCompareRow[] }> {
  const cache = loadLmsCache(email);
  if (!cache?.host || !cache.cookie) return { ok: false, detail: 'Sign in to the LMS again, then compare this page.', rows: [] };
  const loaded = await readText(`${cache.host}${path}`, cache.cookie);
  const expired = /\/login\/?(?:\?|$)/.test(loaded.url) || (/name="_token"/.test(loaded.text) && !/content-wrapper/.test(loaded.text));
  if (expired) return { ok: false, detail: 'The LMS sign-in expired. Refresh the pages and try again.', rows: [] };
  const cookie = cookieHeader(`${cache.cookie}; ${loaded.setCookie}`) || cache.cookie;
  saveLmsCache({ ...cache, cookie, pages: { ...cache.pages, [path]: pageView(loaded.text) } });
  const rows = reportMethod(path) === 'generateReport' ? compareReport(loaded.text, values) : compareFields(loaded.text, values);
  const different = rows.some((row) => row.different);
  return {
    ok: true,
    detail: different
      ? 'Some values saved on this phone differ from the LMS. Change them, or submit the phone copy.'
      : 'The copy on this phone matches the LMS. You can still submit it.',
    rows,
  };
}

function compareReport(html: string, values: Record<string, string>): LmsCompareRow[] {
  const server = reportColumnSet(html);
  const phone = new Set(columnList(values));
  return REPORT_FIELDS.filter((field) => server.has(field.key) || phone.has(field.key)).map((field) => ({
    label: field.label,
    server: server.has(field.key) ? 'Selected' : 'Not selected',
    phone: phone.has(field.key) ? 'Selected' : 'Not selected',
    different: server.has(field.key) !== phone.has(field.key),
  }));
}

function compareFields(html: string, values: Record<string, string>): LmsCompareRow[] {
  const server = new Map(pageFields(html).map((field) => [field.key, field.value]));
  return Object.entries(values).filter(([key]) => key && !key.startsWith('__')).map(([key, phone]) => {
    const current = server.get(key) || '';
    return { label: reportLabel(key), server: current || '—', phone: phone || '—', different: current !== phone };
  });
}

function componentSnapshot(html: string, hint: string): string {
  const snaps = [...contentHtml(html).matchAll(/wire:snapshot="([^"]+)"/g)].map((match) => decodeEntities(match[1]));
  const score = (snapshot: string) => {
    let value = snapshot.length / 10000;
    if (hint && snapshot.includes(hint)) value += 50;
    if (snapshot.includes('selectedColumns') || snapshot.includes('previewRows') || snapshot.includes('hasPreview')) value += 20;
    return value;
  };
  return snaps.sort((left, right) => score(right) - score(left))[0] || '';
}

function livewireToast(text: string): string {
  try {
    const data = JSON.parse(text) as {
      message?: string;
      components?: { effects?: { dispatches?: { params?: unknown }[] } }[];
    };
    const dispatches = data.components?.[0]?.effects?.dispatches || [];
    for (const item of dispatches) {
      const params = item.params;
      const bag = Array.isArray(params) ? params[0] : params;
      if (bag && typeof bag === 'object' && 'message' in bag && typeof (bag as { message?: unknown }).message === 'string') {
        return (bag as { message: string }).message;
      }
    }
    if (typeof data.message === 'string' && data.message.length < 240 && !/stack trace/i.test(data.message)) return data.message;
  } catch {
    return '';
  }
  return '';
}

function livewireUpdates(path: string, values: Record<string, string>, html: string): Record<string, unknown> {
  if (reportMethod(path) === 'generateReport') return { selectedColumns: columnList(values) };
  const allowed = new Set(pageFields(html).map((field) => field.key));
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!key || key.startsWith('__') || !allowed.has(key)) continue;
    updates[key] = value;
  }
  return updates;
}

export async function runLmsAction(
  email: string,
  path: string,
  values: Record<string, string>,
): Promise<{ ok: boolean; detail: string; view: LmsPageView }> {
  const cache = loadLmsCache(email);
  const current = cache?.pages[path] || emptyView();
  if (!cache?.host || !cache.cookie) return { ok: false, detail: 'Sign in to the LMS again, then submit this page.', view: current };
  const pageUrl = `${cache.host}${path}`;
  const loaded = await readText(pageUrl, cache.cookie);
  const expired = /\/login\/?(?:\?|$)/.test(loaded.url) || (/name="_token"/.test(loaded.text) && !/content-wrapper/.test(loaded.text));
  if (expired) return { ok: false, detail: 'The LMS sign-in expired. Refresh the pages and try again.', view: current };
  const known = new Set([reportMethod(path), ...pageActions(loaded.text)].filter(Boolean));
  const requested = values.__action || '';
  const method = requested && known.has(requested) ? requested : (reportMethod(path) || pageActions(loaded.text)[0] || '');
  if (!method) return { ok: false, detail: 'This page has no submit action in the app. Refresh it, or open it on the LMS for a file upload.', view: pageView(loaded.text) };
  const snapshot = componentSnapshot(loaded.text, method);
  const token = /csrf-token"\s+content="([^"]+)"/.exec(loaded.text)?.[1] || /name="_token"\s+value="([^"]+)"/.exec(loaded.text)?.[1] || '';
  if (!snapshot || !token) return { ok: false, detail: 'This page did not include a save action.', view: pageView(loaded.text) };
  const cookie = cookieHeader(`${cache.cookie}; ${loaded.setCookie}`) || cache.cookie;
  const posted = await postJson(`${cache.host}/livewire/update`, cookie, pageUrl, {
    _token: token,
    components: [{ snapshot, updates: livewireUpdates(path, values, loaded.text), calls: [{ path: '', method, params: [] }] }],
  });
  let html = '';
  try {
    const data = JSON.parse(posted.text) as { components?: { effects?: { html?: string } }[] };
    html = data.components?.[0]?.effects?.html || '';
  } catch {
    html = '';
  }
  const toast = livewireToast(posted.text);
  const failed = /must select|unauthorised|unauthorized|unexpected error|invalid selection|not authorised/i.test(toast);
  if (!html || failed) {
    return {
      ok: false,
      detail: toast || (posted.status === 419
        ? 'The LMS sign-in expired. Refresh the pages and try again.'
        : 'The LMS did not return the updated page.'),
      view: html ? pageView(html) : pageView(loaded.text),
    };
  }
  const view = pageView(html);
  saveLmsCache({ ...cache, cookie, pages: { ...cache.pages, [path]: view } });
  const count = view.tables.reduce((sum, table) => sum + table.rows.length, 0);
  return {
    ok: true,
    detail: toast || (count ? `Submitted. ${count} rows are on this phone.` : 'Submitted to the LMS.'),
    view,
  };
}

export async function generateLmsReport(email: string, path: string): Promise<{ ok: boolean; detail: string; view: LmsPageView }> {
  const draft = loadLmsDraft(email, path);
  const values = reportMethod(path) === 'generateReport'
    ? { ...draft, selectedColumns: draft.selectedColumns || DEFAULT_REPORT_COLUMNS.join(',') }
    : draft;
  return runLmsAction(email, path, values);
}
