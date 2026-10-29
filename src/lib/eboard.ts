import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { openExternal } from './openLink';

// #region agent log
function dbgEboard(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown> = {},
) {
  const payload = JSON.stringify({
    sessionId: '9becc5',
    runId: 'eboard-login',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  });
  const headers = { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '9becc5' };
  fetch('http://127.0.0.1:7591/ingest/fc16f6e6-2411-411d-be27-2c94d7813f56', {
    method: 'POST',
    headers,
    body: payload,
  }).catch(() => {});
  fetch('https://loans.uwezo.go.ke/uwezo-app/__dbg', { method: 'POST', headers, body: payload }).catch(
    () => {},
  );
  if (Capacitor.isNativePlatform()) {
    void CapacitorHttp.post({
      url: 'https://loans.uwezo.go.ke/uwezo-app/__dbg',
      headers,
      data: payload,
      connectTimeout: 4000,
      readTimeout: 4000,
    }).catch(() => {});
  }
}
// #endregion

/**
 * Live public host is 41.76.170.244. TLS cert SAN is only IP:197.248.181.146, so
 * HTTPS to .244 always fails verification; .146 itself is often unreachable.
 * Prefer HTTP to .244 first (Android cleartext allowed in network_security_config).
 * Never show these in UI.
 */
const EBOARD_HTTP_CANDIDATES = [
  'http://41.76.170.244/eboard',
  'http://197.248.181.146/eboard',
] as const;

const EBOARD_HTTPS_CANDIDATES = [
  // Cert matches this IP only — useful if/when .146 is routable again.
  'https://197.248.181.146/eboard',
  // Kept last: TCP may open, but cert verification fails (SAN mismatch).
  'https://41.76.170.244/eboard',
] as const;

const CACHE_KEY = 'uwezo.eboard.base.v1';

/** @deprecated Prefer resolveEboardBase(); kept as sync fallback for URL builders. */
export const EBOARD_PUBLIC_BASE = EBOARD_HTTP_CANDIDATES[0];

let memoryBase: string | null = null;

/** Last probe outcome for UI errors (no secrets). */
export type EboardProbeStatus = {
  reachable: boolean;
  accepted: boolean;
  host: string;
  detail: string;
};

let lastEboardProbeStatus: EboardProbeStatus = {
  reachable: false,
  accepted: false,
  host: '',
  detail: '',
};

export function getLastEboardProbeStatus(): EboardProbeStatus {
  return { ...lastEboardProbeStatus };
}

function setLastEboardProbeStatus(next: Partial<EboardProbeStatus>) {
  lastEboardProbeStatus = { ...lastEboardProbeStatus, ...next };
}

export type EboardDeepLink =
  | { kind: 'meeting'; meetingId: string; action: string }
  | { kind: 'rsvp'; meetingId: string; inviteId: string }
  | { kind: 'join'; meetingId: string }
  | { kind: 'home' };

function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, '');
}

function loadCachedBase(): string | null {
  if (memoryBase) return memoryBase;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw && /^https?:\/\//i.test(raw)) {
      memoryBase = raw;
      return raw;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function storeCachedBase(base: string) {
  memoryBase = base;
  try {
    sessionStorage.setItem(CACHE_KEY, base);
  } catch {
    /* ignore */
  }
}

/** Pull name=value pairs from Set-Cookie header(s) for the next request. */
function cookieHeaderFromSetCookie(headers: Record<string, string>): string {
  const raw =
    headers['set-cookie'] ||
    headers['Set-Cookie'] ||
    Object.entries(headers)
      .filter(([k]) => k.toLowerCase() === 'set-cookie')
      .map(([, v]) => v)
      .join(',');
  if (!raw) return '';
  const parts: string[] = [];
  for (const segment of String(raw).split(/,(?=\s*[^;,]+=)/)) {
    const nv = segment.split(';')[0]?.trim();
    if (nv && nv.includes('=')) parts.push(nv);
  }
  return parts.join('; ');
}

async function httpGet(
  url: string,
  timeoutMs: number,
): Promise<{ status: number; text: string; headers: Record<string, string>; cookie: string }> {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url,
      connectTimeout: timeoutMs,
      readTimeout: timeoutMs,
      disableRedirects: false,
    });
    const headers: Record<string, string> = {};
    const raw = response.headers || {};
    for (const [key, value] of Object.entries(raw)) {
      headers[key.toLowerCase()] = String(value);
    }
    return {
      status: response.status || 0,
      text: typeof response.data === 'string' ? response.data : JSON.stringify(response.data ?? ''),
      headers,
      cookie: cookieHeaderFromSetCookie(headers),
    };
  }
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    redirect: 'follow',
    credentials: 'include',
    signal: AbortSignal.timeout(timeoutMs),
  });
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return {
    status: response.status,
    text: await response.text(),
    headers,
    cookie: cookieHeaderFromSetCookie(headers),
  };
}

