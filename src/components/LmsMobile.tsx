import { useState, useEffect, useRef } from 'react';
import logo from '../assets/uwezo-fund-logo.png';
import { LmsOffline } from './LmsOffline';
import { MailBox } from './MailBox';
import { LmsReactHost } from '../lms/LmsReactHost';
import { menuForRole } from '../lms/registry';
import {
  loadLmsCache,
  openLmsFromZimbra,
  roleLabel,
  syncLmsMailbox,
  type LmsRole,
} from '../lib/lmsSync';
import { openLmsDatabase, lmsDbVaultStatus } from '../lib/lmsDbVault';
import { compareAndSendOfflineChanges, refreshLmsConnection, syncLmsLocal } from '../lib/lmsOfflineSync';
import { ensureLmsWorkingCopyFor, loadLmsMeta, pendingMutationCount } from '../lib/lmsLocalDb';
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
  mailOnly?: boolean;
};

type LmsMobileProps = {
  officer: LmsOfficer;
  onBack: () => void;
  onLogout: () => void;
};

export function LmsMobile({ officer, onBack, onLogout }: LmsMobileProps) {
  const mailOnly = Boolean(officer.mailOnly || loadStaffSession()?.mailOnly);
  const [revision, setRevision] = useState(0);
  const cache = loadLmsCache(officer.email);
  const role = (cache?.role || officer.role) as LmsRole;
  const pages = mailOnly ? [] : menuForRole(officer.email, role);
  const [page, setPage] = useState(pages[0]?.id || 'dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [section, setSection] = useState<'pages' | 'mail' | 'password' | 'database'>(
    mailOnly ? 'mail' : 'pages',
  );
  const [mailRevision, setMailRevision] = useState(0);
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [lmsOnline, setLmsOnline] = useState<boolean | null>(null);
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(mailOnly ? officer.syncDetail || '' : '');
  const [hasLocalDb, setHasLocalDb] = useState(Boolean(lmsDbVaultStatus(officer.email)));
  const [constituencyLabel, setConstituencyLabel] = useState(officer.constituency);
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

  async function applyConstituencyName(metaName?: string) {
    const name = String(metaName || '').trim();
    if (!name) return;
    setConstituencyLabel(name);
    const staff = loadStaffSession();
    if (staff && staff.email === officer.email && staff.constituency !== name) {
      saveStaffSession({ ...staff, constituency: name });
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (bootDone.current === officer.email) return;
      bootDone.current = officer.email;
      if (mailOnly) {
        setSection('mail');
        setNotice(
          officer.syncDetail ||
            'This mailbox is not an LMS user. Mail is available; the loan management system is not.',
        );
        setLmsOnline(false);
        return;
      }
      await ensureLmsWorkingCopyFor(officer.email);
      const staff = loadStaffSession();
      if (staff?.password && lmsDbVaultStatus(officer.email)) {
        await openLmsDatabase(officer.email, staff.password);
      }
      let count = await pendingMutationCount(officer.email);
      if (!cancelled) setPending(count);
      let meta = await loadLmsMeta(officer.email);
      if (!cancelled) {
        setHasLocalDb(Boolean(meta || lmsDbVaultStatus(officer.email)));
        if (meta?.constituencyName) void applyConstituencyName(meta.constituencyName);
      }

      const online = await probeOrigin('https://lms.uwezo.go.ke');
      if (cancelled) return;
      setLmsOnline(online);

      if (online) {
        // Host reachable ≠ authenticated. Always refresh the LMS session when online so
        // /app/mobile/snapshot can run (cookie + constituency), then sync local DB.
        setNotice('Signing in to LMS…');
        await refreshSessionQuiet();
        setNotice('Syncing encrypted LMS data…');
        let synced = await syncLmsLocal(officer.email);
        if (!synced.ok && /session|Sign in|cookie|expired|403|401/i.test(synced.detail || '')) {
          setNotice('Refreshing LMS session, then syncing again…');
          await refreshSessionQuiet();
          synced = await syncLmsLocal(officer.email);
        }
        if (cancelled) return;
        setNotice(synced.detail);
        count = await pendingMutationCount(officer.email);
        setPending(count);
        meta = synced.meta || (await loadLmsMeta(officer.email));
        setHasLocalDb(Boolean(lmsDbVaultStatus(officer.email) || meta));
        if (meta?.constituencyName) void applyConstituencyName(meta.constituencyName);
        setRevision((value) => value + 1);
      } else if (lmsDbVaultStatus(officer.email) || (await loadLmsMeta(officer.email))) {
        setNotice('');
        setHasLocalDb(true);
        meta = await loadLmsMeta(officer.email);
        if (meta?.constituencyName) void applyConstituencyName(meta.constituencyName);
      } else {
        setNotice('Offline — sync once online to download encrypted LMS data.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officer.email, mailOnly]);

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
    const staffForPwd = loadStaffSession();
    const result = await setMailboxPassword(officer.email, nextPassword, [
      staffForPwd?.mail?.password || '',
      staffForPwd?.password || '',
      standardMailboxPassword(),
    ]);
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
  const showCompare = !mailOnly && lmsOnline === true && pending > 0;
  const statusLine = mailOnly
    ? notice || 'Mail only — not an LMS user'
    : notice ||
      (lmsOnline === null
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
          <strong>{mailOnly ? 'Uwezo Mail' : 'Uwezo Fund LMS'}</strong>
          <span>
            {mailOnly
              ? officer.email
              : constituencyLabel || officer.constituency || roleLabel(role)}
          </span>
        </div>
        {!mailOnly ? (
          <button type="button" className="lms-menu-btn" disabled={busy} onClick={() => void refresh()}>
            Refresh
          </button>
        ) : null}
        <button type="button" className="lms-menu-btn" onClick={() => leavePages('mail')}>
          Mail
        </button>
        <button type="button" className="lms-menu-btn" onClick={onBack}>
          Close
        </button>
      </header>

      {menuOpen ? (
        <nav
          className={`lms-drawer${
            role === 'headquarters'
              ? ' lms-drawer--hq'
              : role === 'secretariat'
                ? ' lms-drawer--secretariat'
                : role === 'accountant'
                  ? ' lms-drawer--accountant'
                  : ''
          }`}
          aria-label="LMS menu"
        >
          <div className="lms-drawer__brand">
            <img src={logo} alt="" width={28} height={28} />
            <strong>UWEZO FUND LMS</strong>
          </div>
          {!mailOnly
            ? (() => {
                const groups: { group: string; items: typeof pages }[] = [];
                for (const item of pages) {
                  const last = groups[groups.length - 1];
                  if (!last || last.group !== item.group) groups.push({ group: item.group, items: [item] });
                  else last.items.push(item);
                }
                return groups.map((block) => (
                  <div key={block.group} style={{ display: 'contents' }}>
                    <div className="lms-drawer__section">{block.group}</div>
                    {block.items.map((item) => (
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
                        {item.title}
                      </button>
                    ))}
                  </div>
                ));
              })()
            : null}
          {!mailOnly ? (
            <>
              <div className="lms-drawer__section">Offline</div>
              <button type="button" className="lms-link" onClick={() => leavePages('database')}>
                Encrypted database
              </button>
            </>
          ) : (
            <div className="lms-drawer__section">Mail only</div>
          )}
          <div className="lms-drawer__section">Mailbox</div>
          <button type="button" className="lms-link" onClick={() => leavePages('mail')}>
            Mail
          </button>
          {isUwezoMailbox(officer.email) ? (
            <button type="button" className="lms-link" onClick={() => leavePages('password')}>
              Change email password
            </button>
          ) : null}
          <div className="lms-drawer__section">Account</div>
          <button type="button" className="lms-link" onClick={onLogout}>
            Log out
          </button>
        </nav>
      ) : null}

      {reset ? (
        <p className="lms-note lms-note--bar">
          Your mailbox password had expired and was reset to {standardMailboxPassword()}. Use that password the next time a mailbox sign-in is required.
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
      ) : mailOnly ? (
        <section className="lms-body">
          <p className="lms-note">{statusLine}</p>
          <MailBox key={mailRevision} onPasswordReset={setNotice} />
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
            constituency={constituencyLabel || officer.constituency}
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
