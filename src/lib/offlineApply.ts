import { LINKS } from '../config';
import { isLikelyKenyanMobile, normalizeKenyanPhone, sameKenyanLine } from './phone';
import type { PortalId } from './portalStatus';
import { probeOrigin } from './portalStatus';
import { newId } from './session';

export type OfflineProduct = 'core' | 'majuu';

export const PRODUCT_PORTAL: Record<OfflineProduct, PortalId> = {
  core: 'loans',
  majuu: 'majuu',
};

export const PRODUCT_ORIGIN: Record<OfflineProduct, string> = {
  core: LINKS.loans.url,
  majuu: LINKS.majuu.url,
};

export const CORE_FILE_SLOTS = [
  { slot: 'registrationCertificate', label: 'Registration certificate', required: true },
  { slot: 'memberList', label: 'List of members on the certificate', required: true },
  { slot: 'minutes', label: 'Group meeting minutes', required: true },
] as const;

export const MAJUU_FILE_SLOTS = [
  { slot: 'kraPin', label: 'KRA PIN certificate (group)', required: true },
  { slot: 'registrationCertificate', label: 'Registration certificate', required: true },
  { slot: 'expressionOfInterest', label: 'Expression of interest', required: true },
] as const;

export const MAJUU_MEMBER_FILE_SLOTS = [
  { slot: 'memberId', label: 'National ID (photo or scan)', required: true },
  { slot: 'memberPassport', label: 'Passport', required: true },
  { slot: 'memberKra', label: 'KRA PIN certificate', required: true },
] as const;

export const FILE_SLOTS = CORE_FILE_SLOTS;

export type FileSlot =
  | (typeof CORE_FILE_SLOTS)[number]['slot']
  | (typeof MAJUU_FILE_SLOTS)[number]['slot']
  | (typeof MAJUU_MEMBER_FILE_SLOTS)[number]['slot']
  | 'photoOfId'
  | 'certificateOfDisability'
  | 'groupCreditHistory';

export function fileSlots(product: OfflineProduct) {
  return product === 'majuu' ? MAJUU_FILE_SLOTS : CORE_FILE_SLOTS;
}

/** Same shape as LAS createApplicationId: APP-YYYYMMDD- plus 6 letters or digits. */
export function createLoanApplicationId(now = new Date()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let suffix = '';
  for (const byte of bytes) suffix += alphabet[byte % alphabet.length];
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `APP-${date}-${suffix}`;
}

/** Same shape as Wezesha-LAS generateAcknowledgmentNumber. The portal keeps it if unique. */
export function createMajuuAcknowledgmentNumber(now = Date.now()): string {
  return `UWZ-${now}`;
}

export function assignApplicationNumber(product: OfflineProduct): string {
  return product === 'majuu' ? createMajuuAcknowledgmentNumber() : createLoanApplicationId();
}

/** Matches the Majuu portal placement cutoff. The date is not shown to applicants. */
export function neaimsPlacementRequired(now = Date.now()): boolean {
  return now > Date.parse('2026-11-06T23:59:59+03:00');
}

export type MemberDraft = {
  name: string;
  nationalId: string;
  gender: string;
  position: string;
  phone: string;
  email: string;
  passportNo: string;
  purpose: string;
  kraPin: string;
  economicActivity: string;
  pwdNumber: string;
  loanAmount: string;
  jobPlacement: string;
  consentCode: string;
  consentInput: string;
  consentStatus: 'none' | 'sent' | 'verified';
  signed: boolean;
};