async function httpPostJson(
  url: string,
  body: Record<string, string>,
  timeoutMs: number,
): Promise<{ status: number; text: string }> {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.post({
      url,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      data: body,
      connectTimeout: timeoutMs,
      readTimeout: timeoutMs,
    });
    return {
      status: response.status || 0,
      text: typeof response.data === 'string' ? response.data : JSON.stringify(response.data ?? ''),
    };
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    credentials: 'omit',
    signal: AbortSignal.timeout(timeoutMs),
  });
  return { status: response.status, text: await response.text() };
}

async function httpPostForm(
  url: string,
  body: string,
  timeoutMs: number,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; text: string; url: string }> {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/html, application/json',
        ...(extraHeaders || {}),
      },
      data: body,
      connectTimeout: timeoutMs,
      readTimeout: timeoutMs,
    });
    return {
      status: response.status || 0,
      text: typeof response.data === 'string' ? response.data : JSON.stringify(response.data ?? ''),
      url: String((response as { url?: string }).url || url),
    };
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html, application/json',
      ...(extraHeaders || {}),
    },
    body,
    credentials: 'include',
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  return { status: response.status, text: await response.text(), url: response.url };
}

async function baseReachable(base: string, timeoutMs = 5000): Promise<boolean> {
  const root = stripTrailingSlash(base);
  // Django eBoard serves /login/ (trailing slash). Prefer that before API guesses.
  for (const path of ['/login/', '/login', '/', '/api/health', '/api/login']) {
    try {
      const result = await httpGet(`${root}${path === '/' ? '/' : path}`, timeoutMs);
      // #region agent log
      dbgEboard('H-REACH', 'eboard.ts:baseReachable', 'health path result', {
        host: hostOfBase(root),
        scheme: root.startsWith('https') ? 'https' : 'http',
        path,
        status: result.status,
      });
      // #endregion
      if (result.status > 0 && result.status < 500) return true;
    } catch (err) {
      // #region agent log
      dbgEboard('H-SSL', 'eboard.ts:baseReachable', 'health path threw', {
        host: hostOfBase(root),
        scheme: root.startsWith('https') ? 'https' : 'http',
        path,
        err: err instanceof Error ? err.message.slice(0, 120) : 'error',
      });
      // #endregion
    }
  }
  return false;
}

/**
 * Silently pick a reachable eBoard origin. Caches the winner for the session.
 * Never put the returned URL into user-visible copy.
 */
