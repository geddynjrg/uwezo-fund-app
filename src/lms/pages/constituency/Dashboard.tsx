import { useEffect, useMemo, useState } from 'react';
import {
  dashboardKpis,
  groupDemographics,
  loadConstituencyBundle,
  loanTotals,
  moneyKes,
  wardPerformance,
} from '../../lib/analytics';
import { PageHeader } from '../../shell/PageHeader';
import { StatCard } from '../../shell/StatCard';
import type { LmsPageProps } from '../../types';

type Workspace = 'overview' | 'data' | 'analyze' | 'tasks';
type AnalyzeDim = 'demographics' | 'sectors' | 'recovery';

export default function Dashboard({ email, constituency, revision, onNavigate }: LmsPageProps) {
  const [wardFilter, setWardFilter] = useState('');
  const [workspace, setWorkspace] = useState<Workspace>('overview');
  const [analyzeDim, setAnalyzeDim] = useState<AnalyzeDim>('demographics');
  const [fetchedAt, setFetchedAt] = useState('');
  const [groups, setGroups] = useState<Record<string, unknown>[]>([]);
  const [wards, setWards] = useState<Record<string, unknown>[]>([]);
  const [loans, setLoans] = useState<Record<string, unknown>[]>([]);
  const [apps, setApps] = useState<Record<string, unknown>[]>([]);
  const [phases, setPhases] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    void (async () => {
      const bundle = await loadConstituencyBundle(email);
      setFetchedAt(bundle.meta?.fetchedAt || '');
      setGroups(bundle.groups);
      setWards(bundle.wards);
      setLoans(bundle.loans);
      setApps(bundle.apps);
      setPhases(bundle.phases);
    })();
  }, [email, revision]);

  const filteredGroups = useMemo(
    () => (wardFilter ? groups.filter((g) => String(g.ward_id) === wardFilter) : groups),
    [groups, wardFilter],
  );
  const groupIds = useMemo(() => new Set(filteredGroups.map((g) => String(g.id))), [filteredGroups]);
  const filteredLoans = useMemo(
    () => (wardFilter ? loans.filter((loan) => groupIds.has(String(loan.group_id))) : loans),
    [loans, wardFilter, groupIds],
  );

  const totals = useMemo(() => loanTotals(filteredLoans), [filteredLoans]);
  const kpis = useMemo(() => dashboardKpis(filteredLoans), [filteredLoans]);
  const demographics = useMemo(() => groupDemographics(filteredGroups, filteredLoans), [filteredGroups, filteredLoans]);
  const wardRows = useMemo(() => wardPerformance(wards, filteredGroups, filteredLoans), [wards, filteredGroups, filteredLoans]);

  const inboxApps = useMemo(() => {
    const groupById = new Map(groups.map((g) => [String(g.id), g]));
    return apps
      .filter((app) => {
        const status = String(app.status || app.vetting_status || '').toLowerCase();
        return !status || /new|pending|submitted|review/.test(status);
      })
      .slice(0, 8)
      .map((app) => ({
        ...app,
        id: app.id,
        group_name: String(groupById.get(String(app.group_id))?.name || `Group #${app.group_id}`),
        loan_amount: Number(app.amount_applied || app.loan_amount || 0),
      })) as Array<Record<string, unknown> & { group_name: string; loan_amount: number }>;
  }, [apps, groups]);

  const approvedPhases = useMemo(
    () =>
      phases
        .filter((phase) => /approv|disburs|active|open/i.test(String(phase.status || '')))
        .slice(0, 6),
    [phases],
  );

  const analysisTable = useMemo(() => {
    if (analyzeDim === 'demographics') {
      return demographics
        .filter((row) => row.cat)
        .map((row) => ({
          label: row.label,
          count: row.val,
          amount: moneyKes(row.amount || 0),
          share: `${row.percentage}%`,
        }));
    }
    if (analyzeDim === 'sectors') {
      const map = new Map<string, { count: number; amount: number }>();
      for (const loan of filteredLoans) {
        const key = String(loan.sector || loan.sector_desc || 'Unspecified');
        const prev = map.get(key) || { count: 0, amount: 0 };
        prev.count += 1;
        prev.amount += Number(loan.amount_issued || 0);
        map.set(key, prev);
      }
      const total = [...map.values()].reduce((s, r) => s + r.amount, 0) || 1;
      return [...map.entries()]
        .sort((a, b) => b[1].amount - a[1].amount)
        .slice(0, 12)
        .map(([label, row]) => ({
          label,
          count: row.count,
          amount: moneyKes(row.amount),
          share: `${Math.round((row.amount / total) * 100)}%`,
        }));
    }
    return wardRows.slice(0, 12).map((row) => ({
      label: row.name,
      count: Number(String(row.secondary).split(' ')[0]) || 0,
      amount: row.value,
      share: row.secondary,
    }));
  }, [analyzeDim, demographics, filteredLoans, wardRows]);

  const riskTone = totals.parRate > 5 ? 'is-bad' : totals.parRate > 2 ? '' : 'is-ok';

  return (
    <div>
      <PageHeader
        title={`${constituency || 'Constituency'} Constituency Dashboard`}
        crumb={`Management Dashboard.${fetchedAt ? ` Synced ${new Date(fetchedAt).toLocaleString()}.` : ' Not synced yet.'}`}
      />

      <div className="lms-stat-grid">
        <StatCard value={filteredGroups.length} label="Groups" tone="info" actionLabel="Open groups" onAction={() => onNavigate('groups')} />
        <StatCard value={filteredLoans.length} label="Group loans" tone="primary" actionLabel="Open loans" onAction={() => onNavigate('group-loans')} />
        <StatCard value={inboxApps.length} label="Pending apps" tone="warning" actionLabel="Review" onAction={() => onNavigate('tasks')} />
        <StatCard value={`${totals.recoveryRate}%`} label="Recovery rate" tone="success" actionLabel="Receipts" onAction={() => onNavigate('receipts')} />
      </div>

      <div className="lms-workspace">
        <aside className="lms-workspace__side">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
            <span className="hq-sidebar-label" style={{ margin: 0 }}>
              Constituency scope
            </span>
            <span className="hq-badge-v2">Local DB</span>
          </div>
          <p className="lms-muted" style={{ marginBottom: '0.75rem' }}>
            {constituency || 'Your constituency'}
          </p>

          <label className="lms-muted" style={{ display: 'grid', gap: '0.25rem', marginBottom: '0.75rem' }}>
            Filter by ward
            <select value={wardFilter} onChange={(e) => setWardFilter(e.target.value)}>
              <option value="">All wards</option>
              {wards.map((ward) => (
                <option key={String(ward.id)} value={String(ward.id)}>
                  {String(ward.ward_name || ward.id)}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: 'grid', gap: '0.4rem', marginBottom: '0.85rem' }}>
            <button type="button" className="btn-info btn-sm" onClick={() => setWardFilter('')}>
              Clear ward filter
            </button>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid #e5e7eb', margin: '0.85rem 0' }} />
          <span className="hq-sidebar-label" style={{ display: 'block', marginBottom: '0.45rem' }}>
            Quick links
          </span>
          <ul className="lms-quick-links">
            <li>
              <button type="button" onClick={() => onNavigate('applications')}>
                Application portal
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onNavigate('loan-phase')}>
                Phases
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onNavigate('groups')}>
                Groups registry
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onNavigate('report')}>
                Reports
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onNavigate('receipts')}>
                Receipts
              </button>
            </li>
          </ul>

          <div className={`lms-risk-box ${riskTone}`}>
            <span className="hq-sidebar-label" style={{ display: 'block', marginBottom: '0.25rem' }}>
              Portfolio risk
            </span>
            <div style={{ fontWeight: 700 }}>{totals.parRate.toFixed(1)}% PAR</div>
            <small className="lms-muted">
              {totals.parRate > 5 ? 'Elevated arrears vs issued capital.' : 'Portfolio within healthy PAR band.'}
            </small>
          </div>
        </aside>

        <div className="lms-workspace__main">
          <div className="lms-tabs">
            {(
              [
                ['overview', 'Overview'],
                ['data', 'Data'],
                ['analyze', 'Analyze'],
                ['tasks', 'Tasks'],
              ] as const
            ).map(([key, label]) => (
              <button key={key} type="button" className={workspace === key ? 'active' : ''} onClick={() => setWorkspace(key)}>
                {label}
              </button>
            ))}
          </div>

          {workspace === 'overview' ? (
            <>
              <div className="lms-kpi-grid">
                {kpis.map((kpi) => (
                  <div key={kpi.title} className="lms-kpi">
                    <div className="lms-kpi__label">{kpi.title}</div>
                    <div className="lms-kpi__value">{moneyKes(kpi.val)}</div>
                    <div className="lms-kpi__desc">{kpi.desc}</div>
                    <div className="lms-progress">
                      <span className={`tone-${kpi.color}`} style={{ width: `${Math.min(100, kpi.prog)}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="lms-panel-grid cols-3">
                <section className="hq-panel-card" style={{ padding: '0.85rem' }}>
                  <h6 style={{ margin: '0 0 0.65rem', fontWeight: 700 }}>Portfolio mix</h6>
                  <div className="lms-bar-list">
                    {demographics
                      .filter((d) => d.cat)
                      .map((d) => (
                        <div key={d.label} className="lms-bar-list__row">
                          <div className="lms-bar-list__meta">
                            <span>{d.label}</span>
                            <strong>{d.percentage}%</strong>
                          </div>
                          <div className="lms-share-track">
                            <div className="lms-share-fill" style={{ width: `${d.percentage}%` }} />
                          </div>
                        </div>
                      ))}
                  </div>
                </section>
                <section className="hq-panel-card" style={{ padding: '0.85rem' }}>
                  <h6 style={{ margin: '0 0 0.65rem', fontWeight: 700 }}>Target groups</h6>
                  <ul className="list-unstyled" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {demographics.map((d) => (
                      <li key={d.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #f1f5f9' }}>
                        <span>{d.label}</span>
                        <strong>{d.val}</strong>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="hq-panel-card" style={{ padding: '0.85rem' }}>
                  <h6 style={{ margin: '0 0 0.65rem', fontWeight: 700 }}>Recovery</h6>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{totals.recoveryRate}%</div>
                  <span className="lms-badge lms-badge--info">{moneyKes(totals.repaid)} collected</span>
                  <div className="lms-progress" style={{ height: 6, marginTop: '0.75rem' }}>
                    <span className="tone-success" style={{ width: `${Math.min(100, totals.recoveryRate)}%` }} />
                  </div>
                </section>
              </div>

              <div className="lms-panel-grid cols-2" style={{ marginTop: '0.75rem' }}>
                <section className="hq-panel-card" style={{ padding: '0.85rem' }}>
                  <h6 style={{ margin: '0 0 0.65rem', fontWeight: 700 }}>Ward recovery (%)</h6>
                  <div className="lms-table-wrap">
                    <table className="lms-table hq-data-table">
                      <thead>
                        <tr>
                          <th>Ward</th>
                          <th>Recovery</th>
                          <th>Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wardRows.length ? (
                          wardRows.map((row) => (
                            <tr key={row.name}>
                              <td style={{ fontWeight: 700 }}>{row.name}</td>
                              <td className={`text-${row.tone}`} style={{ fontWeight: 700 }}>
                                {row.value}
                              </td>
                              <td className="lms-muted">{row.secondary}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="lms-empty">
                              No ward data yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="hq-panel-card" style={{ padding: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                    <h6 style={{ margin: 0, fontWeight: 700 }}>Action inbox</h6>
                    <span className="lms-badge lms-badge--warn">{inboxApps.length} new</span>
                  </div>
                  {inboxApps.length ? (
                    inboxApps.map((app) => (
                      <div key={String(app.id)} className="hq-inbox-item">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>#{String(app.id)}</strong>
                          <small className="lms-muted">{moneyKes(app.loan_amount)}</small>
                        </div>
                        <small className="lms-muted">{app.group_name}</small>
                        <div style={{ marginTop: '0.45rem' }}>
                          <button type="button" className="btn-outline-info btn-sm" onClick={() => onNavigate('applications')}>
                            Review
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="lms-muted">No new applications for review.</p>
                  )}
                  <button type="button" className="lms-linkish" style={{ marginTop: '0.35rem' }} onClick={() => onNavigate('applications')}>
                    Open application portal →
                  </button>
                </section>
              </div>
            </>
          ) : null}

          {workspace === 'data' ? (
            <>
              <section className="hq-panel-card" style={{ padding: '0.85rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <div>
                    <h5 style={{ margin: 0, fontWeight: 700 }}>Ward performance</h5>
                    <p className="lms-muted" style={{ margin: '0.2rem 0 0' }}>
                      Single table — recovery by ward from encrypted copy.
                    </p>
                  </div>
                  <span className="hq-badge-v2">{wardRows.length} wards</span>
                </div>
                <div className="lms-table-wrap">
                  <table className="lms-table hq-data-table">
                    <thead>
                      <tr>
                        <th>Ward</th>
                        <th>Metric</th>
                        <th>Value</th>
                        <th>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wardRows.map((row) => (
                        <tr key={row.name}>
                          <td style={{ fontWeight: 700 }}>{row.name}</td>
                          <td>{row.metric}</td>
                          <td className={`text-${row.tone}`} style={{ fontWeight: 700 }}>
                            {row.value}
                          </td>
                          <td className="lms-muted">{row.secondary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <div className="lms-panel-grid cols-2">
                <section className="hq-panel-card" style={{ padding: '0.85rem' }}>
                  <h6 style={{ margin: '0 0 0.65rem', fontWeight: 700 }}>Registry summary</h6>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    <li style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #e5e7eb' }}>
                      <span>Total groups</span>
                      <strong>{filteredGroups.length}</strong>
                    </li>
                    <li style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #e5e7eb' }}>
                      <span>Disbursed</span>
                      <strong>{moneyKes(totals.issued)}</strong>
                    </li>
                    <li style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #e5e7eb' }}>
                      <span>Repaid</span>
                      <strong>{moneyKes(totals.repaid)}</strong>
                    </li>
                    <li style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                      <span>Groups at risk</span>
                      <strong className="text-danger">
                        {filteredLoans.filter((l) => Number(l.total_arrears || 0) > 0).length}
                      </strong>
                    </li>
                  </ul>
                </section>
                <section className="hq-panel-card" style={{ padding: '0.85rem' }}>
                  <h6 style={{ margin: '0 0 0.65rem', fontWeight: 700 }}>Economic sectors</h6>
                  <div className="lms-bar-list">
                    {analysisTable.slice(0, 6).map((row) => (
                      <div key={row.label} className="lms-bar-list__row">
                        <div className="lms-bar-list__meta">
                          <span>{row.label}</span>
                          <strong>{row.share}</strong>
                        </div>
                        <div className="lms-share-track">
                          <div className="lms-share-fill" style={{ width: String(row.share).endsWith('%') ? row.share : '40%' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          ) : null}

          {workspace === 'analyze' ? (
            <>
              <section className="hq-panel-card" style={{ padding: '0.85rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h5 style={{ margin: 0, fontWeight: 700, marginRight: '0.5rem' }}>Cross-tab analysis</h5>
                  {(
                    [
                      ['demographics', 'Demographics'],
                      ['sectors', 'Sectors'],
                      ['recovery', 'Recovery'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`btn-outline-secondary btn-sm hq-dimension-btn ${analyzeDim === key ? 'active' : ''}`}
                      onClick={() => setAnalyzeDim(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="lms-table-wrap">
                  <table className="lms-table hq-data-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Count</th>
                        <th>Amount</th>
                        <th>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysisTable.map((row) => (
                        <tr key={row.label}>
                          <td style={{ fontWeight: 700 }}>{row.label}</td>
                          <td>{row.count}</td>
                          <td>{row.amount}</td>
                          <td>{row.share}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <div className="lms-kpi-grid">
                <div className="lms-kpi" style={{ textAlign: 'center' }}>
                  <div className="lms-kpi__label">Expected</div>
                  <div className="lms-kpi__value">{moneyKes(totals.due)}</div>
                </div>
                <div className="lms-kpi" style={{ textAlign: 'center' }}>
                  <div className="lms-kpi__label">Collected</div>
                  <div className="lms-kpi__value text-success">{moneyKes(totals.repaid)}</div>
                </div>
                <div className="lms-kpi" style={{ textAlign: 'center' }}>
                  <div className="lms-kpi__label">Gap</div>
                  <div className="lms-kpi__value text-danger">{moneyKes(Math.max(0, totals.due - totals.repaid))}</div>
                </div>
                <div className="lms-kpi" style={{ textAlign: 'center' }}>
                  <div className="lms-kpi__label">Efficiency</div>
                  <div className="lms-kpi__value">{totals.collectionEfficiency}%</div>
                </div>
              </div>
            </>
          ) : null}

          {workspace === 'tasks' ? (
            <div className="lms-panel-grid cols-2">
              <section className="hq-panel-card" style={{ padding: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                  <h5 style={{ margin: 0, fontWeight: 700 }}>Incoming applications</h5>
                  <button type="button" className="btn-info btn-sm" onClick={() => onNavigate('applications')}>
                    Open portal
                  </button>
                </div>
                <div className="lms-table-wrap">
                  <table className="lms-table hq-data-table">
                    <thead>
                      <tr>
                        <th>Application</th>
                        <th>Group</th>
                        <th>Amount</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {inboxApps.length ? (
                        inboxApps.map((app) => (
                          <tr key={String(app.id)}>
                            <td style={{ fontWeight: 700 }}>#{String(app.id)}</td>
                            <td>{app.group_name}</td>
                            <td>{moneyKes(app.loan_amount)}</td>
                            <td>
                              <button type="button" className="btn-outline-info btn-sm" onClick={() => onNavigate('applications')}>
                                View
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="lms-empty">
                            No applications awaiting review.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="hq-panel-card" style={{ padding: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                  <h5 style={{ margin: 0, fontWeight: 700 }}>Approved phases</h5>
                  <button type="button" className="btn-outline-info btn-sm" onClick={() => onNavigate('loan-phase')}>
                    All phases
                  </button>
                </div>
                {approvedPhases.length ? (
                  approvedPhases.map((phase) => (
                    <div key={String(phase.id)} className="hq-inbox-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{String(phase.phase || phase.phase_ref || phase.id)}</strong>
                        <small className="lms-muted" style={{ display: 'block' }}>
                          {String(phase.phase_ref || phase.status || '')}
                        </small>
                        <small className="text-success" style={{ fontWeight: 700 }}>
                          {moneyKes(Number(phase.total_amount_approved || phase.amount_disbursed || 0))}
                        </small>
                      </div>
                      <button type="button" className="btn-outline-info btn-sm" onClick={() => onNavigate('loan-phase')}>
                        View
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="lms-muted">No recently approved phases.</p>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
