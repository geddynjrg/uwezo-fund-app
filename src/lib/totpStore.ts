import { generateTotpSecret, normalizeBase32, type TotpAccount } from './totp';

const KEY = 'uwezo.fund.app.totp.v1';

export function loadTotpAccounts(): TotpAccount[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as TotpAccount[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function save(list: TotpAccount[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function upsertTotpAccount(input: Omit<TotpAccount, 'id' | 'enrolledAt'> & { id?: string }) {
  const list = loadTotpAccounts();
  const secret = normalizeBase32(input.secret);
  const existing = list.find(
    (item) =>
      item.id === input.id ||
      (item.issuer === input.issuer && item.label === input.label),
  );
  const next: TotpAccount = {
    id: existing?.id || input.id || crypto.randomUUID(),
    issuer: input.issuer.trim() || 'Uwezo Fund',
    label: input.label.trim() || 'application',
    secret,
    digits: input.digits || 6,
    period: input.period || 30,
    enrolledAt: existing?.enrolledAt || new Date().toISOString(),
  };
  const rest = list.filter((item) => item.id !== next.id);
  save([next, ...rest]);
  return next;
}

export function removeTotpAccount(id: string) {
  save(loadTotpAccounts().filter((item) => item.id !== id));
}

export function createLocalApplicationAccount(label: string) {
  return upsertTotpAccount({
    issuer: 'Uwezo Fund',
    label,
    secret: generateTotpSecret(),
    digits: 6,
    period: 30,
  });
}
