import { appUnifiedLogin } from './appAuth';
import { normalizeKenyanPhone } from './phone';
import { saveSession, type AppSession } from './session';

const KEY = 'uwezo.fund.pendingLogin.v1';

export type PendingLogin = {
  email: string;
  password: string;
  phone: string;
  remainSignedIn: boolean;
  simVerified: boolean;
  savedAt: string;
  lastError: string;
};

export function isUnreachableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /could not reach|timed out|failed to fetch|network|abort/i.test(message);
}

export function loadPendingLogin(): PendingLogin | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingLogin;
    if (!parsed.email || !parsed.password || !parsed.phone) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePendingLogin(input: Omit<PendingLogin, 'savedAt' | 'lastError'> & { lastError?: string }) {
  const value: PendingLogin = {
    email: input.email.trim().toLowerCase(),
    password: input.password,
    phone: normalizeKenyanPhone(input.phone),
    remainSignedIn: input.remainSignedIn,
    simVerified: input.simVerified,
    savedAt: new Date().toISOString(),
    lastError: input.lastError || '',
  };
  localStorage.setItem(KEY, JSON.stringify(value));
  return value;
}

export function clearPendingLogin() {
  localStorage.removeItem(KEY);
}

/** Try the saved sign-in once Majuu answers. A wrong password is kept for the user to correct. */
export async function replayPendingLogin(): Promise<'idle' | 'signed-in' | 'unreachable' | 'rejected'> {
  const pending = loadPendingLogin();
  if (!pending || pending.lastError) return pending ? 'rejected' : 'idle';
  try {
    const data = await appUnifiedLogin({
      email: pending.email,
      password: pending.password,
      phone: pending.phone,
      simVerified: pending.simVerified,
    });
    const majuuAccessToken = String(data.majuuAccessToken || '');
    const loansAccessToken = String(data.loansAccessToken || '');
    const next: AppSession = {
      email: pending.email,
      phone: pending.phone,
      accessToken: String(data.accessToken || data.access_token || majuuAccessToken || loansAccessToken),
      refreshToken:
        String(data.refreshToken || data.refresh_token || data.majuuRefreshToken || data.loansRefreshToken || '') ||
        undefined,
      origin: majuuAccessToken ? 'https://majuu.uwezo.go.ke' : 'https://loans.uwezo.go.ke',
      remainSignedIn: pending.remainSignedIn,
      verifiedAt: new Date().toISOString(),
      majuuAccessToken: majuuAccessToken || undefined,
      majuuRefreshToken: String(data.majuuRefreshToken || '') || undefined,
      loansAccessToken: loansAccessToken || undefined,
      loansRefreshToken: String(data.loansRefreshToken || '') || undefined,
      portals: Array.isArray(data.portals) ? data.portals.map((item) => String(item)) : [],
    };
    if (!next.accessToken) throw new Error('Login succeeded but no access token returned.');
    saveSession(next);
    clearPendingLogin();
    return 'signed-in';
  } catch (error) {
    if (isUnreachableError(error)) return 'unreachable';
    savePendingLogin({
      ...pending,
      lastError: error instanceof Error ? error.message : 'Sign-in was rejected.',
    });
    return 'rejected';
  }
}
