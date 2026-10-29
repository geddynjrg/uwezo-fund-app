import { Capacitor } from '@capacitor/core';
import { newId } from './session';

/**
 * Device token for inbox / eBoard notify matching.
 *
 * Do NOT call Capacitor PushNotifications.register() until
 * android/app/google-services.json is present — without it
 * FirebaseMessaging.getInstance() crashes the native process.
 * Use a stable local id so email/phone matching still works.
 */
export async function resolveDevicePushToken(): Promise<string> {
  const stored = localStorage.getItem('uwezo.fund.deviceToken') || '';
  if (!Capacitor.isNativePlatform()) {
    const token = stored || `web-${newId()}`;
    localStorage.setItem('uwezo.fund.deviceToken', token);
    return token;
  }

  // Native without google-services.json: skip FCM register (crashes otherwise).
  const fallback = stored || `local-${newId()}`;
  localStorage.setItem('uwezo.fund.deviceToken', fallback);
  return fallback;
}
