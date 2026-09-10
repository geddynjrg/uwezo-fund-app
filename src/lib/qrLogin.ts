import { OTP_API_BASE } from '../config';

export type QrLoginPayload = {
  v: number;
  type: 'uwezo_qr_login';
  challengeId: string;
  origin: string;
  expiresAt: number;
};

export type QrParseResult =
  | { ok: true; payload: QrLoginPayload }
  | { ok: false; error: string };

export function parseQrLoginPayload(raw: string): QrParseResult {
  let text = raw.trim();
  // Allow deep-link style wrappers if present.
  if (text.startsWith('uwezo://qr-login?')) {
    try {
      const u = new URL(text);
      text = u.searchParams.get('data') || text;
    } catch {
      // keep original
    }
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'QR content is not a valid Uwezo login code.' };
  }

  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'QR content is invalid.' };
  }

  const obj = data as Record<string, unknown>;
  if (obj.type !== 'uwezo_qr_login') {
    return { ok: false, error: 'This QR is not a Uwezo app login code.' };
  }

  const challengeId = String(obj.challengeId || '').trim();
  const origin = String(obj.origin || '').replace(/\/$/, '');
  const expiresAt = Number(obj.expiresAt || 0);
  if (!challengeId || !origin || !expiresAt) {
    return { ok: false, error: 'QR login payload is incomplete.' };
  }
  if (Date.now() > expiresAt) {
    return { ok: false, error: 'This QR code has expired. Generate a new one on the website.' };
  }

  const allowed = [
    'https://majuu.uwezo.go.ke',
    'https://loans.uwezo.go.ke',
    'https://loans-staging.uwezo.go.ke',
  ];
  if (!allowed.includes(origin)) {
    return {
      ok: false,
      error: `Unsupported login origin: ${origin}`,
    };
  }

  return {
    ok: true,
    payload: {
      v: Number(obj.v || 1),
      type: 'uwezo_qr_login',
      challengeId,
      origin,
      expiresAt,
    },
  };
}

export async function confirmQrLogin(input: {
  origin: string;
  challengeId: string;
  method: 'phone_verify' | 'password' | 'session';
  requestId?: string;
  otp?: string;
  username?: string;
  password?: string;
  accessToken?: string;
  refreshToken?: string;
}): Promise<{ ok: true; message: string } | { ok: false; error: string; needAuth?: boolean }> {
  try {
    const body: Record<string, string> = {
      challengeId: input.challengeId,
      method: input.method,
    };
    if (input.method === 'phone_verify') {
      body.requestId = input.requestId || '';
      body.otp = input.otp || '';
    } else if (input.method === 'password') {
      body.username = input.username || '';
      body.password = input.password || '';
    } else {
      body.accessToken = input.accessToken || '';
      body.refreshToken = input.refreshToken || '';
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (input.method === 'session' && input.accessToken) {
      headers.Authorization = `Bearer ${input.accessToken}`;
    }

    const res = await fetch(`${input.origin}/api/auth/qr/confirm`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || data.ok === false) {
      return {
        ok: false,
        needAuth: Boolean(data.needAuth),
        error: String(data.error || `Confirm failed (${res.status})`),
      };
    }
    return {
      ok: true,
      message: String(
        data.message ||
          'Confirmed. Return to the browser to finish signing in.',
      ),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error:
        msg.includes('Failed to fetch') || msg.includes('NetworkError')
          ? `Could not reach ${input.origin || OTP_API_BASE} to confirm QR login.`
          : msg || 'Confirm failed',
    };
  }
}
