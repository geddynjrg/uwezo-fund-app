import { useEffect, useState } from 'react';
import logo from '../assets/uwezo-fund-logo.png';
import { INBOX_UPDATED_EVENT } from '../lib/inboxSync';
import { getActiveSession, loadInbox, markInboxRead, type AppNotification } from '../lib/session';

type NotificationsProps = {
  onBack: () => void;
};

export function Notifications({ onBack }: NotificationsProps) {
  const [items, setItems] = useState<AppNotification[]>(() => loadInbox());
  const [message, setMessage] = useState('OTP and loan alerts also appear as phone notifications.');

  useEffect(() => {
    const refreshLocal = () => setItems(loadInbox());
    window.addEventListener(INBOX_UPDATED_EVENT, refreshLocal);
    refreshLocal();
    if (!getActiveSession()) {
      setMessage('Sign in to receive OTP and loan alerts on this phone.');
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
          items.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`bubble bubble--system notif ${n.read ? '' : 'notif--unread'}`}
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
          ))
        )}
      </div>
    </div>
  );
}
