import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { saveReceiptOffline } from '../../../lib/lmsOfflineSync';
import { PageHeader } from '../../shell/PageHeader';
import { Card } from '../../shell/Card';
import { DataTable } from '../../shell/DataTable';
import { SearchBar } from '../../shell/SearchBar';
import { StatusBadge } from '../../shell/StatusBadge';
import { loadTable, matchesSearch, money } from '../../lib/localQuery';
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
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loanId, setLoanId] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [amount, setAmount] = useState('');
  const [payment, setPayment] = useState<'Bank' | 'Mpesa'>('Mpesa');
  const [reference, setReference] = useState('');

  async function reload() {
    setRows(await loadTable('loan_receipts'));
    setLoans(await loadTable('group_loans'));
  }

  useEffect(() => {
    void reload();
  }, [email, revision]);

  const filtered = useMemo(
    () =>
      rows.filter((row) =>
        matchesSearch(row, query, ['receipt_number', 'reference_number', 'payment', 'group_loans_id', 'status']),
      ),
    [rows, query],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
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

  return (
    <div>
      <PageHeader title="Loan" accent="Receipts" crumb={constituency || 'Constituency'} />
      <Card
        title={`Receipts (${filtered.length})`}
        tools={
          <button type="button" className="btn-ghost" onClick={() => setShowForm((value) => !value)}>
            {showForm ? 'Cancel' : 'Add receipt'}
          </button>
        }
        flush
      >
        <div className="lms-card__body">
          <SearchBar value={query} onChange={setQuery} placeholder="Search receipts…" />
          {showForm ? (
            <form className="lms-form" onSubmit={(event) => void submit(event)} style={{ marginTop: '0.75rem' }}>
              <label>
                Group loan
                <select value={loanId} onChange={(event) => setLoanId(event.target.value)} required>
                  <option value="">Select loan…</option>
                  {loans.map((loan) => (
                    <option key={String(loan.id)} value={String(loan.id)}>
                      #{String(loan.id)} · {String(loan.gfs_code || loan.category || 'loan')} · {money(loan.amount_approved)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Receipt number
                <input value={receiptNumber} onChange={(event) => setReceiptNumber(event.target.value)} required />
              </label>
              <label>
                Date
                <input type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} required />
              </label>
              <label>
                Amount
                <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" required />
              </label>
              <label>
                Payment
                <select value={payment} onChange={(event) => setPayment(event.target.value as 'Bank' | 'Mpesa')}>
                  <option value="Mpesa">Mpesa</option>
                  <option value="Bank">Bank</option>
                </select>
              </label>
              <label>
                Reference
                <input value={reference} onChange={(event) => setReference(event.target.value)} required />
              </label>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save offline'}
              </button>
            </form>
          ) : null}
        </div>
        <DataTable
          rows={filtered}
          empty="No receipts in the encrypted copy."
          columns={[
            { key: 'receipt_number', label: 'Receipt' },
            { key: 'group_loans_id', label: 'Loan' },
            { key: 'transaction_date', label: 'Date' },
            { key: 'amount', label: 'Amount', render: (row) => money(row.amount) },
            { key: 'payment', label: 'Payment' },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
          ]}
        />
      </Card>
    </div>
  );
}
