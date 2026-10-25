import { useState, useEffect, useRef } from 'react';
import logo from '../assets/uwezo-fund-logo.png';
import { LmsOffline } from './LmsOffline';
import { MailBox } from './MailBox';
import {
  LMS_PAGES,
  cacheHasFigures,
  loadLmsCache,
  openLmsFromZimbra,
  roleLabel,
  syncLmsMailbox,
  type LmsRole,
} from '../lib/lmsSync';
import { openLmsDatabase, lmsDbVaultStatus } from '../lib/lmsDbVault';
import { compareAndSendOfflineChanges, refreshLmsConnection, syncLmsLocal } from '../lib/lmsOfflineSync';
import { pendingMutationCount } from '../lib/lmsLocalDb';
import { hasAnyCachedScreens, loadPageShells, resolveCachedPageHtml } from '../lib/lmsPageShell';
import { openLmsSession } from '../lib/native';
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

export function LmsMobile({ officer, onBack, onLogout }: LmsMobileProps) {
  const [, setRevision] = useState(0);
  const cache = loadLmsCache(officer.email);
  const pages = (cache?.menu && cache.menu.length ? cache.menu : LMS_PAGES[officer.role]) || LMS_PAGES.staff;
  const [page, setPage] = useState(pages[0]?.id || 'dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [section, setSection] = useState<'pages' | 'mail' | 'password' | 'database'>('pages');
  const [mailRevision, setMailRevision] = useState(0);
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [lmsOnline, setLmsOnline] = useState<boolean | null>(null);
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const bootDone = useRef('');
  const current = pages.find((item) => item.id === page) || pages[0];
  const role = cache?.role || officer.role;
  const showCompare = lmsOnline === true && pending > 0;
  const vault = lmsDbVaultStatus(officer.email);
  const shells = loadPageShells(officer.email);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (bootDone.current === officer.email) return;
      bootDone.current = officer.email;
      const staff = loadStaffSession();
      if (staff?.password && lmsDbVaultStatus(officer.email)) {
        await openLmsDatabase(officer.email, staff.password);
      }
      let count = await pendingMutationCount(officer.email);
      if (!cancelled) setPending(count);

      const online = await probeOrigin('https://lms.uwezo.go.ke');
      if (cancelled) return;
      setLmsOnline(online);

      if (online) {
        // Session + full DB sync (push app changes, pull LMS DB, refresh offline screens)
        if (!cacheHasFigures(cache) || !cache?.cookie) {
          await refreshSessionQuiet();
        }
        setNotice('Syncing with the LMS database…');
        const synced = await syncLmsLocal(officer.email);
        if (cancelled) return;
        setNotice(synced.detail);
        count = await pendingMutationCount(officer.email);
        setPending(count);
        await openLmsPage(current?.path || '/dashboard', true);
      } else if (hasAnyCachedScreens(officer.email)) {
        setNotice('Offline — opening the last synced LMS screens (same UI as the website).');
        await openLmsPage(current?.path || '/dashboard', false);
      } else {
        setNotice('Offline and no LMS screens cached yet. Connect once and tap Refresh to sync the database and download the website UI.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officer.email]);

  async function refreshSessionQuiet() {
    const staff = loadStaffSession();
    if (!staff) return;
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
  }

  async function refresh() {
    setBusy(true);
    setNotice('Checking lms.uwezo.go.ke and syncing the LMS database…');
    await refreshSessionQuiet();
    const result = await refreshLmsConnection(officer.email, current?.path || '/dashboard');
    setLmsOnline(result.online);
    setPending(await pendingMutationCount(officer.email));
    setNotice(result.detail);
    setRevision((value) => value + 1);
    setBusy(false);
    await openLmsPage(current?.path, result.online);
  }

  async function openLmsPage(path?: string, forceOnline?: boolean) {
    const pagePath = path || current?.path || '/dashboard';
    const host = loadLmsCache(officer.email)?.host || cache?.host || 'https://lms.uwezo.go.ke';
    const online = forceOnline === true || (forceOnline !== false && (lmsOnline === true || (await probeOrigin('https://lms.uwezo.go.ke'))));
    if (online !== lmsOnline) setLmsOnline(online);

    if (!online) {
      const html = await resolveCachedPageHtml(officer.email, pagePath);
      if (!html) {
        setNotice('No offline copy of this LMS screen. Tap Refresh while online to pull the database and download the same website UI.');
        return;
      }
      setBusy(true);
      const opened = await openLmsSession(`${host}${pagePath}`, '', {
        html,
        baseUrl: `${host}/`,
        offline: true,
      });
      setBusy(false);
      setNotice(
        opened
          ? `Offline LMS — same UI as the website${shells?.savedAt ? ` (synced ${new Date(shells.savedAt).toLocaleString()})` : ''}.`
          : 'Could not open the offline LMS screen.',
      );
      return;
    }

    let cookie = loadLmsCache(officer.email)?.cookie || cache?.cookie || '';
    if (!cookie) {
      await refreshSessionQuiet();
      cookie = loadLmsCache(officer.email)?.cookie || '';
    }
    if (!cookie) {
      setNotice('Could not open the live LMS. Tap Refresh, then try again.');
      return;
    }
    const target = `${host}${pagePath}`;
    setBusy(true);
    const opened = await openLmsSession(target, cookie);
    setBusy(false);
    if (!opened) {
      await openExternal(target);
      setNotice('Opened the LMS in the browser.');
      return;
    }
    setNotice('Live LMS — same UI as lms.uwezo.go.ke. Database syncs on Refresh.');
  }

  async function sendOfflineChanges() {
    setBusy(true);
    setNotice('Sending offline changes and pulling the latest LMS database…');
    const result = await compareAndSendOfflineChanges(officer.email);
    setBusy(false);
    setNotice(result.detail);
    setPending(await pendingMutationCount(officer.email));
    if (result.ok) await openLmsPage(current?.path, true);
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
        <button type="button" className="lms-menu-btn" disabled={busy} onClick={() => void refresh()}>
          Refresh
        </button>
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
                void openLmsPage(item.path);
              }}
            >
              <small>{item.group}</small>
              {item.title}
            </button>
          ))}
          <button type="button" className="lms-link" onClick={() => { setSection('database'); setMenuOpen(false); }}>
            <small>Offline</small>
            Encrypted database
          </button>
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
        ) : section === 'database' ? (
          <LmsOffline
            email={officer.email}
            online={lmsOnline}
            busy={busy}
            setBusy={setBusy}
            setNotice={setNotice}
            onOnlineChange={setLmsOnline}
            onPendingChange={setPending}
          />
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
            <p className="lms-note">
              {notice
                || (lmsOnline === null
                  ? 'Checking lms.uwezo.go.ke…'
                  : lmsOnline
                    ? `Online — same LMS UI as the website. Refresh syncs the database.${pending ? ` ${pending} offline change(s) to send.` : ''}`
                    : 'Offline — same LMS UI from the last database sync.')}
            </p>
            <h1>{current?.title || 'LMS'}</h1>
            <p className="lms-lede">
              Signed in as {officer.email}. Online and offline both open the website LMS screens.
              Refresh pulls the LMS database and updates the offline copy.
              {vault ? ` Encrypted DB saved ${new Date(vault.savedAt).toLocaleString()}.` : ''}
              {officerCopyStatus(officer.email)?.savedAt
                ? ` Officer details encrypted ${new Date(officerCopyStatus(officer.email)?.savedAt || '').toLocaleDateString()}.`
                : ''}
            </p>
            <div className="doc-actions">
              <button type="button" className="btn-primary" disabled={busy} onClick={() => void openLmsPage(current?.path)}>
                {busy ? 'Opening…' : `Open ${current?.title || 'LMS'}`}
              </button>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => void refresh()}>
                {busy ? 'Syncing…' : 'Refresh / sync database'}
              </button>
              {showCompare ? (
                <button type="button" className="btn-primary" disabled={busy} onClick={() => void sendOfflineChanges()}>
                  {busy ? 'Sending…' : 'Compare with the LMS'}
                </button>
              ) : null}
              <button type="button" className="btn-ghost" onClick={() => setSection('database')}>
                Encrypted database
              </button>
            </div>
          </>
        )}
        {section === 'mail' && notice ? <p className="lms-note">{notice}</p> : null}
      </section>
    </main>
  );
}
