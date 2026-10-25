import { useState, useEffect, useRef } from 'react';
import logo from '../assets/uwezo-fund-logo.png';
import { LmsWork } from './LmsWork';
import { MailBox } from './MailBox';
import {
  LMS_PAGES,
  cacheHasFigures,
  loadLmsCache,
  openLmsFromZimbra,
  pageKit,
  roleLabel,
  runLmsAction,
  syncLmsMailbox,
  type LmsPageView,
  type LmsRole,
  type LmsRowAction,
} from '../lib/lmsSync';
import { probeOrigin } from '../lib/portalStatus';
import { officerCopyStatus } from '../lib/officerVault';
import { loadStaffSession, saveStaffSession } from '../lib/staffSession';
import { isUwezoMailbox, setMailboxPassword, standardMailboxPassword } from '../lib/zimbraAuth';
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

const emptyView: LmsPageView = { summary: [], tables: [], notes: [], fields: [], actions: [] };

export function LmsMobile({ officer, onBack, onLogout }: LmsMobileProps) {
  const [revision, setRevision] = useState(0);
  const cache = loadLmsCache(officer.email);
  const pages = (cache?.menu && cache.menu.length ? cache.menu : LMS_PAGES[officer.role]) || LMS_PAGES.staff;
  const [page, setPage] = useState(pages[0]?.id || 'dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [section, setSection] = useState<'pages' | 'mail' | 'password'>('pages');
  const [mailRevision, setMailRevision] = useState(0);
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [lmsOnline, setLmsOnline] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [override, setOverride] = useState<LmsPageView | null>(null);
  const autoRefreshDone = useRef('');
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

  useEffect(() => {
    if (section !== 'pages') return;
    if (lmsOnline !== true) return;
    if (cacheHasFigures(cache)) return;
    if (autoRefreshDone.current === officer.email) return;
    autoRefreshDone.current = officer.email;
    void refreshPages();
    // Pull figures once when an older empty cache is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officer.email, lmsOnline]);

  async function refreshPages() {
    const staff = loadStaffSession();
    if (!staff) return;
    setBusy(true);
    let synced = staff.password ? await syncLmsMailbox(staff.email, staff.password, { refresh: true }) : null;
    if (!synced?.authenticated && staff.mail?.token) synced = await openLmsFromZimbra(staff.email, staff.mail.token);
    if (synced?.authenticated) {
      saveStaffSession({
        ...staff,
        role: synced.role,
        constituency: synced.constituency || staff.constituency,
        syncDetail: synced.detail,
      });
    }
    setNotice(synced?.detail || 'Sign in again to download fresh LMS pages.');
    setRevision((value) => value + 1);
    setBusy(false);
  }

  async function runRowAction(action: LmsRowAction) {
    if (!current?.path) return;
    setBusy(true);
    setNotice('');
    const result = await runLmsAction(officer.email, current.path, {
      __action: action.method,
      __params: JSON.stringify(action.params),
      __id: String(action.params[0] ?? ''),
      editingPhaseId: String(action.params[0] ?? ''),
    });
    setBusy(false);
    setNotice(result.detail);
    if (result.ok) {
      setOverride(result.view);
      setRevision((value) => value + 1);
    }
  }

  async function changeMailboxPassword() {
    if (nextPassword !== confirmPassword) {
      setNotice('The two passwords do not match.');
      return;
    }
    setBusy(true);
    const result = await setMailboxPassword(officer.email, nextPassword);
    setBusy(false);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    const staff = loadStaffSession();
    if (staff) {
      const samePassword = Boolean(staff.password && staff.mail && staff.password === staff.mail.password);
      saveStaffSession({
        ...staff,
        password: samePassword ? result.password : staff.password,
        passwordReset: false,
        mail: { email: result.email, token: result.token, password: result.password },
      });
    }
    setNextPassword('');
    setConfirmPassword('');
    setMailRevision((value) => value + 1);
    setNotice(result.message);
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
          {isUwezoMailbox(officer.email) ? (
            <button type="button" className="lms-link" onClick={() => { setSection('password'); setMenuOpen(false); }}>
              <small>Mailbox</small>
              Change email password
            </button>
          ) : null}
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
          <MailBox key={mailRevision} onPasswordReset={setNotice} />
        ) : section === 'password' ? (
          <form className="account-form" onSubmit={(event) => { event.preventDefault(); void changeMailboxPassword(); }}>
            <h1>Mailbox password</h1>
            <p className="lms-lede">The new password is saved on mail.govmail.ke for {officer.email}.</p>
            <label>
              New password
              <input type="password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} autoComplete="new-password" />
            </label>
            <label>
              Confirm password
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
            </label>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
          </form>
        ) : (
          <>
            <p className="lms-note">{notice || (lmsOnline === null ? 'Checking lms.uwezo.go.ke…' : officer.syncDetail)}</p>
            <h1>{current?.title || 'LMS'}</h1>
            <p className="lms-lede">
              Signed in as {officer.email}. {roleLabel(role)} figures and tables from lms.uwezo.go.ke. You stay signed in until you log out.
              {officerCopyStatus(officer.email)?.savedAt
                ? ` Officer details were encrypted on this phone ${new Date(officerCopyStatus(officer.email)?.savedAt || '').toLocaleDateString()} and refresh after 15 days.`
                : ''}
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
                {table.rows.length ? (
                  <table>
                    {table.headers.length ? (
                      <thead>
                        <tr>
                          {table.headers.map((header) => <th key={header}>{header}</th>)}
                          {table.rowActions?.some((item) => item.length) ? <th>Actions</th> : null}
                        </tr>
                      </thead>
                    ) : null}
                    <tbody>
                      {table.rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
                          {table.rowActions?.some((item) => item.length) ? (
                            <td>
                              <div className="lms-row-actions">
                                {(table.rowActions[rowIndex] || []).map((action) => (
                                  <button
                                    key={`${action.method}-${action.params.join('-')}`}
                                    type="button"
                                    className="btn-ghost"
                                    disabled={busy}
                                    onClick={() => void runRowAction(action)}
                                  >
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="home-chat-note">{pageKit(current?.path || '')?.empty || 'No rows on this list yet.'}</p>
                )}
              </div>
            ))}
            {view.notes.map((note) => <p key={note}>{note}</p>)}
            {!view.summary.length && !view.tables.length && !view.notes.length ? (
              <p className="home-chat-note">{pageKit(current?.path || '')?.empty || 'This page has no figures or rows yet. Tap Refresh pages while online.'}</p>
            ) : null}
            {cache?.fetchedAt ? <p className="home-chat-note">Saved on this phone {new Date(cache.fetchedAt).toLocaleString()}.</p> : null}
            {current?.path ? (
              <LmsWork
                key={current.path}
                email={officer.email}
                path={current.path}
                fields={view.fields || []}
                actions={view.actions || []}
                busy={busy}
                setBusy={setBusy}
                setNotice={setNotice}
                onView={setOverride}
              />
            ) : null}
            <div className="doc-actions">
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
