import { useState, useEffect, useRef } from 'react';
import logo from '../assets/uwezo-fund-logo.png';
import { LmsOffline } from './LmsOffline';
import { MailBox } from './MailBox';
import { LmsReactHost } from '../lms/LmsReactHost';
import { menuForRole } from '../lms/registry';
import {
  cacheHasFigures,
  loadLmsCache,
  openLmsFromZimbra,
  roleLabel,
  syncLmsMailbox,
  type LmsRole,
} from '../lib/lmsSync';
import { openLmsDatabase, lmsDbVaultStatus } from '../lib/lmsDbVault';
import { compareAndSendOfflineChanges, refreshLmsConnection, syncLmsLocal } from '../lib/lmsOfflineSync';
import { loadLmsMeta, pendingMutationCount } from '../lib/lmsLocalDb';
import { hideLmsEmbed } from '../lib/native';
import { probeOrigin } from '../lib/portalStatus';
import { loadStaffSession, saveStaffSession } from '../lib/staffSession';
import { isUwezoMailbox, setMailboxPassword, standardMailboxPassword } from '../lib/zimbraAuth';

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
  const [revision, setRevision] = useState(0);
  const cache = loadLmsCache(officer.email);
  const role = (cache?.role || officer.role) as LmsRole;
  const pages = menuForRole(officer.email, role);
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
  const [hasLocalDb, setHasLocalDb] = useState(Boolean(lmsDbVaultStatus(officer.email)));
  const bootDone = useRef('');

  useEffect(() => {
    // Tear down any leftover WebView embed from older builds
    void hideLmsEmbed();
    return () => {
      void hideLmsEmbed();
    };
  }, []);

  useEffect(() => {
    if (!pages.find((item) => item.id === page) && pages[0]) {
      setPage(pages[0].id);
    }
  }, [pages, page]);

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
      const meta = await loadLmsMeta(officer.email);
      if (!cancelled) setHasLocalDb(Boolean(meta || lmsDbVaultStatus(officer.email)));

      const online = await probeOrigin('https://lms.uwezo.go.ke');
      if (cancelled) return;
      setLmsOnline(online);

      if (online) {
        if (!cacheHasFigures(cache) || !cache?.cookie) {
          setNotice('Signing in to LMS…');
          await refreshSessionQuiet();
        }
        setNotice('Syncing encrypted LMS data…');
        const synced = await syncLmsLocal(officer.email);
        if (cancelled) return;
        setNotice(synced.detail);
        count = await pendingMutationCount(officer.email);
        setPending(count);
        setHasLocalDb(Boolean(lmsDbVaultStatus(officer.email) || (await loadLmsMeta(officer.email))));
        setRevision((value) => value + 1);
      } else if (lmsDbVaultStatus(officer.email) || (await loadLmsMeta(officer.email))) {
        setNotice('');
        setHasLocalDb(true);
      } else {
        setNotice('Offline — sync once online to download encrypted LMS data.');
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
    setNotice('Syncing encrypted LMS data…');
    await refreshSessionQuiet();
    const result = await refreshLmsConnection(officer.email, pages.find((item) => item.id === page)?.path || '/dashboard');
    setLmsOnline(result.online);
    setPending(await pendingMutationCount(officer.email));
    setHasLocalDb(Boolean(lmsDbVaultStatus(officer.email) || (await loadLmsMeta(officer.email))));
    setNotice(result.detail);
    setRevision((value) => value + 1);
    setBusy(false);
  }

  async function sendOfflineChanges() {
    setBusy(true);
    setNotice('Sending offline changes and pulling the latest LMS database…');
    const result = await compareAndSendOfflineChanges(officer.email);
    setBusy(false);
    setNotice(result.detail);
    setPending(await pendingMutationCount(officer.email));
    setHasLocalDb(Boolean(lmsDbVaultStatus(officer.email) || (await loadLmsMeta(officer.email))));
    setRevision((value) => value + 1);
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

  function leavePages(next: 'mail' | 'password' | 'database') {
    setSection(next);
    setMenuOpen(false);
  }

  const reset = officer.passwordReset || loadStaffSession()?.passwordReset;
  const showCompare = lmsOnline === true && pending > 0;
  const statusLine =
    notice
    || (lmsOnline === null
      ? 'Checking LMS…'
      : lmsOnline
        ? `React LMS${pending ? ` · ${pending} to send` : ''}${role === 'constituency' && !hasLocalDb ? ' · sync needed' : ''}`
        : hasLocalDb
          ? 'React LMS (offline)'
          : 'Offline — sync once online');

  return (
    <main className="lms-app lms-app--react">
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
        <button type="button" className="lms-menu-btn" onClick={() => leavePages('mail')}>
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
          <button type="button" className="lms-link" onClick={() => leavePages('database')}>
            <small>Offline</small>
            Encrypted database
          </button>
          <button type="button" className="lms-link" onClick={() => leavePages('mail')}>
            <small>Mailbox</small>
            Mail
          </button>
          {isUwezoMailbox(officer.email) ? (
            <button type="button" className="lms-link" onClick={() => leavePages('password')}>
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

      {reset ? (
        <p className="lms-note lms-note--bar">
          The mailbox password had expired. It is now {standardMailboxPassword()}. Use that password the next time a sign-in is required.
        </p>
      ) : null}

      {section === 'mail' ? (
        <section className="lms-body">
          <MailBox key={mailRevision} onPasswordReset={setNotice} />
          {notice ? <p className="lms-note">{notice}</p> : null}
        </section>
      ) : section === 'database' ? (
        <section className="lms-body">
          <LmsOffline
            email={officer.email}
            online={lmsOnline}
            busy={busy}
            setBusy={setBusy}
            setNotice={setNotice}
            onOnlineChange={setLmsOnline}
            onPendingChange={setPending}
          />
        </section>
      ) : section === 'password' ? (
        <section className="lms-body">
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
        </section>
      ) : (
        <div className="lms-react">
          <div className="lms-react__toolbar">
            <p className="lms-note">{statusLine}</p>
            <div className="doc-actions">
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => void refresh()}>
                {busy ? 'Syncing…' : 'Sync'}
              </button>
              {showCompare ? (
                <button type="button" className="btn-primary" disabled={busy} onClick={() => void sendOfflineChanges()}>
                  {busy ? 'Sending…' : 'Compare'}
                </button>
              ) : null}
            </div>
          </div>
          <LmsReactHost
            pageId={page}
            email={officer.email}
            role={role}
            constituency={officer.constituency}
            online={lmsOnline}
            busy={busy}
            setBusy={setBusy}
            setNotice={setNotice}
            onNavigate={(next) => {
              setPage(next);
              setSection('pages');
            }}
            revision={revision}
          />
        </div>
      )}
    </main>
  );
}
