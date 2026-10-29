import { useEffect, useState, type FormEvent } from 'react';
import {
  LMS_TABLES,
  listLmsTable,
  loadLmsMeta,
  type LmsLocalMeta,
  type LmsTableName,
} from '../lib/lmsLocalDb';
import { lmsDbVaultStatus } from '../lib/lmsDbVault';
import { compareAndSendOfflineChanges, refreshLmsConnection, saveReceiptOffline } from '../lib/lmsOfflineSync';

type LmsOfflineProps = {
  email: string;
  online: boolean | null;
  busy: boolean;
  setBusy: (value: boolean) => void;
  setNotice: (value: string) => void;
  onOnlineChange?: (online: boolean) => void;
  onPendingChange?: (pending: number) => void;
};

const TABLE_LABELS: Record<LmsTableName, string> = {
  wards: 'Wards',
  groups: 'Groups',
  loan_phases: 'Loan phases',
  group_loans: 'Group loans',
  loan_receipts: 'Receipts',
  phase_applications: 'Phase applications',
  group_members: 'Group members',
  members: 'Members',
};

function previewColumns(rows: Record<string, unknown>[]): string[] {
  if (!rows.length) return [];
  const preferred = ['name', 'ward_name', 'phase_ref', 'phase', 'receipt_number', 'amount', 'status', 'loan_status', 'reg_number', 'code', 'member_Id', 'role', 'group_code'];
  const keys = Object.keys(rows[0]);
  const picked = preferred.filter((key) => keys.includes(key));
  if (picked.length) return ['id', ...picked.filter((key) => key !== 'id')].slice(0, 6);
  return keys.slice(0, 6);
}

export function LmsOffline({
  email,
  online,
  busy,
  setBusy,
  setNotice,
  onOnlineChange,
  onPendingChange,
}: LmsOfflineProps) {
  const [meta, setMeta] = useState<LmsLocalMeta | null>(null);
  const [table, setTable] = useState<LmsTableName>('groups');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [showReceipt, setShowReceipt] = useState(false);
  const [loanId, setLoanId] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [amount, setAmount] = useState('');
  const [payment, setPayment] = useState<'Bank' | 'Mpesa'>('Mpesa');
  const [reference, setReference] = useState('');
  const vault = lmsDbVaultStatus(email);
  const pending = meta?.pendingMutations || 0;
  const showCompare = online === true && pending > 0;

  async function refresh(selected: LmsTableName = table) {
    const nextMeta = await loadLmsMeta(email);
    setMeta(nextMeta);
    onPendingChange?.(nextMeta?.pendingMutations || 0);
    setRows(await listLmsTable(selected, 150, email));
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  async function runRefresh() {
    setBusy(true);
    const result = await refreshLmsConnection(email);
    setBusy(false);
    onOnlineChange?.(result.online);
    setNotice(result.detail);
    await refresh(table);
  }

  async function runCompare() {
    setBusy(true);
    const result = await compareAndSendOfflineChanges(email);
    setBusy(false);
    setNotice(result.detail);
    await refresh(table);
  }

  async function submitReceipt(event: FormEvent) {
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
      setShowReceipt(false);
      await refresh('loan_receipts');
      setTable('loan_receipts');
    }
  }

  const columns = previewColumns(rows);

  return (
    <div className="lms-offline">
      <h1>Encrypted offline LMS</h1>
      <p className="lms-lede">
        {meta
          ? `${meta.constituencyName || 'Constituency'} database on this phone${vault ? ` (encrypted ${new Date(vault.savedAt).toLocaleString()})` : ''}. Same tables as lms.uwezo.go.ke for your area.`
          : 'No encrypted LMS database on this phone yet. Tap Refresh while online to download and encrypt your constituency tables.'}
      </p>
      {pending ? (
        <p className="lms-note">{pending} offline change(s) waiting. Compare with the LMS appears when lms.uwezo.go.ke is reachable.</p>
      ) : null}
      <div className="doc-actions">
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => void runRefresh()}>
          {busy ? 'Refreshing…' : 'Refresh'}
        </button>
        {showCompare ? (
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void runCompare()}>
            {busy ? 'Sending…' : 'Compare with the LMS'}
          </button>
        ) : null}
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => setShowReceipt((value) => !value)}>
          {showReceipt ? 'Cancel receipt' : 'Add receipt'}
        </button>
      </div>
      {showReceipt ? (
        <form className="account-form" onSubmit={(event) => void submitReceipt(event)}>
          <h3>New receipt</h3>
          <label>
            Group loan id
            <input value={loanId} onChange={(event) => setLoanId(event.target.value)} inputMode="numeric" required />
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
            Save offline
          </button>
        </form>
      ) : null}
      <div className="lms-offline__tabs">
        {LMS_TABLES.map((name) => (
          <button
            key={name}
            type="button"
            className={name === table ? 'lms-link lms-link--on' : 'lms-link'}
            onClick={() => {
              setTable(name);
              void refresh(name);
            }}
          >
            {TABLE_LABELS[name]}
            {meta?.counts?.[name] != null ? ` (${meta.counts[name]})` : ''}
          </button>
        ))}
      </div>
      <div className="lms-table">
        <h3>{TABLE_LABELS[table]}</h3>
        {rows.length ? (
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)}>
                  {columns.map((column) => (
                    <td key={column}>{row[column] == null ? '' : String(row[column])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="home-chat-note">No rows in this table on the phone yet.</p>
        )}
      </div>
    </div>
  );
}
