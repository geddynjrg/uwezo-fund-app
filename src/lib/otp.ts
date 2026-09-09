import { OTP_API_BASE, OTP_LOGIN_PATH } from '../config';

export type OtpSendResult = {
  ok: true;
  requestId: string;
  channel?: string;
  message: string;
  maskedEmail?: string | null;
};

export type OtpVerifyResult = {
  ok: true;
  userId?: string | number | null;
  message: string;
};

export type OtpError = {
  ok: false;
  error: string;
  needEmail?: boolean;
  corsOrNetwork?: boolean;
};

async function postLogin(body: Record<string, unknown>): Promise<Response> {
  return fetch(`${OTP_API_BASE}${OTP_LOGIN_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
}

function networkError(err: unknown): OtpError {
  const msg = err instanceof Error ? err.message : String(err);
  const corsOrNetwork =
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('CORS') ||
    msg.includes('Load failed');
  return {
    ok: false,
    corsOrNetwork,
    error: corsOrNetwork
      ? 'Could not reach the OTP service from this app (network or CORS). You can open Wezesha Majuu Help chat instead.'
      : msg || 'Request failed',
  };
}

export async function sendPhoneOtp(
  phone: string,
  email?: string,
): Promise<OtpSendResult | OtpError> {
  try {
    const res = await postLogin({
      method: 'phone_send',
      phone,
      ...(email ? { email } : {}),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || data.ok === false) {
      return {
        ok: false,
        needEmail: Boolean(data.needEmail),
        error: String(data.error || `Could not send OTP (${res.status})`),
      };
    }
    return {
      ok: true,
      requestId: String(data.requestId || data.request_id || ''),
      channel: data.channel ? String(data.channel) : undefined,
      message: String(data.message || 'OTP sent. Enter the 6-digit code.'),
      maskedEmail: (data.maskedEmail as string | null | undefined) ?? null,
    };
  } catch (err) {
    return networkError(err);
  }
}

export async function verifyPhoneOtp(
  requestId: string,
  otp: string,
): Promise<OtpVerifyResult | OtpError> {
  try {
    const res = await postLogin({
      method: 'phone_verify',
      requestId,
      otp,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || data.ok === false) {
      return {
        ok: false,
        error: String(data.error || `Invalid or expired OTP (${res.status})`),
      };
    }
    return {
      ok: true,
      userId: (data.userId as string | number | null | undefined) ?? null,
      message: String(data.message || 'Signed in with mobile OTP.'),
    };
  } catch (err) {
    return networkError(err);
  }
}

export async function checkOtpSession(): Promise<{
  authenticated: boolean;
  userId: string | number | null;
}> {
  try {
    const res = await fetch(`${OTP_API_BASE}${OTP_LOGIN_PATH}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { authenticated: false, userId: null };
    const data = (await res.json()) as {
      authenticated?: boolean;
      userId?: string | number | null;
    };
    return {
      authenticated: Boolean(data.authenticated),
      userId: data.userId ?? null,
    };
  } catch {
    return { authenticated: false, userId: null };
  }
}
