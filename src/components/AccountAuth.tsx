import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import logo from '../assets/uwezo-fund-logo.png';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import {
  appLoginProbe,
  appResetPassword,
  appUnifiedLogin,
  confirmContactCodes,
  requestContactConfirmation,
  type ApplicantPortalProbe,
} from '../lib/appAuth';
import { readSimPhoneNumber } from '../lib/native';
import { isLikelyKenyanMobile, normalizeKenyanPhone, sameKenyanLine } from '../lib/phone';
import {
  clearSession,
  getActiveSession,
  saveSession,
  type AppSession,
} from '../lib/session';
import { stopOtpListener } from '../lib/native';
import { isUnreachableError, savePendingLogin, clearPendingLogin } from '../lib/pendingLogin';
import { LINKS } from '../config';
import { probeOrigin, type PortalId } from '../lib/portalStatus';
import { cacheHasFigures, fetchOfficerProfile, fetchStaffRole, lmsHostOnline, loadLmsCache, openLmsFromZimbra, rememberMappedMenu, roleLabel, saveLmsCache, syncLmsMailbox, type LmsRole, type OfficerProfile } from '../lib/lmsSync';
import { openApplicantCopy, sealApplicantCopy } from '../lib/applicantVault';
import { clearPublishedRecords, publishApplicantRecords, pullApplicantRecords, recordsNote } from '../lib/applicantRecords';
import { officerCopyStatus, openOfficerCopy, sealOfficerCopy } from '../lib/officerVault';
import { getLastEboardProbeStatus, openEboardHome, probeEboardLogin } from '../lib/eboard';
import { loadStaffSession, saveStaffSession, type MailLink, type StaffAuthVia } from '../lib/staffSession';
import { isUwezoMailbox, openMailboxForOfficer, signInMailbox } from '../lib/zimbraAuth';

// #region agent log
function dbgAuth(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown> = {},
) {
  const payload = JSON.stringify({
    sessionId: '9becc5',
    runId: 'eboard-login',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  });
  const headers = { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '9becc5' };
  fetch('http://127.0.0.1:7591/ingest/fc16f6e6-2411-411d-be27-2c94d7813f56', {
    method: 'POST',
    headers,
    body: payload,
  }).catch(() => {});
  fetch('https://loans.uwezo.go.ke/uwezo-app/__dbg', { method: 'POST', headers, body: payload }).catch(
    () => {},
  );
  if (Capacitor.isNativePlatform()) {
    void CapacitorHttp.post({
      url: 'https://loans.uwezo.go.ke/uwezo-app/__dbg',
      headers,
      data: payload,
      connectTimeout: 4000,
      readTimeout: 4000,
    }).catch(() => {});
  }
}
// #endregion

type Mode = 'menu' | 'login' | 'reset' | 'signed_in';

type OfficerOpenPayload = {
  email: string;
  constituency: string;
  passwordReset: boolean;
  role: LmsRole;
  syncDetail: string;
  mailOnly?: boolean;
};

function emptyPortalProbe(): ApplicantPortalProbe {
  return {
    majuu: false,
    loans: false,
    eboard: false,
    majuuAccessToken: '',
    majuuRefreshToken: '',
    loansAccessToken: '',
    loansRefreshToken: '',
  };
}

type PortalChooser = {
  email: string;
  password: string;
  phone: string;
  officer: OfficerOpenPayload;
  mail: MailLink | null;
  authVia: StaffAuthVia;
  lmsPassword: string;
  probe: ApplicantPortalProbe;
};

type AccountAuthProps = {
  onBack: () => void;
  onSessionChange?: (session: AppSession | null) => void;
  onContinueOffline?: (portal: PortalId) => void;
  onOpenLms?: (officer: OfficerOpenPayload) => void;
};

