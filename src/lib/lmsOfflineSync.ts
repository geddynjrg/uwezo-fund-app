import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { lmsDbVaultStatus, sealLmsDatabase } from './lmsDbVault';
import { loadLmsCache } from './lmsSync';
import {
  LMS_TABLES,
  listOutbox,
  loadLmsMeta,
  markOutbox,
  pendingMutationCount,
  putLocalReceipt,
  putLocalRow,
  deleteLocalRow,
  queueMutation,
  replaceLmsSnapshot,
  listLmsTable,
  setLmsActiveEmail,
  type LmsLocalMeta,
  type LmsTableName,
  newClientKey,
} from './lmsLocalDb';
import { loadStaffSession } from './staffSession';
import { probeOrigin } from './portalStatus';
import { reopenReturnedPackets } from './offlineApply';

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
  setLmsActiveEmail(email);
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
  const phaseApps = (tables.phase_applications || []) as Record<string, unknown>[];
  const reopened = await reopenReturnedPackets(
    phaseApps.map((row) => ({
      applicationId: String(row.application_number || row.application_id || row.id || ''),
      status: String(row.status || ''),
      action: String(row.action || ''),
    })),
  );
  const meta = await loadLmsMeta(email);
  const parts = LMS_TABLES.map((name) => `${name} ${counts[name] ?? 0}`).join(', ');
  return {
    ok: true,
    detail: `Saved ${json.constituencyName || 'constituency'} LMS tables on this phone (${parts}).${
      reopened ? ` Reopened ${reopened} returned loan draft(s) for editing.` : ''
    }`,
    meta,
  };
}

