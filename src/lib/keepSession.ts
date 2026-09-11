import { canonicalAuthOrigin, refreshAppSession } from './appAuth';
import {
  accessTokenExpiryMs,
  getActiveSession,
  saveSession,
  type AppSession,
} from './session';

const REFRESH_SKEW_MS = 2 * 60 * 1000;

export async function ensureFreshSession(): Promise<AppSession | null> {
  const session = getActiveSession();
  if (!session) return null;

  const expiry = accessTokenExpiryMs(session.accessToken);
  const stillFresh = expiry !== null && expiry - Date.now() > REFRESH_SKEW_MS;
  if (stillFresh) return session;
  if (!session.refreshToken) return session;

  try {
    const data = await refreshAppSession({
      origin: canonicalAuthOrigin(session.origin),
      refreshToken: session.refreshToken,
    });
    const accessToken = String(data.accessToken || data.access_token || session.accessToken);
    const refreshToken = String(
      data.refreshToken || data.refresh_token || session.refreshToken,
    );
    const next: AppSession = {
      ...session,
      accessToken,
      refreshToken,
      verifiedAt: new Date().toISOString(),
    };
    saveSession(next);
    return next;
  } catch {
    // Keep the existing app session; QR confirm can still use the refresh token.
    return session;
  }
}
