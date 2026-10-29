import { useEffect, useMemo, useState } from 'react';
import { decideNationalPhase, fetchNationalApplications, fetchNationalPhases } from '../../../lib/lmsOfflineSync';
import { moneyKes } from '../../lib/analytics';
import { matchesSearch } from '../../lib/localQuery';
import { PageHeader } from '../../shell/PageHeader';
import { StatusBadge } from '../../shell/StatusBadge';
import type { LmsPageProps } from '../../types';

type Props = LmsPageProps & {
  title: string;
  accent: string;
};

/**
 * Online-first national phase queue (HQ / Secretariat / Accountant).
 * Kept intentionally thin vs live Livewire: Approve/Return only — no LOA,
 * signature, or bank-recon document gates on the phone for this release.
 */
export default function NationalPhases({
  email,
  title,
  accent,
  online,
  revision,
  onNavigate,
  busy,
  setBusy,
  setNotice,
}: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [apps, setApps] = useState<Record<string, unknown>[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [role, setRole] = useState('');
  const [localRevision, setLocalRevision] = useState(0);

  async function reload() {
    setError('');
    setBusy(true);
    const result = await fetchNationalPhases(email, statusFilter);
    setBusy(false);
    if (!result.ok) {
      setError(result.detail);
      setRows([]);
      return;
    }
    setRows(result.rows);
    setRole(result.role || '');
  }

  useEffect(() => {
    void reload();
  }, [email, revision, localRevision, statusFilter]);

  const statuses = useMemo(
    () => [...new Set(rows.map((r) => String(r.status || '').trim()).filter(Boolean))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((row) => matchesSearch(row, query, ['id', 'phase', 'phase_ref', 'status', 'constituency_code']));
  }, [rows, query]);

  async function openPhase(row: Record<string, unknown>) {
    setSelected(row);
    setNotes('');
    setBusy(true);
    const result = await fetchNationalApplications(email, Number(row.id));
    setBusy(false);
    if (!result.ok) {
      setApps([]);
      setNotice(result.detail);
      return;
    }
    setApps(result.rows);
  }

  async function decide(decision: 'approve' | 'return') {
    if (!selected) return;
    setBusy(true);
    const result = await decideNationalPhase({
      email,
      phase_id: Number(selected.id),
      decision,
      notes: notes.trim(),
    });
    setBusy(false);
    setNotice(result.detail);
    if (result.ok) {
      setSelected(null);
      setLocalRevision((n) => n + 1);
    }
  }

  return (
    <div className="secretariat-page-body">
      <PageHeader
        title={`${title}${accent ? ` ${accent}` : ''}`}
        crumb={`${online ? 'Live national queue' : 'Needs LMS online'}${role ? ` · ${role}` : ''}`}
        actions={
          <>
            <button type="button" className="btn-refresh-premium btn-sm" disabled={busy} onClick={() => void reload()}>
              {busy ? 'Loading…' : 'Refresh data'}
            </button>
            <button type="button" className="btn-outline-info btn-sm" onClick={() => onNavigate('dashboard')}>
              Dashboard
            </button>
          </>
        }
      />

      <div className="lms-demo-kpis">
        <div className="lms-demo-kpi">
          <div className="lms-demo-kpi__value">{filtered.length}</div>
          <div className="lms-demo-kpi__label">In queue</div>
        </div>
        <div className="lms-demo-kpi">
          <div className="lms-demo-kpi__value">{statuses.length}</div>
          <div className="lms-demo-kpi__label">Statuses</div>
        </div>
        <div className="lms-demo-kpi">
          <div className="lms-demo-kpi__value">{online ? 'On' : 'Off'}</div>
          <div className="lms-demo-kpi__label">LMS link</div>
        </div>
        <div className="lms-demo-kpi">
          <div className="lms-demo-kpi__value">{role || '—'}</div>
          <div className="lms-demo-kpi__label">Role scope</div>
        </div>
      </div>

      {error ? <p className="lms-note" style={{ color: '#b3261e' }}>{error}</p> : null}

      <section className="lms-outline-card">
        <div className="lms-outline-card__head">
          <h2>
            Authorization / payment queue ({filtered.length})
          </h2>
          <div className="lms-outline-card__tools">
            <div className="lms-premium-search">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${title.toLowerCase()}…`} />
              <span>⌕</span>
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Role default statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="lms-table-wrap">
          <table className="lms-table hq-data-table">
            <thead>
              <tr>
                <th>Phase</th>
                <th>Constituency</th>
                <th>Submitted to HQ</th>
                <th>Applied</th>
                <th>Approved</th>
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
                    <td>{String(row.constituency_name || row.constituency_code || '—')}</td>
                    <td>{String(row.submitted_at || row.submitted_to_hq_at || row.updated_at || '—').slice(0, 16)}</td>
                    <td>{moneyKes(Number(row.total_amount_applied || 0))}</td>
                    <td>{moneyKes(Number(row.total_amount_approved || 0))}</td>
                    <td>
                      <StatusBadge value={row.status} />
                    </td>
                    <td>
                      <button type="button" className="btn-outline-info btn-xs" onClick={() => void openPhase(row)}>
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="lms-empty">
                    {busy ? 'Loading national phases…' : 'No phases in the national queue for this role.'}
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
                {String(selected.phase || selected.phase_ref)} · {String(selected.constituency_code)}
              </h2>
              <button type="button" className="btn-default btn-sm" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <div className="lms-card__body">
              <ul className="lms-kv">
                <li>
                  <b>Status</b>
                  <span>{String(selected.status)}</span>
                </li>
                <li>
                  <b>Applied</b>
                  <span>{moneyKes(Number(selected.total_amount_applied || 0))}</span>
                </li>
                <li>
                  <b>Approved</b>
                  <span>{moneyKes(Number(selected.total_amount_approved || 0))}</span>
                </li>
              </ul>
              <label style={{ display: 'block', marginTop: '0.75rem' }}>
                Notes
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ width: '100%' }} />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                <button type="button" className="btn-primary btn-sm" disabled={busy || !online} onClick={() => void decide('approve')}>
                  Approve
                </button>
                <button type="button" className="btn-outline-danger btn-sm" disabled={busy || !online} onClick={() => void decide('return')}>
                  Return
                </button>
              </div>
              <div className="lms-table-wrap" style={{ marginTop: '0.85rem' }}>
                <table className="lms-table">
                  <thead>
                    <tr>
                      <th>App</th>
                      <th>Group</th>
                      <th>Applied</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apps.length ? (
                      apps.map((app) => (
                        <tr key={String(app.id)}>
                          <td>#{String(app.id)}</td>
                          <td>{String(app.group_code || app.group_id || '—')}</td>
                          <td>{moneyKes(Number(app.amount_applied || 0))}</td>
                          <td>
                            <StatusBadge value={app.status} />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="lms-empty">
                          No applications for this phase.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
