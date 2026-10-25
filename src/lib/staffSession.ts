import type { LmsRole } from './lmsSync';

const KEY = 'uwezo.staff.session.v1';

export type MailLink = {
  email: string;
  token: string;
  password: string;
};

export type StaffSession = {
  email: string;
  constituency: string;
  role: LmsRole;
  syncDetail: string;
  passwordReset: boolean;
  password: string;
  signedInAt: string;
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
