import { Capacitor, registerPlugin } from '@capacitor/core';
import { INBOX_ORIGINS, canonicalAuthOrigin } from './appAuth';
import { extractOtpCode, type AppSession } from './session';

export type NativeVersion = {
  versionCode: number;
  versionName: string;
};

export type NativeUpdateInfo = {
  updateAvailable: boolean;
  versionCode?: number;
  versionName?: string;
  notes?: string;
  apkUrl?: string;
  currentVersionCode?: number;
  started?: boolean;
  needsPermission?: boolean;
  stage?: string;
};

type UwezoNativePlugin = {
  startOtpListener(options: {
    email?: string;
    phone?: string;
    origins: string[];
  }): Promise<{ started?: boolean }>;
  stopOtpListener(): Promise<void>;
  showOtpAlert(options: {
    id?: string;
    title: string;
    body: string;
    kind?: string;
    otp?: string;
  }): Promise<{ shown?: boolean; hasOtp?: boolean }>;
  copyText(options: { text: string }): Promise<{ copied: boolean }>;
  readSimPhoneNumber(): Promise<{
    online?: boolean;
    numbers?: string[];
    permission?: string;
  }>;
  getVersion(): Promise<NativeVersion>;
  openLmsSession(options: {
    url?: string;
    cookie?: string;
    html?: string;
    baseUrl?: string;
    offline?: boolean;
  }): Promise<{ opened?: boolean }>;
  saveLmsOfflinePage(options: { path: string; html: string }): Promise<{ saved?: boolean }>;
  readLmsOfflinePage(options: { path: string }): Promise<{ found?: boolean; html?: string }>;
  checkForUpdate(): Promise<NativeUpdateInfo>;
  installUpdate(): Promise<NativeUpdateInfo>;
  addListener(
    eventName: 'updateProgress',
    listener: (event: { stage: string; message: string }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
};

const UwezoNative = registerPlugin<UwezoNativePlugin>('UwezoNative');

export { extractOtpCode };

export async function startOtpListener(session: AppSession) {
  if (!Capacitor.isNativePlatform()) return;
  const origins = Array.from(
    new Set([canonicalAuthOrigin(session.origin), ...INBOX_ORIGINS]),
  );
  await UwezoNative.startOtpListener({
    email: session.email,
    phone: session.phone,
    origins,
  });
}

export async function stopOtpListener() {
  if (!Capacitor.isNativePlatform()) return;
  await UwezoNative.stopOtpListener();
}

export async function showNativeOtpAlert(input: {
  id?: string;
  title: string;
  body: string;
  kind?: string;
  otp?: string;
}) {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await UwezoNative.showOtpAlert({
      id: input.id,
      title: input.title,
      body: input.body,
      kind: input.kind,
      otp: input.otp,
    });
    return Boolean(result.shown);
  } catch {
    return false;
  }
}

export async function copyOtpText(text: string) {
  const value = text.trim();
  if (!value) return false;
  try {
    if (Capacitor.isNativePlatform()) {
      const result = await UwezoNative.copyText({ text: value });
      return result.copied;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export type SimPhoneResult = {
  online: boolean;
  numbers: string[];
  permission: 'granted' | 'denied' | 'offline' | 'unavailable';
};

/** Read the Kenyan mobile number stored on the SIM. Only works while online. */
export async function readSimPhoneNumber(): Promise<SimPhoneResult> {
  if (!Capacitor.isNativePlatform()) {
    return { online: navigator.onLine, numbers: [], permission: 'unavailable' };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { online: false, numbers: [], permission: 'offline' };
  }
  try {
    const result = await UwezoNative.readSimPhoneNumber();
    const permission =
      result.permission === 'denied'
        ? 'denied'
        : result.permission === 'offline' || result.online === false
          ? 'offline'
          : 'granted';
    return {
      online: result.online !== false && permission !== 'offline',
      numbers: Array.isArray(result.numbers) ? result.numbers.map((item) => String(item)) : [],
      permission,
    };
  } catch {
    return { online: navigator.onLine, numbers: [], permission: 'denied' };
  }
}

export async function getNativeVersion(): Promise<NativeVersion | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    return await UwezoNative.getVersion();
  } catch {
    return null;
  }
}

/** Open the live LMS (or an offline HTML shell) in a first-party WebView. */
export async function openLmsSession(
  url: string,
  cookie = '',
  options?: { html?: string; baseUrl?: string; offline?: boolean },
): Promise<boolean> {
  if (!url && !options?.html) return false;
  if (!Capacitor.isNativePlatform()) {
    if (options?.html) {
      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(options.html);
        win.document.close();
        return true;
      }
    }
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    return Boolean(url);
  }
  try {
    const result = await UwezoNative.openLmsSession({
      url: url || options?.baseUrl || 'https://lms.uwezo.go.ke/',
      cookie,
      html: options?.html,
      baseUrl: options?.baseUrl || 'https://lms.uwezo.go.ke/',
      offline: Boolean(options?.offline || options?.html),
    });
    return Boolean(result.opened);
  } catch {
    return false;
  }
}

/** Persist one offline LMS page for in-WebView navigation. */
export async function saveLmsOfflinePage(path: string, html: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !path || !html) return false;
  try {
    const result = await UwezoNative.saveLmsOfflinePage({ path, html });
    return Boolean(result.saved);
  } catch {
    return false;
  }
}

/** Read a cached offline LMS page from native storage (full HTML). */
export async function readLmsOfflinePage(path: string): Promise<string | null> {
  if (!path) return null;
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const result = await UwezoNative.readLmsOfflinePage({ path });
    if (result.found && result.html) return result.html;
  } catch {
    /* fall through */
  }
  return null;
}

export async function checkForNativeUpdate(): Promise<NativeUpdateInfo | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    return await UwezoNative.checkForUpdate();
  } catch {
    return null;
  }
}

export async function installNativeUpdate(): Promise<NativeUpdateInfo> {
  if (!Capacitor.isNativePlatform()) {
    return { started: false, updateAvailable: false };
  }
  return UwezoNative.installUpdate();
}

export async function onUpdateProgress(
  listener: (event: { stage: string; message: string }) => void,
) {
  if (!Capacitor.isNativePlatform()) return { remove: async () => undefined };
  return UwezoNative.addListener('updateProgress', listener);
}
