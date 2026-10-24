/** Banks offered on the Wezesha Majuu group bank step. Branches come from the same Kenya list. */
export const GROUP_BANKS = [
  'Equity Bank',
  'Family Bank',
  'ABSA Bank',
  'Co-operative Bank',
  'KCB Bank',
  'UBA Bank',
  'SBM Bank',
  'I&M Bank',
  'National Bank',
  'Diamond Trust Bank',
  'Standard Chartered Bank',
  'Stanbic Bank',
  'NCBA Bank',
] as const;

export type BankBranches = Record<string, string[]>;

function parseLine(line: string): { branch: string; bank: string } | null {
  const trimmed = line.trim();
  const lastComma = trimmed.lastIndexOf(',');
  if (lastComma === -1) return null;
  const bank = trimmed.slice(lastComma + 1).trim();
  const rest = trimmed.slice(0, lastComma);
  const firstComma = rest.indexOf(',');
  if (firstComma === -1 || !bank) return null;
  const branch = rest.slice(firstComma + 1).trim();
  return branch ? { branch, bank } : null;
}

export async function loadGroupBankBranches(): Promise<BankBranches> {
  const response = await fetch('/data/kenya_all_bank_branches.csv');
  if (!response.ok) throw new Error('Bank list did not load.');
  const text = await response.text();
  const grouped: BankBranches = {};
  for (const bank of GROUP_BANKS) grouped[bank] = [];
  for (const line of text.split('\n').slice(1)) {
    const row = parseLine(line);
    if (!row) continue;
    const match = GROUP_BANKS.find((bank) => bank.toLowerCase() === row.bank.toLowerCase());
    if (!match || grouped[match].includes(row.branch)) continue;
    grouped[match].push(row.branch);
  }
  for (const bank of GROUP_BANKS) grouped[bank].sort((a, b) => a.localeCompare(b));
  return grouped;
}
