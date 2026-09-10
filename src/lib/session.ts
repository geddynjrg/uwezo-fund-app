const SESSION_KEY = 'uwezo.fund.app.session.v1';
const INBOX_KEY = 'uwezo.fund.app.inbox.v1';

export type AppSession = {
  email: string;
  phone: string;
  accessToken: string;
  refreshToken?: string;
  origin: string;
  remainSignedIn: boolean;
  verifiedAt: string;
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
      if (parsed?.accessToken) return parsed;
    }
  } catch {
    // ignore
  }
  return loadSession();
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

export function pushInbox(item: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) {
  const next: AppNotification = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    read: false,
  };
  const list = [next, ...loadInbox()].slice(0, 100);
  localStorage.setItem(INBOX_KEY, JSON.stringify(list));
  return next;
}

export function markInboxRead(id?: string) {
  const list = loadInbox().map((n) =>
    !id || n.id === id ? { ...n, read: true } : n,
  );
  localStorage.setItem(INBOX_KEY, JSON.stringify(list));
}
