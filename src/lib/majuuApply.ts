import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { LINKS } from '../config';
import { newConsentCode, sendEbisSms } from './ebisSms';
import { inferGender } from './genderFromName';
import { isMseaOfficialPartner, lookupMsea, partnerByNationalId, type MseaPartner, type MseaRecord } from './msea';
import { neaimsPlacementRequired } from './offlineApply';
import { showPhoneAlert } from './notify';
import { isLikelyKenyanMobile } from './phone';
import { probeOrigin } from './portalStatus';
import { newId, pushInbox } from './session';

export const GROUP_PURPOSE = 'Seek Funds to facilitate travel abroad for jobs';
export const GROUP_ACTIVITIES = 'Travelling Abroad for Work';
export const MAJUU_LMS_URL = 'https://majuu.uwezo.go.ke/lms';
export const INDIVIDUAL_LOAN_CAP = 166666;
/** Ordinary Kenyan passport (A1234567) and ePassport (AK1234567), up to 9 digits. */
export const KENYAN_PASSPORT = /^[A-Z]{1,2}\d{1,9}$/;
export const AGENT_NUMBER = /^[A-Z0-9][A-Z0-9\-/]*$/;

export function isKenyanPassport(value: string): boolean {
  return KENYAN_PASSPORT.test(value.trim().toUpperCase());
}
const NEAIMS_PLACEMENTS_URL = 'https://majuu.uwezo.go.ke/api/neaims/placements';
const MAJUU_SYNC_URL = 'https://majuu.uwezo.go.ke/api/app/offline-sync';

const DB_NAME = 'uwezo-majuu-applications';
const DB_VERSION = 1;
const STORE = 'records';

export type GuarantorDraft = {
  name: string;
  gender: '' | 'Male' | 'Female';
  county: string;
  constituency: string;
  ward: string;
  nationalId: string;
  phone: string;
  otpCode: string;
  otpEntered: string;
  otpSent: boolean;
  consentPending: boolean;
};

export type BudgetLine = { item: string; cost: string };

export type CreditLoan = {
  lender: string;
  date: string;
  amount: string;
  duration: string;
  monthlyInstallment: string;
  outstandingAmount: string;
};

export type PassportFile = { name: string; type: string; buffer: ArrayBuffer };

export type PendingNotice = {
  id: string;
  name: string;
  phone: string;
  title: string;
  body: string;
  sent: boolean;
};

export type IndividualMajuu = {
  id: string;
  kind: 'individual';
  createdAt: string;
  registrationNumber: string;
  groupName: string;
  registrationDate: string;
  mseaMember: 'unchecked' | 'matched' | 'missing' | 'offline';
  mseaDetail: string;
  neaims: 'unchecked' | 'placed' | 'missing' | 'offline';
  neaimsDetail: string;
  name: string;
  nationalId: string;
  gender: '' | 'Male' | 'Female';
  dob: string;
  passportNo: string;
  kraPin: string;
  educationLevel: string;
  phone: string;
  email: string;
  poBox: string;
  postalCode: string;
  town: string;
  dependants: string;
  loanAmount: string;
  county: string;
  constituency: string;
  ward: string;
  guarantors: [GuarantorDraft, GuarantorDraft];
  agentNumber: string;
  localAgentName: string;
  employerAbroad: string;
  recruiterCode: string;
  countryOfDestination: string;
  natureOfWork: string;
  durationType: '' | 'months' | 'years';
  workDuration: string;
  currency: '' | 'KWD' | 'AED' | 'RUB';
  monthlyRemuneration: string;
  convertedKesAmount: string;
  budget: BudgetLine[];
  bankName: string;
  bankBranch: string;
  accountName: string;
  accountNumber: string;
  hasLoanHistory: '' | 'yes' | 'no';
  creditLoans: CreditLoan[];
  termsAccepted: boolean;
  signed: boolean;
  signatureImage: string;
  recruitmentLocked: string[];
  tripartiteAccepted: boolean;
  uploadedToMajuu: boolean;
  submitRequested: boolean;
  serverApplicationId: string;
  passportFile: PassportFile | null;
  loanNumber: string;
  individualNumber: string;
  status: 'draft' | 'saved' | 'numbered';
  notices: PendingNotice[];
};

