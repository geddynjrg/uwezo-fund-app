import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { saveReceiptOffline, updateReceiptOffline, voidReceiptOffline } from '../../../lib/lmsOfflineSync';
import { enrichGroups, loadConstituencyBundle, moneyKes, type EnrichedGroup } from '../../lib/analytics';
import { matchesSearch } from '../../lib/localQuery';
import { PageHeader } from '../../shell/PageHeader';
import type { LmsPageProps } from '../../types';

export default function Receipts({
  email,
  constituency,
  revision,
  busy,
  setBusy,
  setNotice,
}: LmsPageProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loans, setLoans] = useState<Record<string, unknown>[]>([]);
  const [groups, setGroups] = useState<EnrichedGroup[]>([]);
  const [query, setQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loanId, setLoanId] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [amount, setAmount] = useState('');
  const [payment, setPayment] = useState<'Bank' | 'Mpesa'>('Mpesa');
  const [reference, setReference] = useState('');
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [voiding, setVoiding] = useState<Record<string, unknown> | null>(null);
  const [voidReason, setVoidReason] = useState('');

  async function reload() {
    const bundle = await loadConstituencyBundle(email);
    setRows(bundle.receipts);
    setLoans(bundle.loans);
    setGroups(enrichGroups(bundle.groups, bundle.wards, bundle.loans));
  }

  useEffect(() => {
    void reload();
  }, [email, revision]);

  const groupById = useMemo(() => new Map(groups.map((g) => [String(g.id), g])), [groups]);
  const loanById = useMemo(() => new Map(loans.map((l) => [String(l.id), l])), [loans]);

  const enriched = useMemo(
    () =>
      rows.map((row) => {
        const loan = loanById.get(String(row.group_loans_id)) || {};
        const group = groupById.get(String(loan.group_id || '')) || ({} as EnrichedGroup);
        return {
          ...row,
          gfs_code: loan.gfs_code || '—',
          group_name: group.name || `Loan #${row.group_loans_id}`,
        } as Record<string, unknown>;
      }),
    [rows, loanById, groupById],
  );

  const filtered = useMemo(() => {
    return enriched.filter((row) => {
      if (paymentFilter && String(row.payment) !== paymentFilter) return false;
      return matchesSearch(row, query, ['receipt_number', 'reference_number', 'payment', 'group_loans_id', 'status', 'group_name', 'gfs_code']);
    });
  }, [enriched, query, paymentFilter]);

  function openEdit(row: Record<string, unknown>) {
    setEditing(row);
    setShowForm(false);
    setVoiding(null);
    setReceiptNumber(String(row.receipt_number || ''));
    setTransactionDate(String(row.transaction_date || '').slice(0, 10));
    setAmount(String(row.amount || ''));
    setPayment((String(row.payment) === 'Bank' ? 'Bank' : 'Mpesa') as 'Bank' | 'Mpesa');
    setReference(String(row.reference_number || ''));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (editing) {
      if (!receiptNumber.trim() || !transactionDate || !amount || !reference.trim()) {
        setNotice('Fill every receipt field.');
        return;
      }
      const numericId = Number(editing.id);
      if (!Number.isFinite(numericId) || String(editing.id).startsWith('local-')) {
        setNotice('Sync this receipt to the LMS before editing it.');
        return;
      }
      setBusy(true);
      const result = await updateReceiptOffline({
        email,
        id: numericId,
        receipt_number: receiptNumber.trim(),
        transaction_date: transactionDate,
        amount: Number(amount),
        payment,
        reference_number: reference.trim(),
      });
      setBusy(false);
      setNotice(result.detail);
      if (result.ok) {
        setEditing(null);
        await reload();
      }
      return;
    }

    const groupLoansId = Number(loanId);
    if (!groupLoansId || !receiptNumber.trim() || !transactionDate || !amount || !reference.trim()) {
      setNotice('Fill every receipt field.');
      return;
    }
    setBusy(true);
    const result = await saveReceiptOffline({
      email,
      group_loans_id: groupLoansId,
      receipt_number: receiptNumber.trim(),
      transaction_date: transactionDate,
      amount: Number(amount),
      payment,
      reference_number: reference.trim(),
    });
    setBusy(false);
    setNotice(result.detail);
    if (result.ok) {
      setReceiptNumber('');
      setAmount('');
      setReference('');
      setShowForm(false);
      await reload();
    }
  }

  async function submitVoid(event: FormEvent) {
    event.preventDefault();
    if (!voiding) return;
    if (voidReason.trim().length < 10) {
      setNotice('Void reason must be at least 10 characters.');
      return;
    }
    const numericId = Number(voiding.id);
    if (!Number.isFinite(numericId) || String(voiding.id).startsWith('local-')) {
      setNotice('Sync this receipt to the LMS before voiding it.');
      return;
    }
    setBusy(true);
    const result = await voidReceiptOffline({
      email,
      id: numericId,
      void_reason: voidReason.trim(),
    });
    setBusy(false);
    setNotice(result.detail);
    if (result.ok) {
      setVoiding(null);
      setVoidReason('');
      await reload();
    }
  }

  const formOpen = showForm || Boolean(editing);

  const kpis = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const active = enriched.filter((r) => !/cancel|void/i.test(String(r.status || 'active')));
    const sum = (list: typeof enriched) => list.reduce((s, r) => s + Number(r.amount || 0), 0);
    const todayRows = active.filter((r) => String(r.transaction_date || '').slice(0, 10) === today);
    const weekRows = active.filter((r) => String(r.transaction_date || '').slice(0, 10) >= weekAgo);
    const monthRows = active.filter((r) => String(r.transaction_date || '').slice(0, 7) === month);
    return [
      { label: "Today's receipts", value: moneyKes(sum(todayRows)), count: todayRows.length },
      { label: 'Weekly', value: moneyKes(sum(weekRows)), count: weekRows.length },
      { label: 'Monthly', value: moneyKes(sum(monthRows)), count: monthRows.length },
      { label: 'Lifetime', value: moneyKes(sum(active)), count: active.length },
    ];
  }, [enriched]);

  return (
    <div>
      <PageHeader
        title={`${constituency || 'Constituency'} Constituency`}
        crumb="Manage repayment receipts."
        actions={
          <button type="button" className="btn-refresh-premium btn-sm" onClick={() => void reload()}>
            Refresh data
          </button>
        }
      />

      <div className="lms-demo-kpis">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="lms-demo-kpi">
            <div className="lms-demo-kpi__value" style={{ fontSize: '1.05rem' }}>
              {kpi.value}
            </div>
            <div className="lms-demo-kpi__label">
              {kpi.label} · {kpi.count}
            </div>
          </div>
        ))}
      </div>

      {formOpen ? (
        <section className="lms-card" style={{ borderRadius: 12 }}>
          <div className="lms-card__head">
            <h2>{editing ? `Edit receipt #${String(editing.receipt_number)}` : 'Add receipt'}</h2>
          </div>
          <div className="lms-card__body">
            <form className="lms-form" onSubmit={(event) => void submit(event)}>
              {!editing ? (
                <label>
                  Group loan
                  <select value={loanId} onChange={(event) => setLoanId(event.target.value)} required>
                    <option value="">Select loan…</option>
                    {loans.map((loan) => {
                      const group = groupById.get(String(loan.group_id));
                      return (
                        <option key={String(loan.id)} value={String(loan.id)}>
                          #{String(loan.id)} · {String(loan.gfs_code || loan.category || 'loan')} · {String(group?.name || '')} ·{' '}
                          {moneyKes(Number(loan.amount_approved || 0))}
                        </option>
                      );
                    })}
                  </select>
                </label>
              ) : null}
              <label>
                Receipt number
                <input
                  value={receiptNumber}
                  onChange={(event) => setReceiptNumber(event.target.value.toUpperCase())}
                  required
                />
              </label>
              <label>
                Transaction date
                <input type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} required />
              </label>
              <label>
                Amount
                <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" required />
              </label>
              <label>
                Repayment method
                <select value={payment} onChange={(event) => setPayment(event.target.value as 'Bank' | 'Mpesa')}>
                  <option value="Mpesa">Mpesa</option>
                  <option value="Bank">Bank</option>
                </select>
              </label>
              <label>
                Reference no
                <input value={reference} onChange={(event) => setReference(event.target.value)} required />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy ? 'Saving…' : editing ? 'Confirm edit' : 'Add'}
                </button>
                <button
                  type="button"
                  className="btn-default"
                  onClick={() => {
                    setEditing(null);
                    setShowForm(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      {voiding ? (
        <section className="lms-card" style={{ borderRadius: 12 }}>
          <div className="lms-card__head">
            <h2>Confirm cancel receipt {String(voiding.receipt_number)}</h2>
          </div>
          <div className="lms-card__body">
            <form className="lms-form" onSubmit={(event) => void submitVoid(event)}>
              <label>
                Void reason
                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  rows={3}
                  required
                  minLength={10}
                  placeholder="At least 10 characters"
                />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="submit" className="btn-danger" disabled={busy}>
                  {busy ? 'Voiding…' : 'Yes, confirm'}
                </button>
                <button type="button" className="btn-default" onClick={() => setVoiding(null)}>
                  No, keep
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      <section className="lms-outline-card">
        <div className="lms-outline-card__head">
          <h2>Repayment Receipts</h2>
          <div className="lms-outline-card__tools">
            <div className="lms-premium-search">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search receipts…" />
              <span>⌕</span>
            </div>
            <button type="button" className="btn-default btn-sm" onClick={() => void reload()}>
              ↻
            </button>
            <button
              type="button"
              className="btn-outline-primary btn-sm"
              onClick={() => {
                setEditing(null);
                setVoiding(null);
                setShowForm((v) => !v);
              }}
            >
              {showForm && !editing ? 'Cancel' : 'New receipt'}
            </button>
          </div>
        </div>
        <div className="lms-card__body">
          <div className="lms-filter-grid">
            <label>
              Payment method
              <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
                <option value="">All methods</option>
                <option value="Mpesa">Mpesa</option>
                <option value="Bank">Bank</option>
              </select>
            </label>
          </div>
        </div>
        <div className="lms-table-wrap">
          <table className="lms-table">
            <thead>
              <tr>
                <th>Receipt no.</th>
                <th>Trans. date</th>
                <th>Group name</th>
                <th>Amount</th>
                <th>Payment method</th>
                <th>Reference no</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((row) => {
                  const active = String(row.status || 'active') === 'active' || String(row.status) === 'pending_sync';
                  const canceled = /cancel|void/i.test(String(row.status || ''));
                  return (
                    <tr key={String(row.id)}>
                      <td style={{ fontWeight: 700 }}>{String(row.receipt_number || '—')}</td>
                      <td>{String(row.transaction_date || '—')}</td>
                      <td>
                        <strong>{String(row.group_name)}</strong>
                        <small className="lms-muted" style={{ display: 'block' }}>
                          Loan #{String(row.group_loans_id)} · {String(row.gfs_code)}
                        </small>
                      </td>
                      <td>{moneyKes(Number(row.amount || 0))}</td>
                      <td>{String(row.payment || '—')}</td>
                      <td className="font-mono">{String(row.reference_number || '—')}</td>
                      <td>
                        <span className={canceled ? 'lms-status-chip lms-status-chip--danger' : 'lms-status-chip'}>
                          {canceled ? 'Canceled' : 'Posted'}
                        </span>
                        {canceled && row.void_reason ? (
                          <small className="lms-muted" style={{ display: 'block' }}>
                            {String(row.void_reason)}
                          </small>
                        ) : null}
                      </td>
                      <td style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {active ? (
                          <>
                            <button type="button" className="btn-outline-primary btn-xs" onClick={() => openEdit(row)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn-outline-danger btn-xs"
                              onClick={() => {
                                setVoiding(row);
                                setEditing(null);
                                setShowForm(false);
                                setVoidReason('');
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <span className="lms-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="lms-empty">
                    No receipts in the encrypted copy.
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
