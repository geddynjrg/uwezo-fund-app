import { Capacitor } from '@capacitor/core';
import { LINKS } from '../config';

function majuuBase() {
  const preview =
    !Capacitor.isNativePlatform() &&
    typeof location !== 'undefined' &&
    (location.hostname === '127.0.0.1' || location.hostname === 'localhost');
  if (preview) return '';
  return LINKS.majuu.url;
}

export type AgencyHit = { neaRegNo: string; agencyName: string; status?: string };

/** Majuu searches NEAIMS agencies. If Majuu is down, the public NEAIMS list is tried. */
export async function searchAgencies(query: string): Promise<{ available: boolean; results: AgencyHit[]; message: string }> {
  const q = query.trim();
  if (q.length < 2) return { available: true, results: [], message: '' };
  try {
    const url = new URL(`${majuuBase()}/api/agencies/search`, location.origin);
    url.searchParams.set('q', q);
    const response = await fetch(url, { cache: 'no-store' });
    if (response.ok) {
      const data = (await response.json()) as { results?: AgencyHit[] };
      return { available: true, results: data.results || [], message: '' };
    }
  } catch {
    // Majuu is down. Try the public NEAIMS list next.
  }
  try {
    const response = await fetch('https://api.neaims.go.ke/api/v1/agencies/public/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ search: q }),
    });
    if (!response.ok) throw new Error('NEAIMS did not answer');
    const data = (await response.json()) as { data?: Array<Record<string, unknown>>; results?: Array<Record<string, unknown>> };
    const rows = data.data || data.results || [];
    const results: AgencyHit[] = [];
    for (const row of rows) {
      const agencyName = String(row.instName || row.agencyName || '').trim();
      const neaRegNo = String(row.instCode || row.instRegNo || row.neaRegNo || '').trim();
      if (!agencyName || !neaRegNo) continue;
      results.push({ neaRegNo, agencyName, status: String(row.instStatus || row.status || '') });
    }
    return { available: true, results, message: '' };
  } catch {
    return {
      available: false,
      results: [],
      message: 'NEAIMS is unavailable. Enter the agency and job placement manually. Majuu confirms the placement when it is back.',
    };
  }
}
