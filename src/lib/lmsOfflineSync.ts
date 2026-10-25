import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { sealLmsDatabase } from './lmsDbVault';
import { cacheLmsPageShells } from './lmsPageShell';
import { loadLmsCache, LMS_PAGES } from './lmsSync';
import {
  LMS_TABLES,
  listOutbox,
  loadLmsMeta,
  markOutbox,
  pendingMutationCount,
  putLocalReceipt,
  queueMutation,
  replaceLmsSnapshot,
  type LmsLocalMeta,
  type LmsTableName,
  newClientKey,
} from './lmsLocalDb';
import { loadStaffSession } from './staffSession';
import { probeOrigin } from './portalStatus';

export type SyncResult = { ok: boolean; detail: string; meta?: LmsLocalMeta | null };

function bodyText(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data == null) return '';
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

function xsrfToken(cookie: string): string {
  const raw = /XSRF-TOKEN=([^;]+)/.exec(cookie)?.[1] || '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function httpJson(
  method: 'GET' | 'POST',
  url: string,
  cookie: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (cookie) headers.Cookie = cookie;
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
    headers['X-XSRF-TOKEN'] = xsrfToken(cookie);
  }

  if (Capacitor.isNativePlatform()) {
    const response =
      method === 'GET'
        ? await CapacitorHttp.get({ url, headers, connectTimeout: 60000, readTimeout: 120000 })
        : await CapacitorHttp.post({
            url,
            headers,
            data: body,
            connectTimeout: 60000,
            readTimeout: 120000,
          });
    let json: Record<string, unknown> = {};
    try {
      json = typeof response.data === 'string' ? JSON.parse(response.data || '{}') : (response.data as Record<string, unknown>) || {};
    } catch {
      json = { detail: bodyText(response.data).slice(0, 200) };
    }
    return { status: response.status, json };
  }

  const response = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
    signal: AbortSignal.timeout(120000),
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await response.json()) as Record<string, unknown>;
  } catch {
    json = { detail: 'Invalid JSON from LMS.' };
  }
  return { status: response.status, json };
}

/** Pull constituency LMS tables onto the phone. */
export async function pullLmsSnapshot(email: string): Promise<SyncResult> {
  const cache = loadLmsCache(email);
  const host = cache?.host || 'https://lms.uwezo.go.ke';
  const cookie = cache?.cookie || '';
  if (!cookie) {
    return { ok: false, detail: 'Sign in to the LMS first so the phone can download your constituency tables.' };
  }
  const url = `${host}/app/mobile/snapshot`;
  const { status, json } = await httpJson('GET', url, cookie);
  if (status === 401 || status === 403) {
    return { ok: false, detail: String(json.detail || 'LMS session expired. Refresh session, then sync again.') };
  }
  if (!json.ok) {
    return { ok: false, detail: String(json.detail || 'Could not download LMS tables.') };
  }
  const tables = (json.tables || {}) as Partial<Record<LmsTableName, Record<string, unknown>[]>>;
  const counts = (json.counts || {}) as Record<string, number>;
  await replaceLmsSnapshot({
    email,
    fetchedAt: String(json.fetchedAt || new Date().toISOString()),
    constituencyCode: String(json.constituencyCode || ''),
    constituencyName: String(json.constituencyName || ''),
    role: String(json.role || 'staff'),
    counts,
    tables,
  });
  const meta = await loadLmsMeta(email);
  const parts = LMS_TABLES.map((name) => `${name} ${counts[name] ?? 0}`).join(', ');
  return {
    ok: true,
    detail: `Saved ${json.constituencyName || 'constituency'} LMS tables on this phone (${parts}).`,
    meta,
  };
}

/** Push queued offline mutations (receipts) to the live LMS. */
export async function pushLmsMutations(email: string): Promise<SyncResult> {
  const pending = await listOutbox('pending');
  if (!pending.length) {
    return { ok: true, detail: 'No offline changes waiting to sync.' };
  }
  const cache = loadLmsCache(email);
  const host = cache?.host || 'https://lms.uwezo.go.ke';
  const cookie = cache?.cookie || '';
  if (!cookie) {
    return { ok: false, detail: 'Sign in online to upload offline LMS changes.' };
  }
  const meta = await loadLmsMeta(email);
  const { status, json } = await httpJson('POST', `${host}/app/mobile/mutations`, cookie, {
    constituency: meta?.constituencyCode || meta?.constituencyName || '',
    mutations: pending.map((item) => ({
      id: item.id,
      type: item.type,
      payload: item.payload,
    })),
  });
  if (status === 401 || status === 403) {
    return { ok: false, detail: String(json.detail || 'LMS session expired before upload.') };
  }
  const results = Array.isArray(json.results) ? (json.results as Array<Record<string, unknown>>) : [];
  let accepted = 0;
  let rejected = 0;
  for (const result of results) {
    const id = String(result.id || '');
    if (!id) continue;
    if (result.ok) {
      accepted += 1;
      await markOutbox(id, 'synced', String(result.detail || 'Synced'));
    } else {
      rejected += 1;
      await markOutbox(id, 'rejected', String(result.detail || 'Rejected'));
    }
  }
  if (!results.length && !json.ok) {
    return { ok: false, detail: String(json.detail || 'Upload failed.') };
  }
  return {
    ok: rejected === 0,
    detail: `Uploaded ${accepted} change(s)${rejected ? `, ${rejected} rejected` : ''} to the LMS.`,
    meta: await loadLmsMeta(email),
  };
}

