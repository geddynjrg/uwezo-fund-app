import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import logo from '../assets/uwezo-fund-logo.png';
import { MAJUU_HELP_URL, OTP_API_BASE } from '../config';
import { openExternal } from '../lib/openLink';
import { sendPhoneOtp, verifyPhoneOtp } from '../lib/otp';
import { isLikelyKenyanMobile, normalizeKenyanPhone } from '../lib/phone';

type Phase = 'phone' | 'email_fallback' | 'otp' | 'success';

type ChatMsg = {
  id: string;
  role: 'bot' | 'user' | 'system';
  text: string;
};

type OtpChatProps = {
  onBack: () => void;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function OtpChat({ onBack }: OtpChatProps) {
  const [phase, setPhase] = useState<Phase>('phone');
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: uid(),
      role: 'bot',
      text: 'Karibu. Sign in with your Kenyan mobile number. I will send a one-time code by SMS (email failover if SMS is unavailable).',
    },
    {
      id: uid(),
      role: 'bot',
      text: 'Enter your phone number (e.g. 07XX XXX XXX or +2547…).',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState('');
  const [requestId, setRequestId] = useState('');
  const [sessionNote, setSessionNote] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  function push(role: ChatMsg['role'], text: string) {
    setMessages((prev) => [...prev, { id: uid(), role, text }]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || busy) return;

    setInput('');
    push('user', phase === 'otp' ? '••••••' : trimmed);
    setBusy(true);

    try {
      if (phase === 'phone' || phase === 'email_fallback') {
        await handlePhoneOrEmail(trimmed);
      } else if (phase === 'otp') {
        await handleOtp(trimmed);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handlePhoneOrEmail(trimmed: string) {
    let phoneToUse = phone;
    let email: string | undefined;

    if (phase === 'email_fallback') {
      if (!trimmed.includes('@')) {
        push('bot', 'Please enter the email linked to this phone, or type “back” to re-enter the number.');
        if (trimmed.toLowerCase() === 'back') {
          setPhase('phone');
          setPhone('');
          push('bot', 'Enter your Kenyan mobile number again.');
        }
        return;
      }
      email = trimmed;
    } else {
      if (!isLikelyKenyanMobile(trimmed)) {
        push(
          'bot',
          'That does not look like a Kenyan mobile (07… / +2547…). Please check and try again.',
        );
        return;
      }
      phoneToUse = normalizeKenyanPhone(trimmed);
      setPhone(phoneToUse);
    }

    push('bot', 'Sending OTP…');
    const result = await sendPhoneOtp(phoneToUse, email);

    if (!result.ok) {
      if (result.needEmail) {
        setPhase('email_fallback');
        push('bot', result.error);
        push('bot', 'Reply with your email address to receive the code.');
        return;
      }
      push('bot', result.error);
      if (result.corsOrNetwork) {
        push(
          'system',
          `OTP API base: ${OTP_API_BASE}. If this keeps failing, open Majuu in the browser and use Help chat.`,
        );
      }
      return;
    }

    if (!result.requestId) {
      push('bot', 'OTP was accepted but no request id returned. Try again or use Majuu Help chat.');
      return;
    }

    setRequestId(result.requestId);
    setPhase('otp');
    push('bot', result.message);
    push('bot', 'Enter the 6-digit code (it will be masked here).');
  }

  async function handleOtp(trimmed: string) {
    const code = trimmed.replace(/\D/g, '');
    if (code.length !== 6) {
      push('bot', 'Enter the full 6-digit code from SMS or email.');
      return;
    }

    const result = await verifyPhoneOtp(requestId, code);
    if (!result.ok) {
      push('bot', result.error);
      if (result.corsOrNetwork) {
        push(
          'system',
          'Verification could not complete from this app shell. Open Wezesha Majuu and finish in Help chat.',
        );
      }
      return;
    }

    setPhase('success');
    const note = result.userId
      ? `Signed in. Session user id: ${result.userId}. Cookies/session apply to ${OTP_API_BASE} when the browser allows them.`
      : `${result.message} Session is held by the OTP host (${OTP_API_BASE}) when credentials are allowed.`;
    setSessionNote(note);
    push('bot', result.message);
    push('system', note);
  }

  const placeholder =
    phase === 'otp'
      ? '6-digit OTP'
      : phase === 'email_fallback'
        ? 'Email for OTP failover'
        : phase === 'success'
          ? 'Signed in'
          : 'Phone number';

  return (
    <div className="chat">
      <header className="chat-header">
        <button type="button" className="chat-back" onClick={onBack} aria-label="Back">
          ←
        </button>
        <img src={logo} alt="" className="chat-header__logo" width={36} height={36} />
        <div className="chat-header__text">
          <strong>OTP Chat</strong>
          <span>Uwezo Fund · phone login</span>
        </div>
      </header>

      <div className="chat-thread" role="log" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`bubble bubble--${m.role}`}>
            {m.text}
          </div>
        ))}
        {busy ? <div className="bubble bubble--bot bubble--typing">…</div> : null}
        <div ref={bottomRef} />
      </div>

      {phase === 'success' ? (
        <div className="chat-success">
          <p>{sessionNote || 'OTP verified.'}</p>
          <div className="chat-success__actions">
            <button type="button" className="btn-primary" onClick={() => void openExternal(MAJUU_HELP_URL)}>
              Open Wezesha Majuu
            </button>
            <button type="button" className="btn-ghost" onClick={onBack}>
              Back to home
            </button>
          </div>
        </div>
      ) : (
        <form className="chat-composer" onSubmit={(e) => void handleSubmit(e)}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            inputMode={phase === 'otp' ? 'numeric' : phase === 'email_fallback' ? 'email' : 'tel'}
            autoComplete={phase === 'otp' ? 'one-time-code' : 'tel'}
            disabled={busy}
            aria-label={placeholder}
          />
          <button type="submit" className="btn-send" disabled={busy || !input.trim()}>
            Send
          </button>
        </form>
      )}

      <p className="chat-api-hint">
        API: {OTP_API_BASE}
        {' · '}
        <button type="button" className="linkish" onClick={() => void openExternal(MAJUU_HELP_URL)}>
          Open Majuu Help
        </button>
      </p>
    </div>
  );
}
