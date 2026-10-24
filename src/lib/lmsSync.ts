import { Capacitor, CapacitorHttp } from '@capacitor/core';

export type LmsRole = 'constituency' | 'headquarters' | 'secretariat' | 'staff';

const LMS = 'https://lms.uwezo.go.ke';
const CACHE_KEY = 'uwezo.lms.cache';

export type LmsCache = {
  email: string;
  role: LmsRole;
  fetchedAt: string;
  detail: string;
  pages: Record<string, string>;
};

export const LMS_PAGES: Record<LmsRole, { id: string; group: string; title: string; path: string }[]> = {
  constituency: [
    { id: 'dashboard', group: 'Constituency', title: 'Dashboard', path: '/staff/co' },
    { id: 'applications', group: 'Applications', title: 'Applications', path: '/staff/co/applications' },
    { id: 'phases', group: 'Applications', title: 'Review Cohorts', path: '/staff/co/phases' },
    { id: 'report', group: 'Reports', title: 'Generate Report', path: '/staff/co/reports/dynamic-report' },
  ],
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
  if (value.includes('/staff/secretariat')) return 'secretariat';
  if (value.includes('/staff/hq')) return 'headquarters';
  if (value.includes('/staff/co')) return 'constituency';
  return 'staff';
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

export async function syncLmsMailbox(email: string, password: string): Promise<{ role: LmsRole; detail: string }> {
  const cached = loadLmsCache(email);
  try {
    const loginPage = await readText(`${LMS}/login`, '');
    const token = /name="_token"\s+value="([^"]+)"/.exec(loginPage.text)?.[1] || '';
    if (!token) {
      return { role: cached?.role || 'constituency', detail: 'lms.uwezo.go.ke did not return a sign-in form. The last copy on this phone is kept.' };
    }
    const cookie = cookieHeader(loginPage.setCookie);
    const posted = Capacitor.isNativePlatform()
      ? await CapacitorHttp.post({
          url: `${LMS}/login`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'text/html',
            Cookie: cookie,
            Referer: `${LMS}/login`,
          },
          data: `_token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
          connectTimeout: 20000,
          readTimeout: 20000,
        })
      : await fetch(`${LMS}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html', Cookie: cookie, Referer: `${LMS}/login` },
          body: `_token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
          credentials: 'include',
          signal: AbortSignal.timeout(20000),
        });
    const postedHeaders = Capacitor.isNativePlatform() ? headersOf((posted as { headers?: unknown }).headers) : {};
    const postedText = Capacitor.isNativePlatform()
      ? (typeof (posted as { data?: unknown }).data === 'string' ? String((posted as { data?: unknown }).data) : '')
      : await (posted as Response).text();
    const postedUrl = Capacitor.isNativePlatform() ? String((posted as { url?: string }).url || '') : (posted as Response).url;
    if (/Invalid email or password/i.test(postedText) || (!postedUrl.includes('/staff') && /name="_token"/.test(postedText))) {
      return {
        role: cached?.role || 'constituency',
        detail: 'The mailbox was accepted, but lms.uwezo.go.ke did not accept the same password. The last copy on this phone is kept.',
      };
    }
    const role = roleFromLocation(`${postedUrl} ${postedText}`);
    const session = cookieHeader(`${cookie}; ${postedHeaders['set-cookie'] || ''}`);
    const pages: Record<string, string> = {};
    for (const page of LMS_PAGES[role]) {
      const loaded = await readText(`${LMS}${page.path}`, session);
      pages[page.path] = stripHtml(loaded.text);
    }
    const detail = 'Constituency, headquarters, or secretariat pages were downloaded from lms.uwezo.go.ke. Signing in again replaces this copy with the latest rows.';
    const next: LmsCache = { email, role, fetchedAt: new Date().toISOString(), detail, pages };
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    return { role, detail };
  } catch {
    return {
      role: cached?.role || 'constituency',
      detail: cached
        ? 'lms.uwezo.go.ke did not answer. This phone is showing the last downloaded copy.'
        : 'lms.uwezo.go.ke did not answer. The LMS pages stay on this phone until the site answers at the next sign-in.',
    };
  }
}
