/** Local LMS tables on the phone (IndexedDB) — one working DB per officer email. */

const DB_VERSION = 1;
const LEGACY_DB_NAME = 'uwezo-lms-local';

export const LMS_TABLES = [
  'wards',
  'groups',
  'loan_phases',
  'group_loans',
  'loan_receipts',
  'phase_applications',
  'group_members',
  'members',
] as const;

export type LmsTableName = (typeof LMS_TABLES)[number];

export type LmsLocalMeta = {
  email: string;
  fetchedAt: string;
  constituencyCode: string;
  constituencyName: string;
  role: string;
  counts: Record<string, number>;
  pendingMutations: number;
};

export type LmsMutationType =
  | 'receipt.create'
  | 'receipt.update'
  | 'receipt.void'
  | 'member.update'
  | 'member.create'
  | 'member.delete'
  | 'group.update'
  | 'application.approve'
  | 'application.reject'
  | 'application.link'
  | 'application.unlink'
  | 'application.assign_phase'
  | 'application.remove_phase'
  | 'application.return'
  | 'application.review'
  | 'application.score'
  | 'phase.create'
  | 'phase.update'
  | 'phase.submit';

export type LmsOutboxItem = {
  id: string;
  type: LmsMutationType;
  createdAt: string;
  status: 'pending' | 'synced' | 'rejected';
  detail?: string;
  payload: Record<string, string | number | boolean>;
};

type MetaRow = LmsLocalMeta & { id: 'meta' };

/** Active officer email for the working IndexedDB (per-email DB name). */
let activeEmail = '';

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

function dbNameFor(email: string): string {
  const e = normalizeEmail(email);
  return e ? `${LEGACY_DB_NAME}:${e}` : LEGACY_DB_NAME;
}

/** Switch the working LMS DB to this officer. Call on every LMS boot / sync / vault open. */
export function setLmsActiveEmail(email: string): void {
  activeEmail = normalizeEmail(email);
}

export function getLmsActiveEmail(): string {
  return activeEmail;
}

/** Ensure subsequent list/put calls use this officer’s isolated DB. */
export async function ensureLmsWorkingCopyFor(email: string): Promise<void> {
  setLmsActiveEmail(email);
  // Touch DB so object stores exist; do not copy foreign rows from legacy shared DB.
  await openDb(email);
}

function requireEmail(email?: string): string {
  const e = normalizeEmail(email || activeEmail);
  if (!e) throw new Error('LMS local DB requires an active officer email.');
  return e;
}

