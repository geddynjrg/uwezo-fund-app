import { useCallback, useEffect, useState } from 'react';
import {
  listPacketsForAccount,
  packetStatusLabel,
  type OfflinePacket,
} from '../lib/offlineApply';
import {
  listMajuuForAccount,
  type MajuuRecord,
} from '../lib/majuuApply';
import {
  publishApplicantRecords,
  pullApplicantRecords,
  recordsNote,
} from '../lib/applicantRecords';
import type { AppSession } from '../lib/session';

type Tab = 'loans' | 'majuu';

type MyApplicationsProps = {
  session: AppSession;
  onOpenLoan: (packet: OfflinePacket) => void;
  onOpenMajuu: (record: MajuuRecord) => void;
  compact?: boolean;
};

function formatWhen(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return iso.slice(0, 16);
  }
}

function loanChip(packet: OfflinePacket): string {
  if (packet.status === 'synced') return 'sent';
  if (packet.status === 'draft') return 'returned';
  return 'pending sync';
}

function majuuChip(record: MajuuRecord): string {
  if (record.uploadedToMajuu) return 'sent';
  if (record.kind === 'individual' && record.status === 'draft') return 'draft';
  if (record.kind === 'group' && record.status === 'draft') return 'draft';
  if (record.submitRequested) return 'pending sync';
  return record.status;
}

function majuuTitle(record: MajuuRecord): string {
  if (record.kind === 'group') return record.groupName || 'Group application';
  return record.name || record.groupName || 'Individual application';
}

function majuuNumber(record: MajuuRecord): string {
  if (record.kind === 'group') return record.loanNumber || record.registrationNumber || '—';
  return record.individualNumber || record.loanNumber || record.registrationNumber || '—';
}

export function MyApplications({
  session,
  onOpenLoan,
  onOpenMajuu,
  compact = false,
}: MyApplicationsProps) {
  const [tab, setTab] = useState<Tab>('loans');
  const [loans, setLoans] = useState<OfflinePacket[]>([]);
  const [majuu, setMajuu] = useState<MajuuRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    const [loanRows, majuuRows] = await Promise.all([
      listPacketsForAccount(session.email, session.phone),
      listMajuuForAccount(session.email, session.phone),
    ]);
    setLoans(loanRows.slice().reverse());
    setMajuu(majuuRows.slice().reverse());
  }, [session.email, session.phone]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function refresh() {
    setBusy(true);
    setError('');
    setNote('Refreshing applications…');
    try {
      const records = await pullApplicantRecords(session);
      const numbers = await publishApplicantRecords(records, session);
      setNote(recordsNote(numbers));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh applications.');
      setNote('');
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`my-apps${compact ? ' my-apps--compact' : ''}`} aria-label="My applications">
      <div className="my-apps__head">
        <h2 className="my-apps__title">My applications</h2>
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => void refresh()}>
          {busy ? 'Refreshing…' : 'Refresh my applications'}
        </button>
      </div>
      {note ? <p className="home-chat-note">{note}</p> : null}
      {error ? <p className="home-chat-note my-apps__error">{error}</p> : null}

      <div className="my-apps__tabs" role="tablist" aria-label="Application category">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'loans'}
          className={`my-apps__tab${tab === 'loans' ? ' my-apps__tab--active' : ''}`}
          onClick={() => setTab('loans')}
        >
          Loans ({loans.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'majuu'}
          className={`my-apps__tab${tab === 'majuu' ? ' my-apps__tab--active' : ''}`}
          onClick={() => setTab('majuu')}
        >
          Majuu ({majuu.length})
        </button>
      </div>

      {tab === 'loans' ? (
        loans.length ? (
          <ul className="my-apps__list">
            {loans.map((packet) => (
              <li key={packet.id} className="my-apps__item">
                <div className="my-apps__item-main">
                  <strong>{packet.payload.groupName || 'Loan application'}</strong>
                  <span className={`my-apps__chip my-apps__chip--${packet.status}`}>
                    {loanChip(packet)}
                  </span>
                </div>
                <p className="home-chat-note">
                  {packet.acknowledgementNumber ||
                    packet.applicationId ||
                    packet.payload.proposedNumber ||
                    '—'}{' '}
                  · {packetStatusLabel(packet)}
                </p>
                <p className="home-chat-note">{formatWhen(packet.createdAt)}</p>
                <button type="button" className="btn-ghost" onClick={() => onOpenLoan(packet)}>
                  {packet.status === 'synced'
                    ? 'Open summary'
                    : packet.status === 'draft'
                      ? 'Edit returned draft'
                      : 'Continue'}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="home-chat-note">No loan applications for this account on this phone yet.</p>
        )
      ) : majuu.length ? (
        <ul className="my-apps__list">
          {majuu.map((record) => (
            <li key={record.id} className="my-apps__item">
              <div className="my-apps__item-main">
                <strong>{majuuTitle(record)}</strong>
                <span className="my-apps__chip">{majuuChip(record)}</span>
              </div>
              <p className="home-chat-note">
                {record.kind === 'group' ? 'Group' : 'Individual'} · {majuuNumber(record)}
              </p>
              <p className="home-chat-note">{formatWhen(record.createdAt)}</p>
              <button type="button" className="btn-ghost" onClick={() => onOpenMajuu(record)}>
                Open
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="home-chat-note">No Majuu applications for this account on this phone yet.</p>
      )}
    </section>
  );
}