async function sealIfPossible(email: string) {
  const password = loadStaffSession()?.password || '';
  if (password) await sealLmsDatabase(email, password);
}

/** Pull then push — keep phone tables aligned with online LMS, then encrypt offline copy. */
export async function syncLmsLocal(email: string): Promise<SyncResult> {
  const pushed = await pushLmsMutations(email);
  const pulled = await pullLmsSnapshot(email);
  const cache = loadLmsCache(email);
  const menu = cache?.menu?.length ? cache.menu : LMS_PAGES[(cache?.role || 'staff') as keyof typeof LMS_PAGES] || LMS_PAGES.staff;
  const shells = pulled.ok || Boolean(cache?.cookie) ? await cacheLmsPageShells(email, menu) : { ok: false, detail: '', count: 0 };
  if (pulled.ok || pushed.ok) await sealIfPossible(email);
  if (!pulled.ok && !pushed.ok) {
    return { ok: false, detail: `${pushed.detail} ${pulled.detail}`.trim() };
  }
  return {
    ok: pulled.ok,
    detail: [pushed.detail, pulled.detail, shells.detail].filter(Boolean).join(' '),
    meta: pulled.meta || pushed.meta,
  };
}

/** Send only pending offline database changes when LMS is reachable. */
export async function compareAndSendOfflineChanges(email: string): Promise<SyncResult> {
  const online = await probeOrigin('https://lms.uwezo.go.ke');
  if (!online) {
    return { ok: false, detail: 'lms.uwezo.go.ke is not reachable. Keep working offline; changes stay on this phone.' };
  }
  const pending = await pendingMutationCount(email);
  if (!pending) {
    return { ok: true, detail: 'No offline database changes to send.' };
  }
  const pushed = await pushLmsMutations(email);
  if (pushed.ok) {
    const pulled = await pullLmsSnapshot(email);
    await sealIfPossible(email);
    return {
      ok: true,
      detail: `${pushed.detail}${pulled.ok ? ` ${pulled.detail}` : ''}`,
      meta: pulled.meta || pushed.meta,
    };
  }
  return pushed;
}

/**
 * Refresh while signed in: probe lms.uwezo.go.ke by pulling the current page/session,
 * then refresh the encrypted offline database. Auto-uploads pending changes when online.
 */
export async function refreshLmsConnection(email: string, path = '/dashboard'): Promise<SyncResult & { online: boolean }> {
  const online = await probeOrigin('https://lms.uwezo.go.ke');
  if (!online) {
    return {
      ok: false,
      online: false,
      detail: 'lms.uwezo.go.ke did not answer. Using the encrypted offline database on this phone.',
      meta: await loadLmsMeta(email),
    };
  }
  const cache = loadLmsCache(email);
  const host = cache?.host || 'https://lms.uwezo.go.ke';
  const cookie = cache?.cookie || '';
  if (cookie) {
    try {
      await httpJson('GET', `${host}${path.startsWith('/') ? path : `/${path}`}`, cookie);
    } catch {
      /* probe already passed; page pull is best-effort */
    }
  }
  const pending = await pendingMutationCount(email);
  const synced = await syncLmsLocal(email);
  return {
    ok: synced.ok,
    online: true,
    detail: pending
      ? `LMS is online. ${synced.detail}`
      : `LMS is online. Screen refreshed. ${synced.detail}`,
    meta: synced.meta,
  };
}

/** Record a receipt offline; syncs to LMS when connected. */
export async function saveReceiptOffline(input: {
  email: string;
  group_loans_id: number;
  receipt_number: string;
  transaction_date: string;
  amount: number;
  payment: 'Bank' | 'Mpesa';
  reference_number: string;
}): Promise<SyncResult> {
  const id = newClientKey();
  const clientKey = `mobile-receipt-${id}`;
  const localId = `local-${id}`;
  await putLocalReceipt({
    id: localId,
    group_loans_id: input.group_loans_id,
    receipt_number: input.receipt_number.toUpperCase(),
    transaction_date: input.transaction_date,
    amount: input.amount,
    payment: input.payment,
    reference_number: input.reference_number.toUpperCase(),
    status: 'pending_sync',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  await queueMutation({
    id,
    type: 'receipt.create',
    payload: {
      group_loans_id: input.group_loans_id,
      receipt_number: input.receipt_number.toUpperCase(),
      transaction_date: input.transaction_date,
      amount: input.amount,
      payment: input.payment,
      reference_number: input.reference_number.toUpperCase(),
      client_key: clientKey,
    },
  });
  await sealIfPossible(input.email);
  return {
    ok: true,
    detail: 'Receipt saved in the encrypted offline database. Compare with the LMS when lms.uwezo.go.ke is reachable.',
    meta: await loadLmsMeta(input.email),
  };
}
