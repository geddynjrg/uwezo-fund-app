import { useEffect, useMemo, useRef, useState } from 'react';
import {
  approveApplicationOffline,
  assignApplicationPhaseOffline,
  linkApplicationOffline,
  rejectApplicationOffline,
  removeApplicationPhaseOffline,
  returnApplicationOffline,
  reviewApplicationOffline,
  scoreApplicationOnline,
  unlinkApplicationOffline,
} from '../../../lib/lmsOfflineSync';
import {
  enrichGroups,
  extractRiskMlDisplay,
  isDecisionLocked,
  loadConstituencyBundle,
  moneyKes,
  resolveConstituencyLabel,
  resolveGroupLabel,
  type EnrichedGroup,
  type RiskMlDisplay,
} from '../../lib/analytics';
import { matchesSearch } from '../../lib/localQuery';
import { PageHeader } from '../../shell/PageHeader';
import type { LmsPageProps } from '../../types';

type Mode = 'all' | 'tasks' | 'loans';
type ReviewPanel = 'details' | 'approve' | 'reject' | 'link' | 'return' | 'review' | 'phase';
type DetailTab = 'overview' | 'finance' | 'group';

function scoreGroupMatch(needle: string, group: EnrichedGroup): number {
  const hay = `${group.name || ''} ${group.code || ''} ${group.reg_number || ''} ${group.identifier || ''}`.toLowerCase();
  const parts = needle
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length > 2);
  if (!parts.length) return 0;
  let score = 0;
  for (const part of parts) {
    if (hay.includes(part)) score += part.length;
  }
  return score;
}

function statusChipClass(status: string): string {
  const s = status.toLowerCase();
  if (/reject|cancel|void|declin/.test(s)) return 'lms-status-chip lms-status-chip--danger';
  if (/approv|disburs|complete|posted|active|issued/.test(s)) return 'lms-status-chip lms-status-chip--ok';
  if (/pending|review|new|submitted|task|draft/.test(s)) return 'lms-status-chip lms-status-chip--warn';
  return 'lms-status-chip lms-status-chip--info';
}

function workflowSteps(row: Record<string, unknown>) {
  const status = String(row.display_status || '').toLowerCase();
  const hasPhase = Boolean(row.loan_phase_id || row.phase_label);
  const linked = Boolean(row.group_id);
  const decided = /approv|reject|disburs|issued/.test(status);
  return [
    { label: 'Submitted', status: 'done' as const },
    { label: 'Phase', status: hasPhase ? ('done' as const) : ('active' as const) },
    {
      label: 'Verify',
      status: !hasPhase ? ('locked' as const) : linked ? ('done' as const) : ('active' as const),
    },
    {
      label: 'Decision',
      status: !hasPhase || !linked ? ('locked' as const) : decided ? ('done' as const) : ('active' as const),
    },
  ];
}

function nextAction(row: Record<string, unknown>): { tone: string; message: string; cta?: ReviewPanel } {
  const status = String(row.display_status || '').toLowerCase();
  if (/defer|returned/.test(status)) {
    return { tone: 'warning', message: 'Returned to the group for correction. Waiting for resubmission.' };
  }
  if (/reject/.test(status)) {
    return { tone: 'muted', message: 'Application was rejected at constituency. You can review the decision to reopen it.', cta: 'review' };
  }
  if (isDecisionLocked(status)) {
    return {
      tone: 'success',
      message: `Decision recorded (${String(row.display_status)}). Further approve/reject actions are locked.`,
    };
  }
  if (!row.loan_phase_id && !row.phase_label) {
    return { tone: 'warning', message: 'Assign this application to a review phase before verification.', cta: 'phase' };
  }
  if (!row.group_id) {
    return { tone: 'info', message: 'Link a master group record, then approve, reject, or return to group.', cta: 'link' };
  }
  return { tone: 'success', message: 'Ready for final constituency decision.', cta: 'approve' };
}