export type RosterPerson = {
  name: string;
  nationalId: string;
  gender: '' | 'Male' | 'Female';
};

export type GroupMajuu = {
  id: string;
  kind: 'group';
  createdAt: string;
  registrationNumber: string;
  groupName: string;
  registrationDate: string;
  officialName: string;
  officialNationalId: string;
  officialPhone: string;
  roster: RosterPerson[];
  totalMales: string;
  totalFemales: string;
  county: string;
  constituency: string;
  ward: string;
  purpose: string;
  proposedActivities: string;
  bankName: string;
  bankBranch: string;
  accountName: string;
  accountNumber: string;
  memberIds: string[];
  loanNumber: string;
  status: 'draft' | 'complete';
  lastError: string;
  uploadedToMajuu: boolean;
  submitRequested: boolean;
  serverApplicationId: string;
  notices: PendingNotice[];
};

export type MajuuRecord = IndividualMajuu | GroupMajuu;

export function emptyGuarantor(): GuarantorDraft {
  return {
    name: '',
    gender: '',
    county: '',
    constituency: '',
    ward: '',
    nationalId: '',
    phone: '',
    otpCode: '',
    otpEntered: '',
    otpSent: false,
    consentPending: false,
  };
}

export function budgetTotal(lines: BudgetLine[]): number {
  return lines.reduce((sum, line) => {
    const cost = Number(line.cost);
    if (!line.item.trim() || !(cost > 0)) return sum;
    return sum + cost;
  }, 0);
}

export function withBudgetAmount<T extends { budget: BudgetLine[]; loanAmount: string }>(person: T): T {
  return { ...person, loanAmount: String(budgetTotal(person.budget)) };
}

export function emptyBudget(): BudgetLine[] {
  return Array.from({ length: 5 }, () => ({ item: '', cost: '' }));
}

export function emptyIndividual(): IndividualMajuu {
  return {
    id: newId(),
    kind: 'individual',
    createdAt: new Date().toISOString(),
    registrationNumber: '',
    groupName: '',
    registrationDate: '',
    mseaMember: 'unchecked',
    mseaDetail: '',
    neaims: 'unchecked',
    neaimsDetail: '',
    name: '',
    nationalId: '',
    gender: '',
    dob: '',
    passportNo: '',
    kraPin: '',
    educationLevel: '',
    phone: '',
    email: '',
    poBox: '',
    postalCode: '',
    town: '',
    dependants: '',
    loanAmount: '',
    county: '',
    constituency: '',
    ward: '',
    guarantors: [emptyGuarantor(), emptyGuarantor()],
    agentNumber: '',
    localAgentName: '',
    employerAbroad: '',
    recruiterCode: '',
    countryOfDestination: '',
    natureOfWork: '',
    durationType: '',
    workDuration: '',
    currency: '',
    monthlyRemuneration: '',
    convertedKesAmount: '',
    budget: emptyBudget(),
    bankName: '',
    bankBranch: '',
    accountName: '',
    accountNumber: '',
    hasLoanHistory: '',
    creditLoans: [],
    termsAccepted: false,
    signed: false,
    signatureImage: '',
    recruitmentLocked: [],
    tripartiteAccepted: false,
    uploadedToMajuu: false,
    submitRequested: false,
    serverApplicationId: '',
    passportFile: null,
    loanNumber: '',
    individualNumber: '',
    status: 'draft',
    notices: [],
  };
}

export function emptyGroup(): GroupMajuu {
  return {
    id: newId(),
    kind: 'group',
    createdAt: new Date().toISOString(),
    registrationNumber: '',
    groupName: '',
    registrationDate: '',
    officialName: '',
    officialNationalId: '',
    officialPhone: '',
    roster: [],
    totalMales: '',
    totalFemales: '',
    county: '',
    constituency: '',
    ward: '',
    purpose: GROUP_PURPOSE,
    proposedActivities: GROUP_ACTIVITIES,
    bankName: '',
    bankBranch: '',
    accountName: '',
    accountNumber: '',
    memberIds: [],
    loanNumber: '',
    status: 'draft',
    lastError: '',
    uploadedToMajuu: false,
    submitRequested: false,
    serverApplicationId: '',
    notices: [],
  };
}

