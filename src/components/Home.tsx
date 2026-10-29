import { useEffect, useState } from 'react';
import logo from '../assets/uwezo-fund-logo.png';
import { LINKS } from '../config';
import { openEboardHome } from '../lib/eboard';
import { openExternal } from '../lib/openLink';
import type { PortalAvailability, PortalId } from '../lib/portalStatus';
import type { AppSession } from '../lib/session';
import type { StaffSession } from '../lib/staffSession';
import {
  getNativeVersion,
  installNativeUpdate,
  onUpdateProgress,
} from '../lib/native';

type HomeProps = {
  onOpenQr: () => void;
  onOpenAccount: () => void;
  onOpenNotifications: () => void;
  onOpenAuthenticator: () => void;
  onOpenOffline: (portal: PortalId) => void;
  portals: PortalAvailability;
  session?: AppSession | null;
  staff?: StaffSession | null;
  onOpenStaff?: () => void;
  showStaging?: boolean;
};

const primaryLinks = [LINKS.majuu, LINKS.loans, LINKS.website] as const;
/** Keep in sync with package.json / android versionName */
const PACKAGE_VERSION = '1.2.6';

function friendlyUpdateMessage(raw: string) {
  const text = String(raw || '').trim();
  if (!text) return 'Could not update the app.';
  // Hide raw URLs / GitHub paths, keep useful error text.
  if (/github|raw\.githubusercontent/i.test(text)) {
    return 'The update could not be downloaded. Check your connection and try again.';
  }
  return text.replace(/https?:\/\/\S+/gi, '').replace(/\s{2,}/g, ' ').trim() || text;
}

