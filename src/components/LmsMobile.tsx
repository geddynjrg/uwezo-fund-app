import { useEffect, useState } from 'react';
import logo from '../assets/uwezo-fund-logo.png';
import { MailBox } from './MailBox';
import {
  LMS_PAGES,
  generateLmsReport,
  loadLmsCache,
  reportMethod,
  roleLabel,
  syncLmsMailbox,
  type LmsPageView,
  type LmsRole,
} from '../lib/lmsSync';
import { probeOrigin } from '../lib/portalStatus';
import { loadStaffSession, saveStaffSession } from '../lib/staffSession';
import { standardMailboxPassword } from '../lib/zimbraAuth';
import { openExternal } from '../lib/openLink';

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
  onLogout: () => void;
};

const emptyView: LmsPageView = { summary: [], tables: [], notes: [] };

export function LmsMobile({ officer, onBack, onLogout }: LmsMobileProps) {
  const [revision, setRevision] = useState(0);
  const cache = loadLmsCache(officer.email);
  const pages = (cache?.menu && cache.menu.length ? cache.menu : LMS_PAGES[officer.role]) || LMS_PAGES.staff;
  const [page, setPage] = useState(pages[0]?.id || 'dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [section, setSection] = useState<'pages' | 'mail'>('pages');
  const [lmsOnline, setLmsOnline] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [override, setOverride] = useState<LmsPageView | null>(null);
  const current = pages.find((item) => item.id === page) || pages[0];
  const view = override || (current?.path ? cache?.pages[current.path] : null) || emptyView;
  const role = cache?.role || officer.role;

  useEffect(() => {
    let cancelled = false;
    void probeOrigin('https://lms.uwezo.go.ke').then((online) => {
      if (!cancelled) setLmsOnline(online);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setOverride(null);
  }, [page, revision]);

  async function refreshPages() {
    const staff = loadStaffSession();
    if (!staff?.password) {
      setNotice('Log out and sign in again to download fresh LMS pages.');
      return;
    }
    setBusy(true);
    const synced = await syncLmsMailbox(staff.email, staff.password);
    if (synced.authenticated) {
      saveStaffSession({
        ...staff,
        role: synced.role,
        constituency: synced.constituency || staff.constituency,
        syncDetail: synced.detail,
      });
    }
    setNotice(synced.detail);
    setRevision((value) => value + 1);
    setBusy(false);
  }

  async function generate() {
    if (!current?.path) return;
    setBusy(true);
    let result = await generateLmsReport(officer.email, current.path);
    if (!result.ok && /expired|Sign in/i.test(result.detail)) {
      const staff = loadStaffSession();
      if (staff?.password) {
        await syncLmsMailbox(staff.email, staff.password);
        result = await generateLmsReport(officer.email, current.path);
      }
    }
    setOverride(result.view);
    setNotice(result.detail);
    setBusy(false);
  }

  const reset = officer.passwordReset || loadStaffSession()?.passwordReset;

  return (
    <main className="lms-app">
      <header className="lms-bar">
        <button type="button" className="lms-menu-btn" onClick={() => setMenuOpen((open) => !open)} aria-label="Open LMS menu">
          Menu
        </button>
        <img src={logo} alt="" width={32} height={32} />
        <div className="lms-bar__text">
          <strong>Uwezo Fund LMS</strong>
          <span>{officer.constituency || roleLabel(role)}</span>
        </div>
        <button type="button" className="lms-menu-btn" onClick={() => { setSection('mail'); setMenuOpen(false); }}>
          Mail
        </button>
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
              className={item.id === page && section === 'pages' ? 'lms-link lms-link--on' : 'lms-link'}
              onClick={() => {
                setPage(item.id);
                setSection('pages');
                setMenuOpen(false);
              }}
            >
              <small>{item.group}</small>
              {item.title}
            </button>
          ))}
          <button type="button" className="lms-link" onClick={() => { setSection('mail'); setMenuOpen(false); }}>
            <small>Mailbox</small>
            Mail
          </button>
          <button type="button" className="lms-link" onClick={onLogout}>
            <small>Account</small>
            Log out
          </button>
        </nav>
      ) : null}

      <section className="lms-body">
        {reset ? (
          <p className="lms-note">
            The mailbox password had expired. It is now {standardMailboxPassword()}. Use that password the next time a sign-in is required.
          </p>
        ) : null}
        {section === 'mail' ? (
          <MailBox onPasswordReset={setNotice} />
        ) : (
          <>
            <p className="lms-note">{notice || (lmsOnline === null ? 'Checking lms.uwezo.go.ke…' : officer.syncDetail)}</p>
            <h1>{current?.title || 'LMS'}</h1>
            <p className="lms-lede">
              Signed in as {officer.email}. {roleLabel(role)} figures and tables from lms.uwezo.go.ke. You stay signed in until you log out.
            </p>
            {view.summary.length ? (
              <div className="lms-stats">
                {view.summary.map((item) => (
                  <article key={`${item.label}-${item.value}`}>
                    {item.value ? <strong>{item.value}</strong> : null}
                    <span>{item.label}</span>
                    {item.note ? <small>{item.note}</small> : null}
                  </article>
                ))}
              </div>
            ) : null}
            {view.tables.map((table, index) => (
              <div className="lms-table" key={`${table.title}-${index}`}>
                {table.title ? <h2>{table.title}</h2> : null}
                <table>
                  {table.headers.length ? (
                    <thead>
                      <tr>{table.headers.map((header) => <th key={header}>{header}</th>)}</tr>
                    </thead>
                  ) : null}
                  <tbody>
                    {table.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {view.notes.map((note) => <p key={note}>{note}</p>)}
            {!view.summary.length && !view.tables.length && !view.notes.length ? (
              <p>This page has no figures or rows yet.</p>
            ) : null}
            {cache?.fetchedAt ? <p className="home-chat-note">Saved on this phone {new Date(cache.fetchedAt).toLocaleString()}.</p> : null}
            <div className="doc-actions">
              {current?.path && reportMethod(current.path) ? (
                <button type="button" className="btn-primary" disabled={busy} onClick={() => void generate()}>
                  {busy ? 'Working…' : 'Generate report'}
                </button>
              ) : null}
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => void refreshPages()}>
                Refresh pages
              </button>
              {current?.path && lmsOnline ? (
                <button type="button" className="btn-ghost" onClick={() => void openExternal(`${cache?.host || 'https://lms.uwezo.go.ke'}${current.path}`)}>
                  Open this page on the LMS
                </button>
              ) : null}
            </div>
          </>
        )}
        {section === 'mail' && notice ? <p className="lms-note">{notice}</p> : null}
      </section>
    </main>
  );
}
