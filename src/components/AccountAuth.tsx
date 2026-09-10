import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import logo from '../assets/uwezo-fund-logo.png';
import {
  AUTH_ORIGINS,
  appLoginOrRegister,
  appResetPassword,
  appSignup,
  defaultAuthOrigin,
  type AuthOrigin,
} from '../lib/appAuth';
import { isLikelyKenyanMobile, normalizeKenyanPhone } from '../lib/phone';
import {
  clearSession,
  getActiveSession,
  saveSession,
  type AppSession,
} from '../lib/session';

type Mode = 'menu' | 'login' | 'signup' | 'reset' | 'signed_in';

type AccountAuthProps = {
  onBack: () => void;
  onSessionChange?: (session: AppSession | null) => void;
};

export function AccountAuth({ onBack, onSessionChange }: AccountAuthProps) {
  const [mode, setMode] = useState<Mode>('menu');
  const [origin, setOrigin] = useState<AuthOrigin>(defaultAuthOrigin());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [requestId, setRequestId] = useState('');
  const [remainSignedIn, setRemainSignedIn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [session, setSession] = useState<AppSession | null>(null);

  useEffect(() => {
    const existing = getActiveSession();
    setSession(existing);
    if (existing) setMode('signed_in');
  }, []);

  function applySession(next: AppSession | null) {
    setSession(next);
    onSessionChange?.(next);
  }

  async function sendPhoneOtp() {
    const phoneNorm = normalizeKenyanPhone(phone);
    if (!isLikelyKenyanMobile(phoneNorm)) {
      setError('Enter a valid Kenyan mobile number.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${origin}/api/assistive-chat/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          method: 'phone_send',
          phone: phoneNorm,
          email: email.trim().toLowerCase() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || data.ok === false) {
        throw new Error(String(data.error || 'Could not send OTP'));
      }
      setPhone(phoneNorm);
      setRequestId(String(data.requestId || ''));
      setMessage(String(data.message || 'OTP sent. Enter the 6-digit code.'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OTP send failed');
    } finally {
      setBusy(false);
    }
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const phoneNorm = normalizeKenyanPhone(phone);
      const data = await appLoginOrRegister({
        origin,
        email,
        password,
        phone: phoneNorm,
        createIfMissing: true,
      });
      const next: AppSession = {
        email: email.trim().toLowerCase(),
        phone: phoneNorm,
        accessToken: String(data.accessToken || data.access_token || ''),
        refreshToken: String(data.refreshToken || data.refresh_token || '') || undefined,
        origin,
        remainSignedIn,
        verifiedAt: new Date().toISOString(),
      };
      if (!next.accessToken) throw new Error('Login succeeded but no access token returned.');
      saveSession(next);
      applySession(next);
      setMode('signed_in');
      setMessage(
        data.created
          ? 'Account created and you are signed in.'
          : 'Signed in. You will stay signed in on this device.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSignup(e: FormEvent) {
    e.preventDefault();
    if (!requestId) {
      await sendPhoneOtp();
      return;
    }
    const code = otp.replace(/\D/g, '');
    if (code.length !== 6) {
      setError('Enter the 6-digit OTP from SMS/email.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const phoneNorm = normalizeKenyanPhone(phone);
      const data = await appSignup({
        origin,
        email,
        password,
        phone: phoneNorm,
        requestId,
        otp: code,
      });
      const next: AppSession = {
        email: email.trim().toLowerCase(),
        phone: phoneNorm,
        accessToken: String(data.accessToken || data.access_token || ''),
        refreshToken: String(data.refreshToken || data.refresh_token || '') || undefined,
        origin,
        remainSignedIn,
        verifiedAt: new Date().toISOString(),
      };
      if (!next.accessToken) throw new Error('Signup succeeded but no access token returned.');
      saveSession(next);
      applySession(next);
      setMode('signed_in');
      setMessage('Account created with verified phone. You are signed in.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setBusy(false);
    }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await appResetPassword({ origin, email });
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
          <span>Create · sign in · reset · stay signed in</span>
        </div>
      </header>

      <div className="chat-thread">
        {message ? <div className="bubble bubble--bot">{message}</div> : null}
        {error ? <div className="bubble bubble--system">{error}</div> : null}

        {mode === 'menu' ? (
          <div className="chat-success__actions">
            <button type="button" className="btn-primary" onClick={() => setMode('login')}>
              Sign in (create if new)
            </button>
            <button type="button" className="btn-ghost" onClick={() => setMode('signup')}>
              Create account (email + phone OTP)
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
              Portal: {session.origin.replace(/^https:\/\//, '')}
            </p>
            <div className="chat-success__actions">
              <button type="button" className="btn-ghost" onClick={signOut}>
                Sign out
              </button>
            </div>
          </div>
        ) : null}

        {(mode === 'login' || mode === 'signup' || mode === 'reset') && (
          <form
            className="account-form"
            onSubmit={(e) => {
              if (mode === 'login') void onLogin(e);
              else if (mode === 'signup') void onSignup(e);
              else void onReset(e);
            }}
          >
            <label>
              Portal
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value as AuthOrigin)}
                disabled={busy}
              >
                {AUTH_ORIGINS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={busy}
              />
            </label>
            {mode !== 'reset' ? (
              <label>
                Password
                <input
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={busy}
                />
              </label>
            ) : null}
            {mode !== 'reset' ? (
              <label>
                Phone (Kenya)
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  disabled={busy}
                  placeholder="07XXXXXXXX"
                />
              </label>
            ) : null}
            {mode === 'signup' && requestId ? (
              <label>
                OTP code
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  disabled={busy}
                  placeholder="6-digit code"
                />
              </label>
            ) : null}
            {mode === 'login' || mode === 'signup' ? (
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
              {mode === 'login'
                ? 'Sign in'
                : mode === 'signup'
                  ? requestId
                    ? 'Verify & create'
                    : 'Send phone OTP'
                  : 'Send reset link'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setMode('menu');
                setError('');
                setRequestId('');
                setOtp('');
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
