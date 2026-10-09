import { canonicalAuthOrigin, type AuthOrigin } from './appAuth';
import type { AppSession } from './session';
import { parseOtpauth, type TotpAccount } from './totp';

export type EnrollResult =
  | { ok: true; account: Omit<TotpAccount, 'id' | 'enrolledAt'> }
  | { ok: false; error: string };

async function enrollAt(origin: string, accessToken: string): Promise<EnrollResult> {
  const url = `${origin.replace(/\/$/, '')}/api/auth/totp/enroll`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({}),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    otpauth?: string;
    secret?: string;
    issuer?: string;
    account?: string;
  };
  if (!res.ok || !data.ok || !data.secret) {
    return { ok: false, error: data.error || `Could not register on ${origin}.` };
  }
  const parsed = data.otpauth ? parseOtpauth(data.otpauth) : null;
  return {
    ok: true,
    account: parsed || {
      issuer: data.issuer || 'Uwezo Fund',
      label: data.account || 'application',
      secret: data.secret,
      digits: 6,
      period: 30,
    },
  };
}

/** Register the signed-in application with the portal, the way an authenticator scans a setup QR. */
export async function enrollApplicationTotp(session: AppSession): Promise<EnrollResult> {
  const origins = Array.from(
    new Set<AuthOrigin>([
      canonicalAuthOrigin(session.origin),
      'https://majuu.uwezo.go.ke',
    ]),
  );
  let last = 'Could not register the authenticator.';
  for (const origin of origins) {
    try {
      const result = await enrollAt(origin, session.accessToken);
      if (result.ok) return result;
      last = result.error;
    } catch {
      last = 'The portal did not accept authenticator registration.';
    }
  }
  return { ok: false, error: last };
}
