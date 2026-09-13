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
};

type UwezoNativePlugin = {
  startOtpListener(options: {
    email?: string;
    phone?: string;
    origins: string[];
  }): Promise<{ started?: boolean }>;
  stopOtpListener(): Promise<void>;
  copyText(options: { text: string }): Promise<{ copied: boolean }>;
  getVersion(): Promise<NativeVersion>;
  checkForUpdate(): Promise<NativeUpdateInfo>;
  installUpdate(): Promise<{ started: boolean; updateAvailable?: boolean; versionName?: string }>;
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

export async function getNativeVersion(): Promise<NativeVersion | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    return await UwezoNative.getVersion();
  } catch {
    return null;
  }
}

export async function checkForNativeUpdate(): Promise<NativeUpdateInfo | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    return await UwezoNative.checkForUpdate();
  } catch {
    return null;
  }
}

export async function installNativeUpdate() {
  if (!Capacitor.isNativePlatform()) {
    return { started: false };
  }
  return UwezoNative.installUpdate();
}
