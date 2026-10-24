import { Capacitor, CapacitorHttp } from '@capacitor/core';

export type LmsRole = 'constituency' | 'headquarters' | 'secretariat' | 'staff';

const CACHE_KEY = 'uwezo.lms.cache';

export type LmsPage = { id: string; group: string; title: string; path: string };

export type LmsCache = {
  email: string;
  role: LmsRole;
  fetchedAt: string;
  detail: string;
  pages: Record<string, string>;
  menu?: LmsPage[];
  host?: string;
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
    if (!base) return [{ id: item.id, group: item.group, title: item.title, path: '' }];
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
    { id: 'dashboard', group: 'National Administration', title: 'HQ Dashboard', path: '/staff/hq' },
    { id: 'analytics', group: 'National Administration', title: 'HQ Analytics', path: '/staff/hq/analytics' },
    { id: 'aging', group: 'National Administration', title: 'Phase Aging', path: '/staff/hq/analytics/phase-aging' },
    { id: 'process', group: 'Processing', title: 'Process as CO', path: '/staff/hq/process' },
    { id: 'phases', group: 'Processing', title: 'Review Cohorts', path: '/staff/hq/phases' },
    { id: 'report', group: 'Reports', title: 'Generate Report', path: '/staff/hq/reports/dynamic-report' },
    { id: 'all', group: 'Submissions', title: 'All Applications', path: '/staff/applications' },
    { id: 'intake', group: 'Submissions', title: 'Intake Queue', path: '/staff/applications?status=submitted' },
  ],
  secretariat: [
    { id: 'dashboard', group: 'Secretariat', title: 'Secretariat Dashboard', path: '/staff/secretariat' },
    { id: 'analytics', group: 'Secretariat', title: 'National Analytics', path: '/staff/secretariat/analytics' },
    { id: 'all', group: 'Submissions', title: 'All Applications', path: '/staff/applications' },
    { id: 'intake', group: 'Submissions', title: 'Intake Queue', path: '/staff/applications?status=submitted' },
    { id: 'gate', group: 'Submissions', title: 'HOS Training Gate', path: '/staff/applications?status=ps_attestation' },
  ],
  staff: [
    { id: 'dashboard', group: 'LMS', title: 'Dashboard', path: '/staff' },
  ],
};

export function loadLmsCache(email: string): LmsCache | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || '') as LmsCache;
    return parsed.email === email ? parsed : null;
  } catch {
    return null;
  }
}

function roleFromLocation(value: string): LmsRole {
  if (value.includes('/secretariat')) return 'secretariat';
  if (value.includes('/hq') || value.includes('national=1')) return 'headquarters';
  if (/\/[a-z0-9-]+\/[a-z0-9-]+\/dashboard/i.test(value) || value.includes('constituency')) return 'constituency';
  return 'staff';
}

function constituencyBase(value: string): string {
  const match = /\/([a-z0-9-]+)\/([a-z0-9-]+)\/dashboard/i.exec(value);
  return match ? `/${match[1]}/${match[2]}` : '';
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2500);
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
  const html = `${landed.url} ${landed.text}`;
  return { ok: true, role: roleFromLocation(html), cookie: cookieHeader(`${session}; ${landed.setCookie}`), html, detail: '' };
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
      const role = base ? 'constituency' : signed.role;
      const menu = role === 'constituency' ? constituencyMenu(base) : LMS_PAGES[role];
      const pages: Record<string, string> = {};
      const seen = new Set<string>();
      for (const page of menu) {
        if (!page.path || seen.has(page.path)) continue;
        seen.add(page.path);
        const loaded = await readText(`${host}${page.path}`, signed.cookie);
        pages[page.path] = stripHtml(loaded.text);
      }
      const detail = `Signed in to ${host.replace('https://', '')}. The ${role} pages were downloaded and replace the previous copy on this phone.`;
      const next: LmsCache = { email, role, fetchedAt: new Date().toISOString(), detail, pages, menu, host };
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      const constituency = base.split('/').filter(Boolean)[1]?.replace(/-/g, ' ') || '';
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
