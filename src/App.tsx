import { useState } from 'react';
import { Home } from './components/Home';
import { OtpChat } from './components/OtpChat';
import './App.css';

type Screen = 'home' | 'chat';

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const showStaging =
    import.meta.env.VITE_SHOW_LOANS_STAGING === 'true' ||
    import.meta.env.DEV;

  if (screen === 'chat') {
    return <OtpChat onBack={() => setScreen('home')} />;
  }

  return (
    <Home onOpenChat={() => setScreen('chat')} showStaging={showStaging} />
  );
}

export default App;