/** Push queued offline mutations (receipts, members, groups) to the live LMS. */
export async function pushLmsMutations(email: string): Promise<SyncResult> {
  setLmsActiveEmail(email);
  const pending = await listOutbox('pending', email);
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
      await markOutbox(id, 'synced', String(result.detail || 'Synced'), email);
    } else {
      rejected += 1;
      await markOutbox(id, 'rejected', String(result.detail || 'Rejected'), email);
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

async function sealIfPossible(email: string): Promise<boolean> {
  const password = loadStaffSession()?.password || '';
  if (!password) return false;
  return sealLmsDatabase(email, password);
}

/**
 * Sync encrypted LMS data when reachable (React LMS — no HTML shell cache):
 * 1) push phone changes
 * 2) pull constituency tables for this user (when assigned)
 * 3) encrypt the offline database vault
 */
function isNationalRole(role: string): boolean {
  return /secretariat|headquarters|^hq$|accountant/i.test(role);
}

export async function syncLmsLocal(email: string): Promise<SyncResult> {
  setLmsActiveEmail(email);
  const cache = loadLmsCache(email);
  if (!cache?.cookie) {
    return { ok: false, detail: 'No LMS session on this phone. Sign in again, then sync.' };
  }

  const role = cache.role || 'staff';
  const pushed = await pushLmsMutations(email);

  // National roles (secretariat / HQ / accountant) have no constituency snapshot by design.
  // Drive sync from /app/mobile/national/phases so Refresh matches the live queues.
  if (isNationalRole(role)) {
    const national = await fetchNationalPhases(email);
    const sealed = (await sealIfPossible(email)) || Boolean(lmsDbVaultStatus(email));
    const parts = [
      pushed.detail,
      national.ok
        ? `National queue ready (${national.rows.length} phase${national.rows.length === 1 ? '' : 's'}). Open Phases to review.`
        : national.detail || 'Could not load the national phase queue.',
      sealed ? 'Encrypted session data saved on this phone.' : '',
    ].filter(Boolean);
    return {
      ok: Boolean(national.ok),
      detail: parts.join(' '),
      meta: await loadLmsMeta(email),
    };
  }

  const pulled = await pullLmsSnapshot(email);

  let sealed = false;
  if (pulled.ok) {
    sealed = await sealIfPossible(email);
  } else if (lmsDbVaultStatus(email)) {
    sealed = true;
  }

  const counts = pulled.meta?.counts
    ? Object.entries(pulled.meta.counts)
        .map(([name, value]) => `${name}:${value}`)
        .join(' ')
    : '';
  const parts = [
    pushed.detail,
    pulled.ok
      ? `Pulled LMS database${counts ? ` (${counts})` : ''}.`
      : pulled.detail,
    sealed
      ? 'Encrypted LMS database saved on this phone.'
      : pulled.ok
        ? 'Could not encrypt LMS database (sign-in password needed on this phone).'
        : lmsDbVaultStatus(email)
          ? 'Using the encrypted LMS database already on this phone.'
          : '',
  ].filter(Boolean);

  // Constituency officers need a successful pull. Encryption is best-effort: do not
  // treat a missing seal password as a sync failure when tables already landed.
  return {
    ok: Boolean(pulled.ok),
    detail: parts.join(' '),
    meta: pulled.meta || pushed.meta,
  };
}

/** Send pending offline DB changes, then pull + refresh screens so both sides match. */
export async function compareAndSendOfflineChanges(email: string): Promise<SyncResult> {
  const online = await probeOrigin('https://lms.uwezo.go.ke');
  if (!online) {
    return { ok: false, detail: 'lms.uwezo.go.ke is not reachable. Keep working offline; changes stay on this phone.' };
  }
  const pending = await pendingMutationCount(email);
  if (!pending) {
    // Still pull latest LMS data so the phone matches the server
    return syncLmsLocal(email);
  }
  return syncLmsLocal(email);
}

/**
 * Refresh: probe LMS, sync database both ways, refresh offline website screens.
 */
export async function refreshLmsConnection(email: string, path = '/dashboard'): Promise<SyncResult & { online: boolean }> {
  const online = await probeOrigin('https://lms.uwezo.go.ke');
  if (!online) {
    return {
      ok: false,
      online: false,
      detail: 'lms.uwezo.go.ke did not answer. Opening the React LMS from data already on this phone.',
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
      /* best-effort page probe */
    }
  }
  const synced = await syncLmsLocal(email);
  return {
    ok: synced.ok,
    online: true,
    detail: `Synced with LMS database. ${synced.detail}`,
    meta: synced.meta,
  };
}

/** Update a member offline; syncs to LMS when connected. */
export async function saveMemberOffline(input: {
  email: string;
  id: number;
  name: string;
  number?: string;
  gender?: string;
  disabled?: boolean;
}): Promise<SyncResult> {
  const rows = await listLmsTable('members', 5000);
  const existing = rows.find((row) => Number(row.id) === input.id);
  if (!existing) {
    return { ok: false, detail: 'Member is not in the offline database. Sync first.' };
  }
  const next = {
    ...existing,
    name: input.name.trim(),
    number: input.number != null ? input.number.trim() : existing.number,
    gender: input.gender != null ? input.gender : existing.gender,
    disabled: input.disabled != null ? input.disabled : existing.disabled,
    updated_at: new Date().toISOString(),
    pending_sync: true,
  };
  await putLocalRow('members', next);
  await queueMutation({
    id: newClientKey(),
    type: 'member.update',
    payload: {
      id: input.id,
      name: input.name.trim(),
      number: String(next.number || ''),
      gender: String(next.gender || ''),
      disabled: Boolean(next.disabled),
    },
  });
  await sealIfPossible(input.email);
  return {
    ok: true,
    detail: 'Member saved offline. Changes will sync to the LMS when online.',
    meta: await loadLmsMeta(input.email),
  };
}

/** Update a group offline; syncs to LMS when connected. */
export async function saveGroupOffline(input: {
  email: string;
  id: number;
  name: string;
  bank?: string;
  account?: string;
  location?: string;
  box?: string;
  status?: string;
}): Promise<SyncResult> {
  const rows = await listLmsTable('groups', 5000);
  const existing = rows.find((row) => Number(row.id) === input.id);
  if (!existing) {
    return { ok: false, detail: 'Group is not in the offline database. Sync first.' };
  }
  const next = {
    ...existing,
    name: input.name.trim(),
    bank: input.bank != null ? input.bank.trim() : existing.bank,
    account: input.account != null ? input.account.trim() : existing.account,
    location: input.location != null ? input.location.trim() : existing.location,
    box: input.box != null ? input.box.trim() : existing.box,
    status: input.status != null ? input.status.trim() : existing.status,
    updated_at: new Date().toISOString(),
    pending_sync: true,
  };
  await putLocalRow('groups', next);
  await queueMutation({
    id: newClientKey(),
    type: 'group.update',
    payload: {
      id: input.id,
      name: String(next.name || ''),
      bank: String(next.bank || ''),
      account: String(next.account || ''),
      location: String(next.location || ''),
      box: String(next.box || ''),
      status: String(next.status || ''),
    },
  });
  await sealIfPossible(input.email);
  return {
    ok: true,
    detail: 'Group saved offline. Changes will sync to the LMS when online.',
    meta: await loadLmsMeta(input.email),
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

export async function updateReceiptOffline(input: {
  email: string;
  id: number;
  receipt_number: string;
  transaction_date: string;
  amount: number;
  payment: 'Bank' | 'Mpesa';
  reference_number: string;
}): Promise<SyncResult> {
  const rows = await listLmsTable('loan_receipts', 10000);
  const existing = rows.find((row) => Number(row.id) === input.id);
  if (!existing) {
    return { ok: false, detail: 'Receipt is not in the offline database. Sync first.' };
  }
  if (String(existing.status || 'active') !== 'active' && String(existing.status) !== 'pending_sync') {
    return { ok: false, detail: 'Only active receipts can be edited.' };
  }
  const next = {
    ...existing,
    receipt_number: input.receipt_number.toUpperCase(),
    transaction_date: input.transaction_date,
    amount: input.amount,
    payment: input.payment,
    reference_number: input.reference_number.toUpperCase(),
    updated_at: new Date().toISOString(),
    pending_sync: true,
  };
  await putLocalReceipt(next);
  await queueMutation({
    id: newClientKey(),
    type: 'receipt.update',
    payload: {
      id: input.id,
      receipt_number: input.receipt_number.toUpperCase(),
      transaction_date: input.transaction_date,
      amount: input.amount,
      payment: input.payment,
      reference_number: input.reference_number.toUpperCase(),
    },
  });
  await sealIfPossible(input.email);
  return {
    ok: true,
    detail: 'Receipt updated offline. Changes will sync to the LMS when online.',
    meta: await loadLmsMeta(input.email),
  };
}

export async function voidReceiptOffline(input: {
  email: string;
  id: number;
  void_reason: string;
}): Promise<SyncResult> {
  const rows = await listLmsTable('loan_receipts', 10000);
  const existing = rows.find((row) => Number(row.id) === input.id);
  if (!existing) {
    return { ok: false, detail: 'Receipt is not in the offline database. Sync first.' };
  }
  if (String(existing.status || 'active') !== 'active') {
    return { ok: false, detail: 'Only active receipts can be voided.' };
  }
  await putLocalReceipt({
    ...existing,
    status: 'canceled',
    void_reason: input.void_reason.trim(),
    updated_at: new Date().toISOString(),
    pending_sync: true,
  });
  await queueMutation({
    id: newClientKey(),
    type: 'receipt.void',
    payload: { id: input.id, void_reason: input.void_reason.trim() },
  });
  await sealIfPossible(input.email);
  return {
    ok: true,
    detail: 'Receipt voided offline. Sync will cancel it on the live LMS.',
    meta: await loadLmsMeta(input.email),
  };
}

export async function createMemberOffline(input: {
  email: string;
  group_loans_id: number;
  name: string;
  member_Id: string;
  number?: string;
  gender?: string;
  role?: string;
  disabled?: boolean;
}): Promise<SyncResult> {
  const id = newClientKey();
  const memberPk = `local-member-${id}`;
  const linkPk = `local-link-${id}`;
  const loans = await listLmsTable('group_loans', 10000);
  const loan = loans.find((row) => Number(row.id) === input.group_loans_id);
  await putLocalRow('members', {
    id: memberPk,
    name: input.name.trim(),
    member_Id: input.member_Id.trim(),
    number: (input.number || '').trim(),
    gender: input.gender || 'Male',
    disabled: Boolean(input.disabled),
    pending_sync: true,
    created_at: new Date().toISOString(),
  });
  await putLocalRow('group_members', {
    id: linkPk,
    group_loans_id: input.group_loans_id,
    group_id: loan?.group_id ?? null,
    member_Id: input.member_Id.trim(),
    member_id: memberPk,
    role: input.role || 'Member',
    status: 'Active',
    pending_sync: true,
  });
  await queueMutation({
    id,
    type: 'member.create',
    payload: {
      group_loans_id: input.group_loans_id,
      name: input.name.trim(),
      member_Id: input.member_Id.trim(),
      number: (input.number || '').trim(),
      gender: input.gender || 'Male',
      role: input.role || 'Member',
      disabled: Boolean(input.disabled),
    },
  });
  await sealIfPossible(input.email);
  return {
    ok: true,
    detail: 'Member added offline. Sync will create them on the live LMS.',
    meta: await loadLmsMeta(input.email),
  };
}

export async function deleteMemberOffline(input: {
  email: string;
  group_member_id: number | string;
}): Promise<SyncResult> {
  const links = await listLmsTable('group_members', 20000);
  const existing = links.find((row) => String(row.id) === String(input.group_member_id));
  if (!existing) {
    return { ok: false, detail: 'Member link is not in the offline database. Sync first.' };
  }
  await deleteLocalRow('group_members', existing.id as string | number);
  const numericId = Number(input.group_member_id);
  if (!Number.isFinite(numericId) || String(input.group_member_id).startsWith('local-')) {
    return {
      ok: true,
      detail: 'Local unsynced member removed from this phone.',
      meta: await loadLmsMeta(input.email),
    };
  }
  await queueMutation({
    id: newClientKey(),
    type: 'member.delete',
    payload: { group_member_id: numericId },
  });
  await sealIfPossible(input.email);
  return {
    ok: true,
    detail: 'Member removal queued. Sync will delete the link on the live LMS.',
    meta: await loadLmsMeta(input.email),
  };
}

export async function approveApplicationOffline(input: {
  email: string;
  id: number;
  amount_approved?: number;
  comments?: string;
  group_id?: number;
}): Promise<SyncResult> {
  const rows = await listLmsTable('phase_applications', 10000);
  const existing = rows.find((row) => Number(row.id) === input.id);
  if (!existing) {
    return { ok: false, detail: 'Application is not in the offline database. Sync first.' };
  }
  const next = {
    ...existing,
    amount_approved: input.amount_approved ?? existing.amount_approved ?? existing.amount_applied,
    status: 'pending_submission_to_hq',
    level: 'constituency',
    action: 'approved_at_constituency',
    comments: input.comments?.trim() || existing.comments,
    group_id: input.group_id ?? existing.group_id,
    pending_sync: true,
    updated_at: new Date().toISOString(),
  };
  await putLocalRow('phase_applications', next);
  const payload: Record<string, string | number | boolean> = { id: input.id };
  if (input.amount_approved != null) payload.amount_approved = input.amount_approved;
  if (input.comments) payload.comments = input.comments.trim();
  if (input.group_id) payload.group_id = input.group_id;
  await queueMutation({ id: newClientKey(), type: 'application.approve', payload });
  await sealIfPossible(input.email);
  return {
    ok: true,
    detail: 'Application approved offline. Sync will push the decision to the LMS.',
    meta: await loadLmsMeta(input.email),
  };
}

export async function rejectApplicationOffline(input: {
  email: string;
  id: number;
  rejection_reason: string;
  rejection_message: string;
}): Promise<SyncResult> {
  const rows = await listLmsTable('phase_applications', 10000);
  const existing = rows.find((row) => Number(row.id) === input.id);
  if (!existing) {
    return { ok: false, detail: 'Application is not in the offline database. Sync first.' };
  }
  await putLocalRow('phase_applications', {
    ...existing,
    status: 'rejected',
    level: 'constituency',
    action: 'declined_at_constituency',
    rejection_reason: input.rejection_reason.trim(),
    rejection_message: input.rejection_message.trim(),
    pending_sync: true,
    updated_at: new Date().toISOString(),
  });
  await queueMutation({
    id: newClientKey(),
    type: 'application.reject',
    payload: {
      id: input.id,
      rejection_reason: input.rejection_reason.trim(),
      rejection_message: input.rejection_message.trim(),
    },
  });
  await sealIfPossible(input.email);
  return {
    ok: true,
    detail: 'Application rejected offline. Sync will push the decision to the LMS.',
    meta: await loadLmsMeta(input.email),
  };
}

export async function linkApplicationOffline(input: {
  email: string;
  id: number;
  group_id: number;
}): Promise<SyncResult> {
  const rows = await listLmsTable('phase_applications', 10000);
  const existing = rows.find((row) => Number(row.id) === input.id);
  if (!existing) {
    return { ok: false, detail: 'Application is not in the offline database. Sync first.' };
  }
  const groups = await listLmsTable('groups', 5000);
  const group = groups.find((row) => Number(row.id) === input.group_id);
  await putLocalRow('phase_applications', {
    ...existing,
    group_id: input.group_id,
    group_code: group?.code || existing.group_code,
    pending_sync: true,
    updated_at: new Date().toISOString(),
  });
  await queueMutation({
    id: newClientKey(),
    type: 'application.link',
    payload: { id: input.id, group_id: input.group_id },
  });
  await sealIfPossible(input.email);
  return {
    ok: true,
    detail: 'Application linked to group offline. Sync will update the LMS.',
    meta: await loadLmsMeta(input.email),
  };
}

/** Unlink master group from a phase application (live removeLink). */
export async function unlinkApplicationOffline(input: {
  email: string;
  id: number;
}): Promise<SyncResult> {
  const rows = await listLmsTable('phase_applications', 10000);
  const existing = rows.find((row) => Number(row.id) === input.id);
  if (!existing) {
    return { ok: false, detail: 'Application is not in the offline database. Sync first.' };
  }
  if (!existing.group_id) {
    return { ok: false, detail: 'This application is not linked to a master group.' };
  }
  await putLocalRow('phase_applications', {
    ...existing,
    group_id: null,
    group_code: null,
    pending_sync: true,
    updated_at: new Date().toISOString(),
  });
  await queueMutation({
    id: newClientKey(),
    type: 'application.unlink',
    payload: { id: input.id },
  });
  await sealIfPossible(input.email);
  return {
    ok: true,
    detail: 'Group unlinked offline. Sync will update the live LMS.',
    meta: await loadLmsMeta(input.email),
  };
}

/** Assign (or reassign) an application to a review phase. */
export async function assignApplicationPhaseOffline(input: {
  email: string;
  id: number;
  loan_phase_id: number;
}): Promise<SyncResult> {
  const rows = await listLmsTable('phase_applications', 10000);
  const existing = rows.find((row) => Number(row.id) === input.id);
  if (!existing) {
    return { ok: false, detail: 'Application is not in the offline database. Sync first.' };
  }
  const phases = await listLmsTable('loan_phases', 5000);
  const phase = phases.find((row) => Number(row.id) === input.loan_phase_id);
  if (!phase) {
    return { ok: false, detail: 'Selected phase is not in the offline database. Sync first.' };
  }
  await putLocalRow('phase_applications', {
    ...existing,
    loan_phase_id: input.loan_phase_id,
    pending_sync: true,
    updated_at: new Date().toISOString(),
  });
  await queueMutation({
    id: newClientKey(),
    type: 'application.assign_phase',
    payload: { id: input.id, loan_phase_id: input.loan_phase_id },
  });
  await sealIfPossible(input.email);
  return {
    ok: true,
    detail: `Assigned to phase ${String(phase.phase || phase.phase_ref || input.loan_phase_id)} offline. Sync will update the LMS.`,
    meta: await loadLmsMeta(input.email),
  };
}

/** Remove an application from its current review phase. */
export async function removeApplicationPhaseOffline(input: {
  email: string;
  id: number;
}): Promise<SyncResult> {
  const rows = await listLmsTable('phase_applications', 10000);
  const existing = rows.find((row) => Number(row.id) === input.id);
  if (!existing) {
    return { ok: false, detail: 'Application is not in the offline database. Sync first.' };
  }
  if (!existing.loan_phase_id) {
    return { ok: false, detail: 'This application is not assigned to a phase.' };
  }
  await putLocalRow('phase_applications', {
    ...existing,
    loan_phase_id: null,
    pending_sync: true,
    updated_at: new Date().toISOString(),
  });
  await queueMutation({
    id: newClientKey(),
    type: 'application.remove_phase',
    payload: { id: input.id },
  });
  await sealIfPossible(input.email);
  return {
    ok: true,
    detail: 'Removed from phase offline. Sync will update the live LMS.',
    meta: await loadLmsMeta(input.email),
  };
}

/** Return application to the group for correction (mirrors live LMS Return to group). */
export async function returnApplicationOffline(input: {
  email: string;
  id: number;
  comment: string;
}): Promise<SyncResult> {
  const comment = input.comment.trim();
  if (comment.length < 20) {
    return { ok: false, detail: 'Tell the group what to correct (at least 20 characters).' };
  }
  const rows = await listLmsTable('phase_applications', 10000);
  const existing = rows.find((row) => Number(row.id) === input.id);
  if (!existing) {
    return { ok: false, detail: 'Application is not in the offline database. Sync first.' };
  }
  const status = String(existing.status || '').toLowerCase();
  if (status && status !== 'pending' && !/new|submitted|review|task/.test(status)) {
    return { ok: false, detail: 'Only applications awaiting constituency decision can be returned to the group.' };
  }
  await putLocalRow('phase_applications', {
    ...existing,
    status: 'deferred',
    level: 'constituency',
    action: 'returned_to_applicant',
    rejection_reason: 'incomplete_information',
    rejection_message: comment,
    comments: comment,
    pending_sync: true,
    updated_at: new Date().toISOString(),
  });
  await queueMutation({
    id: newClientKey(),
    type: 'application.return',
    payload: { id: input.id, comment },
  });
  await sealIfPossible(input.email);
  return {
    ok: true,
    detail: 'Returned to group offline. Sync will mark it draft on the live LMS (SMS sends when online).',
    meta: await loadLmsMeta(input.email),
  };
}

/** Undo approve/reject and put the application back to pending (live Review decision). */
export async function reviewApplicationOffline(input: {
  email: string;
  id: number;
}): Promise<SyncResult> {
  const rows = await listLmsTable('phase_applications', 10000);
  const existing = rows.find((row) => Number(row.id) === input.id);
  if (!existing) {
    return { ok: false, detail: 'Application is not in the offline database. Sync first.' };
  }
  const status = String(existing.status || '').toLowerCase();
  if (!/reject|pending_submission_to_hq|approv/.test(status)) {
    return { ok: false, detail: 'Current status does not allow reviewing the decision.' };
  }
  await putLocalRow('phase_applications', {
    ...existing,
    status: 'pending',
    level: 'constituency',
    action: 'review',
    amount_approved: 0,
    comments: null,
    rejection_reason: null,
    rejection_message: null,
    pending_sync: true,
    updated_at: new Date().toISOString(),
  });
  await queueMutation({
    id: newClientKey(),
    type: 'application.review',
    payload: { id: input.id },
  });
  await sealIfPossible(input.email);
  return {
    ok: true,
    detail: 'Decision reviewed offline — application is pending again. Sync will update the live LMS.',
    meta: await loadLmsMeta(input.email),
  };
}

export async function createPhaseOffline(input: {
  email: string;
  phase: string;
  phase_ref?: string;
  review_date?: string;
  review_venue?: string;
}): Promise<SyncResult> {
  const id = newClientKey();
  const localId = `local-phase-${id}`;
  await putLocalRow('loan_phases', {
    id: localId,
    phase: input.phase.trim(),
    phase_ref: (input.phase_ref || '').trim() || `MOB-${Date.now()}`,
    status: 'draft',
    review_date: input.review_date || null,
    review_venue: (input.review_venue || '').trim(),
    total_amount_applied: 0,
    total_amount_approved: 0,
    amount_disbursed: 0,
    pending_sync: true,
    created_at: new Date().toISOString(),
  });
  await queueMutation({
    id,
    type: 'phase.create',
    payload: {
      phase: input.phase.trim(),
      phase_ref: (input.phase_ref || '').trim(),
      review_date: input.review_date || '',
      review_venue: (input.review_venue || '').trim(),
    },
  });
  await sealIfPossible(input.email);
  return {
    ok: true,
    detail: 'Phase created offline. Sync will create it on the live LMS.',
    meta: await loadLmsMeta(input.email),
  };
}

export async function updatePhaseOffline(input: {
  email: string;
  id: number;
  phase: string;
  review_date?: string;
  review_venue?: string;
  committee_remarks?: string;
}): Promise<SyncResult> {
  const rows = await listLmsTable('loan_phases', 5000);
  const existing = rows.find((row) => Number(row.id) === input.id);
  if (!existing) {
    return { ok: false, detail: 'Phase is not in the offline database. Sync first.' };
  }
  if (['submitted', 'hq_approved', 'disbursed'].includes(String(existing.status))) {
    return { ok: false, detail: 'This phase can no longer be edited from the phone.' };
  }
  await putLocalRow('loan_phases', {
    ...existing,
    phase: input.phase.trim(),
    review_date: input.review_date ?? existing.review_date,
    review_venue: input.review_venue ?? existing.review_venue,
    committee_remarks: input.committee_remarks ?? existing.committee_remarks,
    pending_sync: true,
    updated_at: new Date().toISOString(),
  });
  await queueMutation({
    id: newClientKey(),
    type: 'phase.update',
    payload: {
      id: input.id,
      phase: input.phase.trim(),
      review_date: input.review_date || '',
      review_venue: (input.review_venue || '').trim(),
      committee_remarks: (input.committee_remarks || '').trim(),
    },
  });
  await sealIfPossible(input.email);
  return {
    ok: true,
    detail: 'Phase updated offline. Sync will push changes to the LMS.',
    meta: await loadLmsMeta(input.email),
  };
}

export async function submitPhaseOffline(input: { email: string; id: number }): Promise<SyncResult> {
  const rows = await listLmsTable('loan_phases', 5000);
  const existing = rows.find((row) => Number(row.id) === input.id);
  if (!existing) {
    return { ok: false, detail: 'Phase is not in the offline database. Sync first.' };
  }
  const apps = await listLmsTable('phase_applications', 10000);
  const ready = apps.filter(
    (app) =>
      String(app.loan_phase_id) === String(input.id) &&
      /pending_submission_to_hq|approved|submitted/i.test(String(app.status || '')),
  );
  if (!ready.length) {
    return { ok: false, detail: 'Approve at least one application before submitting the phase to HQ.' };
  }
  await putLocalRow('loan_phases', {
    ...existing,
    status: 'submitted',
    submitted_to_hq_at: new Date().toISOString(),
    pending_sync: true,
    updated_at: new Date().toISOString(),
  });
  await queueMutation({
    id: newClientKey(),
    type: 'phase.submit',
    payload: { id: input.id },
  });
  await sealIfPossible(input.email);
  return {
    ok: true,
    detail: 'Phase queued for HQ submission. Sync while online to complete.',
    meta: await loadLmsMeta(input.email),
  };
}

/** Online-first national HQ / Secretariat / Accountant APIs. */
export async function fetchNationalPhases(email: string, status = ''): Promise<{
  ok: boolean;
  detail: string;
  rows: Record<string, unknown>[];
  role?: string;
}> {
  const cache = loadLmsCache(email);
  const host = cache?.host || 'https://lms.uwezo.go.ke';
  const cookie = cache?.cookie || '';
  if (!cookie) {
    return { ok: false, detail: 'Sign in to the LMS first.', rows: [] };
  }
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const { status: httpStatus, json } = await httpJson('GET', `${host}/app/mobile/national/phases${qs}`, cookie);
  if (httpStatus === 401 || httpStatus === 403) {
    return { ok: false, detail: String(json.detail || 'LMS session expired or role not allowed.'), rows: [] };
  }
  if (!json.ok) {
    return { ok: false, detail: String(json.detail || 'Could not load national phases.'), rows: [] };
  }
  return {
    ok: true,
    detail: '',
    rows: Array.isArray(json.rows) ? (json.rows as Record<string, unknown>[]) : [],
    role: String(json.role || ''),
  };
}

export async function fetchNationalApplications(email: string, phaseId?: number): Promise<{
  ok: boolean;
  detail: string;
  rows: Record<string, unknown>[];
}> {
  const cache = loadLmsCache(email);
  const host = cache?.host || 'https://lms.uwezo.go.ke';
  const cookie = cache?.cookie || '';
  if (!cookie) {
    return { ok: false, detail: 'Sign in to the LMS first.', rows: [] };
  }
  const qs = phaseId ? `?phase_id=${phaseId}` : '';
  const { status: httpStatus, json } = await httpJson('GET', `${host}/app/mobile/national/applications${qs}`, cookie);
  if (httpStatus === 401 || httpStatus === 403) {
    return { ok: false, detail: String(json.detail || 'LMS session expired or role not allowed.'), rows: [] };
  }
  if (!json.ok) {
    return { ok: false, detail: String(json.detail || 'Could not load national applications.'), rows: [] };
  }
  return {
    ok: true,
    detail: '',
    rows: Array.isArray(json.rows) ? (json.rows as Record<string, unknown>[]) : [],
  };
}

export async function decideNationalPhase(input: {
  email: string;
  phase_id: number;
  decision: 'approve' | 'return';
  notes?: string;
}): Promise<SyncResult> {
  const cache = loadLmsCache(input.email);
  const host = cache?.host || 'https://lms.uwezo.go.ke';
  const cookie = cache?.cookie || '';
  if (!cookie) {
    return { ok: false, detail: 'Sign in online to decide national phases.' };
  }
  const { status, json } = await httpJson('POST', `${host}/app/mobile/national/decide`, cookie, {
    phase_id: input.phase_id,
    decision: input.decision,
    notes: input.notes || '',
  });
  if (status === 401 || status === 403) {
    return { ok: false, detail: String(json.detail || 'Not allowed for this role.') };
  }
  return {
    ok: Boolean(json.ok),
    detail: String(json.detail || (json.ok ? 'Decision saved.' : 'Decision failed.')),
  };
}

export type ApplicationScoreResult = SyncResult & {
  score?: Record<string, unknown>;
  risk_level?: string;
  assessment_data?: unknown;
};

/**
 * Score a constituency application via LMS (repay-ml /v1/score/intake on the server)
 * and persist risk_level + assessment_data on the temp application — same path as live review.
 */
export async function scoreApplicationOnline(input: {
  email: string;
  id: number;
  application_id?: string;
}): Promise<ApplicationScoreResult> {
  setLmsActiveEmail(input.email);
  const cache = loadLmsCache(input.email);
  const host = cache?.host || 'https://lms.uwezo.go.ke';
  const cookie = cache?.cookie || '';
  if (!cookie) {
    return { ok: false, detail: 'Sign in online to score this application.' };
  }
  const meta = await loadLmsMeta(input.email);
  const { status, json } = await httpJson('POST', `${host}/app/mobile/score`, cookie, {
    id: input.id,
    application_id: input.application_id || undefined,
    constituency: meta?.constituencyCode || meta?.constituencyName || '',
  });
  if (status === 401 || status === 403) {
    return { ok: false, detail: String(json.detail || 'LMS session expired before scoring.') };
  }
  if (status === 404) {
    // Older LMS builds without /app/mobile/score — queue mutation for pushLmsMutations.
    await queueMutation({
      id: newClientKey(),
      type: 'application.score',
      payload: {
        id: input.id,
        ...(input.application_id ? { application_id: input.application_id } : {}),
      },
    });
    return {
      ok: false,
      detail: 'Score route missing on LMS; queued application.score for sync.',
      meta: await loadLmsMeta(input.email),
    };
  }
  if (!json.ok) {
    return {
      ok: false,
      detail: String(json.detail || 'Could not score application on LMS.'),
      meta: await loadLmsMeta(input.email),
    };
  }

  const riskLevel = json.risk_level != null ? String(json.risk_level) : undefined;
  const assessmentData = json.assessment_data;
  const score =
    json.score && typeof json.score === 'object' ? (json.score as Record<string, unknown>) : undefined;

  const rows = await listLmsTable('phase_applications', 10000, input.email);
  const existing = rows.find((row) => Number(row.id) === input.id);
  if (existing) {
    await putLocalRow(
      'phase_applications',
      {
        ...existing,
        ...(riskLevel != null ? { risk_level: riskLevel } : {}),
        ...(assessmentData !== undefined ? { assessment_data: assessmentData } : {}),
        updated_at: new Date().toISOString(),
      },
      input.email,
    );
  }

  await sealIfPossible(input.email);
  return {
    ok: true,
    detail: String(json.detail || 'Risk / ML score saved on LMS.'),
    score,
    risk_level: riskLevel,
    assessment_data: assessmentData,
    meta: await loadLmsMeta(input.email),
  };
}

/** Persist a score payload locally and queue LMS write-back when the dedicated route is unavailable. */
export async function persistApplicationScoreLocal(input: {
  email: string;
  id: number;
  risk_level?: string;
  assessment_data?: unknown;
  queueWriteback?: boolean;
}): Promise<ApplicationScoreResult> {
  setLmsActiveEmail(input.email);
  const rows = await listLmsTable('phase_applications', 10000, input.email);
  const existing = rows.find((row) => Number(row.id) === input.id);
  if (!existing) {
    return { ok: false, detail: 'Application is not in the offline database. Sync first.' };
  }
  await putLocalRow(
    'phase_applications',
    {
      ...existing,
      ...(input.risk_level != null ? { risk_level: input.risk_level } : {}),
      ...(input.assessment_data !== undefined ? { assessment_data: input.assessment_data } : {}),
      pending_sync: Boolean(input.queueWriteback),
      updated_at: new Date().toISOString(),
    },
    input.email,
  );
  if (input.queueWriteback) {
    await queueMutation({
      id: newClientKey(),
      type: 'application.score',
      payload: { id: input.id },
    });
  }
  await sealIfPossible(input.email);
  return {
    ok: true,
    detail: input.queueWriteback
      ? 'Score saved on this phone. Sync will write risk / ML fields to the LMS.'
      : 'Score saved on this phone.',
    risk_level: input.risk_level,
    assessment_data: input.assessment_data,
    meta: await loadLmsMeta(input.email),
  };
}
