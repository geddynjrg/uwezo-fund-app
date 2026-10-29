import { useEffect, useMemo, useState } from 'react';
import { loadLmsCache } from '../../../lib/lmsSync';
import { matchesSearch } from '../../lib/localQuery';
import type { LmsPageProps } from '../../types';
import NationalPhases from '../shared/NationalPhases';
import { PageHeader } from '../../shell/PageHeader';

type LiveListProps = LmsPageProps & {
  title: string;
  accent: string;
  pathIncludes: string;
};

/** HQ/national screens: show last scraped table rows for matching paths while online APIs expand. */
export function LiveList({ email, title, accent, pathIncludes, online, revision, onNavigate }: LiveListProps) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [summary, setSummary] = useState<{ label: string; value: string }[]>([]);
  const [matchedPath, setMatchedPath] = useState('');

  useEffect(() => {
    const cache = loadLmsCache(email);
    const entry = Object.entries(cache?.pages || {}).find(([path]) => path.includes(pathIncludes));
    const page = entry?.[1];
    setMatchedPath(entry?.[0] || '');
    setSummary((page?.summary || []).map((fig) => ({ label: fig.label, value: String(fig.value) })));
    const table = page?.tables?.[0];
    if (!table) {
      setRows([]);
      setColumns([]);
      return;
    }
    setColumns(table.headers?.length ? table.headers : Object.keys(table.rows?.[0] || {}).slice(0, 8));
    const mapped = (table.rows || []).map((row, index) => {
      const obj: Record<string, unknown> = { id: index };
      row.forEach((cell, i) => {
        obj[table.headers[i] || `col${i}`] = cell;
      });
      return obj;
    });
    setRows(mapped);
  }, [email, pathIncludes, revision]);

  const visibleCols = (columns.length ? columns : ['id']).slice(0, 7);
  const filtered = useMemo(() => rows.filter((row) => matchesSearch(row, query, visibleCols)), [rows, query, visibleCols]);

  function exportCsv() {
    const lines = [
      visibleCols.join(','),
      ...filtered.map((row) => visibleCols.map((col) => `"${String(row[col] ?? '').replace(/"/g, '""')}"`).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hq-${title.toLowerCase().replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title={`${title}${accent ? ` ${accent}` : ''}`}
        crumb={`${online ? 'Online LMS figures' : 'Last copy on phone'}${matchedPath ? ` · ${matchedPath.replace(/^https?:\/\/[^/]+/, '')}` : ''}`}
        actions={
          <>
            <button type="button" className="btn-outline-dark btn-sm" onClick={exportCsv} disabled={!filtered.length}>
              Export Data
            </button>
            <button type="button" className="btn-outline-info btn-sm" onClick={() => onNavigate('dashboard')}>
              HQ dashboard
            </button>
          </>
        }
      />

      {summary.length ? (
        <div className="lms-demo-kpis">
          {summary.slice(0, 4).map((fig) => (
            <div key={fig.label} className="lms-demo-kpi">
              <div className="lms-demo-kpi__value" style={{ fontSize: '1.05rem' }}>
                {fig.value}
              </div>
              <div className="lms-demo-kpi__label">{fig.label}</div>
            </div>
          ))}
        </div>
      ) : null}

      <section className="lms-outline-card">
        <div className="lms-outline-card__head">
          <h2>
            {title} ({filtered.length})
          </h2>
          <div className="lms-outline-card__tools">
            <div className="lms-premium-search">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${title.toLowerCase()}…`} />
              <span>⌕</span>
            </div>
          </div>
        </div>
        <div className="lms-card__body">
          {!rows.length ? (
            <p className="lms-muted" style={{ marginTop: 0 }}>
              No table rows saved for this screen yet. Tap Sync while online to refresh HQ figures from lms.uwezo.go.ke.
            </p>
          ) : null}
        </div>
        <div className="lms-table-wrap">
          <table className="lms-table hq-data-table">
            <thead>
              <tr>
                {visibleCols.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((row, index) => (
                  <tr key={String(row.id ?? index)}>
                    {visibleCols.map((col) => (
                      <td key={col}>{String(row[col] ?? '—')}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={visibleCols.length} className="lms-empty">
                    No rows yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export const HqApplications = (p: LmsPageProps) => <NationalPhases {...p} title="Phases" accent="HQ queue" />;
export const HqTasks = (p: LmsPageProps) => <NationalPhases {...p} title="Approval" accent="Tasks" />;
export const HqAllocations = (p: LmsPageProps) => <LiveList {...p} title="Allocations" accent="HQ" pathIncludes="/hq/allocations" />;
export const HqGroups = (p: LmsPageProps) => <LiveList {...p} title="Groups" accent="HQ" pathIncludes="/hq/groups" />;
export const HqGroupLoans = (p: LmsPageProps) => <LiveList {...p} title="Group" accent="Loans" pathIncludes="group-loans" />;
export const HqReceipts = (p: LmsPageProps) => <LiveList {...p} title="Receipts" accent="HQ" pathIncludes="/hq/loans/receipts" />;
export const HqVolume = (p: LmsPageProps) => <LiveList {...p} title="Apps by" accent="Constituency" pathIncludes="application-volume" />;
export const HqReport = (p: LmsPageProps) => <LiveList {...p} title="Generate" accent="Report" pathIncludes="/hq/reports" />;
export const HqAging = (p: LmsPageProps) => <LiveList {...p} title="Phase" accent="Aging" pathIncludes="phase-aging" />;
