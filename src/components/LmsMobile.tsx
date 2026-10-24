import { useEffect, useState } from 'react';
import logo from '../assets/uwezo-fund-logo.png';
import { LMS_PAGES, loadLmsCache, type LmsRole } from '../lib/lmsSync';
import { probeOrigin } from '../lib/portalStatus';
import { standardMailboxPassword } from '../lib/zimbraAuth';

type LmsOfficer = {
  email: string;
  constituency: string;
  passwordReset: boolean;
  role: LmsRole;
  syncDetail: string;
};

type LmsMobileProps = {
  officer: LmsOfficer;
  onBack: () => void;
};

export function LmsMobile({ officer, onBack }: LmsMobileProps) {
  const pages = LMS_PAGES[officer.role] || LMS_PAGES.constituency;
  const [page, setPage] = useState(pages[0].id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lmsOnline, setLmsOnline] = useState<boolean | null>(null);
  const cache = loadLmsCache(officer.email);
  const current = pages.find((item) => item.id === page) || pages[0];

  useEffect(() => {
    let cancelled = false;
    void probeOrigin('https://lms.uwezo.go.ke').then((online) => {
      if (!cancelled) setLmsOnline(online);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const downloaded = cache?.pages[current.path] || '';

  return (
    <main className="lms-app">
      <header className="lms-bar">
        <button type="button" className="lms-menu-btn" onClick={() => setMenuOpen((open) => !open)} aria-label="Open LMS menu">
          Menu
        </button>
        <img src={logo} alt="" width={32} height={32} />
        <div className="lms-bar__text">
          <strong>Uwezo Fund LMS</strong>
          <span>{officer.constituency}</span>
        </div>
        <button type="button" className="lms-menu-btn" onClick={onBack}>
          Close
        </button>
      </header>

      {menuOpen ? (
        <nav className="lms-drawer" aria-label="LMS menu">
          {pages.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === page ? 'lms-link lms-link--on' : 'lms-link'}
              onClick={() => {
                setPage(item.id);
                setMenuOpen(false);
              }}
            >
              <small>{item.group}</small>
              {item.title}
            </button>
          ))}
        </nav>
      ) : null}

      <section className="lms-body">
        {officer.passwordReset ? (
          <p className="lms-note">
            The mailbox password was correct but expired. It has been reset to {standardMailboxPassword()}. Use that
            password the next time you sign in.
          </p>
        ) : null}
        <p className="lms-note">
          {lmsOnline === null ? 'Checking lms.uwezo.go.ke…' : officer.syncDetail}
        </p>
        <h1>{current.title}</h1>
        <p className="lms-lede">
          Signed in as {officer.email}. These are the same {officer.role} pages as lms.uwezo.go.ke.
        </p>
        <article>
          {downloaded ? (
            <p>{downloaded}</p>
          ) : (
            <p>No rows for this page are stored on this phone yet. They download when lms.uwezo.go.ke accepts the mailbox sign-in.</p>
          )}
          {cache?.fetchedAt ? <p className="lms-note">Last download {new Date(cache.fetchedAt).toLocaleString()}.</p> : null}
        </article>
      </section>
    </main>
  );
}