export type ApplicationDraft = {
  schemaVersion: 1;
  product: OfflineProduct;
  proposedNumber: string;
  groupName: string;
  registrationNumber: string;
  registrationDate: string;
  county: string;
  constituency: string;
  ward: string;
  meetingPoint: string;
  nearestLandmark: string;
  location: string;
  subLocation: string;
  clusterCategory: string;
  geoLocationType: string;
  clusterCounty: string;
  clusterConstituency: string;
  destinationRegion: string;
  destinationCountry: string;
  localAgentName: string;
  clusterOther: string;
  groupPurpose: string;
  groupActivities: string;
  valueChain: string;
  groupOther: string;
  tableBankingExperience: string;
  tableBankingShareContribution: string;
  tableBankingTotalLoanedOut: string;
  tableBankingTotalRevolvingFund: string;
  contactPhone: string;
  natureOfGroup: string;
  loanType: string;
  loanAmount: string;
  repaymentPeriod: string;
  institutionType: string;
  bankName: string;
  bankBranch: string;
  bankAccountName: string;
  bankAccount: string;
  natureOfBusiness: string;
  businessType: string;
  yearsInBusiness: string;
  averageIncome: string;
  costOfGoods: string;
  rentForBusiness: string;
  salaries: string;
  transportForBusinessStock: string;
  customExpenses: { name: string; amount: string }[];
  businessDescription: string;
  background: string;
  proposedActivities: string;
  totalMales: string;
  totalFemales: string;
  totalDisabledMales: string;
  totalDisabledFemales: string;
  mseaMemberCount: string;
  mseaPhones: string;
  mseaChairIds: string;
  mseaChairPhones: string;
  agency: string;
  agentNumber: string;
  termsSent: boolean;
  termsAccepted: boolean;
  guaranteeAccepted: boolean;
  membersConfirmed: boolean;
  correctInformationConfirm: boolean;
  liabilityConfirm: boolean;
  fundsEligibleConfirm: boolean;
  mseaStatus: 'unchecked' | 'found' | 'manual';
  members: MemberDraft[];
};

export type StoredFile = {
  slot: FileSlot;
  name: string;
  type: string;
  buffer: ArrayBuffer;
  memberIndex?: number;
};

export type OfflinePacket = {
  id: string;
  product: OfflineProduct;
  createdAt: string;
  status: 'pending' | 'synced';
  payload: ApplicationDraft;
  files: StoredFile[];
  lastError: string;
  applicationId?: string;
  acknowledgementNumber?: string;
  syncedAt?: string;
};

const DB_NAME = 'uwezo-offline-applications';
const DB_VERSION = 1;
const STORE = 'packets';

export function emptyMember(): MemberDraft {
  return {
    name: '',
    nationalId: '',
    gender: '',
    position: '',
    phone: '',
    email: '',
    passportNo: '',
    purpose: '',
    kraPin: '',
    economicActivity: '',
    pwdNumber: '',
    loanAmount: '',
    jobPlacement: '',
    consentCode: '',
    consentInput: '',
    consentStatus: 'none',
    signed: false,
  };
}

export function emptyDraft(product: OfflineProduct): ApplicationDraft {
  const count = product === 'majuu' ? 3 : 1;
  return {
    schemaVersion: 1,
    product,
    proposedNumber: '',
    groupName: '',
    registrationNumber: '',
    registrationDate: '',
    county: '',
    constituency: '',
    ward: '',
    meetingPoint: '',
    nearestLandmark: '',
    location: '',
    subLocation: '',
    clusterCategory: '',
    geoLocationType: '',
    clusterCounty: '',
    clusterConstituency: '',
    destinationRegion: '',
    destinationCountry: '',
    localAgentName: '',
    clusterOther: '',
    groupPurpose: '',
    groupActivities: '',
    valueChain: '',
    groupOther: '',
    tableBankingExperience: '',
    tableBankingShareContribution: '',
    tableBankingTotalLoanedOut: '',
    tableBankingTotalRevolvingFund: '',
    contactPhone: '',
    natureOfGroup: '',
    loanType: 'Wezesha',
    loanAmount: '',
    repaymentPeriod: '',
    institutionType: '',
    bankName: '',
    bankBranch: '',
    bankAccountName: '',
    bankAccount: '',
    natureOfBusiness: '',
    businessType: '',
    yearsInBusiness: '',
    averageIncome: '',
    costOfGoods: '',
    rentForBusiness: '',
    salaries: '',
    transportForBusinessStock: '',
    customExpenses: [],
    businessDescription: '',
    background: product === 'majuu' ? 'Seek Funds to facilitate travel abroad for jobs' : '',
    proposedActivities: product === 'majuu' ? 'Travelling Abroad for Work' : '',
    totalMales: '',
    totalFemales: '',
    totalDisabledMales: '0',
    totalDisabledFemales: '0',
    mseaMemberCount: '',
    mseaPhones: '',
    mseaChairIds: '',
    mseaChairPhones: '',
    agency: '',
    agentNumber: '',
    termsSent: false,
    termsAccepted: false,
    guaranteeAccepted: false,
    membersConfirmed: false,
    correctInformationConfirm: false,
    liabilityConfirm: false,
    fundsEligibleConfirm: false,
    mseaStatus: 'unchecked',
    members: Array.from({ length: count }, emptyMember),
  };
}

