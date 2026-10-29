import type { LmsRole } from './lmsSync';

const KEY = 'uwezo.staff.session.v1';

export type MailAuthVia = 'password' | 'delegate';

export type MailLink = {
  email: string;
  token: string;
  /** Empty when mail was opened through the admin delegate path. */
  password: string;
  /** How this token was obtained — password = Zimbra user login; delegate = mail admin. */
  via?: MailAuthVia;
};

export type StaffAuthVia = 'zimbra' | 'lms';

export type StaffSession = {
  email: string;
  constituency: string;
  role: LmsRole;
  syncDetail: string;
  passwordReset: boolean;
  password: string;
  signedInAt: string;
  /** How the officer signed into the app (mailbox Zimbra vs LMS database). */
  authVia?: StaffAuthVia;
  /**
   * True when @uwezo.go.ke mail works but the address is not an LMS user.
   * App may open Mail only — never the LMS React shell.
   */
  mailOnly?: boolean;
  /** Typed password was accepted by eBoard during this app session. */
  eboardVerified?: boolean;
  mail: MailLink | null;
};

export function loadStaffSession(): StaffSession | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '') as StaffSession;
    if (!parsed?.email || !parsed.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStaffSession(session: StaffSession) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearStaffSession() {
  localStorage.removeItem(KEY);
}
