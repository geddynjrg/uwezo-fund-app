import { useMemo } from 'react';
import { loadLmsCache } from '../../../lib/lmsSync';
import NationalPhases from '../shared/NationalPhases';
import { PageHeader } from '../../shell/PageHeader';
import { StatCard } from '../../shell/StatCard';
import type { LmsPageProps } from '../../types';

export function AccountantPhases(props: LmsPageProps) {
  return <NationalPhases {...props} title="Phases for" accent="Payment" />;
}

export function AccountantHome({ email, online, onNavigate, revision }: LmsPageProps) {
  const cache = useMemo(() => loadLmsCache(email), [email, revision]);
  const page = Object.entries(cache?.pages || {}).find(([path]) => path.includes('/accountant'))?.[1];
  const figures = page?.summary || [];
  const rows = page?.tables?.[0]?.rows?.length || 0;

  return (
    <div>
      <PageHeader
        title="Accounts"
        crumb={online ? 'Online payment queue · Accounts' : 'Offline copy of accountant phases'}
        showFyBadge={false}
        badge="Accounts"
        actions={
          <button type="button" className="btn-primary btn-sm" onClick={() => onNavigate('phases')}>
            Phases for payment
          </button>
        }
      />

      <div className="lms-stat-grid">
        <div className="hq-kpi-card" style={{ padding: '0.85rem', borderRadius: 14, background: 'linear-gradient(180deg,#fff,#f9fafb)' }}>
          <span className="hq-sidebar-label" style={{ display: 'block' }}>
            Pending review
          </span>
          <h3 style={{ margin: '0.25rem 0 0', fontWeight: 800 }}>{rows || figures.length || '—'}</h3>
        </div>
        <StatCard value={figures.length} label="Figures" tone="primary" />
        <StatCard value={online ? 'On' : 'Off'} label="LMS link" tone="success" />
        <StatCard value="Go" label="Payment queue" tone="warning" actionLabel="Open" onAction={() => onNavigate('phases')} />
      </div>

      <section className="lms-outline-card">
        <div className="lms-outline-card__head">
          <h2>Accountant workspace</h2>
        </div>
        <div className="lms-card__body">
          <p className="lms-muted" style={{ marginTop: 0 }}>
            Accountant modules load only for this role. Payment phase decisions use the live national JSON API while online.
          </p>
          {figures.length ? (
            <ul className="lms-kv">
              {figures.slice(0, 8).map((fig, index) => (
                <li key={`${fig.label}-${index}`}>
                  <b>{fig.label}</b>
                  <span>{String(fig.value)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <button type="button" className="btn-primary" style={{ marginTop: '0.75rem' }} onClick={() => onNavigate('phases')}>
            Open phases for payment
          </button>
        </div>
      </section>
    </div>
  );
}
