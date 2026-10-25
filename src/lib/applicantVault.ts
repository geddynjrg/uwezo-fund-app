import type { AppSession } from './session';

const DB_NAME = 'uwezo-applicant-vault';
const STORE = 'copies';

export type ApplicantTable = { name: string; rows: Record<string, string>[] };

export type ApplicantRecords = {
  savedAt: string;
  majuu: ApplicantTable[];
  loans: ApplicantTable[];
};

export type ApplicantCopy = {
  email: string;
  phone: string;
  savedAt: string;
  session: AppSession;
  records: ApplicantRecords;
};

type Envelope = {
  email: string;
  savedAt: string;
  salt: string;
  iv: string;
  data: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'email' });
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

async function readEnvelope(email: string): Promise<Envelope | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const request = tx.objectStore(STORE).get(email.trim().toLowerCase());
  const row = await new Promise<Envelope | null>((resolve, reject) => {
    request.onsuccess = () => resolve((request.result as Envelope) || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return row;
}

export async function sealApplicantCopy(password: string, copy: ApplicantCopy): Promise<void> {
  if (!crypto.subtle || !password) return;
  const email = copy.email.trim().toLowerCase();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derivedKey(password, salt);
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(JSON.stringify({ ...copy, email })),
  );
  const envelope: Envelope = {
    email,
    savedAt: copy.savedAt,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(sealed)),
  };
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(envelope);
  await txDone(tx);
  db.close();
}

export async function openApplicantCopy(email: string, password: string): Promise<ApplicantCopy | null> {
  if (!crypto.subtle || !password) return null;
  const envelope = await readEnvelope(email);
  if (!envelope?.data || !envelope.salt || !envelope.iv) return null;
  try {
    const key = await derivedKey(password, base64ToBytes(envelope.salt));
    const opened = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) as BufferSource },
      key,
      base64ToBytes(envelope.data) as BufferSource,
    );
    const copy = JSON.parse(new TextDecoder().decode(opened)) as ApplicantCopy;
    if (!copy?.session?.email || copy.email !== email.trim().toLowerCase()) return null;
    return copy;
  } catch {
    return null;
  }
}
