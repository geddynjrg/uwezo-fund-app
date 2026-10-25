import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../shell/PageHeader';
import { Card } from '../../shell/Card';
import { DataTable } from '../../shell/DataTable';
import { SearchBar } from '../../shell/SearchBar';
import { StatusBadge } from '../../shell/StatusBadge';
import { loadTable, matchesSearch } from '../../lib/localQuery';
import type { LmsPageProps } from '../../types';

export default function Groups({ email, constituency, revision }: LmsPageProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void loadTable('groups').then(setRows);
  }, [email, revision]);

  const filtered = useMemo(
    () => rows.filter((row) => matchesSearch(row, query, ['name', 'code', 'reg_number', 'identifier', 'location', 'status'])),
    [rows, query],
  );

  return (
    <div>
      <PageHeader title="Groups" accent="Information" crumb={constituency || 'Constituency'} />
      <Card title={`Groups (${filtered.length})`} flush>
        <div className="lms-card__body">
          <SearchBar value={query} onChange={setQuery} placeholder="Search groups…" />
        </div>
        <DataTable
          rows={filtered}
          empty="No groups in the encrypted constituency copy."
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'code', label: 'Code' },
            { key: 'reg_number', label: 'Reg. number' },
            { key: 'location', label: 'Location' },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
          ]}
        />
      </Card>
    </div>
  );
}
