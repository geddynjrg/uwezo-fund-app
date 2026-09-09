import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

/** Open an external URL in system browser (native) or new tab (web/PWA). */
export async function openExternal(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