export function validateDraft(draft: ApplicationDraft, files: StoredFile[]): string[] {
  const errors: string[] = [];
  if (draft.product !== 'core' && draft.product !== 'majuu') {
    errors.push('Choose a Uwezo Fund loan or Wezesha Majuu.');
  }
  if (!draft.groupName.trim()) errors.push('Group name is required.');
  if (!draft.registrationNumber.trim()) errors.push('Registration number is required.');
  if (!isLikelyKenyanMobile(draft.contactPhone)) {
    errors.push('Contact phone must be a Kenyan mobile number.');
  }
  const filled = draft.members.filter((member) => member.name.trim());
  const minimum = draft.product === 'majuu' ? 3 : 1;
  if (filled.length < minimum) {
    errors.push(
      draft.product === 'majuu'
        ? 'Wezesha Majuu needs at least 3 named members.'
        : 'Add at least one member.',
    );
  }
  const ids = new Set<string>();
  filled.forEach((member, index) => {
    const id = member.nationalId.trim();
    if (!/^\d{6,9}$/.test(id)) errors.push(`Member ${index + 1} needs a national ID.`);
    else if (ids.has(id)) errors.push(`National ID ${id} is repeated.`);
    else ids.add(id);
  });
  if (!draft.county.trim() || !draft.constituency.trim() || !draft.ward.trim()) {
    errors.push('County, constituency, and ward are required.');
  }
  filled.forEach((member, index) => {
    if (draft.product === 'core' && !member.gender) errors.push(`Member ${index + 1} needs a gender.`);
    if (draft.product === 'core' && !member.position.trim()) errors.push(`Member ${index + 1} needs a position.`);
  });
  if (draft.product === 'core') {
    const amount = Number(draft.loanAmount);
    const months = Number(draft.repaymentPeriod);
    if (draft.loanType === 'Endeleza' && (amount < 75000 || amount > 500000)) {
      errors.push('An Endeleza loan is from 75,000 to 500,000.');
    }
    if (draft.loanType !== 'Endeleza' && (amount < 50000 || amount > 100000)) {
      errors.push('A Wezesha loan is from 50,000 to 100,000.');
    }
    if (!(months >= 1 && months <= 24)) errors.push('Repayment period must be from 1 to 24 months.');
    if (!draft.institutionType || !draft.bankName.trim() || !draft.bankBranch.trim() || !draft.bankAccount.trim()) {
      errors.push('Choose a bank or SACCO and enter the branch and account.');
    }
    if (!draft.natureOfBusiness.trim() || !draft.businessType.trim()) {
      errors.push('Nature of business and business type are required.');
    }
    if (
      !draft.costOfGoods.trim() ||
      !draft.rentForBusiness.trim() ||
      !draft.salaries.trim() ||
      !draft.transportForBusinessStock.trim()
    ) {
      errors.push('Cost of goods, rent, salaries, and transport are required.');
    }
    if (!draft.meetingPoint.trim() || !draft.nearestLandmark.trim() || !draft.groupPurpose.trim() || !draft.groupActivities.trim()) {
      errors.push('Meeting point, nearest landmark, purpose, and key activities are required.');
    }
    if (!draft.membersConfirmed || !draft.correctInformationConfirm || !draft.liabilityConfirm || !draft.fundsEligibleConfirm) {
      errors.push('All four group declarations are required.');
    }
    filled.forEach((_, index) => {
      const hasPhoto = files.some((file) => file.slot === 'photoOfId' && file.memberIndex === index);
      if (!hasPhoto) errors.push(`Member ${index + 1} needs a photo of their national ID.`);
    });
  }
  if (draft.product === 'majuu') {
    const total = filled.reduce((sum, member) => sum + Number(member.loanAmount || 0), 0);
    filled.forEach((member, index) => {
      const amount = Number(member.loanAmount || 0);
      if (!(amount > 0) || amount > 166666) {
        errors.push(`Member ${index + 1} loan must be from 1 to 166,666.`);
      }
    });
    if (total > 500000) errors.push('The group total cannot exceed 500,000.');
    if (!draft.termsAccepted) errors.push('Accept the terms and conditions.');
    if (!draft.guaranteeAccepted) errors.push('Accept the repayment commitment.');
    if (!draft.bankName.trim() || !draft.bankBranch.trim() || !draft.bankAccountName.trim() || !draft.bankAccount.trim()) {
      errors.push('Bank, branch, account name, and account number are required.');
    }
    filled.forEach((member, index) => {
      if (!member.email.trim() || !member.email.includes('@')) errors.push(`Member ${index + 1} needs an email address.`);
      if (member.passportNo.trim().length < 2) errors.push(`Member ${index + 1} needs a passport number.`);
      if (member.purpose.trim().length < 2) errors.push(`Member ${index + 1} needs a purpose.`);
      if (!member.phone.trim()) errors.push(`Member ${index + 1} needs a mobile number.`);
    });
    const males = Number(draft.totalMales || 0);
    const females = Number(draft.totalFemales || 0);
    const membership = males + females + Number(draft.totalDisabledMales || 0) + Number(draft.totalDisabledFemales || 0);
    const target = Number(draft.mseaMemberCount || 0);
    if (target > 0 && target < 3) {
      errors.push('Group has fewer than 3 registered members. Loan application cannot proceed.');
    } else if (target >= 3 && membership !== target) {
      errors.push(`Males, females, and PWD counts must add up to ${target} registered members.`);
    } else if (target === 0 && males + females < 3) {
      errors.push('Total members are males plus females, and the group must have at least 3.');
    }
    if (draft.background.trim().length < 10 || draft.proposedActivities.trim().length < 10) {
      errors.push('Purpose and proposed activities must each be at least 10 characters.');
    }
    if (!draft.clusterCategory) errors.push('Cluster category is required.');
    if (draft.clusterCategory === 'geographical' && !draft.geoLocationType) {
      errors.push('Choose whether the cluster is a county or a constituency.');
    }
    if (draft.clusterCategory === 'agency' && (!draft.agentNumber.trim() || !draft.localAgentName.trim())) {
      errors.push('Agent number and local agent name are required for an agency cluster.');
    }
    if (draft.clusterCategory === 'geographical' && draft.geoLocationType === 'county' && !draft.clusterCounty.trim()) {
      errors.push('Cluster county is required.');
    }
    if (draft.clusterCategory === 'geographical' && draft.geoLocationType === 'constituency' && !draft.clusterConstituency.trim()) {
      errors.push('Cluster constituency is required.');
    }
    if (draft.clusterCategory === 'destination' && (!draft.destinationRegion.trim() || !draft.destinationCountry.trim())) {
      errors.push('Destination region and country are required.');
    }
    if (draft.clusterCategory === 'other' && !draft.clusterOther.trim()) {
      errors.push('Describe the other cluster category.');
    }
    const chairs = draft.mseaChairIds
      .split(',')
      .map((id) => id.replace(/\D/g, ''))
      .filter(Boolean);
    const chairPhones = draft.mseaChairPhones
      .split(',')
      .map((phone) => phone.trim())
      .filter(Boolean);
    if (
      (chairs.length || chairPhones.length) &&
      !filled.some(
        (member) =>
          chairs.includes(member.nationalId.replace(/\D/g, '')) ||
          chairPhones.some((phone) => sameKenyanLine(phone, member.phone)),
      )
    ) {
      errors.push(
        'Only the group chair listed on the MSEA registration can complete the group application on behalf of members.',
      );
    }
    draft.members.forEach((member, index) => {
      if (!member.name.trim()) return;
      MAJUU_MEMBER_FILE_SLOTS.forEach((slot) => {
        const hasFile = files.some((file) => file.slot === slot.slot && file.memberIndex === index);
        if (!hasFile) errors.push(`${member.name}: ${slot.label} is required.`);
      });
    });
  }
  if (!draft.membersConfirmed) errors.push('Confirm the member list before saving.');
  const present = new Set(files.map((file) => file.slot));
  fileSlots(draft.product)
    .filter((slot) => slot.required)
    .forEach((slot) => {
      if (!present.has(slot.slot)) errors.push(`${slot.label} is required.`);
    });
  return errors;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('byStatus', 'status');
        store.createIndex('byProduct', 'product');
      }
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

