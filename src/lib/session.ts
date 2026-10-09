const SESSION_KEY = 'uwezo.fund.app.session.v1';
const INBOX_KEY = 'uwezo.fund.app.inbox.v1';
const SEEN_KEY = 'uwezo.fund.app.seenNotices.v1';

export type AppSession = {
  email: string;
  phone: string;
  accessToken: string;
  refreshToken?: string;
  origin: string;
  remainSignedIn: boolean;
  verifiedAt: string;
  majuuAccessToken?: string;
  majuuRefreshToken?: string;
  loansAccessToken?: string;
  loansRefreshToken?: string;
  portals?: string[];
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  kind: 'otp' | 'loan_status' | 'system';
  createdAt: string;
  read: boolean;
  meta?: Record<string, string>;
};

export function noticeFingerprint(item: {
  id?: string;
  title: string;
  body: string;
  kind: string;
}) {
  return `${item.kind}|${item.title}|${item.body}`.slice(0, 400);
}

export function extractOtpCode(text: string): string | null {
  const match = String(text || '').match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

export function noticeDedupeKeys(item: {
  id?: string;
  title: string;
  body: string;
  kind: string;
}) {
  const keys = [item.id, noticeFingerprint(item)].filter(
    (key): key is string => Boolean(key),
  );
  const code = extractOtpCode(item.body);
  if (code) keys.push(`otp:${code}`);
  return keys;
}

export function loadSeenNoticeKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(list) ? list.slice(0, 400) : []);
  } catch {
    return new Set();
  }
}

export function rememberSeenNoticeKeys(keys: Iterable<string>) {
  const next = [...new Set([...loadSeenNoticeKeys(), ...keys])].slice(-400);
  localStorage.setItem(SEEN_KEY, JSON.stringify(next));
}

export function loadSession(): AppSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppSession;
    if (!parsed?.email || !parsed?.phone || !parsed?.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: AppSession) {
  if (session.remainSignedIn) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.removeItem(SESSION_KEY);
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export function getActiveSession(): AppSession | null {
  try {
    const fromSession = sessionStorage.getItem(SESSION_KEY);
    if (fromSession) {
      const parsed = JSON.parse(fromSession) as AppSession;
      if (parsed?.accessToken) return canonicalizeSession(parsed);
    }
  } catch {
    // ignore
  }
  const stored = loadSession();
  return stored ? canonicalizeSession(stored) : null;
}

function canonicalizeSession(session: AppSession): AppSession {
  const origin = session.origin.replace(/\/$/, '');
  if (origin.includes('loans-staging') || origin.includes('loans.uwezo.go.ke')) {
    if (origin !== 'https://loans.uwezo.go.ke') {
      const next = { ...session, origin: 'https://loans.uwezo.go.ke' };
      if (session.remainSignedIn) {
        try {
          localStorage.setItem(SESSION_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    }
  }
  return session;
}

export function accessTokenExpiryMs(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(padded)) as { exp?: number };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function loadInbox(): AppNotification[] {
  try {
    const raw = localStorage.getItem(INBOX_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as AppNotification[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function newId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // older Android WebViews
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function upsertInbox(
  item: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & {
    id?: string;
    createdAt?: string;
  },
): { notice: AppNotification; created: boolean } {
  const list = loadInbox();
  const fingerprint = noticeFingerprint(item);
  const existing = list.find(
    (row) =>
      (item.id && (row.id === item.id || row.meta?.id === item.id)) ||
      noticeFingerprint(row) === fingerprint,
  );
  if (existing) {
    return { notice: existing, created: false };
  }
  const notice: AppNotification = {
    id: item.id || newId(),
    title: item.title,
    body: item.body,
    kind: item.kind,
    createdAt: item.createdAt || new Date().toISOString(),
    read: false,
    meta: { ...item.meta, ...(item.id ? { id: item.id } : {}) },
  };
  localStorage.setItem(INBOX_KEY, JSON.stringify([notice, ...list].slice(0, 100)));
  return { notice, created: true };
}

export function pushInbox(item: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) {
  return upsertInbox(item).notice;
}

export function markInboxRead(id?: string) {
  const list = loadInbox().map((n) =>
    !id || n.id === id ? { ...n, read: true } : n,
  );
  localStorage.setItem(INBOX_KEY, JSON.stringify(list));
}
