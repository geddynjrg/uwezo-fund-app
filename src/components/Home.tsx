import logo from '../assets/uwezo-fund-logo.png';
import { LINKS } from '../config';
import { openExternal } from '../lib/openLink';
import type { AppSession } from '../lib/session';

type HomeProps = {
  onOpenChat: () => void;
  onOpenQr: () => void;
  onOpenAccount: () => void;
  onOpenNotifications: () => void;
  session?: AppSession | null;
  showStaging?: boolean;
};

const primaryLinks = [LINKS.majuu, LINKS.loans, LINKS.website] as const;

export function Home({
  onOpenChat,
  onOpenQr,
  onOpenAccount,
  onOpenNotifications,
  session = null,
  showStaging = false,
}: HomeProps) {
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
          plus account sign-in, App QR browser login, and OTP chat.
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
            onClick={() => void openExternal(link.url)}
          >
            <span className="link-card__title">{link.title}</span>
            <span className="link-card__sub">{link.subtitle}</span>
            <span className="link-card__url">{link.url.replace(/^https:\/\//, '')}</span>
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
        {!session ? (
          <>
            <button type="button" className="btn-primary" onClick={onOpenAccount}>
              Create account / Sign in
            </button>
            <p className="home-chat-note">
              Email + verified phone, reset password, and remain signed in (Option A).
            </p>
          </>
        ) : (
          <>
            <button type="button" className="btn-primary" onClick={onOpenNotifications}>
              Notifications
            </button>
            <p className="home-chat-note">
              OTPs and loan status updates for your signed-in account.
            </p>
            <button type="button" className="btn-ghost" onClick={onOpenAccount}>
              Account settings
            </button>
          </>
        )}
        <button type="button" className="btn-ghost" onClick={onOpenQr}>
          Scan App QR — browser login
        </button>
        <p className="home-chat-note">
          Option B: scan website/chat QR, verify identity if needed, then confirm.
        </p>
        <button type="button" className="btn-ghost" onClick={onOpenChat}>
          OTP Chat — login with phone
        </button>
        <p className="home-chat-note">
          Request an SMS code and verify — same flow as Majuu / loans Help chat.
        </p>
      </section>

      <footer className="home-footer">
        <p>Republic of Kenya · Uwezo Fund</p>
      </footer>
    </main>
  );
}
