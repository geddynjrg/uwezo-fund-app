import { Capacitor, CapacitorHttp } from '@capacitor/core';

export type LmsRole = 'constituency' | 'headquarters' | 'secretariat' | 'accountant' | 'staff';

const CACHE_KEY = 'uwezo.lms.cache';

export type LmsPage = { id: string; group: string; title: string; path: string };

export type LmsSummary = { label: string; value: string; note: string };
export type LmsTable = { title: string; headers: string[]; rows: string[][] };
export type LmsPageView = { summary: LmsSummary[]; tables: LmsTable[]; notes: string[] };

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
  if (path.startsWith('/hq') || /href="[^"]*\/hq\/(?:applications|reports|groups|loans|allocations)/.test(html)) return 'headquarters';
  if (constituencyBase(`${url} ${html}`) || /assigned constituencies/i.test(html)) return 'constituency';
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
  };
}

export function reportMethod(path: string): string {
  if (path.includes('application-volume')) return 'previewReport';
  if (path.includes('dynamic-report') || path.endsWith('/reports') || path.endsWith('/hq/reports')) return 'generateReport';
  return '';
}

function cookieHeader(setCookie: string): string {
  const names = ['laravel_session', 'XSRF-TOKEN'];
  return names
    .map((name) => {
      const match = new RegExp(`${name}=([^;]+)`).exec(setCookie);
      return match ? `${name}=${match[1]}` : '';
    })
    .filter(Boolean)
    .join('; ');
}

function headersOf(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value ?? '');
  }
  return out;
}

async function readText(url: string, cookie: string): Promise<{ status: number; url: string; setCookie: string; text: string }> {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url,
      headers: { Accept: 'text/html', Cookie: cookie },
      connectTimeout: 20000,
      readTimeout: 20000,
    });
    const headers = headersOf(response.headers);
    return {
      status: response.status,
      url: response.url || url,
      setCookie: headers['set-cookie'] || '',
      text: typeof response.data === 'string' ? response.data : '',
    };
  }
  const response = await fetch(url, { headers: { Accept: 'text/html', Cookie: cookie }, credentials: 'include', signal: AbortSignal.timeout(20000) });
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

async function loginToHost(host: string, email: string, password: string): Promise<{ ok: boolean; role: LmsRole; cookie: string; html: string; detail: string }> {
  const loginPage = await readText(`${host}/login`, '');
  const token = /name="_token"\s+value="([^"]+)"/.exec(loginPage.text)?.[1] || '';
  if (!token) return { ok: false, role: 'staff', cookie: '', html: '', detail: `${host.replace('https://', '')} did not return a sign-in form.` };
  const cookie = cookieHeader(loginPage.setCookie);
  const body = `_token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  const posted = Capacitor.isNativePlatform()
    ? await CapacitorHttp.post({
        url: `${host}/login`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html', Cookie: cookie, Referer: `${host}/login` },
        data: body,
        connectTimeout: 20000,
        readTimeout: 20000,
        disableRedirects: true,
      })
    : await fetch(`${host}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html', Cookie: cookie, Referer: `${host}/login` },
        body,
        credentials: 'include',
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
      });
  const postedHeaders = Capacitor.isNativePlatform() ? headersOf((posted as { headers?: unknown }).headers) : {};
  const postedStatus = Capacitor.isNativePlatform() ? Number((posted as { status?: number }).status || 0) : (posted as Response).status;
  const postedText = Capacitor.isNativePlatform()
    ? (typeof (posted as { data?: unknown }).data === 'string' ? String((posted as { data?: unknown }).data) : '')
    : await (posted as Response).text();
  const location = postedHeaders.location || (Capacitor.isNativePlatform() ? '' : (posted as Response).url);
  const session = cookieHeader(`${cookie}; ${postedHeaders['set-cookie'] || ''}`);
  const rejected = /credentials do not match|invalid email or password|auth\.failed/i.test(postedText) || postedStatus === 422 || postedStatus === 419;
  const returnedToLogin = /\/login\/?(?:\?|$)/.test(location);
  const accepted = !rejected && !returnedToLogin && location.length > 0 && (
    postedStatus === 302 || postedStatus === 303 || (postedStatus >= 200 && postedStatus < 300 && !/name="_token"/.test(postedText))
  );
  if (!accepted) return { ok: false, role: 'staff', cookie: '', html: postedText, detail: 'The LMS database did not accept this email and password.' };
  const nextUrl = location.startsWith('http') ? location : `${host}${location.startsWith('/') ? location : '/dashboard'}`;
  const landed = await readText(nextUrl, session);
  const html = `${landed.url}\n${landed.text}`;
  return { ok: true, role: roleFromPage(landed.url || nextUrl, landed.text), cookie: cookieHeader(`${session}; ${landed.setCookie}`), html, detail: '' };
}

