import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
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
import { hasAnyCachedScreens, resolveCachedPageHtml } from '../lib/lmsPageShell';
import { hideLmsEmbed, setLmsEmbedBounds, showLmsEmbed } from '../lib/native';
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

function readBounds(el: HTMLElement | null) {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return null;
  return {
    x: Math.max(0, rect.left),
    y: Math.max(0, rect.top),
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
  };
}

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
  const [webHtml, setWebHtml] = useState('');
  const [webSrc, setWebSrc] = useState('');
  const bootDone = useRef('');
  const embedSlot = useRef<HTMLDivElement | null>(null);
  const current = pages.find((item) => item.id === page) || pages[0];
  const role = cache?.role || officer.role;
  const showCompare = lmsOnline === true && pending > 0;
  const showEmbed = section === 'pages';

  const syncEmbedBounds = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || !showEmbed) return;
    const bounds = readBounds(embedSlot.current);
    if (!bounds) return;
    await setLmsEmbedBounds(bounds);
  }, [showEmbed]);

  useEffect(() => {
    if (!showEmbed) {
      void hideLmsEmbed();
      return;
    }
    void syncEmbedBounds();
    const onResize = () => {
      void syncEmbedBounds();
    };
    window.addEventListener('resize', onResize);
    const timer = window.setInterval(() => {
      void syncEmbedBounds();
    }, 800);
    return () => {
      window.removeEventListener('resize', onResize);
      window.clearInterval(timer);
    };
  }, [showEmbed, menuOpen, notice, syncEmbedBounds]);

  useEffect(() => () => {
    void hideLmsEmbed();
  }, []);

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
        setNotice('');
        await openLmsPage(current?.path || '/dashboard', false);
      } else {
        setNotice('Offline — sync once online');
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
    setNotice('Syncing LMS database…');
    await refreshSessionQuiet();
    const result = await refreshLmsConnection(officer.email, current?.path || '/dashboard');
    setLmsOnline(result.online);
    setPending(await pendingMutationCount(officer.email));
    setNotice(result.detail);
    setRevision((value) => value + 1);
    setBusy(false);
    if (section === 'pages') await openLmsPage(current?.path, result.online);
  }

  async function openLmsPage(path?: string, forceOnline?: boolean) {
    const pagePath = path || current?.path || '/dashboard';
    const host = loadLmsCache(officer.email)?.host || cache?.host || 'https://lms.uwezo.go.ke';
    const online =
      forceOnline === true
      || (forceOnline !== false && (lmsOnline === true || (await probeOrigin('https://lms.uwezo.go.ke'))));
    if (online !== lmsOnline) setLmsOnline(online);

    // Wait a frame so the embed slot has layout
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
    const bounds = readBounds(embedSlot.current) || { x: 0, y: 120, width: window.innerWidth, height: Math.max(240, window.innerHeight - 120) };

    if (!online) {
      const html = await resolveCachedPageHtml(officer.email, pagePath);
      if (!html) {
        setNotice('Screen not cached — Sync online');
        return;
      }
      setBusy(true);
      if (Capacitor.isNativePlatform()) {
        const shown = await showLmsEmbed(bounds, {
          html,
          baseUrl: `${host}/`,
          offline: true,
        });
        setBusy(false);
        setNotice(shown ? '' : 'Could not show offline LMS');
      } else {
        setWebSrc('');
        setWebHtml(html);
        setBusy(false);
        setNotice('');
      }
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
    if (Capacitor.isNativePlatform()) {
      const shown = await showLmsEmbed(bounds, {
        url: target,
        cookie,
        baseUrl: `${host}/`,
        offline: false,
      });
      setBusy(false);
      setNotice(shown ? '' : 'Could not embed LMS');
    } else {
      setWebHtml('');
      setWebSrc(target);
      setBusy(false);
      setNotice('');
    }
  }

  async function sendOfflineChanges() {
    setBusy(true);
    setNotice('Sending offline changes and pulling the latest LMS database…');
    const result = await compareAndSendOfflineChanges(officer.email);
    setBusy(false);
    setNotice(result.detail);
    setPending(await pendingMutationCount(officer.email));
    if (result.ok && section === 'pages') await openLmsPage(current?.path, true);
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
    void hideLmsEmbed();
    setSection(next);
    setMenuOpen(false);
  }

  const reset = officer.passwordReset || loadStaffSession()?.passwordReset;

  return (
    <main className="lms-app lms-app--embed">
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
        <button
          type="button"
          className="lms-menu-btn"
          onClick={() => {
            void hideLmsEmbed();
            onBack();
          }}
        >
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
          <button
            type="button"
            className="lms-link"
            onClick={() => {
              void hideLmsEmbed();
              onLogout();
            }}
          >
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
        <>
          <div className="lms-embed-toolbar">
            <p className="lms-note">
              {notice
                || (lmsOnline === null
                  ? 'Checking LMS…'
                  : lmsOnline
                    ? `In-app LMS${pending ? ` · ${pending} to send` : ''}`
                    : 'In-app LMS (offline)')}
            </p>
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
          <div className="lms-embed-slot" ref={embedSlot}>
            {!Capacitor.isNativePlatform() ? (
              webHtml ? (
                <iframe className="lms-embed-frame" title="Uwezo LMS" srcDoc={webHtml} />
              ) : webSrc ? (
                <iframe className="lms-embed-frame" title="Uwezo LMS" src={webSrc} />
              ) : (
                <p className="home-chat-note">Loading LMS…</p>
              )
            ) : (
              <p className="lms-embed-placeholder home-chat-note">{busy ? 'Loading LMS…' : 'LMS screens load here inside the app.'}</p>
            )}
          </div>
        </>
      )}
    </main>
  );
}
