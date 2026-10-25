import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../shell/PageHeader';
import { Card } from '../../shell/Card';
import { DataTable } from '../../shell/DataTable';
import { SearchBar } from '../../shell/SearchBar';
import { StatusBadge } from '../../shell/StatusBadge';
import { loadTable, matchesSearch, money } from '../../lib/localQuery';
import type { LmsPageProps } from '../../types';

type Mode = 'all' | 'tasks' | 'loans';

function ApplicationsView({ email, constituency, revision, mode }: LmsPageProps & { mode: Mode }) {
  const [apps, setApps] = useState<Record<string, unknown>[]>([]);
  const [loans, setLoans] = useState<Record<string, unknown>[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void (async () => {
      setApps(await loadTable('phase_applications'));
      setLoans(await loadTable('group_loans'));
    })();
  }, [email, revision]);

  const title = mode === 'tasks' ? 'Tasks' : mode === 'loans' ? 'Applied Loans' : 'Applications';
  const rows = mode === 'loans' ? loans : apps;
  const filtered = useMemo(
    () =>
      rows.filter((row) =>
        matchesSearch(row, query, [
          'id',
          'group_id',
          'loan_phase_id',
          'status',
          'vetting_status',
          'gfs_code',
          'category',
          'loan_status',
        ]),
      ),
    [rows, query],
  );

  return (
    <div>
      <PageHeader title={title} accent="Applications" crumb={constituency || 'Constituency'} />
      <Card title={`${title} (${filtered.length})`} flush>
        <div className="lms-card__body">
          <SearchBar value={query} onChange={setQuery} placeholder={`Search ${title.toLowerCase()}…`} />
        </div>
        {mode === 'loans' ? (
          <DataTable
            rows={filtered}
            empty="No applied loans in the encrypted copy."
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'group_id', label: 'Group' },
              { key: 'application_date', label: 'Applied' },
              { key: 'amount_applied', label: 'Amount', render: (row) => money(row.amount_applied) },
              { key: 'loan_status', label: 'Status', render: (row) => <StatusBadge value={row.loan_status || row.status} /> },
            ]}
          />
        ) : (
          <DataTable
            rows={filtered}
            empty="No phase applications in the encrypted copy."
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'loan_phase_id', label: 'Phase' },
              { key: 'group_id', label: 'Group' },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status || row.vetting_status} /> },
            ]}
          />
        )}
      </Card>
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
