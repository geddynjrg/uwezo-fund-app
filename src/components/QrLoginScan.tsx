import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import jsQR from 'jsqr';
import logo from '../assets/uwezo-fund-logo.png';
import { confirmQrLogin, parseQrLoginPayload, type QrLoginPayload } from '../lib/qrLogin';
import { isLikelyKenyanMobile, normalizeKenyanPhone } from '../lib/phone';
import { getActiveSession, saveSession, type AppSession } from '../lib/session';
import { OTP_API_BASE } from '../config';
import { ensureFreshSession } from '../lib/keepSession';

type Phase =
  | 'scan'
  | 'choose_verify'
  | 'phone'
  | 'email_fallback'
  | 'otp'
  | 'password'
  | 'done'
  | 'confirming';

type QrLoginScanProps = {
  onBack: () => void;
};

export function QrLoginScan({ onBack }: QrLoginScanProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>('scan');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(
    'Point your camera at the website QR, or paste the QR text below.',
  );
  const [payload, setPayload] = useState<QrLoginPayload | null>(null);
  const [manual, setManual] = useState('');
  const [phone, setPhone] = useState('');
  const [requestId, setRequestId] = useState('');
  const [input, setInput] = useState('');
  const [emailUser, setEmailUser] = useState('');
  const [password, setPassword] = useState('');

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }

  async function confirmWithSession(
    parsed: QrLoginPayload,
    session: AppSession,
  ): Promise<boolean> {
    setPhase('confirming');
    setBusy(true);
    setMessage(
      `Signed in as ${session.email}. Confirming browser login for ${parsed.origin}…`,
    );
    setError('');
    try {
      const fresh = (await ensureFreshSession()) || session;
      const confirmed = await confirmQrLogin({
        origin: parsed.origin,
        challengeId: parsed.challengeId,
        method: 'session',
        accessToken: fresh.accessToken,
        refreshToken: fresh.refreshToken,
      });
      if (!confirmed.ok) {
        setError(confirmed.error);
        setPhase('choose_verify');
        setMessage(
          'You are still signed in on this phone. Verify this QR with OTP or email/password if it is for a different portal — do not sign out.',
        );
        return false;
      }
      if (confirmed.accessToken) {
        saveSession({
          ...fresh,
          accessToken: confirmed.accessToken,
          refreshToken: confirmed.refreshToken || fresh.refreshToken,
          verifiedAt: new Date().toISOString(),
        });
      }
      setPhase('done');
      setMessage(confirmed.message);
      return true;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        scanLoop();
      } catch {
        setMessage(
          'Camera unavailable. Paste the QR payload text from the website, or allow camera permission and retry.',
        );
      }
    }

    function scanLoop() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const tick = () => {
        if (cancelled || phase !== 'scan') return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(image.data, image.width, image.height, {
            inversionAttempts: 'dontInvert',
          });
          if (code?.data) {
            void applyRaw(code.data);
            return;
          }
        }
        rafRef.current = window.requestAnimationFrame(tick);
      };
      rafRef.current = window.requestAnimationFrame(tick);
    }

    if (phase === 'scan') {
      void startCamera();
    }

    return () => {
      cancelled = true;
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function applyRaw(raw: string) {
    const parsed = parseQrLoginPayload(raw);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    stopCamera();
    setPayload(parsed.payload);
    setError('');

    const session = getActiveSession();
    if (session?.accessToken) {
      await confirmWithSession(parsed.payload, session);
      return;
    }

    setPhase('choose_verify');
    setMessage(
      `QR accepted for ${parsed.payload.origin}. Verify with phone OTP (recommended) or email/password, then confirm.`,
    );
  }

  async function onManualSubmit(e: FormEvent) {
    e.preventDefault();
    if (!manual.trim()) return;
    await applyRaw(manual.trim());
  }

  async function sendOtp(email?: string) {
    if (!payload) return;
    const phoneToUse = phone || normalizeKenyanPhone(input);
    if (!email && !isLikelyKenyanMobile(phoneToUse)) {
      setError('Enter a valid Kenyan mobile number.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${payload.origin}/api/assistive-chat/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          method: 'phone_send',
          phone: phoneToUse,
          ...(email ? { email } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || data.ok === false) {
        if (data.needEmail) {
          setPhase('email_fallback');
          setError(String(data.error || 'Enter the email linked to this phone to receive a login code.'));
          return;
        }
        setError(String(data.error || 'Could not send OTP'));
        return;
      }
      setPhone(phoneToUse);
      setRequestId(String(data.requestId || ''));
      setPhase('otp');
      setMessage(String(data.message || 'OTP sent. Enter the 6-digit code.'));
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP send failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitPasswordConfirm(e: FormEvent) {
    e.preventDefault();
    if (!payload || busy) return;
    const username = emailUser.trim().toLowerCase();
    if (!username || !password) {
      setError('Enter both email and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const confirmed = await confirmQrLogin({
        origin: payload.origin,
        challengeId: payload.challengeId,
        method: 'password',
        username,
        password,
      });
      if (!confirmed.ok) {
        setError(confirmed.error);
        setPassword('');
        return;
      }
      setPhase('done');
      setMessage(confirmed.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifySubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || busy || !payload) return;

    if (phase === 'phone') {
      setPhone(normalizeKenyanPhone(trimmed));
      setInput('');
      await sendOtp();
      return;
    }
    if (phase === 'email_fallback') {
      setInput('');
      await sendOtp(trimmed);
      return;
    }
    if (phase === 'otp') {
      const code = trimmed.replace(/\D/g, '');
      if (code.length !== 6) {
        setError('Enter the full 6-digit code.');
        return;
      }
      setBusy(true);
      setError('');
      try {
        const confirmed = await confirmQrLogin({
          origin: payload.origin,
          challengeId: payload.challengeId,
          method: 'phone_verify',
          requestId,
          otp: code,
        });
        if (!confirmed.ok) {
          setError(confirmed.error);
          return;
        }
        setPhase('done');
        setMessage(confirmed.message);
      } finally {
        setBusy(false);
      }
    }
  }

  return (
    <div className="chat">
      <header className="chat-header">
        <button type="button" className="chat-back" onClick={onBack} aria-label="Back">
          ←
        </button>
        <img src={logo} alt="" className="chat-header__logo" width={36} height={36} />
        <div className="chat-header__text">
          <strong>App QR Login</strong>
          <span>Signed-in confirm · Option B fallback</span>
        </div>
      </header>

      <div className="chat-thread">
        <div className="bubble bubble--bot">{message}</div>
        {error ? <div className="bubble bubble--system">{error}</div> : null}
        {payload ? (
          <div className="bubble bubble--system">
            Origin: {payload.origin}
            {'\n'}
            Challenge: {payload.challengeId.slice(0, 8)}…
            {'\n'}
            Expires in {Math.max(0, Math.ceil((payload.expiresAt - Date.now()) / 1000))}s
          </div>
        ) : null}

        {phase === 'scan' ? (
          <div className="qr-scan-box">
            <video ref={videoRef} playsInline muted className="qr-video" />
            <canvas ref={canvasRef} className="qr-canvas" />
            <form className="chat-composer qr-manual" onSubmit={(e) => void onManualSubmit(e)}>
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Paste QR JSON if camera fails"
                aria-label="Paste QR payload"
              />
              <button type="submit" className="btn-send" disabled={!manual.trim()}>
                Use
              </button>
            </form>
          </div>
        ) : null}

        {phase === 'choose_verify' ? (
          <div className="chat-success__actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setPhase('phone');
                setMessage('Enter your Kenyan mobile number for OTP verification.');
              }}
            >
              Verify with phone OTP
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setPhase('password');
                setEmailUser('');
                setPassword('');
                setMessage('Enter your account email and password together, then confirm.');
              }}
            >
              Verify with email / password
            </button>
            <button type="button" className="btn-ghost" onClick={() => setPhase('scan')}>
              Scan again
            </button>
          </div>
        ) : null}

        {phase === 'confirming' ? (
          <div className="bubble bubble--system">Confirming with your signed-in session…</div>
        ) : null}

        {phase === 'done' ? (
          <div className="chat-success">
            <p>{message}</p>
            <div className="chat-success__actions">
              <button type="button" className="btn-primary" onClick={onBack}>
                Back to home
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {phase === 'password' ? (
        <form className="account-form chat-composer-stack" onSubmit={(e) => void submitPasswordConfirm(e)}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={emailUser}
              onChange={(e) => setEmailUser(e.target.value)}
              disabled={busy}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              required
            />
          </label>
          <button
            type="submit"
            className="btn-primary"
            disabled={busy || !emailUser.trim() || !password}
          >
            Confirm QR login
          </button>
        </form>
      ) : null}

      {phase === 'phone' || phase === 'email_fallback' || phase === 'otp' ? (
        <form className="chat-composer" onSubmit={(e) => void handleVerifySubmit(e)}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              phase === 'otp'
                ? '6-digit OTP'
                : phase === 'email_fallback'
                  ? 'Email for OTP failover'
                  : 'Phone number'
            }
            type="text"
            inputMode={
              phase === 'otp' ? 'numeric' : phase === 'phone' ? 'tel' : 'email'
            }
            disabled={busy}
          />
          <button type="submit" className="btn-send" disabled={busy || !input.trim()}>
            {phase === 'otp' ? 'Confirm' : 'Next'}
          </button>
        </form>
      ) : null}

      <p className="chat-api-hint">
        Default OTP host: {OTP_API_BASE} · QR origin overrides per scan
      </p>
    </div>
  );
}
