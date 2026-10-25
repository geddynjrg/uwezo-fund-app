import { useMemo } from 'react';
import { loadLmsCache } from '../../../lib/lmsSync';
import { PageHeader } from '../../shell/PageHeader';
import { StatCard } from '../../shell/StatCard';
import { Card } from '../../shell/Card';
import type { LmsPageProps } from '../../types';

export default function HqDashboard({ email, online, onNavigate }: LmsPageProps) {
  const cache = loadLmsCache(email);
  const figures = useMemo(() => {
    const pages = Object.values(cache?.pages || {});
    let tables = 0;
    let nums = 0;
    for (const page of pages) {
      tables += page.tables?.length || 0;
      for (const fig of page.summary || []) {
        const n = Number(String(fig.value).replace(/[^\d.-]/g, ''));
        if (Number.isFinite(n)) nums += 1;
      }
    }
    return { screens: pages.length, tables, nums };
  }, [cache]);

  return (
    <div>
      <PageHeader title="HQ" accent="Dashboard" crumb={online ? 'Live session' : 'Last figures on phone'} />
      <div className="lms-stat-grid">
        <StatCard value={figures.screens} label="Cached HQ screens" tone="info" actionLabel="Applications" onAction={() => onNavigate('applications')} />
        <StatCard value={figures.tables} label="Saved tables" tone="primary" actionLabel="Groups" onAction={() => onNavigate('groups')} />
        <StatCard value={figures.nums} label="Saved figures" tone="warning" actionLabel="Reports" onAction={() => onNavigate('report')} />
        <StatCard value={online ? 'On' : 'Off'} label="LMS link" tone="success" actionLabel="Phase aging" onAction={() => onNavigate('aging')} />
      </div>
      <Card title="National headquarters">
        <p className="lms-muted">
          HQ workflows run from the live LMS session when online. Use Sync to refresh figures, then open Applications, Allocations, Loans, and Reports from the menu.
        </p>
      </Card>
    </div>
  );
}
