import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { AccountAuth } from './components/AccountAuth';
import { Authenticator } from './components/Authenticator';
import { Home } from './components/Home';
import { Notifications } from './components/Notifications';
import { LmsMobile } from './components/LmsMobile';
import { clearStaffSession, loadStaffSession, type StaffSession } from './lib/staffSession';
import type { LmsRole } from './lib/lmsSync';
import { MajuuApply } from './components/MajuuApply';
import { OfflineApply } from './components/OfflineApply';
import { QrLoginScan } from './components/QrLoginScan';
import {
  getActiveSession,
  newId,
  type AppNotification,
  type AppSession,
} from './lib/session';
import { registerPushDevice, INBOX_ORIGINS, canonicalAuthOrigin } from './lib/appAuth';
import { syncInbox } from './lib/inboxSync';
import { ensureFreshSession } from './lib/keepSession';
import { flushMajuuNotices, flushMajuuUploads, type MajuuRecord } from './lib/majuuApply';
import { syncPending, type OfflinePacket } from './lib/offlineApply';
import { replayPendingLogin } from './lib/pendingLogin';
import { ensureNotifyPermission } from './lib/notify';
import { openEboardFromDeepLink } from './lib/eboard';
import { EboardShell } from './components/EboardShell';
import { resolveDevicePushToken } from './lib/pushRegister';
import { probePortals, type PortalAvailability, type PortalId } from './lib/portalStatus';
import {
  copyOtpText,
  extractOtpCode,
  startOtpListener,
} from './lib/native';
import './App.css';

type Screen = 'home' | 'qr' | 'account' | 'notifications' | 'authenticator' | 'offline' | 'lms' | 'eboard';
type LmsOfficer = {
  email: string;
  constituency: string;
  passwordReset: boolean;
  role: LmsRole;
  syncDetail: string;
  mailOnly?: boolean;
};

