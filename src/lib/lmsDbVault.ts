/** Encrypted offline LMS database (AES-GCM), same pattern as the officer vault. */

import {
  LMS_TABLES,
  listLmsTable,
  listOutbox,
  loadLmsMeta,
  replaceLmsSnapshot,
  replaceOutbox,
  type LmsLocalMeta,
  type LmsOutboxItem,
  type LmsTableName,
} from './lmsLocalDb';

const VAULT_KEY = 'uwezo.lms.db.vault.v1';

type Envelope = {
  email: string;
  savedAt: string;
  salt: string;
  iv: string;
  data: string;
};

type VaultPayload = {
  meta: Omit<LmsLocalMeta, 'pendingMutations'> & { pendingMutations?: number };
  tables: Partial<Record<LmsTableName, Record<string, unknown>[]>>;
  outbox: LmsOutboxItem[];
};

function envelopes(): Record<string, Envelope> {
  try {
    return JSON.parse(localStorage.getItem(VAULT_KEY) || '{}') as Record<string, Envelope>;
  } catch {
    return {};
  }
}

function writeEnvelopes(all: Record<string, Envelope>) {
  localStorage.setItem(VAULT_KEY, JSON.stringify(all));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function derivedKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 120000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function lmsDbVaultStatus(email: string): { savedAt: string } | null {
  const envelope = envelopes()[email.trim().toLowerCase()];
  if (!envelope?.savedAt) return null;
  return { savedAt: envelope.savedAt };
}

/** Encrypt the current working LMS tables + outbox onto the phone. */
export async function sealLmsDatabase(email: string, password: string): Promise<boolean> {
  if (!password || !crypto.subtle) return false;
  const meta = await loadLmsMeta(email);
  if (!meta) return false;
  const tables: Partial<Record<LmsTableName, Record<string, unknown>[]>> = {};
  for (const table of LMS_TABLES) {
    tables[table] = await listLmsTable(table, 20000);
  }
  const payload: VaultPayload = {
    meta: {
      email: meta.email,
      fetchedAt: meta.fetchedAt,
      constituencyCode: meta.constituencyCode,
      constituencyName: meta.constituencyName,
      role: meta.role,
      counts: meta.counts,
      pendingMutations: meta.pendingMutations,
    },
    tables,
    outbox: await listOutbox(),
  };
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derivedKey(password, salt);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(JSON.stringify(payload)));
  const all = envelopes();
  all[email.trim().toLowerCase()] = {
    email: email.trim().toLowerCase(),
    savedAt: new Date().toISOString(),
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(cipher)),
  };
  writeEnvelopes(all);
  return true;
}

/** Decrypt the offline LMS database into the working IndexedDB copy. */
export async function openLmsDatabase(email: string, password: string): Promise<LmsLocalMeta | null> {
  const envelope = envelopes()[email.trim().toLowerCase()];
  if (!envelope || !password || !crypto.subtle) return null;
  try {
    const key = await derivedKey(password, base64ToBytes(envelope.salt));
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) as BufferSource },
      key,
      base64ToBytes(envelope.data) as BufferSource,
    );
    const payload = JSON.parse(new TextDecoder().decode(plain)) as VaultPayload;
    await replaceLmsSnapshot({
      email: payload.meta.email || email,
      fetchedAt: payload.meta.fetchedAt,
      constituencyCode: payload.meta.constituencyCode,
      constituencyName: payload.meta.constituencyName,
      role: payload.meta.role,
      counts: payload.meta.counts || {},
      tables: payload.tables || {},
    });
    await replaceOutbox(payload.outbox || []);
    return loadLmsMeta(email);
  } catch {
    return null;
  }
}
