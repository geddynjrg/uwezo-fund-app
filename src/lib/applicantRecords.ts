import type { ApplicantRecords, ApplicantTable } from './applicantVault';
import { deleteMajuu, emptyGroup, emptyIndividual, listMajuu, saveMajuu } from './majuuApply';
import {
  deletePacket,
  emptyDraft,
  listPackets,
  reopenReturnedPackets,
  savePacket,
  type OfflinePacket,
} from './offlineApply';
import type { AppSession } from './session';

function cell(row: Record<string, string> | undefined, key: string): string {
  const value = row?.[key];
  return value == null ? '' : String(value);
}

function genderOf(value: string): '' | 'Male' | 'Female' {
  if (value === 'Male' || value === 'Female') return value;
  return '';
}

function table(tables: ApplicantTable[], name: string): Record<string, string>[] {
  return tables.find((item) => item.name === name)?.rows || [];
}

async function readJson(url: string, headers: Record<string, string>): Promise<{ tables: ApplicantTable[]; loansTables: ApplicantTable[] }> {
  const empty = { tables: [], loansTables: [] };
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
    if (!response.ok) return empty;
    const data = (await response.json()) as { ok?: boolean; tables?: ApplicantTable[]; loansTables?: ApplicantTable[] };
    if (!data.ok) return empty;
    return {
      tables: Array.isArray(data.tables) ? data.tables : [],
      loansTables: Array.isArray(data.loansTables) ? data.loansTables : [],
    };
  } catch {
    return empty;
  }
}

export async function pullApplicantRecords(session: AppSession): Promise<ApplicantRecords> {
  const majuuToken = session.majuuAccessToken || (session.origin.includes('majuu') ? session.accessToken : '');
  const loansToken = session.loansAccessToken || (session.origin.includes('loans') ? session.accessToken : '');
  let majuu: ApplicantTable[] = [];
  let loans: ApplicantTable[] = [];
  if (majuuToken) {
    const loaded = await readJson('https://majuu.uwezo.go.ke/api/auth/app/records', {
      Accept: 'application/json',
      Authorization: `Bearer ${majuuToken}`,
      ...(loansToken ? { 'X-Loans-Authorization': `Bearer ${loansToken}` } : {}),
    });
    majuu = loaded.tables;
    loans = loaded.loansTables;
  }
  if (!loans.length && loansToken) {
    const loaded = await readJson('https://loans.uwezo.go.ke/api/auth/app/records', {
      Accept: 'application/json',
      Authorization: `Bearer ${loansToken}`,
    });
    loans = loaded.tables;
  }
  return { savedAt: new Date().toISOString(), majuu, loans };
}

export async function clearPublishedRecords(): Promise<void> {
  for (const row of await listMajuu()) {
    if (row.id.startsWith('server:')) await deleteMajuu(row.id);
  }
  for (const packet of await listPackets()) {
    if (packet.id.startsWith('server:')) await deletePacket(packet.id);
  }
}

export async function publishApplicantRecords(records: ApplicantRecords): Promise<string[]> {
  await clearPublishedRecords();
  const numbers: string[] = [];
  const groups = table(records.majuu, 'group_applications');
  const groupData = table(records.majuu, 'group_data');
  const members = table(records.majuu, 'group_members');
  const people = table(records.majuu, 'individual_applications');
  for (const group of groups) {
    const id = cell(group, 'id');
    if (!id) continue;
    const data = groupData.find((row) => cell(row, 'applicationId') === id);
    const number = cell(group, 'acknowledgmentNumber');
    if (number) numbers.push(number);
    await saveMajuu({
      ...emptyGroup(),
      id: `server:majuu:group:${id}`,
      createdAt: cell(group, 'createdAt') || new Date().toISOString(),
      registrationNumber: cell(data, 'registrationNumber'),
      groupName: cell(data, 'groupName'),
      loanNumber: number,
      status: 'complete',
      uploadedToMajuu: true,
      serverApplicationId: id,
    });
  }
  for (const person of people) {
    const id = cell(person, 'id');
    if (!id) continue;
    const member = members.find((row) => cell(row, 'id') === cell(person, 'memberId'));
    const group = groups.find((row) => cell(row, 'id') === cell(member, 'applicationId'));
    const data = groupData.find((row) => cell(row, 'applicationId') === cell(group, 'id'));
    const number = cell(person, 'acknowledgmentNumber');
    if (number) numbers.push(number);
    await saveMajuu({
      ...emptyIndividual(),
      id: `server:majuu:individual:${id}`,
      createdAt: cell(person, 'createdAt') || new Date().toISOString(),
      name: cell(member, 'name'),
      nationalId: cell(member, 'idNo'),
      phone: cell(member, 'mobile'),
      email: cell(member, 'email'),
      passportNo: cell(member, 'passportNo'),
      gender: genderOf(cell(member, 'gender')),
      registrationNumber: cell(data, 'registrationNumber'),
      groupName: cell(data, 'groupName'),
      individualNumber: number,
      loanNumber: cell(group, 'acknowledgmentNumber'),
      loanAmount: cell(person, 'awardAmount') || cell(member, 'amount'),
      status: 'numbered',
      uploadedToMajuu: true,
      serverApplicationId: id,
    });
  }
  const applications = table(records.loans, 'applications');
  const loanGroups = table(records.loans, 'group_data');
  const reopenHints: { applicationId?: string; status?: string; action?: string }[] = [];
  for (const application of applications) {
    const id = cell(application, 'id');
    if (!id) continue;
    const data = loanGroups.find((row) => cell(row, 'applicationId') === id);
    const number = cell(application, 'applicationId') || id;
    const status = cell(application, 'status');
    const action = cell(application, 'action');
    numbers.push(number);
    reopenHints.push({ applicationId: number, status, action });
    const returned =
      /defer|returned|draft/i.test(status) || /returned_to_applicant|return/i.test(action);
    const packet: OfflinePacket = {
      id: `server:loans:${id}`,
      product: 'core',
      createdAt: cell(application, 'createdAt') || new Date().toISOString(),
      status: returned ? 'draft' : 'synced',
      payload: {
        ...emptyDraft('core'),
        proposedNumber: number,
        groupName: cell(data, 'groupName'),
        registrationNumber: cell(data, 'groupRegistrationNumber'),
        contactPhone: cell(data, 'contactPhone'),
        loanAmount: cell(data, 'loanAmount'),
      },
      files: [],
      lastError: returned ? 'Returned to the group for correction. Edit and submit again.' : '',
      applicationId: number,
      acknowledgementNumber: number,
      syncedAt: returned ? undefined : new Date().toISOString(),
      remoteStatus: status || action || '',
    };
    await savePacket(packet);
  }
  await reopenReturnedPackets(reopenHints);
  return numbers;
}

export function recordsNote(numbers: string[]): string {
  const unique = [...new Set(numbers.filter(Boolean))];
  if (!unique.length) return 'Your sign-in is encrypted on this phone. Majuu and Loans records refresh the next time you sign in online.';
  return `Encrypted on this phone: ${unique.slice(0, 8).join(', ')}. You can sign in again without internet.`;
}
