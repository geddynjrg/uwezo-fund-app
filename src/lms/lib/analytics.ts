import { listLmsTable, loadLmsMeta } from '../../lib/lmsLocalDb';

export type MoneyStat = {
  label: string;
  value: number;
  color: 'info' | 'success' | 'warning' | 'danger' | 'primary';
  subLabel: string;
  percentage?: number;
  hasProgress?: boolean;
};

export type RiskMlDisplay = {
  riskLevel: string;
  riskBand: string;
  mlScore: string;
  mlBand: string;
  source: 'synced' | 'scored' | 'none';
  disclaimer: string;
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Drop empty / literal "null" / bare "#123" style placeholders. */
export function cleanLabel(value: unknown): string {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text || /^null$/i.test(text) || /^undefined$/i.test(text) || /^—$/.test(text)) return '';
  if (/^#?\d+$/.test(text)) return '';
  if (/^group\s*#/i.test(text)) return '';
  return text;
}

/**
 * Prefer master group name, then synced temp-application name fields.
 * Avoid literal null / "Group #id" when a real name exists on the app row.
 */
export function resolveGroupLabel(
  app: Record<string, unknown>,
  group?: Record<string, unknown> | null,
): string {
  const fromGroup = cleanLabel(group?.name);
  if (fromGroup) return fromGroup;
  const candidates = [
    app.group_name,
    app.business_name,
    app.nature_of_business,
    app.proposed_business_name,
    app.group_code,
    group?.code,
    app.reg_number,
    group?.reg_number,
  ];
  for (const candidate of candidates) {
    const label = cleanLabel(candidate);
    if (label) return label;
  }
  return 'Unnamed group';
}

/** Officer profile / LMS meta name beats a raw numeric constituency id. */
export function resolveConstituencyLabel(
  constituencyProp: string | undefined | null,
  metaName?: string | null,
  wards?: Record<string, unknown>[],
): string {
  const fromMeta = cleanLabel(metaName);
  if (fromMeta) return fromMeta;
  const fromProp = cleanLabel(constituencyProp);
  if (fromProp) return fromProp;
  if (wards?.length) {
    for (const ward of wards) {
      const name = cleanLabel(ward.constituency_name || ward.constituencyName);
      if (name) return name;
    }
  }
  return 'Constituency';
}

function parseAssessment(raw: unknown): Record<string, unknown> | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/** Pull risk band + ML/TU-like score from synced temp-application fields or a live score payload. */
export function extractRiskMlDisplay(
  app: Record<string, unknown>,
  scoredPayload?: Record<string, unknown> | null,
): RiskMlDisplay {
  const empty: RiskMlDisplay = {
    riskLevel: '—',
    riskBand: '—',
    mlScore: '—',
    mlBand: '—',
    source: 'none',
    disclaimer: 'Advisory score — not a CRB report',
  };
  const assessment = parseAssessment(app.assessment_data) || {};
  const intakeFromSync =
    (assessment.ml_intake as Record<string, unknown> | undefined) ||
    (assessment.intake as Record<string, unknown> | undefined) ||
    null;
  const intakeFromScore =
    scoredPayload && typeof scoredPayload.intake === 'object' && scoredPayload.intake
      ? (scoredPayload.intake as Record<string, unknown>)
      : null;
  const intake = intakeFromScore || intakeFromSync;
  const riskLevel =
    cleanLabel(app.risk_level) ||
    cleanLabel(assessment.overall_category) ||
    cleanLabel(intake?.risk_band) ||
    '';
  const riskBand =
    cleanLabel(intake?.risk_band) ||
    (riskLevel ? riskLevel.replace(/\s*risk$/i, '').trim() : '') ||
    '';
  const mlScoreRaw = intake?.tu_like_score ?? intake?.ml_score ?? assessment.tu_like_score;
  const mlScore =
    mlScoreRaw != null && mlScoreRaw !== '' && Number.isFinite(Number(mlScoreRaw))
      ? String(Math.round(Number(mlScoreRaw)))
      : '';
  const mlBand = cleanLabel(intake?.tu_like_band) || cleanLabel(intake?.risk_band) || '';
  if (!riskLevel && !mlScore) return empty;
  return {
    riskLevel: riskLevel || (riskBand ? `${riskBand} Risk` : '—'),
    riskBand: riskBand || '—',
    mlScore: mlScore || '—',
    mlBand: mlBand || '—',
    source: intakeFromScore
      ? 'scored'
      : intakeFromSync || cleanLabel(app.risk_level)
        ? 'synced'
        : 'none',
    disclaimer: cleanLabel(assessment.ml_disclaimer) || cleanLabel(intake?.disclaimer) || empty.disclaimer,
  };
}

/** Final constituency decisions — hide approve/reject/return/review actions. */
export function isDecisionLocked(status: unknown): boolean {
  const s = String(status || '').toLowerCase();
  return /approv|disburs|issued|pending_submission_to_hq|pending_hq|submitted_to_hq|hq_approved/.test(s);
}

export async function loadConstituencyBundle(email: string) {
  const meta = await loadLmsMeta(email);
  if (!meta || meta.email !== email.trim().toLowerCase()) {
    return {
      meta: null,
      groups: [] as Record<string, unknown>[],
      wards: [] as Record<string, unknown>[],
      loans: [] as Record<string, unknown>[],
      receipts: [] as Record<string, unknown>[],
      members: [] as Record<string, unknown>[],
      links: [] as Record<string, unknown>[],
      phases: [] as Record<string, unknown>[],
      apps: [] as Record<string, unknown>[],
    };
  }
  const [groups, wards, loans, receipts, members, links, phases, apps] = await Promise.all([
    listLmsTable('groups', 20000, email),
    listLmsTable('wards', 5000, email),
    listLmsTable('group_loans', 20000, email),
    listLmsTable('loan_receipts', 20000, email),
    listLmsTable('members', 20000, email),
    listLmsTable('group_members', 20000, email),
    listLmsTable('loan_phases', 5000, email),
    listLmsTable('phase_applications', 20000, email),
  ]);
  return { meta, groups, wards, loans, receipts, members, links, phases, apps };
}

export function loanTotals(loans: Record<string, unknown>[]) {
  let applied = 0;
  let approved = 0;
  let issued = 0;
  let repaid = 0;
  let arrears = 0;
  let due = 0;
  for (const loan of loans) {
    applied += num(loan.amount_applied);
    approved += num(loan.amount_approved);
    issued += num(loan.amount_issued);
    repaid += num(loan.amount_repaid);
    arrears += num(loan.total_arrears);
    due += num(loan.amount_due);
  }
  const collectionEfficiency = due > 0 ? Math.min(100, Math.round((repaid / due) * 1000) / 10) : repaid > 0 ? 100 : 0;
  const parRate = issued > 0 ? Math.min(100, Math.round((arrears / issued) * 1000) / 10) : 0;
  const recoveryRate = issued > 0 ? Math.min(100, Math.round((repaid / issued) * 1000) / 10) : 0;
  return { applied, approved, issued, repaid, arrears, due, collectionEfficiency, parRate, recoveryRate };
}

export function groupDemographics(groups: Record<string, unknown>[], loans: Record<string, unknown>[]) {
  const byGroup = new Map(loans.map((loan) => [String(loan.group_id), loan]));
  const buckets: Record<string, { count: number; amount: number }> = {
    Women: { count: 0, amount: 0 },
    Youth: { count: 0, amount: 0 },
    PWDs: { count: 0, amount: 0 },
    Other: { count: 0, amount: 0 },
  };
  for (const group of groups) {
    const raw = String(group.category || group.loan_type || '').toLowerCase();
    let key = 'Other';
    if (/women|woman/.test(raw)) key = 'Women';
    else if (/youth/.test(raw)) key = 'Youth';
    else if (/pwd|disab/.test(raw)) key = 'PWDs';
    buckets[key].count += 1;
    const loan = byGroup.get(String(group.id));
    buckets[key].amount += num(loan?.amount_issued ?? loan?.amount_approved);
  }
  const totalAmount = Object.values(buckets).reduce((sum, row) => sum + row.amount, 0) || 1;
  return [
    { label: 'Total Groups', val: groups.length, icon: 'fa-users', color: 'primary' as const, cat: false, percentage: 0, amount: null as number | null },
    { label: 'Women Groups', val: buckets.Women.count, icon: 'fa-female', color: 'info' as const, cat: true, percentage: Math.round((buckets.Women.amount / totalAmount) * 100), amount: buckets.Women.amount },
    { label: 'Youth Groups', val: buckets.Youth.count, icon: 'fa-user-graduate', color: 'success' as const, cat: true, percentage: Math.round((buckets.Youth.amount / totalAmount) * 100), amount: buckets.Youth.amount },
    { label: 'PWD Groups', val: buckets.PWDs.count, icon: 'fa-wheelchair', color: 'warning' as const, cat: true, percentage: Math.round((buckets.PWDs.amount / totalAmount) * 100), amount: buckets.PWDs.amount },
  ];
}

export type EnrichedGroup = Record<string, unknown> & {
  ward_name: string;
  gfs_code: string;
  category: unknown;
  sector: unknown;
  loan?: Record<string, unknown>;
};

export function enrichGroups(
  groups: Record<string, unknown>[],
  wards: Record<string, unknown>[],
  loans: Record<string, unknown>[],
): EnrichedGroup[] {
  const wardById = new Map(wards.map((ward) => [String(ward.id), ward]));
  const loanByGroup = new Map<string, Record<string, unknown>>();
  for (const loan of loans) {
    const gid = String(loan.group_id ?? '');
    if (!gid) continue;
    const prev = loanByGroup.get(gid);
    if (!prev || num(loan.id) > num(prev.id)) loanByGroup.set(gid, loan);
  }
  return groups.map((group) => {
    const ward = wardById.get(String(group.ward_id ?? ''));
    const loan = loanByGroup.get(String(group.id));
    return {
      ...group,
      ward_name: String(ward?.ward_name || '—'),
      gfs_code: String(loan?.gfs_code || '—'),
      category: group.category || loan?.category || '—',
      sector: loan?.sector || loan?.sector_desc || '—',
      loan,
    };
  });
}

export function dashboardKpis(loans: Record<string, unknown>[]) {
  const t = loanTotals(loans);
  return [
    { title: 'Amount applied', val: t.applied, desc: 'All group loans', color: 'info', icon: 'fa-file-invoice', prog: 100 },
    { title: 'Amount approved', val: t.approved, desc: 'Approved capital', color: 'primary', icon: 'fa-check-circle', prog: t.applied ? Math.min(100, (t.approved / t.applied) * 100) : 0 },
    { title: 'Amount issued', val: t.issued, desc: 'Disbursed', color: 'warning', icon: 'fa-hand-holding-usd', prog: t.approved ? Math.min(100, (t.issued / t.approved) * 100) : 0 },
    { title: 'Amount repaid', val: t.repaid, desc: 'Collections', color: 'success', icon: 'fa-coins', prog: t.issued ? Math.min(100, (t.repaid / t.issued) * 100) : 0 },
  ];
}

export function wardPerformance(wards: Record<string, unknown>[], groups: Record<string, unknown>[], loans: Record<string, unknown>[]) {
  const groupsByWard = new Map<string, Record<string, unknown>[]>();
  for (const group of groups) {
    const wid = String(group.ward_id ?? '');
    const list = groupsByWard.get(wid) || [];
    list.push(group);
    groupsByWard.set(wid, list);
  }
  const loanByGroup = new Map(loans.map((loan) => [String(loan.group_id), loan]));
  return wards.map((ward) => {
    const list = groupsByWard.get(String(ward.id)) || [];
    let issued = 0;
    let repaid = 0;
    for (const group of list) {
      const loan = loanByGroup.get(String(group.id));
      issued += num(loan?.amount_issued);
      repaid += num(loan?.amount_repaid);
    }
    const recovery = issued > 0 ? Math.round((repaid / issued) * 1000) / 10 : 0;
    return {
      name: String(ward.ward_name || ward.id),
      metric: 'Recovery',
      value: `${recovery}%`,
      secondary: `${list.length} groups · KES ${issued.toLocaleString()}`,
      tone: recovery >= 70 ? 'success' : recovery >= 40 ? 'warning' : 'danger',
    };
  });
}

export function moneyKes(value: number): string {
  return `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}
