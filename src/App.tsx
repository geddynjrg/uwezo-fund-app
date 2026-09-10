import { useEffect, useState } from 'react';
import { AccountAuth } from './components/AccountAuth';
import { Home } from './components/Home';
import { Notifications } from './components/Notifications';
import { OtpChat } from './components/OtpChat';
import { QrLoginScan } from './components/QrLoginScan';
import { getActiveSession, type AppSession } from './lib/session';
import { registerPushDevice } from './lib/appAuth';
import './App.css';

type Screen = 'home' | 'chat' | 'qr' | 'account' | 'notifications';

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [session, setSession] = useState<AppSession | null>(null);
  const showStaging = import.meta.env.VITE_SHOW_LOANS_STAGING === 'true';

  useEffect(() => {
    setSession(getActiveSession());
  }, []);

  useEffect(() => {
    if (!session?.accessToken) return;
    // Register a stable local device id for inbox targeting; FCM token replaces this when configured.
    const deviceToken =
      localStorage.getItem('uwezo.fund.deviceToken') ||
      `local-${crypto.randomUUID()}`;
    localStorage.setItem('uwezo.fund.deviceToken', deviceToken);
    void registerPushDevice({
      origin: session.origin,
      accessToken: session.accessToken,
      deviceToken,
      platform: 'android',
      email: session.email,
      phone: session.phone,
    }).catch(() => {
      // optional
    });
  }, [session]);

  if (screen === 'chat') {
    return <OtpChat onBack={() => setScreen('home')} />;
  }
  if (screen === 'qr') {
    return <QrLoginScan onBack={() => setScreen('home')} />;
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
    <Home
      onOpenChat={() => setScreen('chat')}
      onOpenQr={() => setScreen('qr')}
      onOpenAccount={() => setScreen('account')}
      onOpenNotifications={() => setScreen('notifications')}
      session={session}
      showStaging={showStaging}
    />
  );
}

export default App;
