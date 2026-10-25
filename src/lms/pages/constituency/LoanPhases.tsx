import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../shell/PageHeader';
import { Card } from '../../shell/Card';
import { DataTable } from '../../shell/DataTable';
import { SearchBar } from '../../shell/SearchBar';
import { StatusBadge } from '../../shell/StatusBadge';
import { loadTable, matchesSearch, money } from '../../lib/localQuery';
import type { LmsPageProps } from '../../types';

export default function LoanPhases({ email, constituency, revision }: LmsPageProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void loadTable('loan_phases').then(setRows);
  }, [email, revision]);

  const filtered = useMemo(
    () => rows.filter((row) => matchesSearch(row, query, ['phase_ref', 'phase', 'status', 'slug'])),
    [rows, query],
  );

  return (
    <div>
      <PageHeader title="Loan" accent="Phases" crumb={constituency || 'Constituency'} />
      <Card title={`Loan phases (${filtered.length})`} flush>
        <div className="lms-card__body">
          <SearchBar value={query} onChange={setQuery} placeholder="Search phases…" />
        </div>
        <DataTable
          rows={filtered}
          empty="No loan phases in the encrypted copy."
          columns={[
            { key: 'phase_ref', label: 'Ref' },
            { key: 'phase', label: 'Phase' },
            { key: 'total_amount_applied', label: 'Applied', render: (row) => money(row.total_amount_applied) },
            { key: 'total_amount_approved', label: 'Approved', render: (row) => money(row.total_amount_approved) },
            { key: 'amount_disbursed', label: 'Disbursed', render: (row) => money(row.amount_disbursed) },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
          ]}
        />
      </Card>
    </div>
  );
}
