import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { LINKS } from '../config';
import { sameKenyanLine } from './phone';
import { probeOrigin } from './portalStatus';

/** Same address the Majuu server uses. The phone calls it directly when Majuu is down. */
const MSEA_API_URL = 'https://msea.ecitizen.go.ke/api/businesses';
const MSEA_USERNAME = 'wezesha';
const MSEA_PASSWORD = 'YuHgw6/nFGOIYlbHkpzAZllclw9kbjRTfCY9G3WgMHs';

export const MSEA_MANUAL =
  'MSEA registration service is unavailable. Please enter your group details manually.';

export const CHAIR_ONLY =
  'Only the group chair listed on the MSEA registration can log in and complete the group application on behalf of members.';

export const NOT_A_PARTNER =
  'Your national ID or phone does not match any partner on this MSEA registration. Only the group chair can start the group application.';

export type MseaPartner = {
  name?: string;
  id_number?: string;
  phone_number?: string;
  type?: string;
  id_type?: string;
};

export type MseaRecord = {
  business_name?: string;
  registration_number?: string;
  registration_date?: string;
  status?: string;
  email?: string;
  phone_number?: string;
  partners?: MseaPartner[];
};

type MseaPayload = {
  count?: number;
  records?: MseaRecord[];
  error?: string;
  reachable?: boolean;
  reason?: string;
};

/** True when MSEA lists this partner as a group official. */
export function isMseaOfficialPartner(partner: MseaPartner): boolean {
  const type = `${partner.type || ''}`.toLowerCase();
  return /chair|chairman|chairperson|secretary|treasurer|official|proprietor|director|leader|president/.test(type);
}

/** True when MSEA partner type indicates the group chair / lead official. */
export function isMseaChairPartner(partner: MseaPartner): boolean {
  const type = `${partner.type || ''}`.toLowerCase();
  return /chair|chairman|chairperson|official|proprietor|director|leader|president/.test(type);
}

export function partnerByNationalId(partners: MseaPartner[], nationalId: string): MseaPartner | null {
  const digits = nationalId.replace(/\D/g, '');
  if (!digits) return null;
  return (partners || []).find((partner) => (partner.id_number || '').replace(/\D/g, '') === digits) || null;
}

export function findMseaChairPartners(partners: MseaPartner[]): MseaPartner[] {
  return (partners || []).filter(isMseaChairPartner);
}

function localPreview() {
  // The installed app is served from https://localhost. That is the computer preview only.
  return (
    !Capacitor.isNativePlatform() &&
    (location.hostname === '127.0.0.1' || location.hostname === 'localhost')
  );
}

function directUrl(registrationNumber: string) {
  const url = localPreview()
    ? new URL('/msea-api/businesses', location.origin)
    : new URL(MSEA_API_URL);
  url.searchParams.set('registration_number', registrationNumber);
  return url.toString();
}

function majuuBusinessUrl(registrationNumber: string) {
  const base = localPreview() ? '' : LINKS.majuu.url;
  const url = new URL(`${base}/api/businesses`, location.origin);
  url.searchParams.set('registration_number', registrationNumber);
  return url.toString();
}