export function Home({
  onOpenQr,
  onOpenAccount,
  onOpenNotifications,
  onOpenAuthenticator,
  onOpenOffline,
  portals,
  session = null,
  staff = null,
  onOpenStaff,
  showStaging = false,
}: HomeProps) {
  const [updateNote, setUpdateNote] = useState('');
  const [updateBusy, setUpdateBusy] = useState(false);
  const [appVersion, setAppVersion] = useState(PACKAGE_VERSION);

  useEffect(() => {
    let cancelled = false;
    void getNativeVersion().then((native) => {
      if (cancelled || !native?.versionName) return;
      setAppVersion(native.versionName);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function runUpdate(fromUser: boolean) {
    setUpdateBusy(true);
    if (fromUser) {
      setUpdateNote('Checking for an update, then downloading and installing if one is available…');
    }
    try {
      const result = await installNativeUpdate();
      if (result.needsPermission) {
        setUpdateNote(
          `Version ${result.versionName || 'new'} is ready. Allow “Install unknown apps” for Uwezo Fund, then tap Check for app update again.`,
        );
        return;
      }
      if (!result.updateAvailable) {
        setUpdateNote(
          fromUser
            ? `You already have the latest version (${result.versionName || appVersion}).`
            : '',
        );
        return;
      }
      if (result.started) {
        setUpdateNote(
          `Downloaded version ${result.versionName || 'new'}. Android is installing it over this app — tap Update when asked. You do not uninstall first.`,
        );
        return;
      }
      setUpdateNote(
        fromUser
          ? 'No update could be installed. You already have this version, or the installer could not start.'
          : '',
      );
    } catch (err) {
      setUpdateNote(
        fromUser
          ? friendlyUpdateMessage(err instanceof Error ? err.message : '')
          : '',
      );
    } finally {
      setUpdateBusy(false);
    }
  }

  useEffect(() => {
    let remove: (() => Promise<void>) | undefined;
    void onUpdateProgress((event) => {
      if (event.message) setUpdateNote(friendlyUpdateMessage(event.message));
    }).then((handle) => {
      remove = () => handle.remove();
    });
    const timer = window.setTimeout(() => {
      void runUpdate(false);
    }, 1800);
    return () => {
      window.clearTimeout(timer);
      void remove?.();
    };
  }, []);

  async function openDestination(link: (typeof primaryLinks)[number]) {
    if (link.id === 'majuu' || link.id === 'loans') {
      onOpenOffline(link.id);
      return;
    }
    await openExternal(link.url);
  }

  return (
    <main className="home">
      <header className="home-hero">
        <div className="home-hero__glow" aria-hidden />
        <img
          className="home-logo"
          src={logo}
          alt="Uwezo Fund"
          width={120}
          height={120}
        />
        <h1 className="home-title">Uwezo Fund</h1>
        <p className="home-tagline">Ahadi Yetu — Kazi Kwako</p>
        <p className="home-lede">
          Quick access to Wezesha Majuu, loan applications, and the official site —
          plus account sign-in and App QR browser login.
        </p>
        {session ? (
          <p className="home-session">
            Signed in as {session.email} · {session.phone}
          </p>
        ) : (
          <p className="home-session home-session--muted">Not signed in</p>
        )}
      </header>

      <section className="link-stack" aria-label="Main destinations">
        {primaryLinks.map((link) => (
          <button
            key={link.id}
            type="button"
            className="link-card"
            onClick={() => void openDestination(link)}
          >
            <span className="link-card__title">{link.title}</span>
            <span className="link-card__sub">{link.subtitle}</span>
            {link.url ? (
              <span className="link-card__url">{link.url.replace(/^https:\/\//, '')}</span>
            ) : null}
            {link.id === 'loans' || link.id === 'majuu' ? (
              <span className="link-card__sub">
                {portals[link.id] === false
                  ? 'The site is not answering. This phone still uses its own application steps.'
                  : 'Uses the application steps saved in this app.'}
              </span>
            ) : null}
          </button>
        ))}

        {showStaging ? (
          <button
            type="button"
            className="link-card link-card--muted"
            onClick={() => void openExternal(LINKS.loansStaging.url)}
          >
            <span className="link-card__title">{LINKS.loansStaging.title}</span>
            <span className="link-card__sub">{LINKS.loansStaging.subtitle}</span>
            <span className="link-card__url">
              {LINKS.loansStaging.url.replace(/^https:\/\//, '')}
            </span>
          </button>
        ) : null}
      </section>

      <section className="home-chat-cta">
        {staff ? (
          <>
            <p className="home-session">
              Signed in as {staff.email}
              {staff.mailOnly
                ? ' · Mail only'
                : staff.constituency
                  ? ` · ${staff.constituency}`
                  : ''}
              {staff.eboardVerified ? ' · eBoard' : ''}
            </p>
            <button type="button" className="btn-primary" onClick={onOpenStaff}>
              {staff.mailOnly ? 'Open Mail' : 'Open LMS'}
            </button>
            {staff.eboardVerified ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => void openEboardHome()}
              >
                Open eBoard
              </button>
            ) : null}
            <p className="home-chat-note">
              {staff.mailOnly
                ? 'This Uwezo mailbox is not an LMS user. Mail stays available until you log out.'
                : 'Headquarters, accounts, and constituency pages stay on this phone until you log out.'}
            </p>
          </>
        ) : null}
        {!session ? (
          <>
            <button type="button" className="btn-primary" onClick={onOpenAccount}>
              Sign in
            </button>
            <p className="home-chat-note">
              Email, phone, and password — new accounts are created automatically. Reset
              password and remain signed in on this device.
            </p>
          </>
        ) : (
          <>
            <button type="button" className="btn-primary" onClick={onOpenNotifications}>
              Notifications
            </button>
            <p className="home-chat-note">
              Stay signed in so OTPs arrive as phone notifications even when this app is closed.
              Tap Copy OTP on the notification, then paste the code where you need it.
            </p>
            {session.eboardVerified ? (
              <button type="button" className="btn-ghost" onClick={() => void openEboardHome()}>
                Open eBoard
              </button>
            ) : null}
            <button type="button" className="btn-ghost" onClick={onOpenAccount}>
              Account settings
            </button>
          </>
        )}
        <button type="button" className="btn-ghost" onClick={onOpenAuthenticator}>
          Authenticator
        </button>
        <p className="home-chat-note">
          Register a TOTP account for your application. Six-digit codes refresh every 30
          seconds, the same way as Microsoft Authenticator.
        </p>
        <button type="button" className="btn-ghost" onClick={onOpenQr}>
          Scan App QR — browser login
        </button>
        <p className="home-chat-note">
          Option B: scan website/chat QR, verify identity if needed, then confirm.
        </p>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => void runUpdate(true)}
          disabled={updateBusy}
        >
          {updateBusy ? 'Updating…' : 'Check for app update'}
        </button>
        {updateNote ? <p className="home-chat-note">{updateNote}</p> : null}
      </section>

      <footer className="home-footer">
        <p>Republic of Kenya · Uwezo Fund</p>
        <p>App {appVersion} · updates download and install over this app</p>
      </footer>
    </main>
  );
}
