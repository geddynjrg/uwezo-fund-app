import { useMemo, useState } from 'react';
import { loadLmsCache } from '../../../lib/lmsSync';
import { StatCard } from '../../shell/StatCard';
import type { LmsPageProps } from '../../types';

type Workspace = 'overview' | 'inbox' | 'reports';

export default function HqDashboard({ email, online, onNavigate, revision }: LmsPageProps) {
  const [workspace, setWorkspace] = useState<Workspace>('overview');
  const cache = useMemo(() => loadLmsCache(email), [email, revision]);
  const pages = Object.entries(cache?.pages || {});

  const figures = useMemo(() => {
    const summary = pages.flatMap(([, page]) => page.summary || []);
    let tables = 0;
    for (const [, page] of pages) tables += page.tables?.length || 0;
    return { screens: pages.length, tables, summary };
  }, [pages]);

  const quick = [
    { id: 'applications', label: 'Applications inbox' },
    { id: 'tasks', label: 'Approval tasks' },
    { id: 'allocations', label: 'Allocations' },
    { id: 'groups', label: 'National groups' },
    { id: 'group-loans', label: 'Group loans' },
    { id: 'receipts', label: 'Receipts' },
    { id: 'volume', label: 'Application volume' },
    { id: 'aging', label: 'Phase aging' },
    { id: 'report', label: 'Generate report' },
  ];

  const recovery = figures.summary.find((f) => /recover/i.test(f.label));

  return (
    <div>
      <div className="nat-hero mb-3">
        <div className="nat-hero-glow" />
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div>
            <span className="sec-hero-badge">National portfolio KPIs</span>
            <h2 className="nat-hero-title" style={{ margin: '0.35rem 0 0.25rem' }}>
              {recovery ? String(recovery.value) : `${figures.summary.length || '—'} figures`}{' '}
              <span style={{ fontWeight: 600, fontSize: '0.85em' }}>{recovery ? 'recovery' : 'cached'}</span>
            </h2>
            <p className="nat-hero-sub" style={{ margin: 0 }}>
              {online
                ? 'Animated dashboard — filter by county, explore charts, and track authorization tasks.'
                : 'Last national figures on phone. Tap Sync while online to refresh from LMS.'}
            </p>
          </div>
          <div className="nat-hero-stats" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div className="nat-hero-stat">
              <div className="nat-hero-stat__value">{figures.screens}</div>
              <div className="nat-hero-stat__label">Screens</div>
            </div>
            <div className="nat-hero-stat">
              <div className="nat-hero-stat__value">{figures.tables}</div>
              <div className="nat-hero-stat__label">Tables</div>
            </div>
            <div className="nat-hero-stat">
              <div className="nat-hero-stat__value">{online ? 'On' : 'Off'}</div>
              <div className="nat-hero-stat__label">LMS link</div>
            </div>
          </div>
        </div>
      </div>

      <div className="lms-stat-grid">
        <StatCard value={figures.screens} label="Saved screens" tone="info" actionLabel="Applications" onAction={() => onNavigate('applications')} />
        <StatCard value={figures.tables} label="Tables cached" tone="primary" actionLabel="Tasks" onAction={() => onNavigate('tasks')} />
        <StatCard value={figures.summary.length} label="Figures" tone="warning" actionLabel="Reports" onAction={() => onNavigate('report')} />
        <StatCard value={online ? 'On' : 'Off'} label="LMS link" tone="success" />
      </div>

      <div className="lms-workspace hq-workspace-shell nat-workspace-shell">
        <aside className="lms-workspace__side">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
            <span className="hq-sidebar-label" style={{ margin: 0 }}>
              National scope
            </span>
            <span className="hq-badge-v2">{online ? 'Online' : 'Cached'}</span>
          </div>
          <p className="lms-muted">Headquarters workspace mirrors live HQ modules when Sync has refreshed figures.</p>
          <hr style={{ border: 0, borderTop: '1px solid #e5e7eb', margin: '0.85rem 0' }} />
          <span className="hq-sidebar-label" style={{ display: 'block', marginBottom: '0.45rem' }}>
            Quick links
          </span>
          <ul className="lms-quick-links">
            {quick.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => onNavigate(item.id)}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="lms-workspace__main">
          <div className="lms-tabs">
            {(
              [
                ['overview', 'Overview'],
                ['inbox', 'Inbox'],
                ['reports', 'Reports'],
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
                <div className="lms-kpi">
                  <div className="lms-kpi__label">Cached HQ screens</div>
                  <div className="lms-kpi__value">{figures.screens}</div>
                  <button type="button" className="lms-linkish" onClick={() => onNavigate('applications')}>
                    Open applications
                  </button>
                </div>
                <div className="lms-kpi">
                  <div className="lms-kpi__label">Saved tables</div>
                  <div className="lms-kpi__value">{figures.tables}</div>
                  <button type="button" className="lms-linkish" onClick={() => onNavigate('groups')}>
                    Groups list
                  </button>
                </div>
                <div className="lms-kpi">
                  <div className="lms-kpi__label">Summary figures</div>
                  <div className="lms-kpi__value">{figures.summary.length}</div>
                  <button type="button" className="lms-linkish" onClick={() => onNavigate('report')}>
                    Reports
                  </button>
                </div>
                <div className="lms-kpi">
                  <div className="lms-kpi__label">LMS link</div>
                  <div className="lms-kpi__value">{online ? 'On' : 'Off'}</div>
                  <button type="button" className="lms-linkish" onClick={() => onNavigate('aging')}>
                    Phase aging
                  </button>
                </div>
              </div>

              <div className="lms-panel-grid cols-2">
                <section className="hq-panel-card" style={{ padding: '0.85rem' }}>
                  <h6 style={{ margin: '0 0 0.65rem', fontWeight: 700 }}>National figures</h6>
                  {figures.summary.length ? (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {figures.summary.slice(0, 10).map((fig, index) => (
                        <li
                          key={`${fig.label}-${index}`}
                          style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid #e5e7eb' }}
                        >
                          <span className="lms-muted">{fig.label}</span>
                          <strong>{String(fig.value)}</strong>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="lms-muted">No national figures yet. Tap Sync while online.</p>
                  )}
                </section>
                <section className="hq-panel-card" style={{ padding: '0.85rem' }}>
                  <h6 style={{ margin: '0 0 0.65rem', fontWeight: 700 }}>Synced screens</h6>
                  <div className="lms-table-wrap">
                    <table className="lms-table hq-data-table">
                      <thead>
                        <tr>
                          <th>Path</th>
                          <th>Tables</th>
                          <th>Figures</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pages.length ? (
                          pages.slice(0, 12).map(([path, page]) => (
                            <tr key={path}>
                              <td className="font-mono" style={{ fontSize: '0.72rem' }}>
                                {path.replace(/^https?:\/\/[^/]+/, '')}
                              </td>
                              <td>{page.tables?.length || 0}</td>
                              <td>{page.summary?.length || 0}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="lms-empty">
                              Sync HQ pages from lms.uwezo.go.ke to populate this workspace.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </>
          ) : null}

          {workspace === 'inbox' ? (
            <div className="lms-panel-grid cols-2">
              {quick.slice(0, 4).map((item) => (
                <section key={item.id} className="hq-inbox-item">
                  <strong>{item.label}</strong>
                  <div style={{ marginTop: '0.45rem' }}>
                    <button type="button" className="btn-outline-info btn-sm" onClick={() => onNavigate(item.id)}>
                      Open
                    </button>
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          {workspace === 'reports' ? (
            <section className="hq-panel-card" style={{ padding: '0.85rem' }}>
              <h5 style={{ margin: '0 0 0.65rem', fontWeight: 700 }}>Reporting & aging</h5>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                <button type="button" className="btn-info btn-sm" onClick={() => onNavigate('volume')}>
                  Application volume
                </button>
                <button type="button" className="btn-outline-info btn-sm" onClick={() => onNavigate('report')}>
                  Generate report
                </button>
                <button type="button" className="btn-outline-secondary btn-sm" onClick={() => onNavigate('aging')}>
                  Phase aging
                </button>
              </div>
              <p className="lms-muted" style={{ marginTop: '0.75rem' }}>
                HQ workflows remain online-first. Figures shown here come from the last Sync of Livewire HQ screens.
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
