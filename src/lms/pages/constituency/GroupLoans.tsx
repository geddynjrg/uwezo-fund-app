import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../shell/PageHeader';
import { Card } from '../../shell/Card';
import { DataTable } from '../../shell/DataTable';
import { SearchBar } from '../../shell/SearchBar';
import { StatusBadge } from '../../shell/StatusBadge';
import { loadTable, matchesSearch, money } from '../../lib/localQuery';
import type { LmsPageProps } from '../../types';

export default function GroupLoans({ email, constituency, revision }: LmsPageProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void loadTable('group_loans').then(setRows);
  }, [email, revision]);

  const filtered = useMemo(
    () =>
      rows.filter((row) =>
        matchesSearch(row, query, ['id', 'gfs_code', 'category', 'sector', 'loan_status', 'status', 'group_id']),
      ),
    [rows, query],
  );

  return (
    <div>
      <PageHeader title="Group" accent="Loans" crumb={constituency || 'Constituency'} />
      <Card title={`Group loans (${filtered.length})`} flush>
        <div className="lms-card__body">
          <SearchBar value={query} onChange={setQuery} placeholder="Search loans…" />
        </div>
        <DataTable
          rows={filtered}
          empty="No group loans in the encrypted copy."
          columns={[
            { key: 'id', label: 'ID' },
            { key: 'group_id', label: 'Group' },
            { key: 'gfs_code', label: 'GFS' },
            { key: 'category', label: 'Category' },
            { key: 'amount_approved', label: 'Approved', render: (row) => money(row.amount_approved) },
            { key: 'amount_repaid', label: 'Repaid', render: (row) => money(row.amount_repaid) },
            { key: 'loan_status', label: 'Status', render: (row) => <StatusBadge value={row.loan_status || row.status} /> },
          ]}
        />
      </Card>
    </div>
  );
}
