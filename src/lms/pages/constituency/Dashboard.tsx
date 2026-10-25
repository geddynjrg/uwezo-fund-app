import { useEffect, useState } from 'react';
import { countLmsTable, loadLmsMeta } from '../../../lib/lmsLocalDb';
import { PageHeader } from '../../shell/PageHeader';
import { StatCard } from '../../shell/StatCard';
import { Card } from '../../shell/Card';
import { DataTable } from '../../shell/DataTable';
import { StatusBadge } from '../../shell/StatusBadge';
import { loadTable } from '../../lib/localQuery';
import type { LmsPageProps } from '../../types';

export default function Dashboard({ email, constituency, revision, onNavigate }: LmsPageProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<Record<string, unknown>[]>([]);
  const [fetchedAt, setFetchedAt] = useState('');

  useEffect(() => {
    void (async () => {
      const meta = await loadLmsMeta(email);
      setFetchedAt(meta?.fetchedAt || '');
      setCounts({
        groups: meta?.counts?.groups ?? (await countLmsTable('groups')),
        members: meta?.counts?.members ?? (await countLmsTable('members')),
        loans: meta?.counts?.group_loans ?? (await countLmsTable('group_loans')),
        receipts: meta?.counts?.loan_receipts ?? (await countLmsTable('loan_receipts')),
        applications: meta?.counts?.phase_applications ?? (await countLmsTable('phase_applications')),
        phases: meta?.counts?.loan_phases ?? (await countLmsTable('loan_phases')),
      });
      const loans = await loadTable('group_loans', 8);
      setRecent(loans.slice(0, 8));
    })();
  }, [email, revision]);

  return (
    <div>
      <PageHeader
        title="Wezesha Majuu"
        accent="Dashboard"
        crumb={`${constituency || 'Constituency'} · ${fetchedAt ? `synced ${new Date(fetchedAt).toLocaleString()}` : 'not synced yet'}`}
      />
      <div className="lms-stat-grid">
        <StatCard value={counts.groups ?? 0} label="Groups" tone="info" actionLabel="View groups" onAction={() => onNavigate('groups')} />
        <StatCard value={counts.members ?? 0} label="Members" tone="primary" actionLabel="View members" onAction={() => onNavigate('group-members')} />
        <StatCard value={counts.loans ?? 0} label="Group loans" tone="warning" actionLabel="Open loans" onAction={() => onNavigate('group-loans')} />
        <StatCard value={counts.receipts ?? 0} label="Receipts" tone="success" actionLabel="Open receipts" onAction={() => onNavigate('receipts')} />
      </div>
      <div className="lms-stat-grid">
        <StatCard value={counts.applications ?? 0} label="Phase applications" tone="info" actionLabel="Applications" onAction={() => onNavigate('applications')} />
        <StatCard value={counts.phases ?? 0} label="Loan phases" tone="primary" actionLabel="Loan phases" onAction={() => onNavigate('loan-phase')} />
      </div>
      <Card title="Recent group loans" flush>
        <DataTable
          rows={recent}
          empty="No group loans in the encrypted copy yet. Tap Sync while online."
          columns={[
            { key: 'id', label: 'ID' },
            { key: 'gfs_code', label: 'GFS / code' },
            { key: 'category', label: 'Category' },
            { key: 'amount_approved', label: 'Approved' },
            { key: 'loan_status', label: 'Status', render: (row) => <StatusBadge value={row.loan_status || row.status} /> },
          ]}
        />
      </Card>
    </div>
  );
}
