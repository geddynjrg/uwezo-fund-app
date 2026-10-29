import { INBOX_ORIGINS, canonicalAuthOrigin, fetchInbox } from './appAuth';
import { showPhoneAlert } from './notify';
import {
  loadInbox,
  loadSeenNoticeKeys,
  noticeDedupeKeys,
  rememberSeenNoticeKeys,
  upsertInbox,
  type AppNotification,
  type AppSession,
} from './session';

export const INBOX_UPDATED_EVENT = 'uwezo-inbox-updated';

function seedSeenFromLocal(seen: Set<string>) {
  for (const row of loadInbox()) {
    for (const key of noticeDedupeKeys(row)) seen.add(key);
    if (row.meta?.id) seen.add(row.meta.id);
  }
}

function ingest(
  items: Array<{
    id: string;
    title: string;
    body: string;
    kind: AppNotification['kind'];
    createdAt: string;
    meta?: Record<string, string>;
  }>,
  alert: boolean,
) {
  const seen = loadSeenNoticeKeys();
  seedSeenFromLocal(seen);
  const fresh: AppNotification[] = [];
  const newKeys: string[] = [];

  for (const item of items.slice(0, 20)) {
    const keys = noticeDedupeKeys(item);
    const already = keys.some((key) => seen.has(key));
    const { notice, created } = upsertInbox({
      id: item.id,
      title: item.title,
      body: item.body,
      kind: item.kind,
      createdAt: item.createdAt,
      meta: { id: item.id, ...(item.meta || {}) },
    });
    for (const key of keys) {
      if (!seen.has(key)) newKeys.push(key);
      seen.add(key);
    }
    if (already || !created) continue;
    const eboardNotice = item.meta?.source === 'eboard' || Boolean(item.meta?.deep_link);
    if (alert && (item.kind === 'otp' || item.kind === 'loan_status' || eboardNotice)) {
      fresh.push(notice);
    }
  }

  if (newKeys.length) rememberSeenNoticeKeys(newKeys);
  if (fresh.length || newKeys.length) {
    window.dispatchEvent(new Event(INBOX_UPDATED_EVENT));
  }
  return fresh;
}

export async function syncInbox(
  session: AppSession,
  options?: { alert?: boolean },
) {
  const alert = options?.alert !== false;
  const primary = canonicalAuthOrigin(session.origin);
  const others = INBOX_ORIGINS.filter((origin) => origin !== primary);
  const fresh: AppNotification[] = [];

  try {
    const items = await fetchInbox({
      origin: primary,
      email: session.email,
      phone: session.phone,
      timeoutMs: 8000,
    });
    fresh.push(...ingest(items, alert));
  } catch {
    // keep last local inbox
  }

  for (const notice of fresh) {
    void showPhoneAlert(notice);
  }

  void Promise.allSettled(
    others.map((origin) =>
      fetchInbox({
        origin,
        email: session.email,
        phone: session.phone,
        timeoutMs: 8000,
      }),
    ),
  ).then((results) => {
    const extra: AppNotification[] = [];
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      extra.push(...ingest(result.value, alert));
    }
    for (const notice of extra) {
      void showPhoneAlert(notice);
    }
  });

  return fresh;
}