function authHeaders(): Record<string, string> {
  const token = btoa(`${MSEA_USERNAME}:${MSEA_PASSWORD}`);
  return {
    Accept: 'application/json',
    Authorization: `Basic ${token}`,
    'User-Agent':
      'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  };
}

async function readJson(url: string, timeoutMs: number): Promise<{ status: number; json: boolean; data: MseaPayload }> {
  const headers = authHeaders();
  try {
    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.get({
        url,
        headers,
        responseType: 'text',
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs,
      });
      const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data ?? '');
      try {
        return { status: response.status, json: true, data: JSON.parse(text) as MseaPayload };
      } catch {
        return { status: response.status, json: false, data: {} };
      }
    }
    const response = await fetch(url, {
      cache: 'no-store',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const type = response.headers.get('content-type') || '';
    if (!type.includes('application/json')) return { status: response.status, json: false, data: {} };
    const data = (await response.json()) as MseaPayload;
    return { status: response.status, json: true, data };
  } catch {
    return { status: 0, json: false, data: {} };
  }
}

function serviceAnswered(result: { status: number; json: boolean }) {
  return result.json && result.status > 0 && result.status < 500 && result.status !== 401 && result.status !== 403;
}

/** Health check uses the same __healthcheck__ registration the Majuu server sends. */
export async function checkMseaHealth(): Promise<{ reachable: boolean; reason: string }> {
  const direct = await readJson(directUrl('__healthcheck__'), 12000);
  if (serviceAnswered(direct)) {
    return { reachable: true, reason: '' };
  }

  if (await probeOrigin(LINKS.majuu.url)) {
    const base = localPreview() ? '' : LINKS.majuu.url;
    const health = await readJson(`${base}/api/businesses/health`, 12000);
    if (health.data.reachable) return { reachable: true, reason: '' };
    return { reachable: false, reason: health.data.reason || MSEA_MANUAL };
  }

  return { reachable: false, reason: MSEA_MANUAL };
}

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

export function formatRegistrationDate(dateString?: string): string {
  if (!dateString) return '';
  const trimmed = dateString.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const words = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (words) {
    const month = MONTHS[words[2].toLowerCase()];
    if (month) return `${words[3]}-${month}-${words[1].padStart(2, '0')}`;
  }
  return '';
}

export function phonesFromRecord(record: MseaRecord): string[] {
  const values = [record.phone_number, ...(record.partners || []).map((partner) => partner.phone_number)];
  const seen = new Set<string>();
  const phones: string[] = [];
  for (const value of values) {
    const digits = (value || '').replace(/\D/g, '');
    if (!digits || seen.has(digits)) continue;
    seen.add(digits);
    phones.push(value || '');
  }
  return phones;
}

/**
 * The signed-in phone is checked the way Majuu checks the session.
 * With no saved phone, the chair is checked later against the named members.
 */
export function applicantMayStartGroup(partners: MseaPartner[], phone: string): { ok: true } | { ok: false; message: string } {
  const chairs = findMseaChairPartners(partners);
  if (!phone.trim()) return { ok: true };
  const pool = chairs.length ? chairs : partners;
  if (!pool.length) return { ok: true };
  const matched = pool.some((partner) => sameKenyanLine(phone, partner.phone_number || ''));
  if (matched) return { ok: true };
  return { ok: false, message: chairs.length ? CHAIR_ONLY : NOT_A_PARTNER };
}

export async function lookupMsea(
  registrationNumber: string,
  applicantPhone = '',
  options?: { skipApplicantCheck?: boolean },
): Promise<{ available: false; message: string } | { available: true; record: MseaRecord }> {
  const trimmed = registrationNumber.trim().toUpperCase();
  if (!trimmed) return { available: false, message: 'Please enter a registration number.' };

  let result = await readJson(directUrl(trimmed), 20000);
  if (!serviceAnswered(result) && (await probeOrigin(LINKS.majuu.url))) {
    result = await readJson(majuuBusinessUrl(trimmed), 20000);
  }

  if (!result.status || result.status === 401 || result.status === 403) {
    return { available: false, message: MSEA_MANUAL };
  }
  if (!result.status || result.data.error) {
    return { available: false, message: result.data.error || MSEA_MANUAL };
  }
  if (result.status !== 200 || result.data.count !== 1 || !result.data.records?.length) {
    return { available: false, message: 'Group not found. Please check the registration number.' };
  }

  const record = result.data.records[0];
  if (record.status && record.status !== 'registered') {
    return { available: false, message: `Group status is "${record.status}". Only registered groups can proceed.` };
  }
  if (!formatRegistrationDate(record.registration_date)) {
    return { available: false, message: 'Registration date not found in MSEA record. Please contact support.' };
  }

  const partners = record.partners || [];
  if (!options?.skipApplicantCheck) {
    const allowed = applicantMayStartGroup(partners, applicantPhone);
    if (!allowed.ok) return { available: false, message: allowed.message };
  }

  return {
    available: true,
    record: {
      ...record,
      business_name: (record.business_name || '').toUpperCase(),
      registration_number: (record.registration_number || trimmed).toUpperCase(),
      registration_date: formatRegistrationDate(record.registration_date),
      partners,
    },
  };
}
