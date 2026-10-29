import { useEffect, useMemo, useState } from 'react';
import { enrichGroups, loadConstituencyBundle, moneyKes, type EnrichedGroup } from '../../lib/analytics';
import { matchesSearch } from '../../lib/localQuery';
import { StatusBadge } from '../../shell/StatusBadge';
import type { LmsPageProps } from '../../types';

export default function GroupLoans({ email, constituency, revision, onNavigate }: LmsPageProps) {
  const [loans, setLoans] = useState<Record<string, unknown>[]>([]);
  const [receipts, setReceipts] = useState<Record<string, unknown>[]>([]);
  const [groups, setGroups] = useState<EnrichedGroup[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void (async () => {
      const bundle = await loadConstituencyBundle(email);
      setLoans(bundle.loans);
      setReceipts(bundle.receipts);
      setGroups(enrichGroups(bundle.groups, bundle.wards, bundle.loans));
    })();
  }, [email, revision]);

  const groupById = useMemo(() => new Map(groups.map((g) => [String(g.id), g])), [groups]);

  const rows = useMemo(
    () =>
      loans.map((loan) => {
        const group = groupById.get(String(loan.group_id)) || ({} as EnrichedGroup);
        return {
          ...loan,
          group_name: group.name || `Group #${loan.group_id}`,
          ward_name: group.ward_name || '—',
        } as Record<string, unknown>;
      }),
    [loans, groupById],
  );

  const categories = useMemo(() => [...new Set(rows.map((r) => String(r.category || '').trim()).filter(Boolean))].sort(), [rows]);
  const statuses = useMemo(
    () => [...new Set(rows.map((r) => String(r.loan_status || r.status || '').trim()).filter(Boolean))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter && String(row.loan_status || row.status) !== statusFilter) return false;
      if (categoryFilter && String(row.category) !== categoryFilter) return false;
      return matchesSearch(row, query, ['id', 'gfs_code', 'category', 'sector', 'loan_status', 'status', 'group_name', 'ward_name']);
    });
  }, [rows, query, statusFilter, categoryFilter]);

  const selectedReceipts = useMemo(() => {
    if (!selected) return [];
    return receipts.filter((r) => String(r.group_loans_id) === String(selected.id));
  }, [selected, receipts]);

  return (
    <div>
      <div className="lms-hero-banner">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <h2>Group Loans</h2>
            <p>{constituency || 'Constituency'} · loan register</p>
          </div>
          <button type="button" className="btn-info btn-sm" onClick={() => onNavigate('receipts')}>
            Add receipt
          </button>
        </div>
      </div>

      <section className="lms-card">
        <div className="lms-card__head">
          <h2>Loans ({filtered.length})</h2>
        </div>
        <div className="lms-card__body">
          <div className="lms-tools">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search loans / GFS / group…" />
          </div>
          <div className="lms-filter-grid">
            <label>
              Category
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">All</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="lms-table-wrap">
          <table className="lms-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Group</th>
                <th>GFS</th>
                <th>Category</th>
                <th>Approved</th>
                <th>Issued</th>
                <th>Repaid</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((row) => (
                  <tr key={String(row.id)}>
                    <td>{String(row.id)}</td>
                    <td>
                      <strong>{String(row.group_name)}</strong>
                      <small className="lms-muted" style={{ display: 'block' }}>
                        {String(row.ward_name)}
                      </small>
                    </td>
                    <td className="font-mono">{String(row.gfs_code || '—')}</td>
                    <td>{String(row.category || '—')}</td>
                    <td>{moneyKes(Number(row.amount_approved || 0))}</td>
                    <td>{moneyKes(Number(row.amount_issued || 0))}</td>
                    <td>{moneyKes(Number(row.amount_repaid || 0))}</td>
                    <td>
                      <StatusBadge value={row.loan_status || row.status} />
                    </td>
                    <td>
                      <button type="button" className="btn-outline-info btn-xs" onClick={() => setSelected(row)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="lms-empty">
                    No group loans in the encrypted copy.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <div className="lms-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="lms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lms-modal__head">
              <h2>
                Loan #{String(selected.id)} · {String(selected.gfs_code || '')}
              </h2>
              <button type="button" className="btn-default btn-sm" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <div className="lms-card__body">
              <div className="lms-kpi-grid">
                <div className="lms-kpi">
                  <div className="lms-kpi__label">Approved</div>
                  <div className="lms-kpi__value">{moneyKes(Number(selected.amount_approved || 0))}</div>
                </div>
                <div className="lms-kpi">
                  <div className="lms-kpi__label">Issued</div>
                  <div className="lms-kpi__value">{moneyKes(Number(selected.amount_issued || 0))}</div>
                </div>
                <div className="lms-kpi">
                  <div className="lms-kpi__label">Repaid</div>
                  <div className="lms-kpi__value">{moneyKes(Number(selected.amount_repaid || 0))}</div>
                </div>
                <div className="lms-kpi">
                  <div className="lms-kpi__label">Arrears</div>
                  <div className="lms-kpi__value text-danger">{moneyKes(Number(selected.total_arrears || 0))}</div>
                </div>
              </div>
              <h6 style={{ margin: '0.75rem 0 0.45rem', fontWeight: 700 }}>Receipts</h6>
              <div className="lms-table-wrap">
                <table className="lms-table">
                  <thead>
                    <tr>
                      <th>Receipt</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Payment</th>
                      <th>Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReceipts.length ? (
                      selectedReceipts.map((r) => (
                        <tr key={String(r.id)}>
                          <td>{String(r.receipt_number || '—')}</td>
                          <td>{String(r.transaction_date || '—')}</td>
                          <td>{moneyKes(Number(r.amount || 0))}</td>
                          <td>{String(r.payment || '—')}</td>
                          <td>{String(r.reference_number || '—')}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="lms-empty">
                          No receipts for this loan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button type="button" className="btn-info btn-sm" style={{ marginTop: '0.65rem' }} onClick={() => onNavigate('receipts')}>
                Add receipt
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
