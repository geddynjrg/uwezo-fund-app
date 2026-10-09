import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { AccountAuth } from './components/AccountAuth';
import { Authenticator } from './components/Authenticator';
import { Home } from './components/Home';
import { Notifications } from './components/Notifications';
import { QrLoginScan } from './components/QrLoginScan';
import {
  getActiveSession,
  newId,
  type AppNotification,
  type AppSession,
} from './lib/session';
import { registerPushDevice, INBOX_ORIGINS, canonicalAuthOrigin } from './lib/appAuth';
import { syncInbox } from './lib/inboxSync';
import { ensureFreshSession } from './lib/keepSession';
import { ensureNotifyPermission } from './lib/notify';
import {
  copyOtpText,
  extractOtpCode,
  startOtpListener,
} from './lib/native';
import './App.css';

type Screen = 'home' | 'qr' | 'account' | 'notifications' | 'authenticator';

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [session, setSession] = useState<AppSession | null>(null);
  const [toast, setToast] = useState<AppNotification | null>(null);
  const showStaging = import.meta.env.VITE_SHOW_LOANS_STAGING === 'true';

  useEffect(() => {
    setSession(getActiveSession());
  }, []);

  useEffect(() => {
    if (!session?.accessToken) return;
    void ensureNotifyPermission();
    void ensureFreshSession().then((next) => {
      if (next && next.accessToken !== session.accessToken) setSession(next);
    });
    const deviceToken =
      localStorage.getItem('uwezo.fund.deviceToken') || `local-${newId()}`;
    localStorage.setItem('uwezo.fund.deviceToken', deviceToken);
    const origins = Array.from(
      new Set([canonicalAuthOrigin(session.origin), ...INBOX_ORIGINS]),
    );
    for (const origin of origins) {
      const accessToken = origin.includes('majuu')
        ? session.majuuAccessToken ||
          (session.origin.includes('majuu') ? session.accessToken : '')
        : origin.includes('staging')
          ? ''
          : session.loansAccessToken ||
            (session.origin.includes('loans') ? session.accessToken : '');
      if (!accessToken) continue;
      void registerPushDevice({
        origin,
        accessToken,
        deviceToken,
        platform: 'android',
        email: session.email,
        phone: session.phone,
      }).catch(() => {
        // optional
      });
    }
    void startOtpListener(session).catch(() => {
      // native listener is optional on web
    });
  }, [session]);

  useEffect(() => {
    if (!session?.accessToken) return;
    let cancelled = false;
    let inflight = false;

    async function poll() {
      if (cancelled || inflight) return;
      inflight = true;
      try {
        const current = getActiveSession() || session;
        if (!current) return;
        const fresh = await syncInbox(current, { alert: true });
        if (!cancelled && fresh[0]) setToast(fresh[0]);
      } catch {
        // ignore poll errors
      } finally {
        inflight = false;
      }
    }

    void poll();
    const t = window.setInterval(() => void poll(), 900);
    let resume: Promise<{ remove: () => Promise<void> | void }> | null = null;
    if (Capacitor.isNativePlatform()) {
      resume = CapApp.addListener('resume', () => {
        void ensureFreshSession().then((next) => {
          if (next) setSession(next);
        });
        void poll();
      });
    }
    return () => {
      cancelled = true;
      window.clearInterval(t);
      void resume?.then((handle) => handle.remove());
    };
  }, [session]);

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

  const toastCode = toast ? extractOtpCode(toast.body) : null;
  const toastUi = toast ? (
    <div className="app-toast">
      <button
        type="button"
        className="app-toast__body"
        onClick={() => {
          setToast(null);
          setScreen('notifications');
        }}
      >
        <strong>{toast.title}</strong>
        <span>{toast.body}</span>
      </button>
      {toastCode ? (
        <button
          type="button"
          className="app-toast__copy"
          onClick={() => {
            void copyOtpText(toastCode);
          }}
        >
          Copy OTP
        </button>
      ) : null}
    </div>
  ) : null;

  if (screen === 'qr') {
    return (
      <>
        <QrLoginScan onBack={() => setScreen('home')} />
        {toastUi}
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
  if (screen === 'authenticator') {
    return (
      <>
        <Authenticator onBack={() => setScreen('home')} session={session} />
        {toastUi}
      </>
    );
  }

  return (
    <>
      <Home
        onOpenQr={() => setScreen('qr')}
        onOpenAccount={() => setScreen('account')}
        onOpenNotifications={() => setScreen('notifications')}
        onOpenAuthenticator={() => setScreen('authenticator')}
        session={session}
        showStaging={showStaging}
      />
      {toastUi}
    </>
  );
}

export default App;
