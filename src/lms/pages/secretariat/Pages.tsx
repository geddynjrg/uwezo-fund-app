import { useMemo } from 'react';
import { loadLmsCache } from '../../../lib/lmsSync';
import { PageHeader } from '../../shell/PageHeader';
import { StatCard } from '../../shell/StatCard';
import { Card } from '../../shell/Card';
import { LiveList } from '../hq/LiveList';
import type { LmsPageProps } from '../../types';

export function SecretariatDashboard({ email, online, onNavigate }: LmsPageProps) {
  const cache = loadLmsCache(email);
  const screens = Object.keys(cache?.pages || {}).length;
  return (
    <div>
      <PageHeader title="Head of" accent="Secretariat" crumb={online ? 'Live session' : 'Offline copy'} />
      <div className="lms-stat-grid">
        <StatCard value={screens} label="Saved national screens" tone="info" />
        <StatCard value={online ? 'On' : 'Off'} label="LMS link" tone="primary" actionLabel="Phases" onAction={() => onNavigate('phases')} />
        <StatCard value="Vol" label="Application volume" tone="warning" actionLabel="Open volume" onAction={() => onNavigate('volume')} />
        <StatCard value="Help" label="Guidance" tone="success" actionLabel="Help" onAction={() => onNavigate('help')} />
      </div>
      <Card title="Secretariat">
        <p className="lms-muted">
          Secretariat modules load only for this role. Sync while online to refresh national figures, then open Phases, National Dashboard, and Application Volume.
        </p>
      </Card>
    </div>
  );
}

export const SecretariatPhases = (p: LmsPageProps) => (
  <LiveList {...p} title="Phases" accent="Secretariat" pathIncludes="/secretariat/phases" />
);

export const SecretariatNational = (p: LmsPageProps) => {
  const cache = useMemo(() => loadLmsCache(p.email), [p.email, p.revision]);
  const figures = Object.values(cache?.pages || {}).flatMap((page) => page.summary || []).slice(0, 12);
  return (
    <div>
      <PageHeader title="National" accent="Dashboard" crumb={p.online ? 'Live' : 'Last copy'} />
      <div className="lms-stat-grid">
        {figures.length
          ? figures.slice(0, 4).map((fig, index) => (
              <StatCard key={`${fig.label}-${index}`} value={String(fig.value)} label={fig.label} tone={index % 2 ? 'primary' : 'info'} />
            ))
          : (
            <>
              <StatCard value="—" label="No national figures yet" tone="info" />
              <StatCard value={p.online ? 'Sync' : 'Offline'} label="Tap Sync while online" tone="warning" />
            </>
          )}
      </div>
      <Card title="National overview">
        <p className="lms-muted">Figures come from the last Sync of secretariat dashboard pages on lms.uwezo.go.ke.</p>
      </Card>
    </div>
  );
};

export const SecretariatVolume = (p: LmsPageProps) => (
  <LiveList {...p} title="Application" accent="Volume" pathIncludes="application-volume" />
);
