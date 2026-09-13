import { useEffect, useState } from 'react';
import logo from '../assets/uwezo-fund-logo.png';
import { INBOX_UPDATED_EVENT } from '../lib/inboxSync';
import { copyOtpText, extractOtpCode } from '../lib/native';
import { getActiveSession, loadInbox, markInboxRead, type AppNotification } from '../lib/session';

type NotificationsProps = {
  onBack: () => void;
};

export function Notifications({ onBack }: NotificationsProps) {
  const [items, setItems] = useState<AppNotification[]>(() => loadInbox());
  const [message, setMessage] = useState(
    'OTP codes appear as phone notifications even when this app is closed. Tap Copy OTP, then paste the code.',
  );
  const [copiedId, setCopiedId] = useState('');

  useEffect(() => {
    const refreshLocal = () => setItems(loadInbox());
    window.addEventListener(INBOX_UPDATED_EVENT, refreshLocal);
    refreshLocal();
    if (!getActiveSession()) {
      setMessage('Sign in and remain signed in to receive OTP and loan alerts on this phone.');
    }
    return () => window.removeEventListener(INBOX_UPDATED_EVENT, refreshLocal);
  }, []);

  return (
    <div className="chat">
      <header className="chat-header">
        <button type="button" className="chat-back" onClick={onBack} aria-label="Back">
          ←
        </button>
        <img src={logo} alt="" className="chat-header__logo" width={36} height={36} />
        <div className="chat-header__text">
          <strong>Notifications</strong>
          <span>OTP · loan status</span>
        </div>
      </header>
      <div className="chat-thread">
        <div className="bubble bubble--bot">{message}</div>
        {items.length === 0 ? (
          <div className="bubble bubble--system">No notifications yet.</div>
        ) : (
          items.map((n) => {
            const code = extractOtpCode(n.body);
            return (
              <div
                key={n.id}
                className={`bubble bubble--system notif ${n.read ? '' : 'notif--unread'}`}
              >
                <button
                  type="button"
                  className="notif__body"
                  onClick={() => {
                    markInboxRead(n.id);
                    setItems(loadInbox());
                  }}
                >
                  <strong>{n.title}</strong>
                  {'\n'}
                  {n.body}
                  {'\n'}
                  <span className="notif-meta">
                    {n.kind} · {new Date(n.createdAt).toLocaleString()}
                  </span>
                </button>
                {code ? (
                  <button
                    type="button"
                    className="notif__copy"
                    onClick={() => {
                      void copyOtpText(code).then((ok) => {
                        if (ok) setCopiedId(n.id);
                      });
                      markInboxRead(n.id);
                      setItems(loadInbox());
                    }}
                  >
                    {copiedId === n.id ? 'OTP copied' : 'Copy OTP'}
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