export async function deletePacket(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
  db.close();
}

export async function savePacket(packet: OfflinePacket): Promise<OfflinePacket> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(packet);
  await txDone(tx);
  db.close();
  return packet;
}

export async function listPackets(): Promise<OfflinePacket[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const request = tx.objectStore(STORE).getAll();
  const rows = await new Promise<OfflinePacket[]>((resolve, reject) => {
    request.onsuccess = () => resolve((request.result as OfflinePacket[]) || []);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createPacket(
  draft: ApplicationDraft,
  files: StoredFile[],
  existingId = '',
): Promise<OfflinePacket> {
  const packet: OfflinePacket = {
    id: existingId || newId(),
    product: draft.product,
    createdAt: new Date().toISOString(),
    status: 'pending',
    payload: {
      ...draft,
      proposedNumber: draft.proposedNumber || assignApplicationNumber(draft.product),
      contactPhone: normalizeKenyanPhone(draft.contactPhone),
      members: draft.members
        .filter((member) => member.name.trim())
        .map((member) => ({
          ...member,
          name: member.name.trim(),
          nationalId: member.nationalId.trim(),
          phone: member.phone ? normalizeKenyanPhone(member.phone) : '',
          jobPlacement: member.jobPlacement.trim(),
        })),
    },
    files,
    lastError: '',
  };
  return savePacket(packet);
}

/** Send one packet only to the portal that owns it. A repeat uses the same id. */
export async function pushPacket(packet: OfflinePacket): Promise<OfflinePacket> {
  const origin = PRODUCT_ORIGIN[packet.product];
  const online = await probeOrigin(origin);
  if (!online) {
    const waiting: OfflinePacket = {
      ...packet,
      status: 'pending',
      lastError: `${origin} is unreachable. Kept on this phone.`,
    };
    await savePacket(waiting);
    return waiting;
  }

  const body = new FormData();
  body.set('schemaVersion', String(packet.payload.schemaVersion || 1));
  body.set('product', packet.product);
  body.set('proposedNumber', packet.payload.proposedNumber);
  body.set('payload', JSON.stringify(packet.payload));
  for (const file of packet.files) {
    const field = file.memberIndex === undefined ? `file:${file.slot}` : `file:${file.slot}:${file.memberIndex}`;
    body.set(
      field,
      new Blob([file.buffer], { type: file.type || 'application/octet-stream' }),
      file.name || file.slot,
    );
  }

  try {
    const response = await fetch(`${origin}/api/sync/applications`, {
      method: 'POST',
      body,
      headers: { 'Idempotency-Key': packet.id },
    });
    const data = (await response.json().catch(() => ({}))) as {
      errors?: string[];
      message?: string;
      applicationId?: string;
      acknowledgementNumber?: string;
    };
    if (response.status === 404) {
      const waiting: OfflinePacket = {
        ...packet,
        status: 'pending',
        lastError: 'Saved on this phone. The portal does not have /api/sync/applications yet.',
      };
      await savePacket(waiting);
      return waiting;
    }
    if (!response.ok) {
      const failed: OfflinePacket = {
        ...packet,
        status: 'pending',
        lastError: data.errors?.join(' ') || data.message || `Portal returned ${response.status}.`,
      };
      await savePacket(failed);
      return failed;
    }
    const synced: OfflinePacket = {
      ...packet,
      status: 'synced',
      applicationId: data.applicationId || '',
      acknowledgementNumber: data.acknowledgementNumber || '',
      syncedAt: new Date().toISOString(),
      lastError: '',
    };
    await savePacket(synced);
    return synced;
  } catch (error) {
    const waiting: OfflinePacket = {
      ...packet,
      status: 'pending',
      lastError: error instanceof Error ? error.message : 'Could not reach the portal. Kept on this phone.',
    };
    await savePacket(waiting);
    return waiting;
  }
}

export async function syncPending(): Promise<OfflinePacket[]> {
  const packets = await listPackets();
  const pending = packets.filter((packet) => packet.status !== 'synced');
  const results: OfflinePacket[] = [];
  for (const packet of pending) results.push(await pushPacket(packet));
  return results;
}
