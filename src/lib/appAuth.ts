import { OTP_API_BASE, LINKS } from '../config';

export type AuthOrigin = 'https://majuu.uwezo.go.ke' | 'https://loans.uwezo.go.ke';

export const AUTH_ORIGINS: { id: AuthOrigin; label: string }[] = [
  { id: LINKS.loans.url as AuthOrigin, label: 'Loans' },
  { id: LINKS.majuu.url as AuthOrigin, label: 'Wezesha Majuu' },
];

/** Portals that should receive device registration and OTP inbox polls. */
export const INBOX_ORIGINS: AuthOrigin[] = [
  'https://loans.uwezo.go.ke',
  'https://majuu.uwezo.go.ke',
];

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function canonicalAuthOrigin(origin: string): AuthOrigin {
  const host = origin.replace(/\/$/, '').toLowerCase();
  if (host.includes('majuu')) return 'https://majuu.uwezo.go.ke';
  return 'https://loans.uwezo.go.ke';
}

async function postJson(origin: string, path: string, body: Record<string, unknown>) {
  const url = `${origin.replace(/\/$/, '')}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'omit',
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      'Could not reach the portal. Check your connection and try Loans sign-in again.',
    );
  }
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(
      res.ok
        ? 'Unexpected response from the portal.'
        : `Sign-in is not available on this portal (${res.status}). Try Loans.`,
    );
  }
  if (!res.ok || data.ok === false) {
    throw new Error(String(data.error || data.message || `Request failed (${res.status})`));
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

export function defaultAuthOrigin(): AuthOrigin {
  const base = OTP_API_BASE.replace(/\/$/, '').toLowerCase();
  if (base.includes('majuu')) return 'https://majuu.uwezo.go.ke';
  return 'https://loans.uwezo.go.ke';
}
