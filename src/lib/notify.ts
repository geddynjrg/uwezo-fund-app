import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { extractOtpCode, type AppNotification } from './session';
import { showNativeOtpAlert } from './native';

const CHANNEL_ID = 'uwezo_alerts';
let channelReady = false;
let permissionAsked = false;

function numericId(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const id = Math.abs(hash) || 1;
  return id > 2_000_000_000 ? id % 2_000_000_000 : id;
}

async function ensureChannel() {
  if (!Capacitor.isNativePlatform() || channelReady) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Uwezo alerts',
      description: 'OTP codes and loan status',
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: 'default',
    });
    channelReady = true;
  } catch {
    channelReady = true;
  }
}

export async function ensureNotifyPermission() {
  if (permissionAsked) return;
  permissionAsked = true;
  try {
    if (Capacitor.isNativePlatform()) {
      const current = await LocalNotifications.checkPermissions();
      if (current.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
      await ensureChannel();
      return;
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  } catch {
    // optional
  }
}

export async function showPhoneAlert(item: AppNotification) {
  await ensureNotifyPermission();
  const otp = extractOtpCode(item.body) || '';
  try {
    if (Capacitor.isNativePlatform()) {
      const shown = await showNativeOtpAlert({
        id: item.id,
        title: item.title,
        body: item.body,
        kind: item.kind,
        otp,
      });
      if (shown) return;
      await ensureChannel();
      const id = numericId(item.id || `${item.title}|${item.body}`);
      await LocalNotifications.schedule({
        notifications: [
          {
            id,
            title: item.title,
            body: otp
              ? `${otp} — open Notifications and tap Copy OTP, then paste the code.`
              : item.body,
            extra: { id: item.id, kind: item.kind, otp },
            channelId: CHANNEL_ID,
            schedule: { at: new Date(Date.now() + 150) },
          },
        ],
      });
      return;
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(item.title, {
        body: otp ? `${otp} — copy this code and paste it where you were asked.` : item.body,
        tag: item.id,
      });
    }
  } catch {
    // keep in-app inbox even if the OS banner cannot be shown
  }
}
