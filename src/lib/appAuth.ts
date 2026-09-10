import { OTP_API_BASE, LINKS } from '../config';

export type AuthOrigin =
  | 'https://majuu.uwezo.go.ke'
  | 'https://loans.uwezo.go.ke'
  | 'https://loans-staging.uwezo.go.ke';

export const AUTH_ORIGINS: { id: AuthOrigin; label: string }[] = [
  { id: LINKS.majuu.url as AuthOrigin, label: 'Wezesha Majuu' },
  { id: LINKS.loans.url as AuthOrigin, label: 'Loans (prod)' },
  {
    id: 'https://loans-staging.uwezo.go.ke',
    label: 'Loans (staging)',
  },
];

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function postJson(origin: string, path: string, body: Record<string, unknown>) {
  const res = await fetch(`${origin.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
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
  const base = OTP_API_BASE.replace(/\/$/, '');
  if (base.includes('loans-staging')) return 'https://loans-staging.uwezo.go.ke';
  if (base.includes('loans.uwezo')) return 'https://loans.uwezo.go.ke';
  return 'https://majuu.uwezo.go.ke';
}