function officerFrom(staff: StaffSession): LmsOfficer {
  return {
    email: staff.email,
    constituency: staff.constituency,
    passwordReset: staff.passwordReset,
    role: staff.role,
    syncDetail: staff.syncDetail,
    mailOnly: Boolean(staff.mailOnly),
  };
}

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [offlinePortal, setOfflinePortal] = useState<PortalId>('loans');
  const [openLoanPacketId, setOpenLoanPacketId] = useState('');
  const [openMajuuRecordId, setOpenMajuuRecordId] = useState('');
  const [lmsOfficer, setLmsOfficer] = useState<LmsOfficer | null>(null);
  const [eboardLaunch, setEboardLaunch] = useState<{
    email?: string;
    password?: string;
    url?: string;
  } | null>(null);
  const [staff, setStaff] = useState<StaffSession | null>(null);
  const [portals, setPortals] = useState<PortalAvailability>({ loans: null, majuu: null });
  const [session, setSession] = useState<AppSession | null>(null);
  const [toast, setToast] = useState<AppNotification | null>(null);
  const showStaging = import.meta.env.VITE_SHOW_LOANS_STAGING === 'true';

  useEffect(() => {
    let cancelled = false;
    async function checkPortals() {
      const next = await probePortals();
      if (cancelled) return;
      setPortals(next);
      if (next.majuu) {
        const login = await replayPendingLogin();
        if (!cancelled && login === 'signed-in') setSession(getActiveSession());
      }
      if (next.loans || next.majuu) void syncPending();
      if (next.majuu) {
        void flushMajuuNotices();
        void flushMajuuUploads();
      }
    }
    void checkPortals();
    let resume: Promise<{ remove: () => Promise<void> | void }> | null = null;
    if (Capacitor.isNativePlatform()) {
      resume = CapApp.addListener('resume', () => {
        void checkPortals();
      });
    }
    return () => {
      cancelled = true;
      void resume?.then((handle) => handle.remove());
    };
  }, []);

  useEffect(() => {
    setSession(getActiveSession());
    setStaff(loadStaffSession());
  }, []);

  useEffect(() => {
    if (!session?.accessToken) return;
    void ensureNotifyPermission();
    void ensureFreshSession().then((next) => {
      if (next && next.accessToken !== session.accessToken) setSession(next);
    });
    void resolveDevicePushToken().then((deviceToken) => {
      const origins = Array.from(
        new Set([canonicalAuthOrigin(session.origin), ...INBOX_ORIGINS]),
      );
      for (const origin of origins) {
        const accessToken = origin.includes('majuu')
          ? session.majuuAccessToken ||
            (session.origin.includes('majuu') ? session.accessToken : '')
          : origin.includes('staging')
            ? ''
            : session.loansAccessToken ||
              (session.origin.includes('loans') ? session.accessToken : '');
        if (!accessToken) continue;
        void registerPushDevice({
          origin,
          accessToken,
          deviceToken,
          platform: 'android',
          email: session.email,
          phone: session.phone,
        }).catch(() => {
          // optional
        });
      }
    });
    void startOtpListener(session).catch(() => {
      // native listener is optional on web
    });
  }, [session]);

  useEffect(() => {
    if (!session?.accessToken) return;
    let cancelled = false;
    let inflight = false;

    async function poll() {
      if (cancelled || inflight) return;
      inflight = true;
      try {
        const current = getActiveSession() || session;
        if (!current) return;
        const fresh = await syncInbox(current, { alert: true });
        if (!cancelled && fresh[0]) setToast(fresh[0]);
      } catch {
        // ignore poll errors
      } finally {
        inflight = false;
      }
    }

    void poll();
    const t = window.setInterval(() => void poll(), 900);
    let resume: Promise<{ remove: () => Promise<void> | void }> | null = null;
    if (Capacitor.isNativePlatform()) {
      resume = CapApp.addListener('resume', () => {
        void ensureFreshSession().then((next) => {
          if (next) setSession(next);
        });
        void poll();
      });
    }
    return () => {
      cancelled = true;
      window.clearInterval(t);
      void resume?.then((handle) => handle.remove());
    };
  }, [session]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handle = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (screen !== 'home') {
        setScreen('home');
        return;
      }
      if (canGoBack) {
        window.history.back();
        return;
      }
      void CapApp.minimizeApp();
    });

    return () => {
      void handle.then((h) => h.remove());
    };
  }, [screen]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    async function handleUrl(url: string) {
      if (!url || !url.startsWith('uwezo://eboard')) return;
      const result = await openEboardFromDeepLink(url);
      if (!result.ok) {
        setToast({
          id: newId(),
          title: 'eBoard',
          body: result.message,
          kind: 'system',
          createdAt: new Date().toISOString(),
          read: false,
        });
        return;
      }
      setEboardLaunch({ url: result.url });
      setScreen('eboard');
    }

    void CapApp.getLaunchUrl().then((launch) => {
      if (launch?.url) void handleUrl(launch.url);
    });

    const sub = CapApp.addListener('appUrlOpen', ({ url }) => {
      void handleUrl(url);
    });

    return () => {
      void sub.then((h) => h.remove());
    };
  }, []);

  const toastCode = toast ? extractOtpCode(toast.body) : null;
  const toastUi = toast ? (
    <div className="app-toast">
      <button
        type="button"
        className="app-toast__body"
        onClick={() => {
          setToast(null);
          setScreen('notifications');
        }}
      >
        <strong>{toast.title}</strong>
        <span>{toast.body}</span>
      </button>
      {toastCode ? (
        <button
          type="button"
          className="app-toast__copy"
          onClick={() => {
            void copyOtpText(toastCode);
          }}
        >
          Copy OTP
        </button>
      ) : null}
    </div>
  ) : null;

  if (screen === 'qr') {
    return (
      <>
        <QrLoginScan onBack={() => setScreen('home')} />
        {toastUi}
      </>
    );
  }
  if (screen === 'account') {
    return (
      <AccountAuth
        onBack={() => setScreen('home')}
        onSessionChange={(s) => setSession(s)}
        onContinueOffline={(portal) => {
          setOpenLoanPacketId('');
          setOpenMajuuRecordId('');
          setOfflinePortal(portal);
          setScreen('offline');
        }}
        onOpenLoanPacket={(packet: OfflinePacket) => {
          setOpenLoanPacketId(packet.id);
          setOpenMajuuRecordId('');
          setOfflinePortal('loans');
          setScreen('offline');
        }}
        onOpenMajuuRecord={(record: MajuuRecord) => {
          setOpenMajuuRecordId(record.id);
          setOpenLoanPacketId('');
          setOfflinePortal('majuu');
          setScreen('offline');
        }}
        onOpenLms={(officer) => {
          setLmsOfficer({
            ...officer,
            mailOnly: Boolean(officer.mailOnly),
          });
          setStaff(loadStaffSession());
          setScreen('lms');
        }}
        onOpenEboard={(launch) => {
          setEboardLaunch(launch);
          setScreen('eboard');
        }}
      />
    );
  }
  if (screen === 'eboard') {
    return (
      <EboardShell
        email={eboardLaunch?.email}
        password={eboardLaunch?.password}
        initialUrl={eboardLaunch?.url}
        onBack={() => {
          setEboardLaunch(null);
          setScreen(session || staff ? 'account' : 'home');
        }}
      />
    );
  }
  if (screen === 'notifications') {
    return <Notifications onBack={() => setScreen('home')} />;
  }
  if (screen === 'authenticator') {
    return (
      <>
        <Authenticator onBack={() => setScreen('home')} session={session} />
        {toastUi}
      </>
    );
  }
  if (screen === 'lms' && lmsOfficer) {
    return (
      <LmsMobile
        officer={lmsOfficer}
        onBack={() => {
          setStaff(loadStaffSession());
          setScreen('home');
        }}
        onLogout={() => {
          clearStaffSession();
          setStaff(null);
          setLmsOfficer(null);
          setScreen('home');
        }}
      />
    );
  }
  if (screen === 'offline') {
    return (
      <>
        {offlinePortal === 'majuu' ? (
          <MajuuApply
            onBack={() => {
              setOpenMajuuRecordId('');
              setScreen('home');
            }}
            openRecordId={openMajuuRecordId || undefined}
          />
        ) : (
          <OfflineApply
            portal={offlinePortal}
            onBack={() => {
              setOpenLoanPacketId('');
              setScreen('home');
            }}
            openPacketId={openLoanPacketId || undefined}
          />
        )}
        {toastUi}
      </>
    );
  }

  return (
    <>
      <Home
        onOpenQr={() => setScreen('qr')}
        onOpenAccount={() => setScreen('account')}
        onOpenNotifications={() => setScreen('notifications')}
        onOpenAuthenticator={() => setScreen('authenticator')}
        onOpenOffline={(portal) => {
          setOpenLoanPacketId('');
          setOpenMajuuRecordId('');
          setOfflinePortal(portal);
          setScreen('offline');
        }}
        onOpenLoanPacket={(packet) => {
          setOpenLoanPacketId(packet.id);
          setOpenMajuuRecordId('');
          setOfflinePortal('loans');
          setScreen('offline');
        }}
        onOpenMajuuRecord={(record) => {
          setOpenMajuuRecordId(record.id);
          setOpenLoanPacketId('');
          setOfflinePortal('majuu');
          setScreen('offline');
        }}
        portals={portals}
        session={session}
        staff={staff}
        onOpenStaff={() => {
          const current = loadStaffSession();
          if (!current) return;
          setLmsOfficer(officerFrom(current));
          setScreen('lms');
        }}
        showStaging={showStaging}
      />
      {toastUi}
    </>
  );
}

export default App;
