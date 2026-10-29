import { useMemo, useState } from 'react';
import { loadLmsCache } from '../../../lib/lmsSync';
import { LiveList } from '../hq/LiveList';
import NationalPhases from '../shared/NationalPhases';
import type { LmsPageProps } from '../../types';

export function SecretariatDashboard({ email, online, onNavigate, revision }: LmsPageProps) {
  const [tab, setTab] = useState<'overview' | 'phases' | 'volume'>('overview');
  const cache = useMemo(() => loadLmsCache(email), [email, revision]);
  const pages = Object.entries(cache?.pages || {});
  const figures = pages.flatMap(([, page]) => page.summary || []).slice(0, 12);

  return (
    <div className="secretariat-command-center">
      <div className="sec-hero mb-3">
        <div className="sec-hero-glow" />
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div>
            <span className="sec-hero-badge">Command Center</span>
            <h2 className="sec-hero-title" style={{ margin: '0.35rem 0 0.25rem' }}>
              Authorization inbox
            </h2>
            <p className="sec-hero-sub" style={{ margin: 0 }}>
              {online
                ? 'Review constituency phases, technical checks, and dispatch decisions.'
                : 'Offline copy — Sync while online to refresh secretariat queues.'}
            </p>
          </div>
          <div className="sec-hero-actions" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn sec-btn-primary btn-sm" onClick={() => onNavigate('phases')}>
              Phases for review
            </button>
            <button type="button" className="btn sec-btn-ghost btn-sm" onClick={() => onNavigate('volume')}>
              Application volume
            </button>
          </div>
        </div>
      </div>

      <div className="lms-workspace">
        <aside className="lms-workspace__side">
          <span className="hq-sidebar-label">National secretariat</span>
          <p className="lms-muted" style={{ marginTop: '0.45rem' }}>
            Phase review and national volume mirrors Livewire secretariat screens after Sync.
          </p>
          <ul className="lms-quick-links" style={{ marginTop: '0.75rem' }}>
            <li>
              <button type="button" onClick={() => onNavigate('phases')}>
                Phases for review
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onNavigate('dashboard')}>
                National dashboard
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onNavigate('volume')}>
                Application volume
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onNavigate('help')}>
                Help
              </button>
            </li>
          </ul>
        </aside>
        <div className="lms-workspace__main">
          <div className="lms-tabs hq-workspace-tabs">
            {(
              [
                ['overview', 'Overview'],
                ['phases', 'Phases'],
                ['volume', 'Volume'],
              ] as const
            ).map(([key, label]) => (
              <button key={key} type="button" className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'overview' ? (
            <>
              <div className="row mb-4 sec-stat-grid lms-demo-kpis">
                <div className="lms-demo-kpi">
                  <div className="lms-demo-kpi__value">{pages.length}</div>
                  <div className="lms-demo-kpi__label">Saved national screens</div>
                </div>
                <div className="lms-demo-kpi">
                  <div className="lms-demo-kpi__value">{online ? 'On' : 'Off'}</div>
                  <div className="lms-demo-kpi__label">LMS link</div>
                </div>
                <div className="lms-demo-kpi">
                  <div className="lms-demo-kpi__value">{figures.length}</div>
                  <div className="lms-demo-kpi__label">Figures</div>
                </div>
                <div className="lms-demo-kpi">
                  <div className="lms-demo-kpi__value">Go</div>
                  <div className="lms-demo-kpi__label">
                    <button type="button" className="lms-linkish" onClick={() => onNavigate('help')}>
                      Open help
                    </button>
                  </div>
                </div>
              </div>
              <section className="sec-panel hq-panel-card" style={{ padding: '0.85rem' }}>
                <h6 className="sec-panel__title" style={{ margin: '0 0 0.65rem', fontWeight: 700 }}>
                  Pending authorizations
                </h6>
                {figures.length ? (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {figures.map((fig, index) => (
                      <li
                        key={`${fig.label}-${index}`}
                        style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #e5e7eb' }}
                      >
                        <span className="lms-muted">{fig.label}</span>
                        <strong>{String(fig.value)}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="lms-muted">Sync while online to refresh national figures from lms.uwezo.go.ke.</p>
                )}
              </section>
            </>
          ) : null}

          {tab === 'phases' ? (
            <section className="hq-panel-card" style={{ padding: '0.85rem' }}>
              <div className="secretariat-review-page">
                <div className="secretariat-stepper">
                  {['Received', 'Technical review', 'Decision', 'Dispatch'].map((label, index) => (
                    <div key={label} className={`secretariat-step ${index === 0 ? 'is-current' : 'is-waiting'}`}>
                      <div className="secretariat-step-index">{index + 1}</div>
                      <strong className="text-navy">{label}</strong>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn-indigo btn-sm" onClick={() => onNavigate('phases')}>
                  Open phases for review
                </button>
              </div>
            </section>
          ) : null}

          {tab === 'volume' ? (
            <section className="hq-panel-card" style={{ padding: '0.85rem' }}>
              <p className="lms-muted" style={{ marginTop: 0 }}>
                Application volume ranking by constituency.
              </p>
              <button type="button" className="btn-primary btn-sm" onClick={() => onNavigate('volume')}>
                Open volume report
              </button>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function SecretariatPhases(props: LmsPageProps) {
  return <NationalPhases {...props} title="Phases for" accent="Review" />;
}

export function SecretariatVolume(props: LmsPageProps) {
  return <LiveList {...props} title="Apps by" accent="Constituency" pathIncludes="application-volume" />;
}

export const SecretariatNational = (p: LmsPageProps) => <SecretariatDashboard {...p} />;
