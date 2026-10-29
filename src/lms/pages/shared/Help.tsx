import type { LmsPageProps } from '../../types';

export default function Help({ role, constituency, online }: LmsPageProps) {
  return (
    <div>
      <div className="lms-hero-banner">
        <h2>Help · LMS</h2>
        <p>
          {role} · {constituency || 'National'} · {online === null ? 'checking…' : online ? 'online' : 'offline'}
        </p>
      </div>
      <section className="lms-card">
        <div className="lms-card__head">
          <h2>Using the in-app LMS</h2>
        </div>
        <div className="lms-card__body">
          <p className="lms-muted">
            This React LMS mirrors the screens on lms.uwezo.go.ke for your role — same layout patterns, filters, and primary actions —
            adapted to the Uwezo phone shell. Only the modules for your account are loaded.
          </p>
          <ul className="lms-muted">
            <li>
              Tap <strong>Sync</strong> while online to download and encrypt your constituency database.
            </li>
            <li>
              Tap <strong>Compare</strong> when you have offline changes (for example receipts) waiting to send.
            </li>
            <li>Constituency officers work from the encrypted IndexedDB copy offline; HQ / Secretariat stay online-first.</li>
            <li>
              Mail is under the Menu. Zimbra sign-ins use your mailbox password; LMS sign-ins open your mailbox through ICT
              support so you still read and send as yourself.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
