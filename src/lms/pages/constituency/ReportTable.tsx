import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../shell/PageHeader';
import { Card } from '../../shell/Card';
import { DataTable } from '../../shell/DataTable';
import { SearchBar } from '../../shell/SearchBar';
import { StatusBadge } from '../../shell/StatusBadge';
import { loadTable, matchesSearch, money } from '../../lib/localQuery';
import type { LmsTableName } from '../../../lib/lmsLocalDb';
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

const META: Record<ReportKind, { title: string; accent: string; table: LmsTableName; keys: string[] }> = {
  volume: { title: 'Apps by', accent: 'Constituency', table: 'phase_applications', keys: ['id', 'group_id', 'loan_phase_id', 'status'] },
  report: { title: 'Generate', accent: 'Report', table: 'group_loans', keys: ['id', 'gfs_code', 'category', 'loan_status'] },
  ledger: { title: 'Loan', accent: 'Ledger (F.5)', table: 'group_loans', keys: ['id', 'group_id', 'amount_issued', 'amount_repaid'] },
  audit: { title: 'Audit', accent: 'Trail', table: 'loan_receipts', keys: ['receipt_number', 'reference_number', 'amount'] },
  disbursement: { title: 'Disbursement', accent: 'Reports', table: 'group_loans', keys: ['id', 'disbursement_date', 'amount_issued'] },
  sector: { title: 'Sectoral', accent: 'Analysis', table: 'group_loans', keys: ['sector', 'sector_desc', 'category'] },
  upload: { title: 'Upload', accent: 'Data', table: 'groups', keys: ['name', 'code', 'status'] },
  restore: { title: 'Restore', accent: 'Deleted Data', table: 'groups', keys: ['name', 'code', 'status'] },
  users: { title: 'County', accent: 'Users', table: 'wards', keys: ['ward_name', 'constituency_code'] },
  'add-user': { title: 'Add', accent: 'User', table: 'wards', keys: ['ward_name', 'constituency_code'] },
  'county-audit': { title: 'County', accent: 'Audit Trail', table: 'loan_receipts', keys: ['receipt_number', 'payment', 'amount'] },
};

export function ReportPage(props: LmsPageProps & { kind: ReportKind }) {
  const meta = META[props.kind];
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void loadTable(meta.table).then(setRows);
  }, [props.email, props.revision, meta.table]);

  const filtered = useMemo(() => rows.filter((row) => matchesSearch(row, query, meta.keys)), [rows, query, meta.keys]);

  const sectorRows = useMemo(() => {
    if (props.kind !== 'sector') return filtered;
    const map = new Map<string, { sector: string; count: number; approved: number }>();
    for (const row of filtered) {
      const sector = String(row.sector || row.sector_desc || 'Unspecified');
      const entry = map.get(sector) || { sector, count: 0, approved: 0 };
      entry.count += 1;
      entry.approved += Number(row.amount_approved || 0);
      map.set(sector, entry);
    }
    return [...map.values()].map((item) => ({ ...item, id: item.sector }));
  }, [filtered, props.kind]);

  return (
    <div>
      <PageHeader title={meta.title} accent={meta.accent} crumb={props.constituency || 'Constituency'} />
      {(props.kind === 'upload' || props.kind === 'restore' || props.kind === 'add-user') && (
        <p className="lms-muted" style={{ marginTop: 0 }}>
          Write/upload actions sync when the phone is online. Showing the local encrypted copy for review.
        </p>
      )}
      <Card title={`${meta.title} ${meta.accent} (${props.kind === 'sector' ? sectorRows.length : filtered.length})`} flush>
        <div className="lms-card__body">
          <SearchBar value={query} onChange={setQuery} placeholder="Search…" />
        </div>
        {props.kind === 'sector' ? (
          <DataTable
            rows={sectorRows}
            empty="No sector data yet."
            columns={[
              { key: 'sector', label: 'Sector' },
              { key: 'count', label: 'Loans' },
              { key: 'approved', label: 'Approved', render: (row) => money(row.approved) },
            ]}
          />
        ) : props.kind === 'volume' ? (
          <DataTable
            rows={filtered}
            empty="No application volume rows yet."
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'loan_phase_id', label: 'Phase' },
              { key: 'group_id', label: 'Group' },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
            ]}
          />
        ) : props.kind === 'audit' || props.kind === 'county-audit' ? (
          <DataTable
            rows={filtered}
            empty="No audit-style rows in the local copy."
            columns={[
              { key: 'receipt_number', label: 'Receipt' },
              { key: 'reference_number', label: 'Reference' },
              { key: 'transaction_date', label: 'Date' },
              { key: 'amount', label: 'Amount', render: (row) => money(row.amount) },
              { key: 'payment', label: 'Payment' },
            ]}
          />
        ) : props.kind === 'users' || props.kind === 'add-user' ? (
          <DataTable
            rows={filtered}
            empty="No ward/user geography rows yet."
            columns={[
              { key: 'ward_name', label: 'Ward' },
              { key: 'constituency_code', label: 'Constituency code' },
              { key: 'id', label: 'ID' },
            ]}
          />
        ) : (
          <DataTable
            rows={filtered}
            empty="No report rows in the encrypted copy."
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'group_id', label: 'Group' },
              { key: 'gfs_code', label: 'GFS' },
              { key: 'category', label: 'Category' },
              { key: 'amount_issued', label: 'Issued', render: (row) => money(row.amount_issued ?? row.amount_approved) },
              { key: 'loan_status', label: 'Status', render: (row) => <StatusBadge value={row.loan_status || row.status} /> },
            ]}
          />
        )}
      </Card>
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
