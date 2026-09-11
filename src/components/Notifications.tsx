import { useEffect, useState } from 'react';
import logo from '../assets/uwezo-fund-logo.png';
import { canonicalAuthOrigin, INBOX_ORIGINS } from '../lib/appAuth';
import { getActiveSession, loadInbox, markInboxRead, pushInbox, type AppNotification } from '../lib/session';

type NotificationsProps = {
  onBack: () => void;
};

export function Notifications({ onBack }: NotificationsProps) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [message, setMessage] = useState('Pulling OTP and loan status notices…');

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const local = loadInbox();
      const session = getActiveSession();
      if (!session) {
        if (!cancelled) {
          setItems(local);
          setMessage('Sign in to sync OTP/loan notifications from the server.');
        }
        return;
      }
      try {
        const origins = Array.from(
          new Set([canonicalAuthOrigin(session.origin), ...INBOX_ORIGINS]),
        );
        for (const origin of origins) {
          const url = new URL(`${origin}/api/auth/app/inbox`);
          url.searchParams.set('email', session.email);
          url.searchParams.set('phone', session.phone);
          const res = await fetch(url.toString(), {
            headers: { Accept: 'application/json' },
            credentials: 'omit',
          });
          const data = (await res.json().catch(() => ({}))) as {
            items?: Array<{
              id: string;
              title: string;
              body: string;
              kind: AppNotification['kind'];
              createdAt: string;
            }>;
          };
          if (Array.isArray(data.items)) {
            for (const item of data.items.slice(0, 20)) {
              if (!local.some((l) => l.id === item.id)) {
                pushInbox({
                  title: item.title,
                  body: item.body,
                  kind: item.kind,
                  meta: { id: item.id },
                });
              }
            }
          }
        }
      } catch {
        // keep local inbox
      }
      if (!cancelled) {
        setItems(loadInbox());
        setMessage('Showing in-app notifications (OTP + loan status). FCM optional.');
      }
    }
    void refresh();
    const t = window.setInterval(() => void refresh(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
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
