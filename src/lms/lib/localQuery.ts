import { listLmsTable, loadLmsMeta, type LmsTableName } from '../../lib/lmsLocalDb';

export function matchesSearch(row: Record<string, unknown>, query: string, keys: string[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return keys.some((key) => String(row[key] ?? '').toLowerCase().includes(q));
}

export async function loadTable(table: LmsTableName, limit = 5000): Promise<Record<string, unknown>[]> {
  return listLmsTable(table, limit);
}

export async function loadMeta(email: string) {
  return loadLmsMeta(email);
}

export function money(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-KE', { maximumFractionDigits: 2 });
}