export async function syncLmsMailbox(email: string, password: string): Promise<{ authenticated: boolean; role: LmsRole; detail: string; constituency: string }> {
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
      const base = constituencyBase(signed.html);
      const role = signed.role === 'constituency' && !base && !/assigned constituencies/i.test(signed.html) ? 'staff' : signed.role;
      const menu = role === 'constituency' ? constituencyMenu(base) : LMS_PAGES[role];
      const pages: Record<string, LmsPageView> = {};
      const seen = new Set<string>();
      let cookie = signed.cookie;
      for (const page of menu) {
        if (!page.path || seen.has(page.path)) continue;
        seen.add(page.path);
        const loaded = await readText(`${host}${page.path}`, cookie);
        cookie = cookieHeader(`${cookie}; ${loaded.setCookie}`) || cookie;
        pages[page.path] = pageView(loaded.text);
      }
      const detail = `Signed in to ${host.replace('https://', '')} as ${roleLabel(role)}. Figures and tables from each page are saved on this phone.`;
      const next: LmsCache = { email, role, fetchedAt: new Date().toISOString(), detail, pages, menu, host, cookie };
      saveLmsCache(next);
      const constituency = role === 'constituency' ? (base.split('/').filter(Boolean)[1]?.replace(/-/g, ' ') || '') : '';
      return { authenticated: true, role, detail, constituency };
    }
    return {
      authenticated: false,
      role: cached?.role || 'constituency',
      constituency: '',
      detail: cached ? `${lastDetail} The last copy on this phone is kept.` : lastDetail,
    };
  } catch {
    return {
      authenticated: false,
      role: cached?.role || 'constituency',
      constituency: '',
      detail: cached
        ? 'lms.uwezo.go.ke did not answer. This phone is showing the last downloaded copy.'
        : 'lms.uwezo.go.ke did not answer.',
    };
  }
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

export async function generateLmsReport(email: string, path: string): Promise<{ ok: boolean; detail: string; view: LmsPageView }> {
  const cache = loadLmsCache(email);
  const current = cache?.pages[path] || { summary: [], tables: [], notes: [] };
  const method = reportMethod(path);
  if (!cache?.host || !cache.cookie) return { ok: false, detail: 'Sign in to the LMS again, then generate the report.', view: current };
  if (!method) return { ok: false, detail: 'This page shows its rows directly.', view: current };
  const pageUrl = `${cache.host}${path}`;
  const loaded = await readText(pageUrl, cache.cookie);
  const expired = /\/login\/?(?:\?|$)/.test(loaded.url) || (/name="_token"/.test(loaded.text) && !/content-wrapper/.test(loaded.text));
  if (expired) return { ok: false, detail: 'The LMS sign-in expired. Refresh the pages and try the report again.', view: current };
  const snapshot = decodeEntities(/wire:snapshot="([^"]+)"/.exec(contentHtml(loaded.text))?.[1] || '');
  const token = /csrf-token"\s+content="([^"]+)"/.exec(loaded.text)?.[1] || /name="_token"\s+value="([^"]+)"/.exec(loaded.text)?.[1] || '';
  if (!snapshot || !token) return { ok: false, detail: 'This report page did not include a generate action.', view: pageView(loaded.text) };
  const cookie = cookieHeader(`${cache.cookie}; ${loaded.setCookie}`) || cache.cookie;
  const posted = await postJson(`${cache.host}/livewire/update`, cookie, pageUrl, {
    _token: token,
    components: [{ snapshot, updates: {}, calls: [{ path: '', method, params: [] }] }],
  });
  let html = '';
  try {
    const data = JSON.parse(posted.text) as { components?: { effects?: { html?: string } }[] };
    html = data.components?.[0]?.effects?.html || '';
  } catch {
    html = '';
  }
  if (!html) {
    return {
      ok: false,
      detail: posted.status === 419
        ? 'The LMS sign-in expired. Refresh the pages and try the report again.'
        : 'The report did not return any rows.',
      view: pageView(loaded.text),
    };
  }
  const view = pageView(html);
  saveLmsCache({ ...cache, cookie, pages: { ...cache.pages, [path]: view } });
  const count = view.tables.reduce((sum, table) => sum + table.rows.length, 0);
  return {
    ok: view.tables.length > 0 || view.summary.length > 0,
    detail: count ? `Report ready. ${count} rows.` : 'The report ran. There are no rows for the current filters.',
    view,
  };
}
