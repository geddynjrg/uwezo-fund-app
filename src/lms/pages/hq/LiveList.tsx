import { useEffect, useMemo, useState } from 'react';
import { loadLmsCache } from '../../../lib/lmsSync';
import { PageHeader } from '../../shell/PageHeader';
import { Card } from '../../shell/Card';
import { DataTable } from '../../shell/DataTable';
import { SearchBar } from '../../shell/SearchBar';
import { matchesSearch } from '../../lib/localQuery';
import type { LmsPageProps } from '../../types';

type LiveListProps = LmsPageProps & {
  title: string;
  accent: string;
  pathIncludes: string;
};

/** HQ/national screens: show last scraped table rows for matching paths while online APIs expand. */
export function LiveList({ email, title, accent, pathIncludes, online, revision }: LiveListProps) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);

  useEffect(() => {
    const cache = loadLmsCache(email);
    const page = Object.entries(cache?.pages || {}).find(([path]) => path.includes(pathIncludes))?.[1];
    const table = page?.tables?.[0];
    if (!table) {
      setRows([]);
      setColumns([]);
      return;
    }
    setColumns(table.headers?.length ? table.headers : Object.keys(table.rows?.[0] || {}).slice(0, 6));
    const mapped = (table.rows || []).map((row, index) => {
      const obj: Record<string, unknown> = { id: index };
      row.forEach((cell, i) => {
        obj[table.headers[i] || `col${i}`] = cell;
      });
      return obj;
    });
    setRows(mapped);
  }, [email, pathIncludes, revision]);

  const filtered = useMemo(
    () => rows.filter((row) => matchesSearch(row, query, columns)),
    [rows, query, columns],
  );

  return (
    <div>
      <PageHeader title={title} accent={accent} crumb={online ? 'Online LMS figures' : 'Last copy on phone'} />
      <Card title={`${title} (${filtered.length})`} flush>
        <div className="lms-card__body">
          <SearchBar value={query} onChange={setQuery} placeholder={`Search ${title.toLowerCase()}…`} />
          {!rows.length ? (
            <p className="lms-muted" style={{ marginTop: '0.5rem' }}>
              No table rows saved for this screen yet. Tap Sync while online to refresh HQ figures from lms.uwezo.go.ke.
            </p>
          ) : null}
        </div>
        <DataTable
          rows={filtered}
          empty="No rows yet."
          columns={(columns.length ? columns : ['id']).slice(0, 6).map((key) => ({ key, label: key }))}
        />
      </Card>
    </div>
  );
}

export const HqApplications = (p: LmsPageProps) => <LiveList {...p} title="Applications" accent="HQ" pathIncludes="/hq/applications" />;
export const HqTasks = (p: LmsPageProps) => <LiveList {...p} title="Approval" accent="Tasks" pathIncludes="approval-tasks" />;
export const HqAllocations = (p: LmsPageProps) => <LiveList {...p} title="Allocations" accent="HQ" pathIncludes="/hq/allocations" />;
export const HqGroups = (p: LmsPageProps) => <LiveList {...p} title="Groups" accent="HQ" pathIncludes="/hq/groups" />;
export const HqGroupLoans = (p: LmsPageProps) => <LiveList {...p} title="Group" accent="Loans" pathIncludes="group-loans" />;
export const HqReceipts = (p: LmsPageProps) => <LiveList {...p} title="Receipts" accent="HQ" pathIncludes="/hq/loans/receipts" />;
export const HqVolume = (p: LmsPageProps) => <LiveList {...p} title="Apps by" accent="Constituency" pathIncludes="application-volume" />;
export const HqReport = (p: LmsPageProps) => <LiveList {...p} title="Generate" accent="Report" pathIncludes="/hq/reports" />;
export const HqAging = (p: LmsPageProps) => <LiveList {...p} title="Phase" accent="Aging" pathIncludes="phase-aging" />;