export function rosterFromPartners(partners: MseaPartner[]): RosterPerson[] {
  return (partners || [])
    .filter((partner) => (partner.name || '').trim())
    .map((partner) => ({
      name: partner.name || '',
      nationalId: (partner.id_number || '').replace(/\D/g, ''),
      gender: inferGender(partner.name || ''),
    }));
}

export function genderTotals(roster: RosterPerson[]) {
  return {
    totalMales: String(roster.filter((person) => person.gender === 'Male').length),
    totalFemales: String(roster.filter((person) => person.gender === 'Female').length),
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function deleteMajuu(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
  db.close();
}

export async function saveMajuu(record: MajuuRecord): Promise<MajuuRecord> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(record);
  await txDone(tx);
  db.close();
  return record;
}

function normalizeRecord(row: MajuuRecord): MajuuRecord {
  if (row.kind === 'group') {
    return { ...emptyGroup(), ...row, id: row.id, createdAt: row.createdAt };
  }
  const guarantors = [0, 1].map((index) => ({
    ...emptyGuarantor(),
    ...(row.guarantors?.[index] || {}),
  })) as [GuarantorDraft, GuarantorDraft];
  return {
    ...emptyIndividual(),
    ...row,
    id: row.id,
    createdAt: row.createdAt,
    guarantors,
    budget: row.budget?.length ? row.budget : emptyBudget(),
    recruitmentLocked: row.recruitmentLocked || [],
    signatureImage: row.signatureImage || '',
  };
}

export async function listMajuu(): Promise<MajuuRecord[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const request = tx.objectStore(STORE).getAll();
  const rows = await new Promise<MajuuRecord[]>((resolve, reject) => {
    request.onsuccess = () => resolve((request.result as MajuuRecord[]) || []);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows.map(normalizeRecord).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function individualsFor(records: MajuuRecord[], registrationNumber: string): IndividualMajuu[] {
  const key = registrationNumber.trim().toUpperCase();
  return records.filter(
    (row): row is IndividualMajuu => row.kind === 'individual' && row.registrationNumber.trim().toUpperCase() === key && row.status !== 'draft',
  );
}

export async function majuuAndLmsOnline(): Promise<boolean> {
  const [site, lms] = await Promise.all([probeOrigin(LINKS.majuu.url), probeOrigin(MAJUU_LMS_URL)]);
  return site && lms;
}

export async function queueMajuuNotice<T extends MajuuRecord>(record: T, notice: Omit<PendingNotice, 'id' | 'sent'>): Promise<T> {
  const item: PendingNotice = { ...notice, id: newId(), sent: false };
  const next = { ...record, notices: [...record.notices, item] };
  await saveMajuu(next);
  pushInbox({ title: item.title, body: item.body, kind: 'loan_status' });
  void showPhoneAlert({
    id: item.id,
    title: item.title,
    body: item.body,
    kind: 'loan_status',
    createdAt: new Date().toISOString(),
    read: false,
  });
  return flushRecordNotices(next);
}

async function flushRecordNotices<T extends MajuuRecord>(record: T): Promise<T> {
  if (!record.notices.some((notice) => !notice.sent)) return record;
  const online = await majuuAndLmsOnline();
  if (!online) return record;
  const notices: PendingNotice[] = [];
  for (const notice of record.notices) {
    if (notice.sent || !isLikelyKenyanMobile(notice.phone)) {
      notices.push(notice.sent ? notice : { ...notice, sent: !isLikelyKenyanMobile(notice.phone) });
      continue;
    }
    const result = await sendEbisSms(notice.phone, notice.body);
    notices.push({ ...notice, sent: result.ok });
  }
  const next = { ...record, notices } as T;
  await saveMajuu(next);
  return next;
}

export async function flushMajuuNotices(): Promise<void> {
  const online = await majuuAndLmsOnline();
  if (!online) return;
  const rows = await listMajuu();
  for (const row of rows) {
    if (row.notices.some((notice) => !notice.sent)) await flushRecordNotices(row);
  }
}

export type PlacementPatch = Partial<
  Pick<
    IndividualMajuu,
    | 'agentNumber'
    | 'localAgentName'
    | 'employerAbroad'
    | 'recruiterCode'
    | 'countryOfDestination'
    | 'natureOfWork'
    | 'durationType'
    | 'workDuration'
    | 'currency'
    | 'monthlyRemuneration'
    | 'passportNo'
  >
>;

const PLACEMENT_FIELDS = [
  'agentNumber',
  'localAgentName',
  'employerAbroad',
  'recruiterCode',
  'countryOfDestination',
  'natureOfWork',
  'durationType',
  'workDuration',
  'currency',
  'monthlyRemuneration',
  'passportNo',
] as const;

function textOf(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function mapPlacement(raw: Record<string, unknown>): { values: PlacementPatch; locked: string[] } {
  const values: PlacementPatch = {};
  const locked: string[] = [];
  const take = (field: keyof PlacementPatch, value: unknown) => {
    const text = field === 'passportNo' || field === 'agentNumber' ? textOf(value).toUpperCase() : textOf(value);
    if (!text) return;
    values[field] = text as never;
    locked.push(field);
  };
  take('agentNumber', raw.agentNumber);
  take('passportNo', textOf(raw.passportNo) || textOf(raw.passportNumber) || textOf(raw.passport));
  take('localAgentName', raw.agencyName);
  take('employerAbroad', raw.employerAbroad);
  take('recruiterCode', raw.employerCode);
  take('countryOfDestination', raw.countryOfDestination);
  take('natureOfWork', textOf(raw.natureOfWork) || textOf(raw.position) || textOf(raw.advertTitle));
  const months = Number(textOf(raw.durationMonths));
  if (months > 0) {
    values.durationType = 'months';
    values.workDuration = String(months);
    locked.push('durationType', 'workDuration');
  }
  const currency = textOf(raw.currency).toUpperCase();
  if (currency === 'KWD' || currency === 'AED' || currency === 'RUB') {
    values.currency = currency;
    locked.push('currency');
  }
  const gross = Number(textOf(raw.grossPay).replace(/,/g, ''));
  if (gross > 0) {
    values.monthlyRemuneration = String(gross);
    locked.push('monthlyRemuneration');
  }
  return { values, locked };
}

/** Job placement is read from the Kazi254 placement API, not from the loans admin site. */
export async function checkJobseekerPlacement(nationalId: string): Promise<{
  state: IndividualMajuu['neaims'];
  detail: string;
  recruitment: PlacementPatch;
  locked: string[];
}> {
  const id = nationalId.replace(/\D/g, '');
  const empty = { recruitment: {} as PlacementPatch, locked: [] as string[] };
  if (!id) return { state: 'missing', detail: 'Enter a national ID before the placement check.', ...empty };
  try {
    const response = Capacitor.isNativePlatform()
      ? await CapacitorHttp.post({
          url: NEAIMS_PLACEMENTS_URL,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          data: { nationalId: id },
          connectTimeout: 20000,
          readTimeout: 20000,
        })
      : await fetch(NEAIMS_PLACEMENTS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ nationalId: id }),
          signal: AbortSignal.timeout(20000),
        });
    const status = 'status' in response ? response.status : 0;
    const raw = Capacitor.isNativePlatform()
      ? (response as { data?: unknown }).data
      : await (response as Response).json().catch(() => null);
    const data = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown> | null;
    const nested = data && typeof data.data === 'object' && data.data ? (data.data as Record<string, unknown>) : null;
    const placements = Array.isArray(data?.placements)
      ? (data.placements as Record<string, unknown>[])
      : Array.isArray(nested?.placements)
        ? (nested.placements as Record<string, unknown>[])
        : [];
    if (status >= 200 && status < 300 && placements.length) {
      const preferred = placements[0];
      const mapped = mapPlacement(preferred);
      return {
        state: 'placed',
        detail: 'A job placement was found. Matching recruitment fields are filled.',
        recruitment: mapped.values,
        locked: mapped.locked,
      };
    }
    if (!neaimsPlacementRequired()) {
      return { state: 'offline', detail: 'Recruitment details can be typed on this step.', ...empty };
    }
    if (status >= 200 && status < 300) {
      return { state: 'missing', detail: 'NEAIMS has not confirmed a job placement.', ...empty };
    }
    return {
      state: 'offline',
      detail: 'The job placement service did not answer. Recruitment details can be typed and are checked again when you submit.',
      ...empty,
    };
  } catch {
    return {
      state: 'offline',
      detail: neaimsPlacementRequired()
        ? 'The job placement service did not answer. Recruitment details can be typed and are checked again when you submit.'
        : 'Recruitment details can be typed on this step.',
      ...empty,
    };
  }
}

export function applyPlacement(person: IndividualMajuu, placement: { recruitment: PlacementPatch; locked: string[] }): IndividualMajuu {
  const next = { ...person };
  for (const field of PLACEMENT_FIELDS) {
    const value = placement.recruitment[field];
    if (value) next[field] = value as never;
  }
  next.recruitmentLocked = placement.locked;
  return next;
}

export function guarantorConfirmationError(person: IndividualMajuu): string {
  for (let index = 0; index < person.guarantors.length; index += 1) {
    const guarantor = person.guarantors[index];
    if (!guarantor.otpSent || !guarantor.otpCode) {
      return `Send the OTP to guarantor ${index + 1}, then type it in Guarantor OTP.`;
    }
    if ((guarantor.otpEntered || '').trim() !== guarantor.otpCode) {
      return `Type the Guarantor OTP sent to guarantor ${index + 1}. The field is under that guarantor's phone.`;
    }
  }
  return '';
}

export async function sendGuarantorOtps(
  person: IndividualMajuu,
  options?: { onlyIndex?: number; resend?: boolean },
): Promise<IndividualMajuu> {
  const guarantors = person.guarantors.map((guarantor) => ({ ...guarantor })) as [GuarantorDraft, GuarantorDraft];
  for (let index = 0; index < guarantors.length; index += 1) {
    const guarantor = guarantors[index];
    if (options?.onlyIndex !== undefined && index !== options.onlyIndex) continue;
    if (!isLikelyKenyanMobile(guarantor.phone)) continue;
    if (guarantor.otpSent && !options?.resend) continue;
    const otpCode = guarantor.otpCode || newConsentCode();
    const result = await sendEbisSms(
      guarantor.phone,
      `Dear ${guarantor.name || 'guarantor'}, your Uwezo Fund Wezesha Majuu confirmation code is ${otpCode}. Share it with the applicant if you consent to guarantee this application.`,
    );
    guarantors[index] = {
      ...guarantor,
      otpCode,
      otpSent: result.ok,
      consentPending: !result.ok,
    };
  }
  return { ...person, guarantors };
}

export async function checkMemberOnCertificate(registrationNumber: string, nationalId: string): Promise<{
  state: IndividualMajuu['mseaMember'];
  record: MseaRecord | null;
  detail: string;
}> {
  const looked = await lookupMsea(registrationNumber, '', { skipApplicantCheck: true });
  if (!looked.available) {
    return { state: 'offline', record: null, detail: looked.message };
  }
  const partner = partnerByNationalId(looked.record.partners || [], nationalId);
  if (!partner) {
    return {
      state: 'missing',
      record: looked.record,
      detail: 'This national ID is not on the MSEA certificate.',
    };
  }
  return {
    state: 'matched',
    record: looked.record,
    detail: `${partner.name || 'Member'} is on this MSEA certificate.`,
  };
}

export function validateIndividual(draft: IndividualMajuu, atSubmit: boolean): string[] {
  const errors: string[] = [];
  if (draft.registrationNumber.trim().length < 2) errors.push('MSEA certificate number is required.');
  if (!/^\d{6,9}$/.test(draft.nationalId.trim())) errors.push('National ID is required.');
  if (draft.name.trim().length < 2) errors.push('Name is required.');
  if (!draft.gender) errors.push('Gender is required.');
  const passport = draft.passportNo.trim().toUpperCase();
  if (!passport) errors.push('Passport number is required.');
  else if (!draft.recruitmentLocked.includes('passportNo') && !isKenyanPassport(passport)) {
    errors.push('Enter a Kenyan passport number: one or two capital letters followed by up to 9 digits, such as A1234567 or AK123456789.');
  }
  const agent = draft.agentNumber.trim().toUpperCase();
  if (agent && !AGENT_NUMBER.test(agent)) errors.push('Agent number must be capital letters and numbers.');
  if (!draft.educationLevel.trim()) errors.push('Education level is required.');
  if (!isLikelyKenyanMobile(draft.phone)) errors.push('A Kenyan mobile number is required.');
  if (!draft.email.includes('@')) errors.push('Email is required.');
  if (!draft.county || !draft.constituency || !draft.ward) errors.push('County, constituency, and ward are required.');
  draft.guarantors.forEach((guarantor, index) => {
    if (!guarantor.name.trim() || !guarantor.gender || !guarantor.county || !guarantor.constituency || !guarantor.ward) {
      errors.push(`Guarantor ${index + 1} needs a name, gender, county, constituency, and ward.`);
    }
    if (!/^\d{6,9}$/.test(guarantor.nationalId.trim())) errors.push(`Guarantor ${index + 1} needs a national ID.`);
    if (!isLikelyKenyanMobile(guarantor.phone)) errors.push(`Guarantor ${index + 1} needs a Kenyan mobile number.`);
  });
  if (!draft.agentNumber.trim() || !draft.localAgentName.trim()) errors.push('Agent number and local agent name are required.');
  if (!draft.employerAbroad.trim() || !draft.recruiterCode.trim() || !draft.countryOfDestination.trim() || !draft.natureOfWork.trim()) {
    errors.push('Employer, employer code, destination country, and nature of work are required.');
  }
  if (!draft.durationType || !(Number(draft.workDuration) > 0)) errors.push('Work duration is required.');
  if (!draft.currency || !(Number(draft.monthlyRemuneration) > 0)) errors.push('Currency and monthly pay are required.');
  if (!(Number(draft.convertedKesAmount) > 0)) errors.push('The pay converted to Kenya shillings is required.');
  const filledBudget = draft.budget.filter((line) => line.item.trim() && Number(line.cost) > 0);
  if (!filledBudget.length) errors.push('Add at least one budget item.');
  const applied = budgetTotal(draft.budget);
  if (applied < 1 || applied > INDIVIDUAL_LOAN_CAP) {
    errors.push('The amount applied is the budget total and must be from 1 to 166,666.');
  }
  if (!draft.bankName.trim() || !draft.bankBranch.trim() || !draft.accountName.trim() || !draft.accountNumber.trim()) {
    errors.push('Bank, branch, account name, and account number are required.');
  }
  if (draft.hasLoanHistory !== 'yes' && draft.hasLoanHistory !== 'no') errors.push('Say whether you have had a loan before.');
  if (draft.hasLoanHistory === 'yes') {
    if (!draft.creditLoans.length) errors.push('Add the previous loan.');
    draft.creditLoans.forEach((loan, index) => {
      if (!loan.lender.trim() || !loan.date || !loan.duration.trim()) errors.push(`Loan ${index + 1} needs a lender, date, and duration.`);
    });
  }
  if (!draft.passportFile) errors.push('The passport biodata page is required.');
  if (draft.passportFile && draft.passportFile.type && !draft.passportFile.type.startsWith('image/') && draft.passportFile.type !== 'application/pdf') {
    errors.push('The passport file must be a photo or a PDF.');
  }
  if (!draft.termsAccepted || !draft.signatureImage) errors.push('Accept the loan terms and sign.');
  if (!draft.tripartiteAccepted) errors.push('Accept the tripartite agreement.');
  if (atSubmit && draft.mseaMember === 'missing') errors.push('This national ID is not on the MSEA certificate.');
  if (atSubmit && neaimsPlacementRequired() && draft.neaims === 'missing') {
    errors.push(draft.neaimsDetail || 'NEAIMS has not confirmed a job placement.');
  }
  return errors;
}

export function newLoanNumber() {
  return `UWZ-${Date.now()}`;
}

export function individualAcknowledgement(loanNumber: string, nationalId: string) {
  return `${loanNumber}-${nationalId.replace(/\D/g, '')}`;
}

export function validateGroup(group: GroupMajuu, members: IndividualMajuu[]): string[] {
  const errors: string[] = [];
  if (group.registrationNumber.trim().length < 2) errors.push('MSEA certificate number is required.');
  if (!group.groupName.trim() || !group.registrationDate) errors.push('Group name and date formed come from MSEA.');
  if (!/^\d{6,9}$/.test(group.officialNationalId.trim())) errors.push('The official’s national ID is required.');
  const males = Number(group.totalMales || 0);
  const females = Number(group.totalFemales || 0);
  if (group.roster.length) {
    if (group.roster.some((person) => !person.gender)) errors.push('Choose male or female for each member listed on the certificate.');
    if (males + females !== group.roster.length) {
      errors.push(`Males and females must add up to ${group.roster.length} members on the MSEA certificate.`);
    }
  } else if (males + females < 3) {
    errors.push('Enter the number of males and females. Together they must be at least 3.');
  }
  if (members.length < 3) errors.push('Include at least 3 members whose individual applications are already saved.');
  const total = members.reduce((sum, member) => sum + Number(member.loanAmount || 0), 0);
  if (total > 500000) errors.push('The group total cannot exceed 500,000.');
  if (!group.county || !group.constituency || !group.ward) {
    errors.push('County, constituency, and ward are copied from a saved member location and are missing.');
  }
  if (!group.bankName.trim() || !group.bankBranch.trim() || !group.accountName.trim() || !group.accountNumber.trim()) {
    errors.push('Group bank, branch, account name, and account number are required.');
  }
  return errors;
}

export function copyGroupLocation(officialId: string, members: IndividualMajuu[]) {
  const official = members.find((member) => member.nationalId.replace(/\D/g, '') === officialId.replace(/\D/g, ''));
  const source = official || members[0];
  return {
    county: source?.county || '',
    constituency: source?.constituency || '',
    ward: source?.ward || '',
  };
}

export async function officialMayFile(group: GroupMajuu): Promise<string> {
  const looked = await lookupMsea(group.registrationNumber, '', { skipApplicantCheck: true });
  if (!looked.available) return '';
  const partner = partnerByNationalId(looked.record.partners || [], group.officialNationalId);
  if (!partner) return 'This national ID is not on the MSEA certificate.';
  if (!isMseaOfficialPartner(partner)) return 'A group official listed on the MSEA certificate can file the group loan.';
  return '';
}

function bytesToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function syncPayload(record: MajuuRecord) {
  if (record.kind === 'group') return record;
  const { passportFile, ...rest } = record;
  return {
    ...rest,
    passport: passportFile
      ? { name: passportFile.name, type: passportFile.type, base64: bytesToBase64(passportFile.buffer) }
      : null,
  };
}

async function postMajuuSync(record: MajuuRecord): Promise<{ ok: boolean; detail: string; serverId: string }> {
  const payload = syncPayload(record);
  try {
    const response = Capacitor.isNativePlatform()
      ? await CapacitorHttp.post({
          url: MAJUU_SYNC_URL,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          data: payload,
          connectTimeout: 25000,
          readTimeout: 45000,
        })
      : await fetch(MAJUU_SYNC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(45000),
        });
    const status = 'status' in response ? response.status : 0;
    const raw = Capacitor.isNativePlatform()
      ? (response as { data?: unknown }).data
      : await (response as Response).text();
    let data: { ok?: boolean; detail?: string; serverId?: string } = {};
    try {
      data = (typeof raw === 'string' ? JSON.parse(raw || '{}') : raw || {}) as { ok?: boolean; detail?: string; serverId?: string };
    } catch {
      data = {};
    }
    if (status >= 200 && status < 300 && data.ok) {
      return { ok: true, detail: data.detail || 'Submitted to majuu.uwezo.go.ke.', serverId: data.serverId || '' };
    }
    if (!status) {
      return { ok: false, detail: 'The phone could not reach majuu.uwezo.go.ke. The application stays on this phone.', serverId: '' };
    }
    return { ok: false, detail: data.detail || `Majuu answered (${status}) and did not store this application.`, serverId: '' };
  } catch {
    return { ok: false, detail: 'The phone could not reach majuu.uwezo.go.ke. The application stays on this phone.', serverId: '' };
  }
}

export async function confirmMajuuUpload(clientId: string): Promise<boolean> {
  const online = await probeOrigin(LINKS.majuu.url);
  if (!online || !clientId) return false;
  try {
    const url = `${MAJUU_SYNC_URL}?clientId=${encodeURIComponent(clientId)}`;
    const response = Capacitor.isNativePlatform()
      ? await CapacitorHttp.get({ url, headers: { Accept: 'application/json' }, connectTimeout: 15000, readTimeout: 15000 })
      : await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    const data = Capacitor.isNativePlatform()
      ? ((response as { data?: { uploaded?: boolean } }).data || {})
      : ((await (response as Response).json().catch(() => ({}))) as { uploaded?: boolean });
    return Boolean(data.uploaded);
  } catch {
    return false;
  }
}

export async function submitIndividualOnline(person: IndividualMajuu): Promise<{ person: IndividualMajuu; ok: boolean; detail: string }> {
  const priced = withBudgetAmount(person);
  const membership = await checkMemberOnCertificate(priced.registrationNumber, priced.nationalId);
  if (membership.state === 'missing') return { person: priced, ok: false, detail: membership.detail };
  const placement = await checkJobseekerPlacement(priced.nationalId);
  const filled = placement.locked.length ? applyPlacement(priced, placement) : { ...priced, neaims: placement.state, neaimsDetail: placement.detail };
  if (neaimsPlacementRequired() && placement.state === 'missing') {
    return { person: { ...filled, neaims: 'missing', neaimsDetail: placement.detail }, ok: false, detail: placement.detail };
  }
  let current = await sendGuarantorOtps(filled);
  const confirmationError = guarantorConfirmationError(current);
  if (confirmationError) {
    const held = { ...current, submitRequested: false };
    await saveMajuu(held);
    return { person: held, ok: false, detail: confirmationError };
  }
  const result = await postMajuuSync({ ...current, neaims: placement.state, neaimsDetail: placement.detail });
  const saved = {
    ...current,
    neaims: placement.state,
    neaimsDetail: placement.detail,
    uploadedToMajuu: result.ok,
    serverApplicationId: result.serverId,
  };
  await saveMajuu(saved);
  return { person: saved, ok: result.ok, detail: result.detail };
}

export async function submitGroupOnline(group: GroupMajuu): Promise<{ group: GroupMajuu; ok: boolean; detail: string }> {
  const officialError = await officialMayFile(group);
  if (officialError) return { group, ok: false, detail: officialError };
  const result = await postMajuuSync(group);
  const saved = { ...group, uploadedToMajuu: result.ok, serverApplicationId: result.serverId, lastError: result.ok ? '' : result.detail };
  await saveMajuu(saved);
  return { group: saved, ok: result.ok, detail: result.detail };
}

export async function flushMajuuUploads(): Promise<void> {
  const online = await probeOrigin(LINKS.majuu.url);
  if (!online) return;
  const rows = await listMajuu();
  for (const row of rows) {
    if (row.kind === 'individual' && row.submitRequested && !row.uploadedToMajuu) {
      await submitIndividualOnline(row);
    }
    if (row.kind === 'group' && row.submitRequested && row.status === 'complete' && !row.uploadedToMajuu) {
      await submitGroupOnline(row);
    }
  }
}
