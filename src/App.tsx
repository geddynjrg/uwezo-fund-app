import { useState } from 'react';
import { Home } from './components/Home';
import { OtpChat } from './components/OtpChat';
import { QrLoginScan } from './components/QrLoginScan';
import './App.css';

type Screen = 'home' | 'chat' | 'qr';

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const showStaging = import.meta.env.VITE_SHOW_LOANS_STAGING === 'true';

  if (screen === 'chat') {
    return <OtpChat onBack={() => setScreen('home')} />;
  }
  if (screen === 'qr') {
    return <QrLoginScan onBack={() => setScreen('home')} />;
  }

  return (
    <Home
      onOpenChat={() => setScreen('chat')}
      onOpenQr={() => setScreen('qr')}
      showStaging={showStaging}
    />
  );
}

export default App;