function openDb(email?: string): Promise<IDBDatabase> {
  const e = requireEmail(email);
  const name = dbNameFor(e);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'id' });
      for (const table of LMS_TABLES) {
        if (!db.objectStoreNames.contains(table)) db.createObjectStore(table, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function metaMatchesActive(db: IDBDatabase, email: string): Promise<boolean> {
  const tx = db.transaction('meta', 'readonly');
  const row = await new Promise<MetaRow | undefined>((resolve, reject) => {
    const req = tx.objectStore('meta').get('meta');
    req.onsuccess = () => resolve(req.result as MetaRow | undefined);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  if (!row?.email) return true; // empty DB ok
  return row.email === normalizeEmail(email);
}

export async function replaceLmsSnapshot(input: {
  email: string;
  fetchedAt: string;
  constituencyCode: string;
  constituencyName: string;
  role: string;
  counts: Record<string, number>;
  tables: Partial<Record<LmsTableName, Record<string, unknown>[]>>;
}): Promise<void> {
  const email = normalizeEmail(input.email);
  setLmsActiveEmail(email);
  const db = await openDb(email);
  const storeNames = ['meta', ...LMS_TABLES] as string[];
  const tx = db.transaction(storeNames, 'readwrite');
  const meta: MetaRow = {
    id: 'meta',
    email,
    fetchedAt: input.fetchedAt,
    constituencyCode: input.constituencyCode,
    constituencyName: input.constituencyName,
    role: input.role,
    counts: input.counts,
    pendingMutations: 0,
  };
  tx.objectStore('meta').put(meta);
  for (const table of LMS_TABLES) {
    const store = tx.objectStore(table);
    store.clear();
    const rows = input.tables[table] || [];
    for (const row of rows) {
      if (row && row.id != null) store.put(row);
    }
  }
  await txDone(tx);
  const pending = await listOutbox('pending', email);
  await setPendingCount(pending.length, email);
}

async function setPendingCount(count: number, email?: string): Promise<void> {
  const e = requireEmail(email);
  const db = await openDb(e);
  const tx = db.transaction('meta', 'readwrite');
  const store = tx.objectStore('meta');
  const current = await new Promise<MetaRow | undefined>((resolve, reject) => {
    const req = store.get('meta');
    req.onsuccess = () => resolve(req.result as MetaRow | undefined);
    req.onerror = () => reject(req.error);
  });
  if (current) {
    current.pendingMutations = count;
    store.put(current);
  }
  await txDone(tx);
}

export async function loadLmsMeta(email?: string): Promise<LmsLocalMeta | null> {
  const e = normalizeEmail(email || activeEmail);
  if (!e) return null;
  setLmsActiveEmail(e);
  const db = await openDb(e);
  const tx = db.transaction('meta', 'readonly');
  const row = await new Promise<MetaRow | undefined>((resolve, reject) => {
    const req = tx.objectStore('meta').get('meta');
    req.onsuccess = () => resolve(req.result as MetaRow | undefined);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  if (!row) return null;
  if (row.email !== e) return null;
  const { id: _id, ...meta } = row;
  return meta;
}

export async function listLmsTable(
  table: LmsTableName,
  limit = 200,
  email?: string,
): Promise<Record<string, unknown>[]> {
  const e = normalizeEmail(email || activeEmail);
  if (!e) return [];
  setLmsActiveEmail(e);
  const db = await openDb(e);
  if (!(await metaMatchesActive(db, e))) return [];
  const tx = db.transaction(table, 'readonly');
  const rows = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
    const req = tx.objectStore(table).getAll();
    req.onsuccess = () => resolve((req.result as Record<string, unknown>[]) || []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  return rows.slice(0, limit);
}

export async function countLmsTable(table: LmsTableName, email?: string): Promise<number> {
  const e = normalizeEmail(email || activeEmail);
  if (!e) return 0;
  setLmsActiveEmail(e);
  const db = await openDb(e);
  if (!(await metaMatchesActive(db, e))) return 0;
  const tx = db.transaction(table, 'readonly');
  const count = await new Promise<number>((resolve, reject) => {
    const req = tx.objectStore(table).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  return count;
}

export async function queueMutation(
  item: Omit<LmsOutboxItem, 'status' | 'createdAt'> & { status?: LmsOutboxItem['status'] },
  email?: string,
): Promise<void> {
  const e = requireEmail(email);
  setLmsActiveEmail(e);
  const db = await openDb(e);
  const tx = db.transaction('outbox', 'readwrite');
  const row: LmsOutboxItem = {
    id: item.id,
    type: item.type,
    payload: item.payload,
    createdAt: new Date().toISOString(),
    status: item.status || 'pending',
    detail: item.detail,
  };
  tx.objectStore('outbox').put(row);
  await txDone(tx);
  const pending = await listOutbox('pending', e);
  await setPendingCount(pending.length, e);
}

export async function listOutbox(
  status?: LmsOutboxItem['status'],
  email?: string,
): Promise<LmsOutboxItem[]> {
  const e = normalizeEmail(email || activeEmail);
  if (!e) return [];
  setLmsActiveEmail(e);
  const db = await openDb(e);
  const tx = db.transaction('outbox', 'readonly');
  const rows = await new Promise<LmsOutboxItem[]>((resolve, reject) => {
    const req = tx.objectStore('outbox').getAll();
    req.onsuccess = () => resolve((req.result as LmsOutboxItem[]) || []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  return status ? rows.filter((row) => row.status === status) : rows;
}

export async function markOutbox(
  id: string,
  status: LmsOutboxItem['status'],
  detail?: string,
  email?: string,
): Promise<void> {
  const e = requireEmail(email);
  setLmsActiveEmail(e);
  const db = await openDb(e);
  const tx = db.transaction('outbox', 'readwrite');
  const store = tx.objectStore('outbox');
  const row = await new Promise<LmsOutboxItem | undefined>((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result as LmsOutboxItem | undefined);
    req.onerror = () => reject(req.error);
  });
  if (row) {
    row.status = status;
    if (detail) row.detail = detail;
    store.put(row);
  }
  await txDone(tx);
  const pending = await listOutbox('pending', e);
  await setPendingCount(pending.length, e);
}

export async function putLocalReceipt(row: Record<string, unknown>, email?: string): Promise<void> {
  const e = requireEmail(email);
  setLmsActiveEmail(e);
  const db = await openDb(e);
  const tx = db.transaction('loan_receipts', 'readwrite');
  tx.objectStore('loan_receipts').put(row);
  await txDone(tx);
}

export async function putLocalRow(
  table: LmsTableName,
  row: Record<string, unknown>,
  email?: string,
): Promise<void> {
  const e = requireEmail(email);
  setLmsActiveEmail(e);
  const db = await openDb(e);
  const tx = db.transaction(table, 'readwrite');
  tx.objectStore(table).put(row);
  await txDone(tx);
}

export async function deleteLocalRow(
  table: LmsTableName,
  id: string | number,
  email?: string,
): Promise<void> {
  const e = requireEmail(email);
  setLmsActiveEmail(e);
  const db = await openDb(e);
  const tx = db.transaction(table, 'readwrite');
  tx.objectStore(table).delete(id);
  await txDone(tx);
}

export async function replaceOutbox(items: LmsOutboxItem[], email?: string): Promise<void> {
  const e = requireEmail(email);
  setLmsActiveEmail(e);
  const db = await openDb(e);
  const tx = db.transaction('outbox', 'readwrite');
  const store = tx.objectStore('outbox');
  store.clear();
  for (const item of items) store.put(item);
  await txDone(tx);
  await setPendingCount(
    items.filter((item) => item.status === 'pending').length,
    e,
  );
}

export function newClientKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `lms-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function pendingMutationCount(email?: string): Promise<number> {
  const e = normalizeEmail(email || activeEmail);
  if (!e) return 0;
  const meta = await loadLmsMeta(e);
  if (meta) return meta.pendingMutations || 0;
  const pending = await listOutbox('pending', e);
  return pending.length;
}