export function AccountAuth({ onBack, onSessionChange, onContinueOffline, onOpenLms }: AccountAuthProps) {
  const [mode, setMode] = useState<Mode>('menu');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [remainSignedIn, setRemainSignedIn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [session, setSession] = useState<AppSession | null>(null);
  const [simNumbers, setSimNumbers] = useState<string[]>([]);
  const [simState, setSimState] = useState<
    'idle' | 'checking' | 'locked' | 'manual' | 'offline' | 'denied'
  >('idle');
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [otpChallenge, setOtpChallenge] = useState<{
    emailRequestId: string;
    phoneRequestId: string;
    phoneChannel: string;
  } | null>(null);
  const [savedForLater, setSavedForLater] = useState(false);
  const [recordNote, setRecordNote] = useState('');
  const [portalChooser, setPortalChooser] = useState<PortalChooser | null>(null);

  useEffect(() => {
    const existing = getActiveSession();
    setSession(existing);
    if (existing) setMode('signed_in');
  }, []);

  useEffect(() => {
    if (mode !== 'login') return;
    void loadSimNumber();
  }, [mode]);

  async function loadSimNumber() {
    if (!Capacitor.isNativePlatform()) {
      setSimState('manual');
      setSimNumbers([]);
      return;
    }
    setSimState('checking');
    setError('');
    const result = await readSimPhoneNumber();
    if (!result.online || result.permission === 'offline') {
      setSimNumbers([]);
      setSimState('offline');
      return;
    }
    if (result.permission === 'denied') {
      setSimNumbers([]);
      setSimState('denied');
      return;
    }
    const numbers = result.numbers
      .map((item) => normalizeKenyanPhone(item))
      .filter((item) => isLikelyKenyanMobile(item));
    if (numbers.length > 0) {
      setSimNumbers(numbers);
      setPhone(numbers[0]);
      setSimState('locked');
      return;
    }
    setSimNumbers([]);
    setSimState('manual');
  }

  function applySession(next: AppSession | null) {
    setSession(next);
    onSessionChange?.(next);
  }

  function rememberOfficer(input: {
    email: string;
    constituency: string;
    role: LmsRole;
    syncDetail: string;
    passwordReset: boolean;
    lmsPassword: string;
    authVia: StaffAuthVia;
    mail: MailLink | null;
    mailOnly?: boolean;
    eboardVerified?: boolean;
  }) {
    const previous = loadStaffSession();
    saveStaffSession({
      email: input.email,
      constituency: input.constituency,
      role: input.role,
      syncDetail: input.syncDetail,
      passwordReset: input.passwordReset || Boolean(previous?.email === input.email && previous.passwordReset),
      password: input.lmsPassword,
      authVia: input.authVia,
      signedInAt: new Date().toISOString(),
      mailOnly: Boolean(input.mailOnly),
      eboardVerified:
        input.eboardVerified === true ||
        Boolean(previous?.email === input.email && previous.eboardVerified),
      mail: input.mail || (previous?.email === input.email ? previous.mail : null),
    });
    onOpenLms?.({
      email: input.email,
      constituency: input.constituency,
      passwordReset: input.passwordReset,
      role: input.role,
      syncDetail: input.syncDetail,
      mailOnly: Boolean(input.mailOnly),
    });
  }

  async function openApplicantPortal(
    chooser: PortalChooser,
    portal: 'majuu' | 'loans',
  ) {
    const probe = chooser.probe;
    const majuuOk = portal === 'majuu' && probe.majuu;
    const loansOk = portal === 'loans' && probe.loans;
    if (!majuuOk && !loansOk) {
      setError(portal === 'majuu' ? 'Wezesha Majuu did not accept this password.' : 'Loans did not accept this password.');
      return;
    }
    // Isolate portals: Majuu session never carries Loans tokens, and vice versa.
    const next: AppSession = {
      email: chooser.email,
      phone: chooser.phone || '0000000000',
      accessToken: majuuOk ? probe.majuuAccessToken : probe.loansAccessToken,
      refreshToken: majuuOk ? probe.majuuRefreshToken || undefined : probe.loansRefreshToken || undefined,
      origin: majuuOk ? 'https://majuu.uwezo.go.ke' : 'https://loans.uwezo.go.ke',
      remainSignedIn,
      verifiedAt: new Date().toISOString(),
      majuuAccessToken: majuuOk ? probe.majuuAccessToken : undefined,
      majuuRefreshToken: majuuOk ? probe.majuuRefreshToken || undefined : undefined,
      loansAccessToken: loansOk ? probe.loansAccessToken : undefined,
      loansRefreshToken: loansOk ? probe.loansRefreshToken || undefined : undefined,
      portals: [majuuOk ? 'https://majuu.uwezo.go.ke' : 'https://loans.uwezo.go.ke'],
      eboardVerified: probe.eboard || undefined,
    };
    saveSession(next);
    clearPendingLogin();
    try {
      const records = await pullApplicantRecords(next);
      await sealApplicantCopy(chooser.password, {
        email: chooser.email,
        phone: next.phone,
        savedAt: records.savedAt,
        session: next,
        records,
      });
      const numbers = await publishApplicantRecords(records);
      setRecordNote(recordsNote(numbers));
    } catch {
      setRecordNote('');
    }
    applySession(next);
    setPortalChooser(null);
    setMode('signed_in');
    setMessage(
      majuuOk
        ? 'Signed in to Wezesha Majuu only. Loans applications are not mixed into this session.'
        : 'Signed in to Loans only. Wezesha Majuu applications are not mixed into this session.',
    );
  }

  async function finishOfficerWithOptionalChooser(input: {
    email: string;
    password: string;
    phone: string;
    officer: OfficerOpenPayload;
    mail: MailLink | null;
    authVia: StaffAuthVia;
    lmsPassword: string;
    mailOnly?: boolean;
  }) {
    let probe = emptyPortalProbe();
    try {
      probe = await appLoginProbe({
        email: input.email,
        password: input.password,
        phone: input.phone,
      });
    } catch {
      probe = emptyPortalProbe();
    }
    if (probe.majuu || probe.loans || probe.eboard) {
      setPortalChooser({
        email: input.email,
        password: input.password,
        phone: input.phone,
        officer: input.officer,
        mail: input.mail,
        authVia: input.authVia,
        lmsPassword: input.lmsPassword,
        probe,
      });
      setMessage(
        probe.eboard && !probe.majuu && !probe.loans
          ? 'Choose LMS or eBoard for this sign-in.'
          : 'This Uwezo mailbox is also accepted on another portal. Choose LMS, Wezesha Majuu, Loans, or eBoard when offered. Domain mailboxes cannot create new applicant accounts.',
      );
      return;
    }
    rememberOfficer({
      email: input.officer.email,
      constituency: input.officer.constituency,
      passwordReset: input.officer.passwordReset,
      role: input.officer.role,
      syncDetail: input.officer.syncDetail,
      lmsPassword: input.lmsPassword,
      authVia: input.authVia,
      mail: input.mail,
      mailOnly: Boolean(input.mailOnly),
      eboardVerified: false,
    });
  }

  async function openEboardFromChooser(chooser: PortalChooser) {
    if (!chooser.probe.eboard) {
      setError('eBoard did not accept this password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      let mail = chooser.mail;
      let passwordReset = chooser.officer.passwordReset;
      // Same as LMS password login: never treat the typed/eBoard password as Zimbra.
      if (isUwezoMailbox(chooser.email)) {
        const linked = await ensureMailLink(chooser.email, chooser.password, true);
        if (linked) {
          mail = linked.mail;
          passwordReset = passwordReset || linked.passwordReset;
        }
      }
      rememberOfficer({
        email: chooser.officer.email,
        constituency: chooser.officer.constituency,
        passwordReset,
        role: chooser.officer.role,
        syncDetail: chooser.officer.syncDetail,
        lmsPassword: chooser.lmsPassword,
        authVia: chooser.authVia,
        mail,
        mailOnly: Boolean(chooser.officer.mailOnly),
        eboardVerified: true,
      });
      setPortalChooser(null);
      await openEboardHome();
      setMessage(
        isUwezoMailbox(chooser.email)
          ? 'Opening eBoard. Mail stays available for this session.'
          : 'Opening eBoard…',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open eBoard.');
    } finally {
      setBusy(false);
    }
  }

  /** After LMS DB login, open mail.govmail.ke for this address when needed. */
  async function ensureMailLink(
    emailNorm: string,
    password: string,
    preferDelegate = false,
  ): Promise<{ mail: MailLink; passwordReset: boolean } | null> {
    if (!isUwezoMailbox(emailNorm)) return null;
    // LMS password ≠ mail password → ictsupport DelegateAuth first (preferDelegate).
    const opened = await openMailboxForOfficer(emailNorm, password, preferDelegate);
    // #region agent log
    fetch('http://127.0.0.1:7591/ingest/fc16f6e6-2411-411d-be27-2c94d7813f56', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '9becc5' },
      body: JSON.stringify({
        sessionId: '9becc5',
        runId: 'post-fix',
        hypothesisId: 'C',
        location: 'AccountAuth.tsx:ensureMailLink',
        message: opened.ok ? 'mail link opened' : 'mail link failed',
        data: {
          local: emailNorm.split('@')[0],
          preferDelegate,
          ok: opened.ok,
          via: opened.ok ? opened.via || '' : '',
          err: opened.ok ? '' : opened.message.slice(0, 120),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    if (!opened.ok) return null;
    return {
      mail: {
        email: opened.email,
        token: opened.token,
        password: opened.password,
        via: opened.via || (opened.password ? 'password' : 'delegate'),
      },
      passwordReset: Boolean(opened.passwordReset),
    };
  }

  async function keepOfficerCopy(input: {
    email: string;
    password: string;
    role: LmsRole;
    constituency: string;
    syncDetail: string;
    profile?: OfficerProfile | null;
  }) {
    const cache = loadLmsCache(input.email);
    const savedAt = new Date().toISOString();
    await sealOfficerCopy(input.password, {
      profile: {
        email: input.email,
        name: input.profile?.name || '',
        phone: input.profile?.phone || '',
        idNumber: input.profile?.idNumber || '',
        role: input.profile?.role || input.role,
        constituency: input.profile?.constituency || input.constituency,
        base: input.profile?.base || '',
      },
      syncDetail: input.syncDetail,
      menu: cache?.menu || [],
      pages: cache?.pages || {},
      savedAt,
    });
  }

  async function restoreOfficerCopy(emailNorm: string, enteredPassword: string) {
    const status = officerCopyStatus(emailNorm);
    if (!status) return false;
    if (status.stale) {
      setError('Officer details on this phone are 15 days old. Connect to the internet to refresh them.');
      return true;
    }
    const copy = await openOfficerCopy(emailNorm, enteredPassword);
    if (!copy) return false;
    saveLmsCache({
      email: emailNorm,
      role: copy.profile.role,
      fetchedAt: copy.savedAt,
      detail: copy.syncDetail,
      pages: copy.pages,
      menu: copy.menu,
      host: 'https://lms.uwezo.go.ke',
    });
    const restoredMail = await ensureMailLink(emailNorm, enteredPassword, true);
    rememberOfficer({
      email: emailNorm,
      constituency: copy.profile.constituency || emailNorm,
      passwordReset: Boolean(restoredMail?.passwordReset),
      role: copy.profile.role,
      syncDetail: `${copy.syncDetail} Working from the encrypted copy saved on this phone.`,
      lmsPassword: '',
      authVia: 'lms',
      mail: restoredMail?.mail || null,
    });
    return true;
  }

  /** When LMS/Zimbra fail, still allow @uwezo.go.ke sign-in if eBoard accepts the typed password. */
  async function tryEboardOnlyOfficer(
    emailNorm: string,
    typedPassword: string,
    phoneNorm: string,
    priorDetail: string,
  ): Promise<boolean> {
    // #region agent log
    dbgAuth('C', 'AccountAuth.tsx:tryEboardOnlyOfficer', 'entered eBoard-only fallback', {
      local: emailNorm.split('@')[0],
      prior: priorDetail.slice(0, 120),
      passLen: typedPassword.length,
    });
    // #endregion
    let probe = emptyPortalProbe();
    try {
      probe = await appLoginProbe({
        email: emailNorm,
        password: typedPassword,
        phone: phoneNorm,
      });
    } catch (err) {
      // #region agent log
      dbgAuth('D', 'AccountAuth.tsx:tryEboardOnlyOfficer', 'appLoginProbe threw', {
        err: err instanceof Error ? err.message.slice(0, 80) : 'error',
      });
      // #endregion
      return false;
    }
    // #region agent log
    dbgAuth('C', 'AccountAuth.tsx:tryEboardOnlyOfficer', 'probe result', {
      majuu: probe.majuu,
      loans: probe.loans,
      eboard: probe.eboard,
    });
    // #endregion
    if (!probe.eboard) return false;
    const linked = await ensureMailLink(emailNorm, typedPassword, true);
    const officer: OfficerOpenPayload = {
      email: emailNorm,
      constituency: '',
      passwordReset: Boolean(linked?.passwordReset),
      role: 'staff',
      syncDetail: [
        priorDetail,
        'eBoard accepted this password. LMS was not opened for this sign-in.',
      ]
        .filter(Boolean)
        .join(' '),
      mailOnly: true,
    };
    if (probe.majuu || probe.loans) {
      setPortalChooser({
        email: emailNorm,
        password: typedPassword,
        phone: phoneNorm,
        officer,
        mail: linked?.mail || null,
        authVia: 'zimbra',
        lmsPassword: '',
        probe,
      });
      setMessage('eBoard accepted this password. Choose eBoard, Wezesha Majuu, or Loans.');
      return true;
    }
    rememberOfficer({
      email: emailNorm,
      constituency: '',
      passwordReset: Boolean(linked?.passwordReset),
      role: 'staff',
      syncDetail: officer.syncDetail,
      lmsPassword: '',
      authVia: 'zimbra',
      mail: linked?.mail || null,
      mailOnly: true,
      eboardVerified: true,
    });
    setMessage('Signed in with eBoard. Mail is available when the mailbox link succeeded.');
    return true;
  }

  async function restoreApplicant(emailNorm: string, passwordValue: string, phoneValue: string): Promise<boolean> {
    const copy = await openApplicantCopy(emailNorm, passwordValue);
    if (!copy) return false;
    if (phoneValue && copy.phone && !sameKenyanLine(phoneValue, copy.phone)) return false;
    const numbers = await publishApplicantRecords(copy.records);
    const next = { ...copy.session, remainSignedIn, phone: phoneValue || copy.session.phone, email: emailNorm };
    saveSession(next);
    clearPendingLogin();
    applySession(next);
    setRecordNote(recordsNote(numbers));
    setSavedForLater(false);
    setMode('signed_in');
    setMessage('Signed in from the encrypted copy on this phone. Majuu and Loans records are available without internet.');
    return true;
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    const emailNorm = email.trim().toLowerCase();
    const phoneNorm = normalizeKenyanPhone(phone.trim());
    if (!emailNorm) {
      setError('Enter the email for this portal account.');
      return;
    }
    if (password.length < 1) {
      setError('Enter the password.');
      return;
    }
    setBusy(true);
    setError('');
    setSavedForLater(false);
    setPortalChooser(null);
    try {
      if (isUwezoMailbox(emailNorm)) {
        // Domain mailboxes are for LMS / mail only — never create Majuu or Loans applicant accounts.
        const lmsOnline = await lmsHostOnline();
        const mailbox = await signInMailbox(emailNorm, password);
        const mailLink: MailLink | null = mailbox.ok
          ? { email: mailbox.email, token: mailbox.token, password: mailbox.password, via: 'password' }
          : null;
        const details = officerCopyStatus(emailNorm);
        const refreshDetails = !details || details.stale || !cacheHasFigures(loadLmsCache(emailNorm));
        const needLmsSession = lmsOnline && (refreshDetails || !loadLmsCache(emailNorm)?.cookie);

        if (mailbox.ok) {
          const opened = needLmsSession ? await openLmsFromZimbra(mailbox.email, mailbox.token) : null;
          const mapped =
            lmsOnline && !opened?.authenticated
              ? await fetchStaffRole('https://lms.uwezo.go.ke', mailbox.email)
              : null;
          if (!opened?.authenticated && mapped?.found) rememberMappedMenu(mailbox.email, mapped);

          const cachedRole = loadLmsCache(emailNorm)?.role;
          const hasCachedLms = Boolean(cachedRole && cachedRole !== 'staff' && loadLmsCache(emailNorm)?.cookie);
          const hasLmsUser = Boolean(opened?.authenticated || mapped?.found || hasCachedLms);
          if (!hasLmsUser) {
            // Offline fallback: encrypted officer copy proves this mailbox is an LMS user.
            if (!lmsOnline && (await restoreOfficerCopy(emailNorm, password))) return;
            // Zimbra OK but not an LMS user → mail only (plus eBoard when the typed password matches).
            await finishOfficerWithOptionalChooser({
              email: mailbox.email,
              password,
              phone: phoneNorm,
              officer: {
                email: mailbox.email,
                constituency: '',
                passwordReset: mailbox.passwordReset,
                role: 'staff',
                syncDetail:
                  'Mailbox signed in. This address is not an LMS user, so only Mail is available — not the loan management system.',
                mailOnly: true,
              },
              mail: mailLink,
              authVia: 'zimbra',
              lmsPassword: mailbox.password || password,
              mailOnly: true,
            });
            return;
          }

          if (!opened?.authenticated && !refreshDetails) {
            const restored = await openOfficerCopy(emailNorm, password);
            if (restored) {
              saveLmsCache({
                email: emailNorm,
                role: restored.profile.role,
                fetchedAt: restored.savedAt,
                detail: restored.syncDetail,
                pages: restored.pages,
                menu: restored.menu,
                host: loadLmsCache(emailNorm)?.host || 'https://lms.uwezo.go.ke',
                cookie: loadLmsCache(emailNorm)?.cookie,
              });
            }
          }

          const role = opened?.authenticated
            ? opened.role
            : mapped?.found
              ? mapped.role
              : loadLmsCache(emailNorm)?.role || 'staff';
          const constituency = opened?.constituency || mapped?.constituency || emailNorm;
          const syncDetail = opened?.authenticated
            ? opened.detail
            : [
                'Signed in with the mailbox.',
                opened?.detail,
                mapped?.found ? `This mailbox is mapped as ${roleLabel(role)}.` : '',
                refreshDetails ? '' : 'Officer details on this phone are still within 15 days.',
              ]
                .filter(Boolean)
                .join(' ');
          const profile =
            opened?.authenticated && loadLmsCache(emailNorm)?.host && loadLmsCache(emailNorm)?.cookie
              ? await fetchOfficerProfile(
                  loadLmsCache(emailNorm)?.host || '',
                  loadLmsCache(emailNorm)?.cookie || '',
                  emailNorm,
                )
              : mapped?.found
                ? {
                    email: emailNorm,
                    name: '',
                    phone: '',
                    idNumber: '',
                    role: mapped.role,
                    constituency: mapped.constituency,
                    base: mapped.base,
                  }
                : null;
          if (refreshDetails || opened?.authenticated) {
            await keepOfficerCopy({
              email: mailbox.email,
              password,
              role: profile?.role || role,
              constituency: profile?.constituency || constituency,
              syncDetail,
              profile,
            });
          }
          await finishOfficerWithOptionalChooser({
            email: mailbox.email,
            password,
            phone: phoneNorm,
            officer: {
              email: mailbox.email,
              constituency: profile?.constituency || constituency,
              passwordReset: mailbox.passwordReset,
              role: profile?.role || role,
              syncDetail,
            },
            mail: mailLink,
            authVia: 'zimbra',
            lmsPassword: mailbox.password || password,
          });
          return;
        }

        // Zimbra failed — try LMS password-session only (mail outage fallback).
        // #region agent log
        dbgAuth('C', 'AccountAuth.tsx:onLogin', 'mailbox failed; trying LMS/eBoard path', {
          local: emailNorm.split('@')[0],
          lmsOnline,
          mailMsg: (mailbox.message || '').slice(0, 100),
          passLen: password.length,
        });
        // #endregion
        if (lmsOnline) {
          const lms = await syncLmsMailbox(emailNorm, password, {
            refresh: needLmsSession || refreshDetails,
          });
          // #region agent log
          dbgAuth('E', 'AccountAuth.tsx:onLogin', 'LMS sync result', {
            authenticated: lms.authenticated,
            detail: (lms.detail || '').slice(0, 120),
            rejected: /did not accept|Too many sign-in|deactivated/i.test(lms.detail || ''),
          });
          // #endregion
          if (lms.authenticated) {
            const cache = loadLmsCache(emailNorm);
            const profile =
              cache?.host && cache.cookie
                ? await fetchOfficerProfile(cache.host, cache.cookie, emailNorm)
                : null;
            const syncDetail = refreshDetails
              ? lms.detail
              : `${lms.detail} Officer details on this phone are still within 15 days.`;
            const delegatedMail = await ensureMailLink(emailNorm, password, true);
            await keepOfficerCopy({
              email: emailNorm,
              password,
              role: profile?.role || lms.role,
              constituency: profile?.constituency || lms.constituency || emailNorm,
              syncDetail,
              profile,
            });
            await finishOfficerWithOptionalChooser({
              email: emailNorm,
              password,
              phone: phoneNorm,
              officer: {
                email: emailNorm,
                constituency: profile?.constituency || lms.constituency || emailNorm,
                passwordReset: Boolean(delegatedMail?.passwordReset),
                role: profile?.role || lms.role,
                syncDetail,
              },
              mail: delegatedMail?.mail || mailLink,
              authVia: 'lms',
              lmsPassword: password,
            });
            return;
          }
          const rejected = /did not accept|Too many sign-in|deactivated/i.test(lms.detail);
          if (!rejected && (await restoreOfficerCopy(emailNorm, password))) return;
          const eboardOk = await tryEboardOnlyOfficer(
            emailNorm,
            password,
            phoneNorm,
            mailbox.message || lms.detail,
          );
          const eboardStatus = getLastEboardProbeStatus();
          // #region agent log
          dbgAuth('C', 'AccountAuth.tsx:onLogin', 'after tryEboardOnlyOfficer', {
            eboardOk,
            rejected,
            eboardReachable: eboardStatus.reachable,
            eboardAccepted: eboardStatus.accepted,
            eboardDetail: eboardStatus.detail.slice(0, 120),
            willShowMailLmsError: !eboardOk,
          });
          // #endregion
          if (eboardOk) {
            return;
          }
          // Prefer the real eBoard outcome — mail/LMS messages alone hide unreachable hosts.
          if (!eboardStatus.reachable) {
            setError(
              [
                eboardStatus.detail ||
                  'Could not reach eBoard from this phone. The password was not checked on eBoard.',
                mailbox.message,
                lms.detail,
              ]
                .filter(Boolean)
                .join(' '),
            );
          } else {
            setError(
              [mailbox.message, lms.detail, eboardStatus.detail].filter(Boolean).join(' ') ||
                'Sign-in was not accepted.',
            );
          }
          return;
        }
        if (await restoreOfficerCopy(emailNorm, password)) return;
        if (await tryEboardOnlyOfficer(emailNorm, password, phoneNorm, mailbox.message)) return;
        {
          const eboardStatus = getLastEboardProbeStatus();
          setError(
            [
              !eboardStatus.reachable ? eboardStatus.detail : '',
              mailbox.message,
              eboardStatus.reachable ? eboardStatus.detail : '',
            ]
              .filter(Boolean)
              .join(' ') ||
              'Could not reach the mailbox or lms.uwezo.go.ke. Check your connection, then try again.',
          );
        }
        return;
      }
    } catch {
      if (isUwezoMailbox(emailNorm) && (await restoreOfficerCopy(emailNorm, password))) return;
      if (isUwezoMailbox(emailNorm)) {
        if (await tryEboardOnlyOfficer(emailNorm, password, phoneNorm, '')) return;
        {
          const eboardStatus = getLastEboardProbeStatus();
          setError(
            eboardStatus.detail ||
              'Could not reach the mailbox, LMS, or eBoard. Check your connection, then try again.',
          );
        }
        return;
      }
      if (await restoreApplicant(emailNorm, password, phoneNorm)) return;
    } finally {
      setBusy(false);
    }
    // Domain mailboxes never use the citizen Majuu/Loans create-or-login path.
    if (isUwezoMailbox(emailNorm)) {
      setError('Uwezo mailbox sign-in is only for LMS, Mail, or eBoard. It cannot open or create applicant accounts here.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!isLikelyKenyanMobile(phoneNorm)) {
      setError('Enter a valid Kenyan mobile number such as 07XXXXXXXX or 01XXXXXXXX.');
      return;
    }
    const simMatch = simNumbers.some((number) => sameKenyanLine(number, phoneNorm));
    function keepForLater() {
      savePendingLogin({
        email: emailNorm,
        password,
        phone: phoneNorm,
        remainSignedIn,
        simVerified: simMatch,
      });
      setError('');
      setSavedForLater(true);
      setMessage(
        'Sign-in is saved on this phone. Majuu did not answer, so you can continue the loan or Wezesha Majuu application now. These credentials will be used when Majuu answers.',
      );
    }
    if (Capacitor.isNativePlatform() && simState === 'checking') {
      setError('Wait for the SIM number to be read.');
      return;
    }
    setBusy(true);
    setError('');
    setSavedForLater(false);
    try {
      const majuuUp = await probeOrigin(LINKS.majuu.url);
      if (!majuuUp || navigator.onLine === false) {
        if (await restoreApplicant(emailNorm, password, phoneNorm)) return;
        keepForLater();
        return;
      }
      if (Capacitor.isNativePlatform() && !simMatch) {
        if (!otpChallenge) {
          const sent = await requestContactConfirmation({
            email: emailNorm,
            phone: phoneNorm,
          });
          setOtpChallenge({
            emailRequestId: String(sent.emailRequestId || ''),
            phoneRequestId: String(sent.phoneRequestId || ''),
            phoneChannel: String(sent.phoneChannel || 'sms'),
          });
          setEmailCode('');
          setPhoneCode('');
          setMessage(String(sent.message || 'Enter the email code and the phone code.'));
          return;
        }
        if (emailCode.trim().length < 4 || phoneCode.trim().length < 4) {
          setError('Enter the email confirmation code and the phone confirmation code.');
          return;
        }
        await confirmContactCodes({
          emailRequestId: otpChallenge.emailRequestId,
          emailCode: emailCode.trim(),
          phoneRequestId: otpChallenge.phoneRequestId,
          phoneCode: phoneCode.trim(),
        });
      }
      const data = await appUnifiedLogin({
        email: emailNorm,
        password,
        phone: phoneNorm,
        simVerified: simMatch,
      });
      const majuuAccessToken = String(data.majuuAccessToken || '');
      const loansAccessToken = String(data.loansAccessToken || '');
      const portals = Array.isArray(data.portals)
        ? data.portals.map((item) => String(item))
        : [];
      const origin = majuuAccessToken
        ? 'https://majuu.uwezo.go.ke'
        : 'https://loans.uwezo.go.ke';
      let eboardVerified = false;
      try {
        eboardVerified = await probeEboardLogin(emailNorm, password);
      } catch {
        eboardVerified = false;
      }
      const next: AppSession = {
        email: emailNorm,
        phone: phoneNorm,
        accessToken: String(data.accessToken || data.access_token || majuuAccessToken || loansAccessToken),
        refreshToken:
          String(data.refreshToken || data.refresh_token || data.majuuRefreshToken || data.loansRefreshToken || '') ||
          undefined,
        origin,
        remainSignedIn,
        verifiedAt: new Date().toISOString(),
        majuuAccessToken: majuuAccessToken || undefined,
        majuuRefreshToken: String(data.majuuRefreshToken || '') || undefined,
        loansAccessToken: loansAccessToken || undefined,
        loansRefreshToken: String(data.loansRefreshToken || '') || undefined,
        portals,
        eboardVerified: eboardVerified || undefined,
      };
      if (!next.accessToken) throw new Error('Login succeeded but no access token returned.');
      saveSession(next);
      clearPendingLogin();
      const records = await pullApplicantRecords(next);
      await sealApplicantCopy(password, {
        email: emailNorm,
        phone: phoneNorm,
        savedAt: records.savedAt,
        session: next,
        records,
      });
      const numbers = await publishApplicantRecords(records);
      setRecordNote(recordsNote(numbers));
      applySession(next);
      setMode('signed_in');
      setMessage(
        [
          data.created
            ? 'Account created and you are signed in. An encrypted copy is saved on this phone.'
            : 'Signed in. An encrypted copy of this account is saved on this phone.',
          eboardVerified ? 'eBoard is available for this session.' : '',
        ]
          .filter(Boolean)
          .join(' '),
      );
    } catch (err) {
      if (isUnreachableError(err)) {
        if (await restoreApplicant(emailNorm, password, phoneNorm)) return;
        keepForLater();
        return;
      }
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await appResetPassword({
        origin: 'https://majuu.uwezo.go.ke',
        email,
      });
      setMessage(
        String(
          data.message ||
            'If that email exists, a password reset link was sent. Check your inbox.',
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    clearSession();
    void clearPublishedRecords();
    setRecordNote('');
    void stopOtpListener();
    applySession(null);
    setMode('menu');
    setMessage('Signed out.');
  }

  return (
    <div className="chat">
      <header className="chat-header">
        <button type="button" className="chat-back" onClick={onBack} aria-label="Back">
          ←
        </button>
        <img src={logo} alt="" className="chat-header__logo" width={36} height={36} />
        <div className="chat-header__text">
          <strong>Account</strong>
          <span>Sign in · reset · stay signed in</span>
        </div>
      </header>

      <div className="chat-thread">
        {message ? <div className="bubble bubble--bot">{message}</div> : null}
        {error ? <div className="bubble bubble--system">{error}</div> : null}
        {savedForLater && onContinueOffline ? (
          <div className="chat-success__actions">
            <button type="button" className="btn-primary" onClick={() => onContinueOffline('loans')}>
              Continue loan application
            </button>
            <button type="button" className="btn-ghost" onClick={() => onContinueOffline('majuu')}>
              Continue Wezesha Majuu
            </button>
          </div>
        ) : null}

        {portalChooser ? (
          <div className="chat-success__actions">
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => {
                const choice = portalChooser;
                setPortalChooser(null);
                rememberOfficer({
                  email: choice.officer.email,
                  constituency: choice.officer.constituency,
                  passwordReset: choice.officer.passwordReset,
                  role: choice.officer.role,
                  syncDetail: choice.officer.syncDetail,
                  lmsPassword: choice.lmsPassword,
                  authVia: choice.authVia,
                  mail: choice.mail,
                  mailOnly: Boolean(choice.officer.mailOnly),
                  eboardVerified: Boolean(choice.probe.eboard),
                });
              }}
            >
              {portalChooser.officer.mailOnly ? 'Open Mail' : 'Open LMS'}
            </button>
            {portalChooser.probe.majuu ? (
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => void openApplicantPortal(portalChooser, 'majuu')}
              >
                Open Wezesha Majuu applications
              </button>
            ) : null}
            {portalChooser.probe.loans ? (
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => void openApplicantPortal(portalChooser, 'loans')}
              >
                Open Loans applications
              </button>
            ) : null}
            {portalChooser.probe.eboard ? (
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => void openEboardFromChooser(portalChooser)}
              >
                Open eBoard
              </button>
            ) : null}
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => setPortalChooser(null)}>
              Cancel
            </button>
          </div>
        ) : null}

        {mode === 'menu' ? (
          <div className="chat-success__actions">
            <button type="button" className="btn-primary" onClick={() => setMode('login')}>
              Sign in (create if new)
            </button>
            <button type="button" className="btn-ghost" onClick={() => setMode('reset')}>
              Reset password
            </button>
          </div>
        ) : null}

        {mode === 'signed_in' && session ? (
          <div className="chat-success">
            <p>
              Signed in as <strong>{session.email}</strong>
              {'\n'}
              Phone: {session.phone}
            </p>
            {recordNote ? <p className="home-chat-note">{recordNote}</p> : null}
            <p>
              {'\n'}
              Portals:{' '}
              {(session.portals && session.portals.length
                ? session.portals
                : [session.origin]
              )
                .map((item) => item.replace(/^https:\/\//, ''))
                .join(', ')}
            </p>
            <div className="chat-success__actions">
              {session.eboardVerified ? (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={() => void openEboardHome()}
                >
                  Open eBoard
                </button>
              ) : null}
              <button type="button" className="btn-ghost" onClick={signOut}>
                Sign out
              </button>
            </div>
          </div>
        ) : null}

        {(mode === 'login' || mode === 'reset') && (
          <form
            className="account-form"
            noValidate
            onSubmit={(e) => {
              if (mode === 'login') void onLogin(e);
              else void onReset(e);
            }}
          >
            <p className="home-chat-note">
              Citizen emails use Wezesha Majuu and Loans (phone required). A mailbox such as
              name@uwezo.go.ke is checked at mail.govmail.ke first. If that mailbox is also an
              LMS user, you open the LMS (or choose Majuu/Loans only when those passwords already
              exist — domain mailboxes cannot create applicant accounts). If the mailbox works
              but is not on the LMS, only Mail opens. After a citizen sign-in, records are encrypted
              on this phone.
            </p>
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setOtpChallenge(null);
                }}
                required
                disabled={busy}
              />
            </label>
            {mode !== 'reset' ? (
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={busy}
                />
              </label>
            ) : null}
            {mode !== 'reset' && simNumbers.length > 0 ? (
              <div className="home-chat-note">
                <div>Numbers on the SIM in this phone:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {simNumbers.map((number) => (
                    <button
                      key={number}
                      type="button"
                      className="btn-ghost"
                      disabled={busy}
                      onClick={() => {
                        setPhone(number);
                        setOtpChallenge(null);
                      }}
                    >
                      Use {number}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {mode !== 'reset' ? (
              <label>
                Phone (Kenya)
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setOtpChallenge(null);
                  }}
                  required
                  disabled={busy || simState === 'checking'}
                  placeholder="+2547XXXXXXXX, 07XXXXXXXX, or 01XXXXXXXX"
                />
              </label>
            ) : null}
            {mode !== 'reset' ? (
              <p className="home-chat-note">
                You can type +254, 07, or 01. A number that is not on the SIM is confirmed
                with a separate email code and a separate phone code. If SMS is unavailable,
                the phone code is sent to the email as well.
              </p>
            ) : null}
            {mode !== 'reset' && otpChallenge ? (
              <>
                <label>
                  Email confirmation code
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value)}
                    disabled={busy}
                    required
                  />
                </label>
                <label>
                  Phone confirmation code
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                    disabled={busy}
                    required
                  />
                </label>
                <p className="home-chat-note">
                  {otpChallenge.phoneChannel === 'email'
                    ? 'SMS was unavailable, so both codes were sent to the email.'
                    : 'The email code is in the inbox. The phone code was sent by SMS.'}
                </p>
              </>
            ) : null}
            {mode !== 'reset' && simState === 'offline' ? (
              <p className="home-chat-note">
                Connect to the internet, then read the SIM again. The phone number is verified
                from the SIM only while you are online.
              </p>
            ) : null}
            {mode !== 'reset' && simState === 'denied' ? (
              <p className="home-chat-note">
                Allow phone permission so the app can read the number stored on this SIM.
              </p>
            ) : null}
            {mode !== 'reset' && simState === 'manual' && Capacitor.isNativePlatform() ? (
              <p className="home-chat-note">
                This SIM did not provide a phone number. Enter the Kenyan number on this line.
                It is saved on Wezesha Majuu and Loans.
              </p>
            ) : null}
            {mode !== 'reset' && Capacitor.isNativePlatform() ? (
              <button
                type="button"
                className="btn-ghost"
                disabled={busy || simState === 'checking'}
                onClick={() => void loadSimNumber()}
              >
                {simState === 'checking' ? 'Reading SIM…' : 'Read number from SIM'}
              </button>
            ) : null}
            {mode === 'login' ? (
              <label className="account-check">
                <input
                  type="checkbox"
                  checked={remainSignedIn}
                  onChange={(e) => setRemainSignedIn(e.target.checked)}
                />
                Remain signed in on this device
              </label>
            ) : null}
            <button type="submit" className="btn-primary" disabled={busy}>
              {mode === 'login' ? 'Sign in' : 'Send reset link'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setMode('menu');
                setError('');
              }}
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