function ApplicationsView({
  email,
  constituency,
  revision,
  mode,
  online,
  onNavigate,
  busy: parentBusy,
  setBusy,
  setNotice,
}: LmsPageProps & { mode: Mode }) {
  const [apps, setApps] = useState<Record<string, unknown>[]>([]);
  const [loans, setLoans] = useState<Record<string, unknown>[]>([]);
  const [phases, setPhases] = useState<Record<string, unknown>[]>([]);
  const [groups, setGroups] = useState<EnrichedGroup[]>([]);
  const [wards, setWards] = useState<Record<string, unknown>[]>([]);
  const [constituencyTitle, setConstituencyTitle] = useState(constituency || 'Constituency');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [panel, setPanel] = useState<ReviewPanel>('details');
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [amountApproved, setAmountApproved] = useState('');
  const [comments, setComments] = useState('');
  const [linkGroupId, setLinkGroupId] = useState('');
  const [rejectReason, setRejectReason] = useState('Does not meet criteria');
  const [rejectMessage, setRejectMessage] = useState('');
  const [returnComment, setReturnComment] = useState('');
  const [assignPhaseId, setAssignPhaseId] = useState('');
  const [matchQuery, setMatchQuery] = useState('');
  const [localBusy, setLocalBusy] = useState(false);
  const [localRevision, setLocalRevision] = useState(0);
  const [riskMl, setRiskMl] = useState<RiskMlDisplay | null>(null);
  const [scoreBusy, setScoreBusy] = useState(false);
  const scoredIdsRef = useRef<Set<number>>(new Set());
  const busy = parentBusy || localBusy;

  async function reload() {
    const bundle = await loadConstituencyBundle(email);
    setApps(bundle.apps);
    setLoans(bundle.loans);
    setPhases(bundle.phases);
    setWards(bundle.wards);
    setGroups(enrichGroups(bundle.groups, bundle.wards, bundle.loans));
    setConstituencyTitle(
      resolveConstituencyLabel(constituency, bundle.meta?.constituencyName, bundle.wards),
    );
  }

  useEffect(() => {
    void reload();
  }, [email, revision, localRevision, constituency]);

  const groupById = useMemo(() => new Map(groups.map((g) => [String(g.id), g])), [groups]);
  const phaseById = useMemo(() => new Map(phases.map((p) => [String(p.id), p])), [phases]);

  const title =
    mode === 'tasks'
      ? 'Approval Tasks'
      : mode === 'loans'
        ? 'Applied Loans'
        : `${constituencyTitle} Constituency`;
  const subtitle =
    mode === 'tasks' ? 'Pending constituency review queue.' : mode === 'loans' ? 'Applied loan register.' : 'Manage loan applications.';

  const appRows = useMemo(() => {
    let list = apps.map((app) => {
      const group = groupById.get(String(app.group_id)) || ({} as EnrichedGroup);
      const phase = phaseById.get(String(app.loan_phase_id)) || {};
      const created = String(app.created_at || app.submitted_at || app.application_date || '');
      return {
        ...app,
        application_id:
          app.application_number ||
          app.application_id ||
          app.app_id ||
          app.group_code ||
          (app.id != null ? String(app.id) : '—'),
        group_name: resolveGroupLabel(app, group),
        group_code: group.code || app.group_code || '',
        group_reg: group.reg_number || group.registration_number || app.reg_number || '',
        ward_name: group.ward_name || app.ward_name || '—',
        constituency_name: resolveConstituencyLabel(
          String(app.constituency_name || constituencyTitle || ''),
          constituencyTitle,
          wards,
        ),
        phase_label: phase.phase || phase.phase_ref || (app.loan_phase_id ? String(app.loan_phase_id) : ''),
        amount: Number(app.amount_applied || app.loan_amount || 0),
        display_status: app.status || app.vetting_status || '—',
        submitted_on: created ? created.slice(0, 16).replace('T', ' ') : '—',
      } as Record<string, unknown>;
    });
    if (mode === 'tasks') {
      list = list.filter((row) => /new|pending|submitted|review|task/i.test(String(row.display_status)));
    }
    return list;
  }, [apps, groupById, phaseById, mode, constituencyTitle, wards]);

  const loanRows = useMemo(
    () =>
      loans.map((loan) => {
        const group = groupById.get(String(loan.group_id)) || ({} as EnrichedGroup);
        return {
          ...loan,
          application_id: loan.id,
          group_name: resolveGroupLabel(loan, group),
          ward_name: group.ward_name || '—',
          phase_label: '',
          amount: Number(loan.amount_applied || 0),
          display_status: loan.loan_status || loan.status || '—',
          submitted_on: String(loan.application_date || '—'),
        } as Record<string, unknown>;
      }),
    [loans, groupById],
  );

  const rows = mode === 'loans' ? loanRows : appRows;
  const statuses = useMemo(
    () => [...new Set(rows.map((r) => String(r.display_status || '').trim()).filter(Boolean))].sort(),
    [rows],
  );

  const pendingPhases = useMemo(
    () => phases.filter((p) => /draft|pending|open|new/i.test(String(p.status || 'draft'))).length,
    [phases],
  );

  const demoKpis = useMemo(() => {
    const total = appRows.length;
    const approved = appRows.filter((r) => /approv/i.test(String(r.display_status))).length;
    const rejected = appRows.filter((r) => /reject/i.test(String(r.display_status))).length;
    const pending = appRows.filter((r) => /pending|new|review|submitted/i.test(String(r.display_status))).length;
    return [
      { label: 'Total Applications', value: total },
      { label: 'Pending Review', value: pending },
      { label: 'Approved', value: approved },
      { label: 'Rejected', value: rejected },
    ];
  }, [appRows]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter && String(row.display_status) !== statusFilter) return false;
      if (phaseFilter && String(row.loan_phase_id || row.phase_label) !== phaseFilter) return false;
      const day = String(row.submitted_on || row.created_at || '').slice(0, 10);
      if (dateFrom && day && day < dateFrom) return false;
      if (dateTo && day && day > dateTo) return false;
      return matchesSearch(row, query, [
        'id',
        'application_id',
        'group_name',
        'phase_label',
        'display_status',
        'gfs_code',
        'category',
        'ward_name',
      ]);
    });
  }, [rows, query, statusFilter, phaseFilter, dateFrom, dateTo]);

  function openReview(row: Record<string, unknown>) {
    setSelected(row);
    setPanel('details');
    setDetailTab('overview');
    setAmountApproved(String(row.amount_approved || row.amount || row.amount_applied || ''));
    setComments(String(row.comments || ''));
    setLinkGroupId(String(row.group_id || ''));
    setRejectReason('Does not meet criteria');
    setRejectMessage('');
    setReturnComment('');
    setAssignPhaseId(String(row.loan_phase_id || ''));
    setMatchQuery(String(row.group_name || row.group_code || '').trim());
    setRiskMl(extractRiskMlDisplay(row));
  }

  function closeReview() {
    setSelected(null);
    setPanel('details');
    setRiskMl(null);
    setScoreBusy(false);
  }

  useEffect(() => {
    if (!selected || mode === 'loans') return;
    const phaseId = Number(selected.id);
    if (!phaseId || !Number.isFinite(phaseId)) return;
    const existing = extractRiskMlDisplay(selected);
    setRiskMl(existing);
    // Prefer synced ML fields; only call repay-ml when the numeric ML score is missing.
    if (existing.mlScore !== '—' || online !== true || scoredIdsRef.current.has(phaseId)) return;
    const applicationId = String(selected.application_number || selected.application_id || '').trim();
    let cancelled = false;
    scoredIdsRef.current.add(phaseId);
    setScoreBusy(true);
    void scoreApplicationOnline({
      email,
      id: phaseId,
      application_id: applicationId && !/^\d+$/.test(applicationId) ? applicationId : undefined,
    }).then((result) => {
      if (cancelled) return;
      setScoreBusy(false);
      if (result.ok && (result.score || result.risk_level || result.assessment_data)) {
        setSelected((prev) => {
          if (!prev || Number(prev.id) !== phaseId) return prev;
          const nextRow = {
            ...prev,
            ...(result.risk_level != null ? { risk_level: result.risk_level } : {}),
            ...(result.assessment_data !== undefined ? { assessment_data: result.assessment_data } : {}),
          };
          setRiskMl(extractRiskMlDisplay(nextRow, result.score || null));
          return nextRow;
        });
        setApps((prev) =>
          prev.map((row) =>
            Number(row.id) === phaseId
              ? {
                  ...row,
                  ...(result.risk_level != null ? { risk_level: result.risk_level } : {}),
                  ...(result.assessment_data !== undefined ? { assessment_data: result.assessment_data } : {}),
                }
              : row,
          ),
        );
      } else {
        scoredIdsRef.current.delete(phaseId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, mode, online, email]);

  async function runApprove() {
    if (!selected || mode === 'loans') return;
    setLocalBusy(true);
    setBusy(true);
    const result = await approveApplicationOffline({
      email,
      id: Number(selected.id),
      amount_approved: amountApproved ? Number(amountApproved) : undefined,
      comments: comments.trim() || undefined,
      group_id: linkGroupId ? Number(linkGroupId) : undefined,
    });
    setLocalBusy(false);
    setBusy(false);
    setNotice(result.detail);
    if (result.ok) {
      closeReview();
      setLocalRevision((n) => n + 1);
    }
  }

  async function runReject() {
    if (!selected || mode === 'loans') return;
    if (!rejectReason.trim() || rejectMessage.trim().length < 10) {
      setNotice('Rejection needs a reason and a message of at least 10 characters.');
      return;
    }
    setLocalBusy(true);
    setBusy(true);
    const result = await rejectApplicationOffline({
      email,
      id: Number(selected.id),
      rejection_reason: rejectReason.trim(),
      rejection_message: rejectMessage.trim(),
    });
    setLocalBusy(false);
    setBusy(false);
    setNotice(result.detail);
    if (result.ok) {
      closeReview();
      setLocalRevision((n) => n + 1);
    }
  }

  async function runLink() {
    if (!selected || mode === 'loans') return;
    if (!linkGroupId) {
      setNotice('Select a group to link.');
      return;
    }
    setLocalBusy(true);
    setBusy(true);
    const result = await linkApplicationOffline({
      email,
      id: Number(selected.id),
      group_id: Number(linkGroupId),
    });
    setLocalBusy(false);
    setBusy(false);
    setNotice(result.detail);
    if (result.ok) {
      closeReview();
      setLocalRevision((n) => n + 1);
    }
  }

  const suggestedGroups = useMemo(() => {
    if (!selected) return groups;
    const needle = matchQuery || String(selected.group_name || selected.group_code || '');
    const ranked = groups
      .map((group) => ({ group, score: scoreGroupMatch(needle, group) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.group);
    if (ranked.length) return ranked.slice(0, 25);
    return groups.slice(0, 40);
  }, [groups, selected, matchQuery]);

  const openPhases = useMemo(
    () => phases.filter((p) => !/submitted|hq_approved|disbursed|closed|reject/i.test(String(p.status || 'draft'))),
    [phases],
  );

  async function runAssignPhase() {
    if (!selected || mode === 'loans') return;
    if (!assignPhaseId) {
      setNotice('Select a review phase to assign.');
      return;
    }
    setLocalBusy(true);
    setBusy(true);
    const result = await assignApplicationPhaseOffline({
      email,
      id: Number(selected.id),
      loan_phase_id: Number(assignPhaseId),
    });
    setLocalBusy(false);
    setBusy(false);
    setNotice(result.detail);
    if (result.ok) {
      closeReview();
      setLocalRevision((n) => n + 1);
    }
  }

  async function runRemovePhase() {
    if (!selected || mode === 'loans') return;
    setLocalBusy(true);
    setBusy(true);
    const result = await removeApplicationPhaseOffline({
      email,
      id: Number(selected.id),
    });
    setLocalBusy(false);
    setBusy(false);
    setNotice(result.detail);
    if (result.ok) {
      closeReview();
      setLocalRevision((n) => n + 1);
    }
  }

  async function runUnlink() {
    if (!selected || mode === 'loans') return;
    setLocalBusy(true);
    setBusy(true);
    const result = await unlinkApplicationOffline({
      email,
      id: Number(selected.id),
    });
    setLocalBusy(false);
    setBusy(false);
    setNotice(result.detail);
    if (result.ok) {
      closeReview();
      setLocalRevision((n) => n + 1);
    }
  }

  async function runReturn() {
    if (!selected || mode === 'loans') return;
    if (returnComment.trim().length < 20) {
      setNotice('Tell the group what to correct (at least 20 characters).');
      return;
    }
    setLocalBusy(true);
    setBusy(true);
    const result = await returnApplicationOffline({
      email,
      id: Number(selected.id),
      comment: returnComment.trim(),
    });
    setLocalBusy(false);
    setBusy(false);
    setNotice(result.detail);
    if (result.ok) {
      closeReview();
      setLocalRevision((n) => n + 1);
    }
  }

  async function runReview() {
    if (!selected || mode === 'loans') return;
    setLocalBusy(true);
    setBusy(true);
    const result = await reviewApplicationOffline({
      email,
      id: Number(selected.id),
    });
    setLocalBusy(false);
    setBusy(false);
    setNotice(result.detail);
    if (result.ok) {
      closeReview();
      setLocalRevision((n) => n + 1);
    }
  }

  function resetFilters() {
    setQuery('');
    setStatusFilter('');
    setPhaseFilter('');
    setDateFrom('');
    setDateTo('');
  }

  if (selected && mode !== 'loans') {
    const steps = workflowSteps(selected);
    const next = nextAction(selected);
    const decided = isDecisionLocked(selected.display_status);
    const riskView = riskMl || extractRiskMlDisplay(selected);
    const decisionPanel = panel === 'approve' || panel === 'reject' || panel === 'return' || panel === 'review';
    const activePanel = decided && decisionPanel ? 'details' : panel;
    return (
      <div className="app-review-v2-shell">
        <div className="lms-card" style={{ borderRadius: 12, marginBottom: '0.75rem' }}>
          <div className="lms-card__body">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>{String(selected.application_id)}</h2>
                  <span className={statusChipClass(String(selected.display_status))}>{String(selected.display_status)}</span>
                </div>
                <div className="lms-muted" style={{ marginTop: '0.45rem' }}>
                  <span style={{ marginRight: '0.85rem' }}>Phase: {String(selected.phase_label || 'Not assigned')}</span>
                  <span style={{ marginRight: '0.85rem' }}>{String(selected.group_name)}</span>
                  <span style={{ marginRight: '0.85rem' }}>{moneyKes(Number(selected.amount || 0))}</span>
                  <span>{String(selected.submitted_on)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn-refresh-premium btn-sm" onClick={() => void reload()}>
                  Refresh
                </button>
                <button type="button" className="btn-refresh-premium btn-sm" onClick={closeReview}>
                  Back to list
                </button>
              </div>
            </div>
          </div>
        </div>

        <ul className="app-review-stepper">
          {steps.map((step) => (
            <li key={step.label} className={`step-item ${step.status}`}>
              <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.04em' }}>
                {step.label}
              </div>
              <div className="lms-muted" style={{ marginTop: '0.25rem' }}>
                {step.status === 'done' ? 'Complete' : step.status === 'active' ? 'Current step' : 'Pending'}
              </div>
            </li>
          ))}
        </ul>

        <div className={`app-review-next-banner tone-${next.tone}`}>
          <span>{next.message}</span>
          {next.cta ? (
            <button type="button" className="btn-primary btn-sm" onClick={() => setPanel(next.cta!)}>
              {next.cta === 'approve'
                ? 'Approve'
                : next.cta === 'link'
                  ? 'Link group'
                  : next.cta === 'phase'
                    ? 'Assign phase'
                    : next.cta === 'return'
                      ? 'Return to group'
                      : next.cta === 'review'
                        ? 'Review decision'
                        : 'Review'}
            </button>
          ) : null}
        </div>

        <div className="app-review-layout">
          <div>
            <div className="app-review-tabs">
              {(
                [
                  ['overview', 'All details'],
                  ['finance', 'Loan'],
                  ['group', 'Group'],
                ] as const
              ).map(([key, label]) => (
                <button key={key} type="button" className={detailTab === key ? 'active' : ''} onClick={() => setDetailTab(key)}>
                  {label}
                </button>
              ))}
            </div>

            <section className="lms-card" style={{ borderRadius: 12 }}>
              <div className="lms-card__body">
                {detailTab === 'overview' ? (
                  <ul className="lms-kv">
                    <li>
                      <b>Application</b>
                      <span>{String(selected.application_id)}</span>
                    </li>
                    <li>
                      <b>Group</b>
                      <span>{String(selected.group_name)}</span>
                    </li>
                    <li>
                      <b>Constituency</b>
                      <span>{String(selected.constituency_name || constituencyTitle)}</span>
                    </li>
                    <li>
                      <b>Ward</b>
                      <span>{String(selected.ward_name || '—')}</span>
                    </li>
                    <li>
                      <b>Phase</b>
                      <span>{String(selected.phase_label || 'Not assigned')}</span>
                    </li>
                    <li>
                      <b>Status</b>
                      <span>{String(selected.display_status)}</span>
                    </li>
                    <li>
                      <b>Risk score</b>
                      <span>
                        {scoreBusy && riskView.riskLevel === '—'
                          ? 'Scoring…'
                          : riskView.riskLevel}
                        {riskView.riskBand !== '—' && riskView.riskBand !== riskView.riskLevel
                          ? ` (${riskView.riskBand})`
                          : ''}
                      </span>
                    </li>
                    <li>
                      <b>ML score</b>
                      <span>
                        {scoreBusy && riskView.mlScore === '—'
                          ? 'Scoring…'
                          : riskView.mlScore !== '—'
                            ? `${riskView.mlScore}${riskView.mlBand !== '—' ? ` · ${riskView.mlBand}` : ''}`
                            : '—'}
                      </span>
                    </li>
                    <li>
                      <b>Submitted</b>
                      <span>{String(selected.submitted_on)}</span>
                    </li>
                    <li>
                      <b>Score note</b>
                      <span className="lms-muted">{riskView.disclaimer}</span>
                    </li>
                  </ul>
                ) : null}
                {detailTab === 'finance' ? (
                  <ul className="lms-kv">
                    <li>
                      <b>Amount applied</b>
                      <span>{moneyKes(Number(selected.amount || 0))}</span>
                    </li>
                    <li>
                      <b>Amount approved</b>
                      <span>{moneyKes(Number(selected.amount_approved || 0))}</span>
                    </li>
                    <li>
                      <b>Category</b>
                      <span>{String(selected.category || '—')}</span>
                    </li>
                    <li>
                      <b>GFS</b>
                      <span>{String(selected.gfs_code || '—')}</span>
                    </li>
                  </ul>
                ) : null}
                {detailTab === 'group' ? (
                  <ul className="lms-kv">
                    <li>
                      <b>Linked group id</b>
                      <span>{String(selected.group_id || 'Not linked')}</span>
                    </li>
                    <li>
                      <b>Group name</b>
                      <span>{String(selected.group_name)}</span>
                    </li>
                    <li>
                      <b>Ward</b>
                      <span>{String(selected.ward_name || '—')}</span>
                    </li>
                  </ul>
                ) : null}

                {activePanel === 'approve' ? (
                  <form
                    className="lms-form"
                    style={{ marginTop: '1rem' }}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void runApprove();
                    }}
                  >
                    <label>
                      Final approved amount
                      <input value={amountApproved} onChange={(e) => setAmountApproved(e.target.value)} inputMode="decimal" />
                    </label>
                    <label>
                      Link / confirm group
                      <select value={linkGroupId} onChange={(e) => setLinkGroupId(e.target.value)}>
                        <option value="">Keep current group</option>
                        {groups.map((group) => (
                          <option key={String(group.id)} value={String(group.id)}>
                            {String(group.name)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Remarks
                      <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} />
                    </label>
                    <button type="submit" className="btn-primary" disabled={busy}>
                      {busy ? 'Saving…' : 'Confirm approval'}
                    </button>
                  </form>
                ) : null}

                {activePanel === 'reject' ? (
                  <form
                    className="lms-form"
                    style={{ marginTop: '1rem' }}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void runReject();
                    }}
                  >
                    <label>
                      Primary reason
                      <select value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}>
                        <option>Does not meet criteria</option>
                        <option>Incomplete documentation</option>
                        <option>Duplicate application</option>
                        <option>Other</option>
                      </select>
                    </label>
                    <label>
                      Detailed explanation
                      <textarea
                        value={rejectMessage}
                        onChange={(e) => setRejectMessage(e.target.value)}
                        rows={3}
                        required
                        minLength={10}
                        placeholder="At least 10 characters"
                      />
                    </label>
                    <button type="submit" className="btn-danger" disabled={busy}>
                      {busy ? 'Saving…' : 'Confirm rejection'}
                    </button>
                  </form>
                ) : null}

                {activePanel === 'link' ? (
                  <form
                    className="lms-form"
                    style={{ marginTop: '1rem' }}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void runLink();
                    }}
                  >
                    <label>
                      Find matches
                      <input
                        value={matchQuery}
                        onChange={(e) => setMatchQuery(e.target.value)}
                        placeholder="Search by group name or code"
                      />
                    </label>
                    <label>
                      Master group record
                      <select value={linkGroupId} onChange={(e) => setLinkGroupId(e.target.value)} required>
                        <option value="">Select group…</option>
                        {suggestedGroups.map((group) => (
                          <option key={String(group.id)} value={String(group.id)}>
                            {String(group.name)}
                            {group.code ? ` (${String(group.code)})` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="lms-muted" style={{ marginTop: 0 }}>
                      Suggested matches are ranked from the offline group register using the application name.
                    </p>
                    <button type="submit" className="btn-primary" disabled={busy}>
                      {busy ? 'Saving…' : 'Link to group'}
                    </button>
                  </form>
                ) : null}

                {activePanel === 'phase' ? (
                  <form
                    className="lms-form"
                    style={{ marginTop: '1rem' }}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void runAssignPhase();
                    }}
                  >
                    <label>
                      Review phase
                      <select value={assignPhaseId} onChange={(e) => setAssignPhaseId(e.target.value)} required>
                        <option value="">Select phase…</option>
                        {openPhases.map((phase) => (
                          <option key={String(phase.id)} value={String(phase.id)}>
                            {String(phase.phase || phase.phase_ref || phase.id)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className="btn-primary" disabled={busy || !openPhases.length}>
                      {busy ? 'Saving…' : 'Assign now'}
                    </button>
                    {selected.loan_phase_id ? (
                      <button
                        type="button"
                        className="btn-outline-primary"
                        disabled={busy}
                        style={{ marginTop: '0.55rem' }}
                        onClick={() => void runRemovePhase()}
                      >
                        Remove assignment
                      </button>
                    ) : null}
                  </form>
                ) : null}

                {activePanel === 'return' ? (
                  <form
                    className="lms-form"
                    style={{ marginTop: '1rem' }}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void runReturn();
                    }}
                  >
                    <p className="lms-muted" style={{ marginTop: 0 }}>
                      The application goes back to the group as a draft so they can correct it. When online, sync also
                      sends your comments by SMS when a group contact is available.
                    </p>
                    <label>
                      What should the group correct?
                      <textarea
                        value={returnComment}
                        onChange={(e) => setReturnComment(e.target.value)}
                        rows={4}
                        required
                        minLength={20}
                        placeholder="At least 20 characters — be specific"
                      />
                    </label>
                    <button type="submit" className="btn-primary" disabled={busy}>
                      {busy ? 'Saving…' : 'Confirm return to group'}
                    </button>
                  </form>
                ) : null}

                {activePanel === 'review' ? (
                  <form
                    className="lms-form"
                    style={{ marginTop: '1rem' }}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void runReview();
                    }}
                  >
                    <p className="lms-muted" style={{ marginTop: 0 }}>
                      This clears the constituency approve/reject decision and puts the application back to pending so
                      you can decide again.
                    </p>
                    <button type="submit" className="btn-primary" disabled={busy}>
                      {busy ? 'Saving…' : 'Confirm review decision'}
                    </button>
                  </form>
                ) : null}
              </div>
            </section>
          </div>

          <aside className="app-review-action-rail">
            <div className="rail-card">
              <div className="rail-card-header">Phase assignment</div>
              <div className="rail-card-body">
                {selected.phase_label ? (
                  <div style={{ border: '1px solid var(--lms-line)', borderRadius: 8, padding: '0.75rem', background: '#f8f9fa' }}>
                    <small className="lms-muted" style={{ display: 'block', textTransform: 'uppercase', fontWeight: 700, fontSize: '0.65rem' }}>
                      Current phase
                    </small>
                    <strong>{String(selected.phase_label)}</strong>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.65rem' }}>
                      <button type="button" className="btn-outline-primary btn-sm" onClick={() => setPanel('phase')}>
                        Change phase
                      </button>
                      <button type="button" className="btn-outline-primary btn-sm" disabled={busy} onClick={() => void runRemovePhase()}>
                        Remove assignment
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="lms-muted" style={{ marginTop: 0 }}>
                      Assign this application to a review phase before verification.
                    </p>
                    <button type="button" className="btn-outline-primary btn-sm btn-block" onClick={() => setPanel('phase')}>
                      Assign now
                    </button>
                    <button
                      type="button"
                      className="btn-outline-secondary btn-sm"
                      style={{ marginTop: '0.45rem', width: '100%' }}
                      onClick={() => onNavigate('loan-phase')}
                    >
                      Manage phases
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="rail-card">
              <div className="rail-card-header">System verification</div>
              <div className="rail-card-body">
                {selected.group_id ? (
                  <div style={{ border: '1px solid var(--lms-line)', borderRadius: 8, padding: '0.75rem', background: '#f8f9fa' }}>
                    <small style={{ textTransform: 'uppercase', fontWeight: 800, fontSize: '0.65rem' }}>Linked master record</small>
                    <p style={{ margin: '0.35rem 0 0' }}>{String(selected.group_name)}</p>
                    {selected.group_reg ? (
                      <span className="lms-muted" style={{ display: 'block', fontSize: '0.75rem' }}>
                        REG: {String(selected.group_reg)}
                      </span>
                    ) : null}
                    {selected.group_code ? (
                      <code className="text-primary" style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.75rem' }}>
                        GROUP CODE: {String(selected.group_code)}
                      </code>
                    ) : null}
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.65rem' }}>
                      <button type="button" className="btn-outline-primary btn-sm" onClick={() => setPanel('link')}>
                        Change link
                      </button>
                      <button type="button" className="btn-outline-primary btn-sm" disabled={busy} onClick={() => void runUnlink()}>
                        Unlink wrongly matched record
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <p className="lms-muted">Manual verification required — review possible duplicate matches.</p>
                    <button type="button" className="btn-primary btn-sm" onClick={() => setPanel('link')}>
                      Review matches
                    </button>
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--lms-line)', marginTop: '1rem', paddingTop: '0.85rem' }}>
                  <label className="lms-muted" style={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem', marginBottom: '0.55rem' }}>
                    Final decision
                  </label>
                  {decided ? (
                    <div style={{ border: '1px solid var(--lms-line)', borderRadius: 8, padding: '0.75rem', background: '#f8f9fa' }}>
                      <small className="lms-muted" style={{ display: 'block', textTransform: 'uppercase', fontWeight: 700, fontSize: '0.65rem' }}>
                        Status (read-only)
                      </small>
                      <strong className={statusChipClass(String(selected.display_status))} style={{ display: 'inline-block', marginTop: '0.35rem' }}>
                        {String(selected.display_status)}
                      </strong>
                      <p className="lms-muted" style={{ margin: '0.55rem 0 0', fontSize: '0.8rem' }}>
                        Approve, reject, return, and review decision are hidden after constituency approval / HQ submission / disbursement.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button type="button" className="btn-refresh-premium" style={{ flex: 1 }} onClick={() => setPanel('approve')} disabled={!selected.group_id}>
                          Approve
                        </button>
                        <button type="button" className="btn-refresh-premium-danger" style={{ flex: 1 }} onClick={() => setPanel('reject')}>
                          Reject
                        </button>
                      </div>
                      <button
                        type="button"
                        className="btn-outline-primary btn-sm"
                        style={{ width: '100%', marginTop: '0.55rem' }}
                        onClick={() => setPanel('return')}
                        disabled={/reject|approv|defer|pending_submission|disburs|issued/i.test(String(selected.display_status || ''))}
                      >
                        Return to group
                      </button>
                      {/reject/i.test(String(selected.display_status || '')) ? (
                        <button
                          type="button"
                          className="btn-outline-secondary btn-sm"
                          style={{ width: '100%', marginTop: '0.45rem' }}
                          onClick={() => setPanel('review')}
                        >
                          Review decision
                        </button>
                      ) : null}
                    </>
                  )}
                </div>

                <button type="button" className="btn-default btn-sm" style={{ width: '100%', marginTop: '0.85rem' }} onClick={closeReview}>
                  Back to list
                </button>
              </div>
            </div>
          </aside>
        </div>

        <div className="app-review-mobile-actions">
          {decided ? (
            <div className="lms-muted" style={{ flex: 1, textAlign: 'center', fontWeight: 700 }}>
              {String(selected.display_status)}
            </div>
          ) : (
            <>
              <button type="button" className="btn-refresh-premium" style={{ flex: 1 }} onClick={() => setPanel('approve')} disabled={!selected.group_id}>
                Approve
              </button>
              <button type="button" className="btn-refresh-premium-danger" style={{ flex: 1 }} onClick={() => setPanel('reject')}>
                Reject
              </button>
              <button
                type="button"
                className="btn-outline-primary"
                style={{ flex: 1 }}
                onClick={() => setPanel('return')}
                disabled={/reject|approv|defer|pending_submission|disburs|issued/i.test(String(selected.display_status || ''))}
              >
                Return
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={title}
        crumb={subtitle}
        actions={
          <>
            <button type="button" className="btn-outline-info btn-sm" onClick={() => onNavigate('loan-phase')}>
              Phases
            </button>
            {mode !== 'tasks' ? (
              <button type="button" className="btn-outline-secondary btn-sm" onClick={() => onNavigate('tasks')}>
                Tasks
              </button>
            ) : null}
          </>
        }
      />

      {mode !== 'loans' ? (
        <div className="lms-demo-kpis">
          {demoKpis.map((kpi) => (
            <div key={kpi.label} className="lms-demo-kpi">
              <div className="lms-demo-kpi__value">{kpi.value}</div>
              <div className="lms-demo-kpi__label">{kpi.label}</div>
            </div>
          ))}
          <div className="lms-phase-dash">
            <strong>{pendingPhases || phases.length}</strong>
            <span>Pending phases</span>
            <button type="button" className="btn-outline-secondary btn-xs" style={{ borderRadius: 999 }} onClick={() => onNavigate('loan-phase')}>
              New phase
            </button>
          </div>
        </div>
      ) : (
        <div className="lms-kpi-grid">
          <div className="lms-kpi">
            <div className="lms-kpi__label">Applied loans</div>
            <div className="lms-kpi__value">{loanRows.length}</div>
          </div>
          <div className="lms-kpi">
            <div className="lms-kpi__label">Showing</div>
            <div className="lms-kpi__value">{filtered.length}</div>
          </div>
        </div>
      )}

      <section className="lms-outline-card">
        <div className="lms-outline-card__head">
          <h2>{mode === 'loans' ? 'Applied Loans' : 'Applications List'}</h2>
          <div className="lms-outline-card__tools">
            <div className="lms-premium-search">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={mode === 'loans' ? 'Search loans…' : 'Search Applications...'}
              />
              <span>⌕</span>
            </div>
            <button type="button" className="btn-default btn-sm" title="Refresh" onClick={() => void reload()}>
              ↻
            </button>
            <button type="button" className="btn-default btn-sm" title="Clear filters" onClick={resetFilters}>
              ⌕
            </button>
          </div>
        </div>

        <div className="lms-card__body">
          <div className="lms-filter-grid">
            <label>
              Application status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            {mode !== 'loans' ? (
              <label>
                Loan phase
                <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)}>
                  <option value="">All phases</option>
                  {phases.map((phase) => (
                    <option key={String(phase.id)} value={String(phase.id)}>
                      {String(phase.phase || phase.phase_ref || phase.id)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              From date
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label>
              To date
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="lms-table-wrap">
          <table className="lms-table">
            <thead>
              <tr>
                <th>Application ID</th>
                <th>Submitted on</th>
                <th>Group name</th>
                <th>Amount applied</th>
                <th>Status</th>
                {mode !== 'loans' ? <th>Phase</th> : null}
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((row) => (
                  <tr key={String(row.id)} className="lms-row-clickable" onClick={() => (mode === 'loans' ? setSelected(row) : openReview(row))}>
                    <td className="font-mono" style={{ fontWeight: 700 }}>
                      {String(row.application_id || row.id)}
                    </td>
                    <td>{String(row.submitted_on || '—')}</td>
                    <td>
                      {String(row.group_name)}
                      <small className="lms-muted" style={{ display: 'block' }}>
                        {String(row.ward_name || '')}
                      </small>
                    </td>
                    <td>{moneyKes(Number(row.amount || row.amount_applied || 0))}</td>
                    <td>
                      <span className={statusChipClass(String(row.display_status))}>{String(row.display_status)}</span>
                    </td>
                    {mode !== 'loans' ? (
                      <td>
                        {row.phase_label ? (
                          <span className="lms-status-chip lms-status-chip--phase">{String(row.phase_label)}</span>
                        ) : (
                          <span className="lms-phase-unassigned">Not assigned</span>
                        )}
                      </td>
                    ) : null}
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn-outline-info btn-xs"
                        onClick={() => (mode === 'loans' ? setSelected(row) : openReview(row))}
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={mode === 'loans' ? 6 : 7} className="lms-empty">
                    No {mode === 'loans' ? 'applied loans' : 'applications'} in the encrypted copy.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && mode === 'loans' ? (
        <div className="lms-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="lms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lms-modal__head">
              <h2>Loan #{String(selected.id)}</h2>
              <button type="button" className="btn-default btn-sm" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <div className="lms-card__body">
              <ul className="lms-kv">
                <li>
                  <b>Group</b>
                  <span>{String(selected.group_name)}</span>
                </li>
                <li>
                  <b>Amount</b>
                  <span>{moneyKes(Number(selected.amount || selected.amount_applied || 0))}</span>
                </li>
                <li>
                  <b>Status</b>
                  <span>{String(selected.display_status)}</span>
                </li>
                <li>
                  <b>Applied</b>
                  <span>{String(selected.submitted_on || selected.application_date || '—')}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Applications(props: LmsPageProps) {
  return <ApplicationsView {...props} mode="all" />;
}

export function ApplicationTasks(props: LmsPageProps) {
  return <ApplicationsView {...props} mode="tasks" />;
}

export function AppliedLoans(props: LmsPageProps) {
  return <ApplicationsView {...props} mode="loans" />;
}
