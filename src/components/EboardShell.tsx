import { useEffect, useState } from 'react';
import {
  eboardHomeUrl,
  getLastEboardProbeStatus,
  loadEboardSession,
  openEboardExternalFallback,
  prepareEboardInApp,
} from '../lib/eboard';

type EboardShellProps = {
  onBack: () => void;
  email?: string;
  password?: string;
  initialUrl?: string;
};

export function EboardShell({ onBack, email, password, initialUrl }: EboardShellProps) {
  const [url, setUrl] = useState(initialUrl || '');
  const [busy, setBusy] = useState(!initialUrl);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(15);

  useEffect(() => {
    if (initialUrl) return;
    let cancelled = false;
    const started = Date.now();
    const tick = window.setInterval(() => {
      const left = Math.max(0, 15 - Math.floor((Date.now() - started) / 1000));
      setRemaining(left);
    }, 400);
    void (async () => {
      setBusy(true);
      setError('');
      try {
        const prepared = await prepareEboardInApp(email, password);
        if (cancelled) return;
        if (!prepared.ok) {
          setError(prepared.message || 'Could not open eBoard.');
          setUrl('');
          return;
        }
        setUrl(prepared.url || eboardHomeUrl());
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not open eBoard.');
        }
      } finally {
        if (!cancelled) setBusy(false);
        window.clearInterval(tick);
      }
    })();
    return () => {
      cancelled = true;
      window.clearInterval(tick);
    };
  }, [email, password, initialUrl]);

  useEffect(() => {
    if (!url) return;
    const session = loadEboardSession();
    if (!session?.cookie) {
      const status = getLastEboardProbeStatus();
      if (!status.accepted) {
        setError(
          status.detail ||
            'Opened eBoard inside the app. If you see a login form, use your eBoard password.',
        );
      }
    }
  }, [url]);

  return (
    <div className="eboard-shell">
      <header className="eboard-shell__bar">
        <button type="button" className="btn-ghost" onClick={onBack}>
          Back
        </button>
        <strong className="eboard-shell__title">eBoard</strong>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => void openEboardExternalFallback()}
        >
          Browser
        </button>
      </header>
      {busy ? (
        <div className="eboard-shell__status" role="status">
          <p>Signing in to eBoard…</p>
          <p className="home-chat-note">About {remaining}s remaining</p>
        </div>
      ) : null}
      {error ? <p className="eboard-shell__error">{error}</p> : null}
      {!busy && url ? (
        <iframe
          title="eBoard"
          className="eboard-shell__frame"
          src={url}
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : null}
      {!busy && !url ? (
        <div className="eboard-shell__status">
          <p>{error || 'eBoard is unreachable from this phone.'}</p>
          <button type="button" className="btn-primary" onClick={onBack}>
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}
