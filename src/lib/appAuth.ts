import { OTP_API_BASE, LINKS } from '../config';

export type AuthOrigin =
  | 'https://majuu.uwezo.go.ke'
  | 'https://loans.uwezo.go.ke'
  | 'https://loans-staging.uwezo.go.ke';

export const AUTH_ORIGINS: { id: AuthOrigin; label: string }[] = [
  { id: LINKS.loans.url as AuthOrigin, label: 'Loans' },
  { id: LINKS.loansStaging.url as AuthOrigin, label: 'Loans (staging)' },
  { id: LINKS.majuu.url as AuthOrigin, label: 'Wezesha Majuu' },
];

/** Portals that should receive device registration and OTP inbox polls. */
export const INBOX_ORIGINS: AuthOrigin[] = [
  'https://loans.uwezo.go.ke',
  'https://loans-staging.uwezo.go.ke',
  'https://majuu.uwezo.go.ke',
];

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function canonicalAuthOrigin(origin: string): AuthOrigin {
  const host = origin.replace(/\/$/, '').toLowerCase();
  if (host.includes('majuu')) return 'https://majuu.uwezo.go.ke';
  if (host.includes('loans-staging') || host.includes('staging')) {
    return 'https://loans-staging.uwezo.go.ke';
  }
  return 'https://loans.uwezo.go.ke';
}

const ORIGIN_STORAGE_KEY = 'uwezo.fund.app.authOrigin.v1';

export function rememberAuthOrigin(origin: AuthOrigin) {
  try {
    localStorage.setItem(ORIGIN_STORAGE_KEY, canonicalAuthOrigin(origin));
  } catch {
    // ignore
  }
}

export function lastAuthOrigin(): AuthOrigin | null {
  try {
    const raw = localStorage.getItem(ORIGIN_STORAGE_KEY) || '';
    if (!raw) return null;
    return canonicalAuthOrigin(raw);
  } catch {
    return null;
  }
}

function portalHost(origin: string) {
  try {
    return new URL(origin).host;
  } catch {
    return origin.replace(/^https?:\/\//, '');
  }
}

async function postJson(
  origin: string,
  path: string,
  body: Record<string, unknown>,
  timeoutMs = 25000,
) {
  const url = `${origin.replace(/\/$/, '')}${path}`;
  const host = portalHost(origin);
  const action = typeof body.action === 'string' ? body.action : '';
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'omit',
      signal: ctrl.signal,
      body: JSON.stringify(body),
    });
  } catch (err) {
    const aborted =
      (err instanceof DOMException && err.name === 'AbortError') ||
      (err instanceof Error && err.name === 'AbortError');
    if (aborted) {
      const what =
        action === 'reset_request'
          ? 'Password reset'
          : action === 'login_or_register' || action === 'signup'
            ? 'Sign-in'
            : 'Request';
      throw new Error(
        `${what} timed out on ${host}. Try again on mobile data or Wi‑Fi, or open https://${host}/reset in a browser. Loans and Wezesha Majuu are separate accounts.`,
      );
    }
    throw new Error(`Could not reach ${host}. Check your connection, then try again.`);
  } finally {
    window.clearTimeout(timer);
  }
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(
      res.ok
        ? `Unexpected response from ${host}.`
        : `Sign-in is not available on ${host} (${res.status}).`,
    );
  }
  if (!res.ok || data.ok === false) {
    const detail = String(data.error || data.message || `Request failed (${res.status})`);
    throw new Error(`${detail} (${host})`);
  }
  return data;
}

/** Option A upsert login: create account if missing when phone was verified. */
export async function appLoginOrRegister(input: {
  origin: string;
  email: string;
  password: string;
  phone: string;
  createIfMissing?: boolean;
}) {
  return postJson(input.origin, '/api/auth/app/account', {
    action: 'login_or_register',
    email: normalizeEmail(input.email),
    password: input.password,
    phone: input.phone,
    createIfMissing: input.createIfMissing !== false,
  });
}

export async function appSignup(input: {
  origin: string;
  email: string;
  password: string;
  phone: string;
  requestId: string;
  otp: string;
}) {
  return postJson(input.origin, '/api/auth/app/account', {
    action: 'signup',
    email: normalizeEmail(input.email),
    password: input.password,
    phone: input.phone,
    requestId: input.requestId,
    otp: input.otp,
  });
}

export async function appResetPassword(input: {
  origin: string;
  email: string;
}) {
  return postJson(input.origin, '/api/auth/app/account', {
    action: 'reset_request',
    email: normalizeEmail(input.email),
  });
}

export async function registerPushDevice(input: {
  origin: string;
  accessToken: string;
  deviceToken: string;
  platform?: string;
  email?: string;
  phone?: string;
}) {
  return postJson(input.origin, '/api/auth/app/device', {
    deviceToken: input.deviceToken,
    platform: input.platform || 'android',
    accessToken: input.accessToken,
    email: input.email,
    phone: input.phone,
  });
}

export async function refreshAppSession(input: {
  origin: string;
  refreshToken: string;
}) {
  return postJson(
    input.origin,
    '/api/auth/app/account',
    {
      action: 'refresh',
      refreshToken: input.refreshToken,
    },
    8000,
  );
}

export async function fetchInbox(input: {
  origin: string;
  email?: string;
  phone?: string;
  timeoutMs?: number;
}) {
  const origin = input.origin.replace(/\/$/, '');
  const url = new URL(`${origin}/api/auth/app/inbox`);
  if (input.email) url.searchParams.set('email', input.email);
  if (input.phone) url.searchParams.set('phone', input.phone);
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), input.timeoutMs ?? 8000);
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      signal: ctrl.signal,
    });
    const data = (await res.json().catch(() => ({}))) as {
      items?: Array<{
        id: string;
        title: string;
        body: string;
        kind: 'otp' | 'loan_status' | 'system';
        createdAt: string;
      }>;
    };
    return Array.isArray(data.items) ? data.items : [];
  } finally {
    window.clearTimeout(timer);
  }
}

export function defaultAuthOrigin(): AuthOrigin {
  const remembered = lastAuthOrigin();
  if (remembered) return remembered;
  const base = OTP_API_BASE.replace(/\/$/, '').toLowerCase();
  if (base.includes('majuu')) return 'https://majuu.uwezo.go.ke';
  if (base.includes('staging')) return 'https://loans-staging.uwezo.go.ke';
  return 'https://loans.uwezo.go.ke';
}
