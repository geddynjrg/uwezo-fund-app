import { LINKS } from '../config';

export type PortalId = 'loans' | 'majuu';

export type PortalAvailability = Record<PortalId, boolean | null>;

const inflight = new Map<string, Promise<boolean>>();

/** A portal is available only when its own origin answers. A timeout stays offline. */
export function probeOrigin(origin: string, timeoutMs = 8000): Promise<boolean> {
  const existing = inflight.get(origin);
  if (existing) return existing;
  const run = actuallyProbe(origin, timeoutMs).finally(() => {
    inflight.delete(origin);
  });
  inflight.set(origin, run);
  return run;
}

async function actuallyProbe(origin: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(origin, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    return response.type === 'opaque' || response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function probePortals(): Promise<Record<PortalId, boolean>> {
  const [loans, majuu] = await Promise.all([
    probeOrigin(LINKS.loans.url),
    probeOrigin(LINKS.majuu.url),
  ]);
  return { loans, majuu };
}
