import type { LmsPage, LmsPageView, LmsRole } from './lmsSync';

const VAULT_KEY = 'uwezo.officer.vault.v1';
export const OFFICER_DETAIL_MS = 15 * 24 * 60 * 60 * 1000;

export type OfficerProfile = {
  email: string;
  name: string;
  phone: string;
  idNumber: string;
  role: LmsRole;
  constituency: string;
  base: string;
};

export type OfficerCopy = {
  profile: OfficerProfile;
  syncDetail: string;
  menu: LmsPage[];
  pages: Record<string, LmsPageView>;
  savedAt: string;
};

type Envelope = {
  email: string;
  savedAt: string;
  salt: string;
  iv: string;
  data: string;
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

export function officerCopyStatus(email: string): { savedAt: string; stale: boolean } | null {
  const envelope = envelopes()[email.trim().toLowerCase()];
  if (!envelope?.savedAt) return null;
  const savedAt = Date.parse(envelope.savedAt);
  if (Number.isNaN(savedAt)) return null;
  return { savedAt: envelope.savedAt, stale: Date.now() - savedAt >= OFFICER_DETAIL_MS };
}

export async function sealOfficerCopy(password: string, copy: OfficerCopy): Promise<void> {
  if (!crypto.subtle) return;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derivedKey(password, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(copy));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const all = envelopes();
  all[copy.profile.email.trim().toLowerCase()] = {
    email: copy.profile.email.trim().toLowerCase(),
    savedAt: copy.savedAt,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(cipher)),
  };
  writeEnvelopes(all);
}

export async function openOfficerCopy(email: string, password: string): Promise<OfficerCopy | null> {
  const envelope = envelopes()[email.trim().toLowerCase()];
  if (!envelope || !crypto.subtle) return null;
  try {
    const key = await derivedKey(password, base64ToBytes(envelope.salt));
    const clear = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) as BufferSource },
      key,
      base64ToBytes(envelope.data) as BufferSource,
    );
    const copy = JSON.parse(new TextDecoder().decode(clear)) as OfficerCopy;
    if (!copy?.profile?.email) return null;
    return copy;
  } catch {
    return null;
  }
}