export async function resolveEboardBase(): Promise<string> {
  const hostOf = (url: string) => url.replace(/^https?:\/\//, '').split('/')[0];
  const cached = loadCachedBase();
  if (cached) {
    try {
      if (await baseReachable(cached, 3500)) {
        setLastEboardProbeStatus({
          reachable: true,
          host: hostOf(cached),
          detail: 'eBoard host reachable (cached).',
        });
        // #region agent log
        dbgEboard('A', 'eboard.ts:resolveEboardBase', 'using cached reachable base', {
          host: hostOf(cached),
          via: 'cache',
        });
        // #endregion
        return cached;
      }
    } catch {
      /* re-resolve */
    }
  }

  // HTTP first: cert on .244 does not match, cleartext is permitted for these IPs.
  for (const candidate of EBOARD_HTTP_CANDIDATES) {
    try {
      // #region agent log
      dbgEboard('H-CLEARTEXT', 'eboard.ts:resolveEboardBase', 'health-check http', {
        host: hostOf(candidate),
      });
      // #endregion
      if (await baseReachable(candidate, 8000)) {
        storeCachedBase(candidate);
        setLastEboardProbeStatus({
          reachable: true,
          host: hostOf(candidate),
          detail: 'eBoard host reachable.',
        });
        // #region agent log
        dbgEboard('A', 'eboard.ts:resolveEboardBase', 'http candidate reachable', {
          host: hostOf(candidate),
          via: 'http',
        });
        // #endregion
        return candidate;
      }
    } catch {
      /* next */
    }
  }

  for (const candidate of EBOARD_HTTPS_CANDIDATES) {
    try {
      // #region agent log
      dbgEboard('H-SSL', 'eboard.ts:resolveEboardBase', 'health-check https', {
        host: hostOf(candidate),
      });
      // #endregion
      if (await baseReachable(candidate, 5000)) {
        storeCachedBase(candidate);
        setLastEboardProbeStatus({
          reachable: true,
          host: hostOf(candidate),
          detail: 'eBoard host reachable (https).',
        });
        // #region agent log
        dbgEboard('A', 'eboard.ts:resolveEboardBase', 'https candidate reachable', {
          host: hostOf(candidate),
          via: 'https',
        });
        // #endregion
        return candidate;
      }
    } catch {
      /* next */
    }
  }

  const fallback = cached || EBOARD_HTTP_CANDIDATES[0];
  storeCachedBase(fallback);
  setLastEboardProbeStatus({
    reachable: false,
    accepted: false,
    host: hostOf(fallback),
    detail:
      'Could not reach eBoard from this phone (tried http://41.76.170.244). The password was not checked on eBoard.',
  });
  // #region agent log
  dbgEboard('A', 'eboard.ts:resolveEboardBase', 'no candidate reachable; using fallback', {
    host: hostOf(fallback),
    via: 'fallback',
  });
  // #endregion
  return fallback;
}

function loginLooksSuccessful(status: number, text: string): boolean {
  if (status === 401 || status === 403 || status === 422) return false;
  if (status < 200 || status >= 500) return false;
  let data: {
    ok?: boolean;
    error?: string;
    token?: string;
    accessToken?: string;
    access_token?: string;
    user?: unknown;
  } = {};
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    data = {};
  }
  if (data.error && /invalid|unauthorized|denied|fail/i.test(String(data.error))) return false;
  if (data.ok === false) return false;
  if (data.ok === true) return true;
  if (data.token || data.accessToken || data.access_token || data.user) return true;
  // HTML form login: redirected away from login, or dashboard markers.
  if (/dashboard|logout|signed.?in|csrf/i.test(text) && !/invalid (email|password|credentials)|incorrect password/i.test(text)) {
    if (status >= 200 && status < 400) return !/name=["']password["']/i.test(text) || /logout/i.test(text);
  }
  return status === 200 && Boolean(data.token || data.accessToken || data.user);
}

function hostOfBase(url: string): string {
  return url.replace(/^https?:\/\//, '').split('/')[0];
}

/** Prefer a known-good base first, then HTTP (.244), then HTTPS fallbacks. */
function eboardLoginBases(preferred?: string | null): string[] {
  const ordered = [
    preferred || '',
    ...EBOARD_HTTP_CANDIDATES,
    ...EBOARD_HTTPS_CANDIDATES,
  ]
    .map((u) => stripTrailingSlash(String(u || '').trim()))
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of ordered) {
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}

type ProbeHostResult = 'accepted' | 'rejected' | 'unreachable' | 'unknown';

async function probeEboardLoginOnBase(
  root: string,
  normalized: string,
  pass: string,
): Promise<ProbeHostResult> {
  const host = hostOfBase(root);
  let sawConnectFailure = false;

  // Primary: JSON API used by eBoard / companion backends.
  for (const path of ['/api/login', '/api/auth/login', '/api/auth/app/login']) {
    try {
      const posted = await httpPostJson(
        `${root}${path}`,
        { email: normalized, password: pass, username: normalized },
        12000,
      );
      // #region agent log
      dbgEboard('B', 'eboard.ts:probeEboardLoginOnBase', 'json login attempt', {
        host,
        path,
        status: posted.status,
        okLook: loginLooksSuccessful(posted.status, posted.text),
        bodyStart: String(posted.text || '').slice(0, 80),
      });
      // #endregion
      if (posted.status === 404 || posted.status === 405) continue;
      if (loginLooksSuccessful(posted.status, posted.text)) return 'accepted';
      if (posted.status === 401 || posted.status === 403) return 'rejected';
    } catch (err) {
      sawConnectFailure = true;
      // #region agent log
      dbgEboard('A', 'eboard.ts:probeEboardLoginOnBase', 'json login threw', {
        host,
        path,
        err: err instanceof Error ? err.message.slice(0, 80) : 'error',
      });
      // #endregion
    }
  }

  // Form login (Django eBoard: /login/ + csrfmiddlewaretoken + csrftoken cookie + username).
  for (const loginPath of ['/login/', '/login', '/accounts/login/', '/accounts/login']) {
    try {
      const page = await httpGet(`${root}${loginPath}`, 10000);
      if (page.status === 404) continue;
      const token =
        /name=["']csrfmiddlewaretoken["']\s+value=["']([^"']+)["']/i.exec(page.text)?.[1] ||
        /name=["']_token["']\s+value=["']([^"']+)["']/i.exec(page.text)?.[1] ||
        '';
      const fields = [
        token ? `csrfmiddlewaretoken=${encodeURIComponent(token)}` : '',
        token ? `_token=${encodeURIComponent(token)}` : '',
        `username=${encodeURIComponent(normalized)}`,
        `email=${encodeURIComponent(normalized)}`,
        `password=${encodeURIComponent(pass)}`,
      ]
        .filter(Boolean)
        .join('&');
      const cookie =
        page.cookie ||
        (token ? `csrftoken=${token}` : '');
      const posted = await httpPostForm(`${root}${loginPath}`, fields, 15000, {
        Referer: `${root}${loginPath}`,
        Origin: root.replace(/\/eboard$/i, '') || root,
        ...(cookie ? { Cookie: cookie } : {}),
        'X-CSRFToken': token || '',
      });
      // #region agent log
      dbgEboard('H-CSRF', 'eboard.ts:probeEboardLoginOnBase', 'form login attempt', {
        host,
        path: loginPath,
        status: posted.status,
        hadCookie: Boolean(cookie),
        hadToken: Boolean(token),
        okLook: loginLooksSuccessful(posted.status, posted.text),
        finalPath: String(posted.url || '').replace(/^https?:\/\/[^/]+/, '').slice(0, 60),
        bodyStart: String(posted.text || '').slice(0, 60),
      });
      // #endregion
      // CSRF failures are 403 with CSRF body — not a wrong password.
      if (
        posted.status === 403 &&
        /csrf|Forbidden/i.test(posted.text || '')
      ) {
        sawConnectFailure = true;
        continue;
      }
      if (posted.status === 401 || posted.status === 403) return 'rejected';
      if (loginLooksSuccessful(posted.status, posted.text)) return 'accepted';
      if (/\/login/i.test(posted.url) && /invalid|incorrect|failed/i.test(posted.text)) return 'rejected';
      // Django success: lands on /eboard/ (not /login/) with 200.
      if (
        posted.status >= 200 &&
        posted.status < 400 &&
        !/\/login\/?/i.test(posted.url) &&
        !/name=["']password["']/i.test(posted.text)
      ) {
        return 'accepted';
      }
      if (
        posted.status >= 200 &&
        posted.status < 400 &&
        /eboard/i.test(posted.text) &&
        /logout|dashboard|meeting/i.test(posted.text) &&
        !/name=["']password["']/i.test(posted.text)
      ) {
        return 'accepted';
      }
    } catch (err) {
      sawConnectFailure = true;
      // #region agent log
      dbgEboard('A', 'eboard.ts:probeEboardLoginOnBase', 'form login threw', {
        host,
        path: loginPath,
        err: err instanceof Error ? err.message.slice(0, 80) : 'error',
      });
      // #endregion
    }
  }

  return sawConnectFailure ? 'unreachable' : 'unknown';
}

/**
 * True when the typed email/password is accepted by eBoard.
 * Tries http://41.76.170.244 first (public + cleartext), then .146 / HTTPS fallbacks.
 * Connect failure on one host does not skip the other.
 */
export async function probeEboardLogin(email: string, password: string): Promise<boolean> {
  const normalized = String(email || '').trim().toLowerCase();
  const pass = String(password || '');
  if (!normalized || !pass) return false;

  setLastEboardProbeStatus({ accepted: false, detail: '', reachable: false, host: '' });

  let preferred: string | null = null;
  try {
    preferred = await resolveEboardBase();
  } catch {
    preferred = null;
  }

  const bases = eboardLoginBases(preferred);
  // #region agent log
  dbgEboard('F', 'eboard.ts:probeEboardLogin', 'multi-host probe start', {
    local: normalized.split('@')[0],
    passLen: pass.length,
    hosts: bases.map(hostOfBase),
    preferredHost: preferred ? hostOfBase(preferred) : '',
  });
  // #endregion

  let sawUnreachable = false;
  let lastHost = '';

  for (const root of bases) {
    lastHost = hostOfBase(root);
    // #region agent log
    dbgEboard('F', 'eboard.ts:probeEboardLogin', 'trying host', { host: lastHost, root });
    // #endregion
    const result = await probeEboardLoginOnBase(root, normalized, pass);
    if (result === 'accepted') {
      storeCachedBase(root);
      setLastEboardProbeStatus({
        reachable: true,
        accepted: true,
        host: lastHost,
        detail: 'eBoard accepted this email and password.',
      });
      // #region agent log
      dbgEboard('F', 'eboard.ts:probeEboardLogin', 'accepted on host', { host: lastHost });
      // #endregion
      return true;
    }
    if (result === 'rejected') {
      storeCachedBase(root);
      setLastEboardProbeStatus({
        reachable: true,
        accepted: false,
        host: lastHost,
        detail: 'eBoard rejected this email and password.',
      });
      // #region agent log
      dbgEboard('B', 'eboard.ts:probeEboardLogin', 'rejected on host', { host: lastHost });
      // #endregion
      return false;
    }
    if (result === 'unreachable') sawUnreachable = true;
    // #region agent log
    dbgEboard('F', 'eboard.ts:probeEboardLogin', 'host failed; trying next IP', {
      host: lastHost,
      result,
    });
    // #endregion
  }

  setLastEboardProbeStatus({
    reachable: false,
    accepted: false,
    host: lastHost,
    detail: sawUnreachable
      ? 'Could not reach eBoard from this phone (tried http://41.76.170.244 and fallbacks). The password was not checked on eBoard.'
      : 'eBoard did not accept this email and password.',
  });
  // #region agent log
  dbgEboard('A', 'eboard.ts:probeEboardLogin', 'all hosts failed', {
    local: normalized.split('@')[0],
    sawUnreachable,
    hostsTried: bases.map(hostOfBase),
  });
  // #endregion
  return false;
}

/** Refuse recording / playback deep links. */
export function isForbiddenEboardUrl(url: string): boolean {
  return /record(ing)?=1|\/recordings?\/|playback|jibri|recording_url/i.test(url);
}

export function parseEboardDeepLink(raw: string): EboardDeepLink | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'uwezo:') return null;
  // uwezo://eboard/... → host is eboard, pathname /meetings/...
  const host = (url.hostname || '').toLowerCase();
  if (host !== 'eboard') return null;

  const parts = url.pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  if (parts[0] === 'meetings' && parts[1]) {
    const meetingId = parts[1];
    if (parts[2] === 'join') {
      return { kind: 'join', meetingId };
    }
    if (parts[2] === 'rsvp') {
      return { kind: 'rsvp', meetingId, inviteId: url.searchParams.get('invite') || '' };
    }
    return {
      kind: 'meeting',
      meetingId,
      action: url.searchParams.get('action') || 'open',
    };
  }
  return { kind: 'home' };
}

function activeBaseSync(): string {
  return stripTrailingSlash(loadCachedBase() || EBOARD_PUBLIC_BASE);
}

export function eboardHttpsUrl(link: EboardDeepLink): string {
  const base = activeBaseSync();
  if (link.kind === 'home') return `${base}/`;
  if (link.kind === 'join') {
    return `${base}/meetings/${encodeURIComponent(link.meetingId)}/?record=0`;
  }
  if (link.kind === 'rsvp') {
    const invite = link.inviteId
      ? `?invite=${encodeURIComponent(link.inviteId)}`
      : '';
    return `${base}/meetings/${encodeURIComponent(link.meetingId)}/${invite}`;
  }
  return `${base}/meetings/${encodeURIComponent(link.meetingId)}/`;
}

/** Open eBoard from a uwezo:// deep link or fall back to home. Never opens recording URLs. */
export async function openEboardFromDeepLink(raw: string): Promise<{ ok: boolean; message: string }> {
  if (isForbiddenEboardUrl(raw)) {
    return { ok: false, message: 'Recording links are not opened in the Uwezo app.' };
  }
  const parsed = parseEboardDeepLink(raw);
  if (!parsed) {
    return { ok: false, message: 'Not an eBoard deep link.' };
  }
  try {
    await resolveEboardBase();
  } catch {
    /* still attempt with fallback */
  }
  const target = eboardHttpsUrl(parsed);
  if (isForbiddenEboardUrl(target)) {
    return { ok: false, message: 'Recording links are not opened in the Uwezo app.' };
  }
  await openExternal(target);
  return { ok: true, message: 'Opening eBoard…' };
}

export async function openEboardHome(): Promise<void> {
  const base = stripTrailingSlash(await resolveEboardBase());
  await openExternal(`${base}/`);
}
