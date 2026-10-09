import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import jsQR from 'jsqr';
import logo from '../assets/uwezo-fund-logo.png';
import { copyOtpText } from '../lib/native';
import type { AppSession } from '../lib/session';
import {
  parseOtpauth,
  secondsRemaining,
  totpCode,
  type TotpAccount,
} from '../lib/totp';
import { enrollApplicationTotp } from '../lib/totpEnroll';
import {
  createLocalApplicationAccount,
  loadTotpAccounts,
  removeTotpAccount,
  upsertTotpAccount,
} from '../lib/totpStore';

type Mode = 'list' | 'scan' | 'manual';

type AuthenticatorProps = {
  onBack: () => void;
  session: AppSession | null;
};

function formatCode(code: string) {
  if (code.length !== 6) return code;
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

export function Authenticator({ onBack, session }: AuthenticatorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<Mode>('list');
  const [accounts, setAccounts] = useState<TotpAccount[]>(() => loadTotpAccounts());
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState(
    'Codes refresh every 30 seconds, the same way as Microsoft Authenticator.',
  );
  const [busy, setBusy] = useState(false);
  const [issuer, setIssuer] = useState('Uwezo Fund');
  const [label, setLabel] = useState(session?.email || session?.phone || '');
  const [secret, setSecret] = useState('');

  function refreshAccounts(next?: TotpAccount[]) {
    setAccounts(next || loadTotpAccounts());
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const account of accounts) {
        try {
          next[account.id] = await totpCode(account, now);
        } catch {
          next[account.id] = '------';
        }
      }
      if (!cancelled) setCodes(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [accounts, now]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    if (mode !== 'scan') {
      stopCamera();
      return;
    }
    let stopped = false;
    let raf = 0;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const tick = () => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video && canvas && video.readyState >= 2) {
            const width = video.videoWidth;
            const height = video.videoHeight;
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx && width && height) {
              ctx.drawImage(video, 0, 0, width, height);
              const image = ctx.getImageData(0, 0, width, height);
              const found = jsQR(image.data, width, height);
              if (found?.data) {
                const parsed = parseOtpauth(found.data);
                if (parsed) {
                  upsertTotpAccount(parsed);
                  refreshAccounts();
                  setMode('list');
                  setMessage(`Added ${parsed.issuer} · ${parsed.label}.`);
                  return;
                }
              }
            }
          }
          raf = window.requestAnimationFrame(tick);
        };
        raf = window.requestAnimationFrame(tick);
      } catch {
        setMessage('Camera permission is required to scan a setup QR. Enter the key instead.');
        setMode('manual');
      }
    }
    void start();
    return () => {
      stopped = true;
      window.cancelAnimationFrame(raf);
      stopCamera();
    };
  }, [mode]);

  async function registerApplication() {
    if (!session) {
      setMessage('Sign in first, then register the authenticator for this application.');
      return;
    }
    setBusy(true);
    setMessage('Registering this application with Uwezo Fund…');
    try {
      const result = await enrollApplicationTotp(session);
      if (!result.ok) {
        setMessage(
          `${result.error} You can still add a key on this phone. Codes stay on the device, the same as Microsoft Authenticator.`,
        );
        return;
      }
      upsertTotpAccount(result.account);
      refreshAccounts();
      setMessage(
        `Registered ${result.account.issuer} · ${result.account.label}. The 6-digit code changes every 30 seconds.`,
      );
    } finally {
      setBusy(false);
    }
  }

  function saveManual(event: FormEvent) {
    event.preventDefault();
    const parsed = parseOtpauth(
      secret.trim().toLowerCase().startsWith('otpauth://')
        ? secret.trim()
        : `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label || 'application')}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`,
    );
    if (!parsed) {
      setMessage('Enter the setup key from the application, or paste an otpauth link.');
      return;
    }
    upsertTotpAccount(parsed);
    refreshAccounts();
    setSecret('');
    setMode('list');
    setMessage(`Added ${parsed.issuer} · ${parsed.label}.`);
  }

  return (
    <div className="chat">
      <header className="chat-header">
        <button type="button" className="chat-back" onClick={onBack} aria-label="Back">
          ←
        </button>
        <img src={logo} alt="" className="chat-header__logo" width={36} height={36} />
        <div className="chat-header__text">
          <strong>Authenticator</strong>
          <span>TOTP · 30 seconds</span>
        </div>
      </header>
      <div className="chat-thread totp">
        <p className="home-chat-note">{message}</p>
        {mode === 'list' ? (
          <>
            {accounts.length === 0 ? (
              <p className="home-chat-note">
                No accounts yet. Register this application, scan a setup QR, or enter a key.
              </p>
            ) : (
              <ul className="totp-list">
                {accounts.map((account) => {
                  const left = secondsRemaining(account.period, now);
                  const code = codes[account.id] || '------';
                  return (
                    <li key={account.id} className="totp-card">
                      <div className="totp-card__meta">
                        <strong>{account.issuer}</strong>
                        <span>{account.label}</span>
                      </div>
                      <button
                        type="button"
                        className="totp-code"
                        onClick={() => void copyOtpText(code.replace(/\s/g, ''))}
                      >
                        {formatCode(code)}
                      </button>
                      <div
                        className="totp-ring"
                        style={{
                          background: `conic-gradient(var(--uf-green) ${(left / account.period) * 360}deg, #e7e4da 0deg)`,
                        }}
                        aria-label={`${left} seconds remaining`}
                      >
                        <span>{left}</span>
                      </div>
                      <button
                        type="button"
                        className="btn-ghost totp-remove"
                        onClick={() => {
                          removeTotpAccount(account.id);
                          refreshAccounts();
                        }}
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={() => void registerApplication()}
              disabled={busy}
            >
              {busy ? 'Registering…' : 'Register this application'}
            </button>
            {session && !accounts.some((item) => item.label === (session.email || session.phone)) ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  const created = createLocalApplicationAccount(session.email || session.phone);
                  refreshAccounts();
                  setMessage(
                    `Saved ${created.issuer} · ${created.label} on this phone. Use the code when an application asks for an authenticator code.`,
                  );
                }}
              >
                Add a key on this phone
              </button>
            ) : null}
            <button type="button" className="btn-ghost" onClick={() => setMode('scan')}>
              Scan setup QR
            </button>
            <button type="button" className="btn-ghost" onClick={() => setMode('manual')}>
              Enter setup key
            </button>
          </>
        ) : null}
        {mode === 'scan' ? (
          <div className="totp-scan">
            <video ref={videoRef} className="totp-video" playsInline muted />
            <canvas ref={canvasRef} hidden />
            <button type="button" className="btn-ghost" onClick={() => setMode('list')}>
              Cancel scan
            </button>
          </div>
        ) : null}
        {mode === 'manual' ? (
          <form className="totp-form" onSubmit={saveManual}>
            <label>
              Issuer
              <input value={issuer} onChange={(event) => setIssuer(event.target.value)} />
            </label>
            <label>
              Account
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Email, phone, or application"
              />
            </label>
            <label>
              Setup key or otpauth link
              <input
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                autoCapitalize="characters"
                autoCorrect="off"
                placeholder="Base32 key"
              />
            </label>
            <button type="submit" className="btn-primary">
              Add account
            </button>
            <button type="button" className="btn-ghost" onClick={() => setMode('list')}>
              Cancel
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
