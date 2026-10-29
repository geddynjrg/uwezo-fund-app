import { useEffect, useMemo, useState } from 'react';
import { loadConstituencyBundle, moneyKes } from '../../lib/analytics';
import { matchesSearch } from '../../lib/localQuery';
import { StatusBadge } from '../../shell/StatusBadge';
import type { LmsPageProps } from '../../types';

type ReportKind =
  | 'volume'
  | 'report'
  | 'ledger'
  | 'audit'
  | 'disbursement'
  | 'sector'
  | 'upload'
  | 'restore'
  | 'users'
  | 'add-user'
  | 'county-audit';

const META: Record<ReportKind, { title: string; accent: string; hint: string }> = {
  volume: { title: 'Application Volume', accent: 'by constituency', hint: 'Phase applications in the encrypted copy.' },
  report: { title: 'Generate Report', accent: 'group loans', hint: 'Filter and export loan rows for review.' },
  ledger: { title: 'Loan Ledger', accent: 'F.5', hint: 'Issued vs repaid ledger from local loans.' },
  audit: { title: 'Audit Trail', accent: 'receipts', hint: 'Receipt movements available offline.' },
  disbursement: { title: 'Disbursement', accent: 'reports', hint: 'Disbursed loans by date and amount.' },
  sector: { title: 'Sectoral Analysis', accent: 'portfolio', hint: 'Capital share by economic sector.' },
  upload: { title: 'Upload Data', accent: 'registry', hint: 'Upload runs online; local registry shown for checks.' },
  restore: { title: 'Restore Deleted Data', accent: 'groups', hint: 'Restore requires online LMS; local groups listed.' },
  users: { title: 'County Users', accent: 'wards', hint: 'Ward geography from the encrypted snapshot.' },
  'add-user': { title: 'Add User', accent: 'county', hint: 'User creation is online-only; ward list for context.' },
  'county-audit': { title: 'County Audit Trail', accent: 'receipts', hint: 'County-scoped receipt audit from local DB.' },
};

