import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { AccountAuth } from './components/AccountAuth';
import { Home } from './components/Home';
import { Notifications } from './components/Notifications';
import { OtpChat } from './components/OtpChat';
import { QrLoginScan } from './components/QrLoginScan';
import {
  getActiveSession,
  loadInbox,
  pushInbox,
  type AppNotification,
  type AppSession,
} from './lib/session';
import { registerPushDevice, INBOX_ORIGINS, canonicalAuthOrigin } from './lib/appAuth';
import './App.css';

type Screen = 'home' | 'chat' | 'qr' | 'account' | 'notifications';

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [session, setSession] = useState<AppSession | null>(null);
  const [toast, setToast] = useState<AppNotification | null>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const showStaging = import.meta.env.VITE_SHOW_LOANS_STAGING === 'true';

  useEffect(() => {
    setSession(getActiveSession());
  }, []);

  useEffect(() => {
    if (!session?.accessToken) return;
    const deviceToken =
      localStorage.getItem('uwezo.fund.deviceToken') ||
      `local-${crypto.randomUUID()}`;
    localStorage.setItem('uwezo.fund.deviceToken', deviceToken);
    const origins = Array.from(
      new Set([canonicalAuthOrigin(session.origin), ...INBOX_ORIGINS]),
    );
    for (const origin of origins) {
      void registerPushDevice({
        origin,
        accessToken: session.accessToken,
        deviceToken,
        platform: 'android',
        email: session.email,
        phone: session.phone,
      }).catch(() => {
        // optional
      });
    }
  }, [session]);

  // Poll inbox for OTP / loan notices and show floating toast + system notification.
  useEffect(() => {
    if (!session?.accessToken) return;
    let cancelled = false;

    async function poll() {
      try {
        const origins = Array.from(
          new Set([canonicalAuthOrigin(session!.origin), ...INBOX_ORIGINS]),
        );
        for (const origin of origins) {
          const url = new URL(`${origin}/api/auth/app/inbox`);
          url.searchParams.set('email', session!.email);
          url.searchParams.set('phone', session!.phone);
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
          if (!Array.isArray(data.items) || cancelled) continue;
          for (const item of data.items.slice(0, 10)) {
            if (seenIds.current.has(item.id)) continue;
            seenIds.current.add(item.id);
            const local = loadInbox();
            if (!local.some((l) => l.id === item.id || l.meta?.id === item.id)) {
              pushInbox({
                title: item.title,
                body: item.body,
                kind: item.kind,
                meta: { id: item.id },
              });
            }
            if (item.kind === 'otp' || item.kind === 'loan_status') {
              setToast({
                id: item.id,
                title: item.title,
                body: item.body,
                kind: item.kind,
                createdAt: item.createdAt,
                read: false,
              });
              if (typeof Notification !== 'undefined') {
                if (Notification.permission === 'granted') {
                  new Notification(item.title, { body: item.body });
                } else if (Notification.permission !== 'denied') {
                  void Notification.requestPermission().then((p) => {
                    if (p === 'granted') {
                      new Notification(item.title, { body: item.body });
                    }
                  });
                }
              }
            }
          }
        }
      } catch {
        // ignore poll errors
      }
    }

    void poll();
    const t = window.setInterval(() => void poll(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [session]);

  // Android hardware/gesture Back → previous screen (same as in-app ←).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handle = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (screen !== 'home') {
        setScreen('home');
        return;
      }
      if (canGoBack) {
        window.history.back();
        return;
      }
      void CapApp.minimizeApp();
    });

    return () => {
      void handle.then((h) => h.remove());
    };
  }, [screen]);

  if (screen === 'chat') {
    return (
      <>
        <OtpChat onBack={() => setScreen('home')} />
        {toast ? (
          <button
            type="button"
            className="app-toast"
            onClick={() => {
              setToast(null);
              setScreen('notifications');
            }}
          >
            <strong>{toast.title}</strong>
            <span>{toast.body}</span>
          </button>
        ) : null}
      </>
    );
  }
  if (screen === 'qr') {
    return (
      <>
        <QrLoginScan onBack={() => setScreen('home')} />
        {toast ? (
          <button type="button" className="app-toast" onClick={() => setToast(null)}>
            <strong>{toast.title}</strong>
            <span>{toast.body}</span>
          </button>
        ) : null}
      </>
    );
  }
  if (screen === 'account') {
    return (
      <AccountAuth
        onBack={() => setScreen('home')}
        onSessionChange={(s) => setSession(s)}
      />
    );
  }
  if (screen === 'notifications') {
    return <Notifications onBack={() => setScreen('home')} />;
  }

  return (
    <>
      <Home
        onOpenChat={() => setScreen('chat')}
        onOpenQr={() => setScreen('qr')}
        onOpenAccount={() => setScreen('account')}
        onOpenNotifications={() => setScreen('notifications')}
        session={session}
        showStaging={showStaging}
      />
      {toast ? (
        <button
          type="button"
          className="app-toast"
          onClick={() => {
            setToast(null);
            setScreen('notifications');
          }}
        >
          <strong>{toast.title}</strong>
          <span>{toast.body}</span>
        </button>
      ) : null}
    </>
  );
}

export default App;
