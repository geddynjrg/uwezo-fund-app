import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createPhaseOffline, submitPhaseOffline, updatePhaseOffline } from '../../../lib/lmsOfflineSync';
import { enrichGroups, loadConstituencyBundle, moneyKes, type EnrichedGroup } from '../../lib/analytics';
import { matchesSearch } from '../../lib/localQuery';
import { PageHeader } from '../../shell/PageHeader';
import { StatusBadge } from '../../shell/StatusBadge';
import type { LmsPageProps } from '../../types';

export default function LoanPhases({
  email,
  constituency,
  revision,
  onNavigate,
  busy,
  setBusy,
  setNotice,
}: LmsPageProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [apps, setApps] = useState<Record<string, unknown>[]>([]);
  const [groups, setGroups] = useState<EnrichedGroup[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(false);
  const [phaseName, setPhaseName] = useState('');
  const [phaseRef, setPhaseRef] = useState('');
  const [reviewDate, setReviewDate] = useState('');
  const [reviewVenue, setReviewVenue] = useState('');
  const [remarks, setRemarks] = useState('');
  const [localRevision, setLocalRevision] = useState(0);

  async function reload() {
    const bundle = await loadConstituencyBundle(email);
    setRows(bundle.phases);
    setApps(bundle.apps);
    setGroups(enrichGroups(bundle.groups, bundle.wards, bundle.loans));
  }

  useEffect(() => {
    void reload();
  }, [email, revision, localRevision]);

  const groupById = useMemo(() => new Map(groups.map((g) => [String(g.id), g])), [groups]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const status = String(row.status || 'draft');
      if (statusFilter === '__pending' && !/draft|pending|open|new/i.test(status)) return false;
      if (statusFilter === '__processing' && !/submit|process|hq|review/i.test(status)) return false;
      if (statusFilter === '__completed' && !/approv|disburs|complete|closed|issued/i.test(status)) return false;
      if (statusFilter && !statusFilter.startsWith('__') && status !== statusFilter) return false;
      return matchesSearch(row, query, ['phase_ref', 'phase', 'status', 'slug']);
    });
  }, [rows, query, statusFilter]);

  const phaseApps = useMemo(() => {
    if (!selected) return [] as Record<string, unknown>[];
    return apps
      .filter((app) => String(app.loan_phase_id) === String(selected.id))
      .map(
        (app) =>
          ({
            ...app,
            group_name: groupById.get(String(app.group_id))?.name || `Group #${app.group_id}`,
          }) as Record<string, unknown>,
      );
  }, [selected, apps, groupById]);

  function openCreate() {
    setShowCreate(true);
    setSelected(null);
    setEditing(false);
    setPhaseName('');
    setPhaseRef('');
    setReviewDate('');
    setReviewVenue('');
    setRemarks('');
  }

  function openEdit(row: Record<string, unknown>) {
    setSelected(row);
    setEditing(true);
    setShowCreate(false);
    setPhaseName(String(row.phase || ''));
    setPhaseRef(String(row.phase_ref || ''));
    setReviewDate(String(row.review_date || '').slice(0, 10));
    setReviewVenue(String(row.review_venue || ''));
    setRemarks(String(row.committee_remarks || ''));
  }

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    if (!phaseName.trim()) {
      setNotice('Enter a phase name.');
      return;
    }
    setBusy(true);
    const result = await createPhaseOffline({
      email,
      phase: phaseName.trim(),
      phase_ref: phaseRef.trim() || undefined,
      review_date: reviewDate || undefined,
      review_venue: reviewVenue.trim() || undefined,
    });
    setBusy(false);
    setNotice(result.detail);
    if (result.ok) {
      setShowCreate(false);
      setLocalRevision((n) => n + 1);
    }
  }

  async function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const numericId = Number(selected.id);
    if (!Number.isFinite(numericId) || String(selected.id).startsWith('local-')) {
      setNotice('Sync this phase to the LMS before editing it.');
      return;
    }
    if (!phaseName.trim()) {
      setNotice('Enter a phase name.');
      return;
    }
    setBusy(true);
    const result = await updatePhaseOffline({
      email,
      id: numericId,
      phase: phaseName.trim(),
      review_date: reviewDate || undefined,
      review_venue: reviewVenue.trim() || undefined,
      committee_remarks: remarks.trim() || undefined,
    });
    setBusy(false);
    setNotice(result.detail);
    if (result.ok) {
      setEditing(false);
      setLocalRevision((n) => n + 1);
      setSelected(null);
    }
  }

  async function submitToHq() {
    if (!selected) return;
    const numericId = Number(selected.id);
    if (!Number.isFinite(numericId) || String(selected.id).startsWith('local-')) {
      setNotice('Sync this phase to the LMS before submitting it.');
      return;
    }
    if (!window.confirm('Submit this phase to HQ? Approved applications will move with it.')) return;
    setBusy(true);
    const result = await submitPhaseOffline({ email, id: numericId });
    setBusy(false);
    setNotice(result.detail);
    if (result.ok) {
      setSelected(null);
      setLocalRevision((n) => n + 1);
    }
  }

  const editable = selected && !['submitted', 'hq_approved', 'disbursed'].includes(String(selected.status));

  const tabCounts = useMemo(() => {
    const pending = rows.filter((r) => /draft|pending|open|new/i.test(String(r.status || 'draft'))).length;
    const processing = rows.filter((r) => /submit|process|hq|review/i.test(String(r.status || ''))).length;
    const completed = rows.filter((r) => /approv|disburs|complete|closed|issued/i.test(String(r.status || ''))).length;
    return { total: rows.length, pending, processing, completed };
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Phase Management"
        crumb={`${constituency || 'Constituency'} · loan review phases`}
        actions={
          <>
            <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
              New phase
            </button>
            <button type="button" className="btn-outline-info btn-sm" onClick={() => onNavigate('applications')}>
              Applications
            </button>
          </>
        }
      />

      <div className="lms-demo-kpis">
        <div className="lms-demo-kpi">
          <div className="lms-demo-kpi__value">{tabCounts.total}</div>
          <div className="lms-demo-kpi__label">Total phases</div>
        </div>
        <div className="lms-demo-kpi">
          <div className="lms-demo-kpi__value">{tabCounts.pending}</div>
          <div className="lms-demo-kpi__label">Pending submission</div>
        </div>
        <div className="lms-demo-kpi">
          <div className="lms-demo-kpi__value">{tabCounts.processing}</div>
          <div className="lms-demo-kpi__label">In processing</div>
        </div>
        <div className="lms-demo-kpi">
          <div className="lms-demo-kpi__value">{tabCounts.completed}</div>
          <div className="lms-demo-kpi__label">Disbursed / done</div>
        </div>
        <div className="lms-phase-dash">
          <strong>+</strong>
          <span>New phase</span>
          <button type="button" className="btn-outline-secondary btn-xs" style={{ borderRadius: 999 }} onClick={openCreate}>
            Create
          </button>
        </div>
      </div>

      {showCreate ? (
        <section className="lms-card" style={{ borderRadius: 12 }}>
          <div className="lms-card__head">
            <h2>Add new phase</h2>
          </div>
          <div className="lms-card__body">
            <form className="lms-form" onSubmit={(event) => void submitCreate(event)}>
              <label>
                Phase name
                <input value={phaseName} onChange={(e) => setPhaseName(e.target.value)} required />
              </label>
              <label>
                Phase ref (optional)
                <input value={phaseRef} onChange={(e) => setPhaseRef(e.target.value)} />
              </label>
              <label>
                Scheduled review date
                <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
              </label>
              <label>
                Review venue (optional)
                <input value={reviewVenue} onChange={(e) => setReviewVenue(e.target.value)} />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Create phase'}
                </button>
                <button type="button" className="btn-default" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      <div className="app-review-tabs" style={{ justifyContent: 'flex-start', marginBottom: '0.65rem' }}>
        <button type="button" className={!statusFilter ? 'active' : ''} onClick={() => setStatusFilter('')}>
          All ({tabCounts.total})
        </button>
        <button
          type="button"
          className={statusFilter === '__pending' ? 'active' : ''}
          onClick={() => setStatusFilter('__pending')}
        >
          Pending ({tabCounts.pending})
        </button>
        <button
          type="button"
          className={statusFilter === '__processing' ? 'active' : ''}
          onClick={() => setStatusFilter('__processing')}
        >
          Processing ({tabCounts.processing})
        </button>
        <button
          type="button"
          className={statusFilter === '__completed' ? 'active' : ''}
          onClick={() => setStatusFilter('__completed')}
        >
          Completed ({tabCounts.completed})
        </button>
      </div>

      <section className="lms-outline-card">
        <div className="lms-outline-card__head">
          <h2>Phases ({filtered.length})</h2>
          <div className="lms-outline-card__tools">
            <div className="lms-premium-search">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search phases…" />
              <span>⌕</span>
            </div>
            <button type="button" className="btn-default btn-sm" onClick={() => void reload()}>
              ↻
            </button>
          </div>
        </div>
        <div className="lms-table-wrap">
          <table className="lms-table">
            <thead>
              <tr>
                <th>Phase details</th>
                <th>Amount applied</th>
                <th>Amount approved</th>
                <th>Amount disbursed</th>
                <th>Review date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((row) => (
                  <tr key={String(row.id)}>
                    <td>
                      <strong>{String(row.phase || '—')}</strong>
                      <small className="lms-muted font-mono" style={{ display: 'block' }}>
                        {String(row.phase_ref || row.id)}
                      </small>
                    </td>
                    <td>{moneyKes(Number(row.total_amount_applied || 0))}</td>
                    <td>{moneyKes(Number(row.total_amount_approved || 0))}</td>
                    <td>{moneyKes(Number(row.amount_disbursed || 0))}</td>
                    <td>{String(row.review_date || '—').slice(0, 10)}</td>
                    <td>
                      <StatusBadge value={row.status} />
                    </td>
                    <td style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-outline-info btn-xs"
                        onClick={() => {
                          setSelected(row);
                          setEditing(false);
                          setShowCreate(false);
                        }}
                      >
                        View
                      </button>
                      {!['submitted', 'hq_approved', 'disbursed'].includes(String(row.status)) ? (
                        <button type="button" className="btn-outline-primary btn-xs" onClick={() => openEdit(row)}>
                          Edit
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="lms-empty">
                    No loan phases in the encrypted copy.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <div className="lms-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="lms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lms-modal__head">
              <h2>
                {String(selected.phase || selected.phase_ref)} · {editing ? 'edit' : 'applications'}
              </h2>
              <button type="button" className="btn-default btn-sm" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <div className="lms-card__body">
              {editing ? (
                <form className="lms-form" onSubmit={(event) => void submitEdit(event)}>
                  <label>
                    Phase name
                    <input value={phaseName} onChange={(e) => setPhaseName(e.target.value)} required />
                  </label>
                  <label>
                    Review date
                    <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
                  </label>
                  <label>
                    Review venue
                    <input value={reviewVenue} onChange={(e) => setReviewVenue(e.target.value)} />
                  </label>
                  <label>
                    Committee remarks
                    <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} />
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="submit" className="btn-primary" disabled={busy}>
                      {busy ? 'Saving…' : 'Save phase'}
                    </button>
                    <button type="button" className="btn-default" onClick={() => setEditing(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="lms-kpi-grid">
                    <div className="lms-kpi">
                      <div className="lms-kpi__label">Applied</div>
                      <div className="lms-kpi__value">{moneyKes(Number(selected.total_amount_applied || 0))}</div>
                    </div>
                    <div className="lms-kpi">
                      <div className="lms-kpi__label">Approved</div>
                      <div className="lms-kpi__value">{moneyKes(Number(selected.total_amount_approved || 0))}</div>
                    </div>
                    <div className="lms-kpi">
                      <div className="lms-kpi__label">Disbursed</div>
                      <div className="lms-kpi__value">{moneyKes(Number(selected.amount_disbursed || 0))}</div>
                    </div>
                    <div className="lms-kpi">
                      <div className="lms-kpi__label">Apps</div>
                      <div className="lms-kpi__value">{phaseApps.length}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                    {editable ? (
                      <>
                        <button type="button" className="btn-outline-primary btn-sm" onClick={() => openEdit(selected)}>
                          Edit phase
                        </button>
                        <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={() => void submitToHq()}>
                          {busy ? 'Submitting…' : 'Submit to HQ'}
                        </button>
                      </>
                    ) : null}
                    <button type="button" className="btn-outline-info btn-sm" onClick={() => onNavigate('applications')}>
                      Review applications
                    </button>
                  </div>
                  <div className="lms-table-wrap" style={{ marginTop: '0.75rem' }}>
                    <table className="lms-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Group</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {phaseApps.length ? (
                          phaseApps.map((app) => (
                            <tr key={String(app.id)}>
                              <td>#{String(app.id)}</td>
                              <td>{String(app.group_name)}</td>
                              <td>
                                <StatusBadge value={app.status || app.vetting_status} />
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="lms-empty">
                              No applications linked in the local copy.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