function exportCsv(filename: string, headers: string[], rows: string[][]) {
  const lines = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportPage(props: LmsPageProps & { kind: ReportKind }) {
  const meta = META[props.kind];
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<Record<string, unknown>[]>([]);
  const [loans, setLoans] = useState<Record<string, unknown>[]>([]);
  const [receipts, setReceipts] = useState<Record<string, unknown>[]>([]);
  const [apps, setApps] = useState<Record<string, unknown>[]>([]);
  const [wards, setWards] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    void (async () => {
      const bundle = await loadConstituencyBundle(props.email);
      setGroups(bundle.groups);
      setLoans(bundle.loans);
      setReceipts(bundle.receipts);
      setApps(bundle.apps);
      setWards(bundle.wards);
    })();
  }, [props.email, props.revision]);

  const sectorRows = useMemo(() => {
    const map = new Map<string, { sector: string; count: number; approved: number; issued: number }>();
    for (const row of loans) {
      const sector = String(row.sector || row.sector_desc || 'Unspecified');
      const entry = map.get(sector) || { sector, count: 0, approved: 0, issued: 0 };
      entry.count += 1;
      entry.approved += Number(row.amount_approved || 0);
      entry.issued += Number(row.amount_issued || 0);
      map.set(sector, entry);
    }
    return [...map.values()].map((item) => ({ ...item, id: item.sector }));
  }, [loans]);

  const sourceRows = useMemo((): Record<string, unknown>[] => {
    switch (props.kind) {
      case 'volume':
        return apps;
      case 'audit':
      case 'county-audit':
        return receipts;
      case 'users':
      case 'add-user':
        return wards;
      case 'upload':
      case 'restore':
        return groups;
      case 'sector':
        return sectorRows as Record<string, unknown>[];
      default:
        return loans;
    }
  }, [props.kind, apps, receipts, wards, groups, loans, sectorRows]);

  const filtered = useMemo(() => {
    const keys = Object.keys(sourceRows[0] || {}).slice(0, 8);
    return sourceRows.filter((row) => matchesSearch(row, query, keys));
  }, [sourceRows, query]);

  function handleExport() {
    if (props.kind === 'sector') {
      exportCsv(
        `sector-${props.constituency || 'report'}.csv`,
        ['Sector', 'Loans', 'Approved', 'Issued'],
        filtered.map((r) => [String(r.sector), String(r.count), String(r.approved), String(r.issued)]),
      );
      return;
    }
    const headers = Object.keys(filtered[0] || { id: 1 }).slice(0, 8);
    exportCsv(
      `${props.kind}-${props.constituency || 'report'}.csv`,
      headers,
      filtered.map((row) => headers.map((h) => String(row[h] ?? ''))),
    );
  }

  return (
    <div>
      <div className="lms-hero-banner">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h2>
              {meta.title} <span className="lms-muted">{meta.accent}</span>
            </h2>
            <p>{meta.hint}</p>
          </div>
          <button type="button" className="btn-outline-dark btn-sm" onClick={handleExport} disabled={!filtered.length}>
            Export Data
          </button>
        </div>
      </div>

      {(props.kind === 'upload' || props.kind === 'restore' || props.kind === 'add-user') && (
        <p className="lms-muted" style={{ marginTop: 0 }}>
          Write/upload/restore actions require an online LMS session. Showing the local encrypted copy for review.
        </p>
      )}

      <section className="lms-card">
        <div className="lms-card__head">
          <h2>
            {meta.title} ({filtered.length})
          </h2>
        </div>
        <div className="lms-card__body">
          <div className="lms-tools">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" />
          </div>
        </div>
        <div className="lms-table-wrap">
          {props.kind === 'sector' ? (
            <table className="lms-table">
              <thead>
                <tr>
                  <th>Sector</th>
                  <th>Loans</th>
                  <th>Approved</th>
                  <th>Issued</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? (
                  filtered.map((row) => (
                    <tr key={String(row.id)}>
                      <td style={{ fontWeight: 700 }}>{String(row.sector)}</td>
                      <td>{String(row.count)}</td>
                      <td>{moneyKes(Number(row.approved || 0))}</td>
                      <td>{moneyKes(Number(row.issued || 0))}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="lms-empty">
                      No sector data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : props.kind === 'volume' ? (
            <table className="lms-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Phase</th>
                  <th>Group</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? (
                  filtered.map((row) => (
                    <tr key={String(row.id)}>
                      <td>#{String(row.id)}</td>
                      <td>{String(row.loan_phase_id || '—')}</td>
                      <td>{String(row.group_id || '—')}</td>
                      <td>
                        <StatusBadge value={row.status || row.vetting_status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="lms-empty">
                      No application volume rows yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : props.kind === 'audit' || props.kind === 'county-audit' ? (
            <table className="lms-table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Reference</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? (
                  filtered.map((row) => (
                    <tr key={String(row.id)}>
                      <td>{String(row.receipt_number || '—')}</td>
                      <td className="font-mono">{String(row.reference_number || '—')}</td>
                      <td>{String(row.transaction_date || '—')}</td>
                      <td>{moneyKes(Number(row.amount || 0))}</td>
                      <td>{String(row.payment || '—')}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="lms-empty">
                      No audit-style rows in the local copy.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : props.kind === 'users' || props.kind === 'add-user' ? (
            <table className="lms-table">
              <thead>
                <tr>
                  <th>Ward</th>
                  <th>Constituency code</th>
                  <th>ID</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? (
                  filtered.map((row) => (
                    <tr key={String(row.id)}>
                      <td style={{ fontWeight: 700 }}>{String(row.ward_name || '—')}</td>
                      <td>{String(row.constituency_code || '—')}</td>
                      <td>{String(row.id)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="lms-empty">
                      No ward/user geography rows yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : props.kind === 'ledger' ? (
            <table className="lms-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Group</th>
                  <th>Issued</th>
                  <th>Repaid</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? (
                  filtered.map((row) => {
                    const issued = Number(row.amount_issued || 0);
                    const repaid = Number(row.amount_repaid || 0);
                    return (
                      <tr key={String(row.id)}>
                        <td>{String(row.id)}</td>
                        <td>{String(row.group_id)}</td>
                        <td>{moneyKes(issued)}</td>
                        <td>{moneyKes(repaid)}</td>
                        <td className={issued - repaid > 0 ? 'text-danger' : 'text-success'} style={{ fontWeight: 700 }}>
                          {moneyKes(Math.max(0, issued - repaid))}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="lms-empty">
                      No ledger rows yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="lms-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Group</th>
                  <th>GFS</th>
                  <th>Category</th>
                  <th>Issued</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? (
                  filtered.map((row) => (
                    <tr key={String(row.id)}>
                      <td>{String(row.id)}</td>
                      <td>{String(row.group_id || row.name || '—')}</td>
                      <td className="font-mono">{String(row.gfs_code || row.code || '—')}</td>
                      <td>{String(row.category || '—')}</td>
                      <td>{moneyKes(Number(row.amount_issued ?? row.amount_approved ?? 0))}</td>
                      <td>
                        <StatusBadge value={row.loan_status || row.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="lms-empty">
                      No report rows in the encrypted copy.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

export const VolumeReport = (p: LmsPageProps) => <ReportPage {...p} kind="volume" />;
export const DynamicReport = (p: LmsPageProps) => <ReportPage {...p} kind="report" />;
export const LedgerReport = (p: LmsPageProps) => <ReportPage {...p} kind="ledger" />;
export const AuditReport = (p: LmsPageProps) => <ReportPage {...p} kind="audit" />;
export const DisbursementReport = (p: LmsPageProps) => <ReportPage {...p} kind="disbursement" />;
export const SectorReport = (p: LmsPageProps) => <ReportPage {...p} kind="sector" />;
export const UploadData = (p: LmsPageProps) => <ReportPage {...p} kind="upload" />;
export const RestoreData = (p: LmsPageProps) => <ReportPage {...p} kind="restore" />;
export const CountyUsers = (p: LmsPageProps) => <ReportPage {...p} kind="users" />;
export const AddUser = (p: LmsPageProps) => <ReportPage {...p} kind="add-user" />;
export const CountyAudit = (p: LmsPageProps) => <ReportPage {...p} kind="county-audit" />;
