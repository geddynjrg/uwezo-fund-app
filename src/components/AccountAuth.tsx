import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import logo from '../assets/uwezo-fund-logo.png';
import { Capacitor } from '@capacitor/core';
import {
  appResetPassword,
  appUnifiedLogin,
  confirmContactCodes,
  requestContactConfirmation,
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
import { fetchOfficerProfile, fetchStaffRole, lmsHostOnline, loadLmsCache, openLmsFromZimbra, rememberMappedMenu, roleLabel, saveLmsCache, syncLmsMailbox, type LmsRole, type OfficerProfile } from '../lib/lmsSync';
import { officerCopyStatus, openOfficerCopy, sealOfficerCopy } from '../lib/officerVault';
import { loadStaffSession, saveStaffSession } from '../lib/staffSession';
import { isUwezoMailbox, signInMailbox } from '../lib/zimbraAuth';

type Mode = 'menu' | 'login' | 'reset' | 'signed_in';

type AccountAuthProps = {
  onBack: () => void;
  onSessionChange?: (session: AppSession | null) => void;
  onContinueOffline?: (portal: PortalId) => void;
  onOpenLms?: (officer: {
    email: string;
    constituency: string;
    passwordReset: boolean;
    role: LmsRole;
    syncDetail: string;
  }) => void;
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
    mail: { email: string; token: string; password: string } | null;
  }) {
    const previous = loadStaffSession();
    saveStaffSession({
      email: input.email,
      constituency: input.constituency,
      role: input.role,
      syncDetail: input.syncDetail,
      passwordReset: input.passwordReset || Boolean(previous?.email === input.email && previous.passwordReset),
      password: input.lmsPassword,
      signedInAt: new Date().toISOString(),
      mail: input.mail || (previous?.email === input.email ? previous.mail : null),
    });
    onOpenLms?.({
      email: input.email,
      constituency: input.constituency,
      passwordReset: input.passwordReset,
      role: input.role,
      syncDetail: input.syncDetail,
    });
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
    rememberOfficer({
      email: emailNorm,
      constituency: copy.profile.constituency || emailNorm,
      passwordReset: false,
      role: copy.profile.role,
      syncDetail: `${copy.syncDetail} Working from the encrypted copy saved on this phone.`,
      lmsPassword: '',
      mail: null,
    });
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
    try {
      const lmsOnline = await lmsHostOnline();
      const mailbox = isUwezoMailbox(emailNorm) ? await signInMailbox(emailNorm, password) : null;
      const mailLink = mailbox?.ok
        ? { email: mailbox.email, token: mailbox.token, password: mailbox.password }
        : null;
      const details = officerCopyStatus(emailNorm);
      const refreshDetails = !details || details.stale;
      if (mailbox?.ok) {
        const opened = lmsOnline && refreshDetails ? await openLmsFromZimbra(mailbox.email, mailbox.token) : null;
        const mapped = lmsOnline && !opened?.authenticated ? await fetchStaffRole('https://lms.uwezo.go.ke', mailbox.email) : null;
        if (!opened?.authenticated && mapped?.found) rememberMappedMenu(mailbox.email, mapped);
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
        const role = opened?.authenticated ? opened.role : (mapped?.found ? mapped.role : (loadLmsCache(emailNorm)?.role || 'staff'));
        const constituency = opened?.constituency || mapped?.constituency || emailNorm;
        const syncDetail = opened?.authenticated
          ? opened.detail
          : ['Signed in with the mailbox.', opened?.detail, mapped?.found ? `This mailbox is mapped as ${roleLabel(role)}.` : '', refreshDetails ? '' : 'Officer details on this phone are still within 15 days.'].filter(Boolean).join(' ');
        const profile = opened?.authenticated && loadLmsCache(emailNorm)?.host && loadLmsCache(emailNorm)?.cookie
          ? await fetchOfficerProfile(loadLmsCache(emailNorm)?.host || '', loadLmsCache(emailNorm)?.cookie || '', emailNorm)
          : mapped?.found
            ? { email: emailNorm, name: '', phone: '', idNumber: '', role: mapped.role, constituency: mapped.constituency, base: mapped.base }
            : null;
        rememberOfficer({
          email: mailbox.email,
          constituency: profile?.constituency || constituency,
          passwordReset: mailbox.passwordReset,
          role: profile?.role || role,
          syncDetail,
          lmsPassword: '',
          mail: mailLink,
        });
        if (refreshDetails || opened?.authenticated) await keepOfficerCopy({ email: mailbox.email, password, role: profile?.role || role, constituency: profile?.constituency || constituency, syncDetail, profile });
        return;
      }
      if (lmsOnline) {
        const lms = await syncLmsMailbox(emailNorm, password, { refresh: refreshDetails });
        if (lms.authenticated) {
          const cache = loadLmsCache(emailNorm);
          const profile = cache?.host && cache.cookie ? await fetchOfficerProfile(cache.host, cache.cookie, emailNorm) : null;
          const syncDetail = refreshDetails
            ? lms.detail
            : `${lms.detail} Officer details on this phone are still within 15 days.`;
          rememberOfficer({
            email: emailNorm,
            constituency: profile?.constituency || lms.constituency || emailNorm,
            passwordReset: false,
            role: profile?.role || lms.role,
            syncDetail,
            lmsPassword: '',
            mail: mailLink,
          });
          await keepOfficerCopy({
            email: emailNorm,
            password,
            role: profile?.role || lms.role,
            constituency: profile?.constituency || lms.constituency || emailNorm,
            syncDetail,
            profile,
          });
          return;
        }
        if (!isUwezoMailbox(emailNorm)) {
          setError(lms.detail);
          return;
        }
        const rejected = /did not accept|Too many sign-in/i.test(lms.detail);
        if (!rejected && await restoreOfficerCopy(emailNorm, password)) return;
        const mailboxMessage = mailbox && !mailbox.ok ? mailbox.message : '';
        setError([mailboxMessage, lms.detail].filter(Boolean).join(' ') || 'Sign-in was not accepted.');
        return;
      }
      if (isUwezoMailbox(emailNorm) && await restoreOfficerCopy(emailNorm, password)) return;
      if (isUwezoMailbox(emailNorm)) {
        const mailboxMessage = mailbox && !mailbox.ok ? mailbox.message : '';
        setError(mailboxMessage || 'Could not reach the mailbox or lms.uwezo.go.ke. Check your connection, then try again.');
        return;
      }
    } catch {
      if (isUwezoMailbox(emailNorm) && await restoreOfficerCopy(emailNorm, password)) return;
      if (isUwezoMailbox(emailNorm)) {
        setError('Could not reach the mailbox or lms.uwezo.go.ke. Check your connection, then try again.');
        return;
      }
    } finally {
      setBusy(false);
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
      };
      if (!next.accessToken) throw new Error('Login succeeded but no access token returned.');
      saveSession(next);
      clearPendingLogin();
      applySession(next);
      setMode('signed_in');
      setMessage(
        data.created
          ? 'Account created and you are signed in.'
          : 'Signed in. You will stay signed in on this device.',
      );
    } catch (err) {
      if (isUnreachableError(err)) {
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
              One email, phone, and password is checked for Wezesha Majuu and Loans. You
              do not choose a portal. A portal is opened only when that same password is
              already accepted there. A constituency mailbox such as turkanawest@uwezo.go.ke
              is checked at mail.govmail.ke and then opens the LMS on this phone.
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
