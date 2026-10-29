import { useEffect, useMemo, useState } from 'react';
import { saveGroupOffline } from '../../../lib/lmsOfflineSync';
import {
  enrichGroups,
  groupDemographics,
  loadConstituencyBundle,
  loanTotals,
  moneyKes,
  type EnrichedGroup,
} from '../../lib/analytics';
import { matchesSearch } from '../../lib/localQuery';
import type { LmsPageProps } from '../../types';

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function GroupDetail({
  email,
  group,
  loans,
  receipts,
  members,
  links,
  onBack,
  onNavigate,
  onGroupSaved,
}: {
  email: string;
  group: EnrichedGroup;
  loans: Record<string, unknown>[];
  receipts: Record<string, unknown>[];
  members: Record<string, unknown>[];
  links: Record<string, unknown>[];
  onBack: () => void;
  onNavigate: (pageId: string) => void;
  onGroupSaved: () => void;
}) {
  const [tab, setTab] = useState<'members' | 'loans' | 'defaulters'>('members');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(String(group.name || ''));
  const [editBank, setEditBank] = useState(String(group.bank || ''));
  const [editAccount, setEditAccount] = useState(String(group.account || ''));
  const [editLocation, setEditLocation] = useState(String(group.location || ''));
  const [editBox, setEditBox] = useState(String(group.box || ''));
  const [editStatus, setEditStatus] = useState(String(group.status || ''));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setEditName(String(group.name || ''));
    setEditBank(String(group.bank || ''));
    setEditAccount(String(group.account || ''));
    setEditLocation(String(group.location || ''));
    setEditBox(String(group.box || ''));
    setEditStatus(String(group.status || ''));
  }, [group]);

  async function saveGroupEdit() {
    if (!editName.trim()) {
      setError('Enter the group name.');
      return;
    }
    setBusy(true);
    setError('');
    const result = await saveGroupOffline({
      email,
      id: Number(group.id),
      name: editName.trim(),
      bank: editBank.trim(),
      account: editAccount.trim(),
      location: editLocation.trim(),
      box: editBox.trim(),
      status: editStatus.trim(),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    setNote(result.detail);
    setEditing(false);
    onGroupSaved();
  }
  const groupLoans = useMemo(
    () => loans.filter((loan) => String(loan.group_id) === String(group.id)).sort((a, b) => num(a.id) - num(b.id)),
    [loans, group.id],
  );
  const [loanTab, setLoanTab] = useState<string>('');
  useEffect(() => {
    if (!loanTab && groupLoans.length) setLoanTab(String(groupLoans[groupLoans.length - 1].id));
  }, [groupLoans, loanTab]);

  const totals = useMemo(() => loanTotals(groupLoans), [groupLoans]);
  const memberById = useMemo(() => new Map(members.map((m) => [String(m.id), m])), [members]);
  const activeLoanId = loanTab || String(groupLoans[groupLoans.length - 1]?.id || '');
  const phaseMembers = useMemo(() => {
    return links
      .filter((link) => {
        const gid = String(link.group_id ?? '');
        const loanId = String(link.group_loans_id ?? link.loan_id ?? '');
        if (gid && gid !== String(group.id)) return false;
        if (loanId && activeLoanId && loanId !== activeLoanId) return false;
        return gid === String(group.id) || loanId === activeLoanId;
      })
      .map((link) => {
        const member = memberById.get(String(link.member_id ?? link.member_Id ?? '')) || {};
        return {
          ...link,
          name: member.name || member.full_name || member.member_name || '—',
          gender: member.gender || '—',
          id_number: member.id_number || member.national_id || link.member_Id || '—',
          phone: member.phone || member.mobile || member.number || '—',
          disabled: Boolean(member.disabled || member.pwd),
          role: link.role || 'Member',
        } as Record<string, unknown>;
      });
  }, [links, memberById, group.id, activeLoanId]);

  const defaulters = useMemo(() => {
    return groupLoans
      .filter((loan) => num(loan.total_arrears) > 0 || num(loan.amount_issued) > num(loan.amount_repaid))
      .map((loan) => ({
        id: loan.id,
        phase: loan.loan_phase_id || loan.phase || loan.gfs_code,
        issued: num(loan.amount_issued),
        repaid: num(loan.amount_repaid),
        arrears: num(loan.total_arrears) || Math.max(0, num(loan.amount_issued) - num(loan.amount_repaid)),
      }));
  }, [groupLoans]);

  const stats = [
    { label: 'Amount applied', value: totals.applied, color: 'info', sub: 'All phases', pct: 100, progress: true },
    {
      label: 'Amount approved',
      value: totals.approved,
      color: 'primary',
      sub: 'Of applied',
      pct: totals.applied ? Math.min(100, Math.round((totals.approved / totals.applied) * 100)) : 0,
      progress: true,
    },
    {
      label: 'Amount issued',
      value: totals.issued,
      color: 'warning',
      sub: 'Disbursed',
      pct: totals.approved ? Math.min(100, Math.round((totals.issued / totals.approved) * 100)) : 0,
      progress: true,
    },
    {
      label: 'Amount repaid',
      value: totals.repaid,
      color: 'success',
      sub: 'Collections',
      pct: totals.issued ? Math.min(100, Math.round((totals.repaid / totals.issued) * 100)) : 0,
      progress: true,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn-outline-secondary btn-sm" onClick={onBack}>
          ← Back to groups
        </button>
        <button type="button" className="btn-outline-info btn-sm" onClick={() => onNavigate('group-members')}>
          All members
        </button>
      </div>

      <div className="lms-page-head">
        <h1>
          Group <span>Stats</span>
        </h1>
        <p className="lms-crumb">{String(group.name)}</p>
      </div>

      <div className="lms-demo-grid">
        {stats.map((stat) => (
          <div key={stat.label} className="lms-demo-card">
            <div className="lms-demo-card__top">
              <div className={`lms-demo-card__icon tone-${stat.color}`}>{stat.color.slice(0, 1).toUpperCase()}</div>
              <div>
                <h3>{moneyKes(stat.value)}</h3>
                <p>{stat.label}</p>
              </div>
            </div>
            <div className="lms-bar-list__meta">
              <span className="lms-muted">{stat.sub}</span>
              <strong className={`text-${stat.color === 'warning' ? 'warning' : stat.color}`}>{stat.pct}%</strong>
            </div>
            <div className="lms-progress">
              <span className={`tone-${stat.color}`} style={{ width: `${stat.pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="lms-metric-pair">
        <div className="lms-metric-card">
          <p className="lms-kpi__label">Collection Efficiency</p>
          <h3>{totals.collectionEfficiency}%</h3>
          <span className={`lms-badge ${totals.collectionEfficiency >= 90 ? 'lms-badge--ok' : 'lms-badge--warn'}`}>
            {totals.collectionEfficiency >= 90 ? 'High Performance' : 'Attention Needed'}
          </span>
          <div className="lms-muted" style={{ marginTop: '0.45rem' }}>
            Paid vs Due · {moneyKes(totals.repaid)} / {moneyKes(totals.due)}
          </div>
          <div className="lms-progress" style={{ height: 6 }}>
            <span className={totals.collectionEfficiency >= 90 ? 'tone-success' : 'tone-warning'} style={{ width: `${Math.min(100, totals.collectionEfficiency)}%` }} />
          </div>
        </div>
        <div className="lms-metric-card">
          <p className="lms-kpi__label">PAR (Portfolio at Risk)</p>
          <h3 className={totals.parRate > 5 ? 'text-danger' : ''}>{totals.parRate}%</h3>
          <span className={`lms-badge ${totals.parRate <= 5 ? 'lms-badge--ok' : 'lms-badge--danger'}`}>
            {totals.parRate <= 5 ? 'Healthy Portfolio' : 'Risk Exposure'}
          </span>
          <div className="lms-muted" style={{ marginTop: '0.45rem' }}>
            Arrears vs Issued · {moneyKes(totals.arrears)} / {moneyKes(totals.issued)}
          </div>
          <div className="lms-progress" style={{ height: 6 }}>
            <span className={totals.parRate <= 5 ? 'tone-success' : 'tone-danger'} style={{ width: `${Math.min(100, totals.parRate)}%` }} />
          </div>
        </div>
      </div>

      <h5 className="lms-muted" style={{ fontWeight: 700, margin: '0.5rem 0 0.75rem' }}>
        Group Data
      </h5>

      <div className="lms-group-layout">
        <div>
          <section className="lms-card">
            <div className="lms-profile">
              <div className="lms-profile__avatar">G</div>
              <h3>{String(group.name)}</h3>
              <span className="lms-badge lms-badge--info">{String(group.category || '—')}</span>
              <ul className="lms-kv" style={{ marginTop: '0.85rem' }}>
                <li>
                  <b>GFS Code</b>
                  <span>{String(group.gfs_code || 'N/A')}</span>
                </li>
                <li>
                  <b>Reg No.</b>
                  <span>{String(group.reg_number || '—')}</span>
                </li>
                <li>
                  <b>ID</b>
                  <span>{String(group.identifier || group.code || '—')}</span>
                </li>
              </ul>
            </div>
          </section>

          <section className="lms-card">
            <div className="lms-card__head">
              <h2>Operational Details</h2>
              <button type="button" className="btn-outline-primary btn-xs" onClick={() => { setEditing((v) => !v); setNote(''); setError(''); }}>
                {editing ? 'Cancel' : 'Edit'}
              </button>
            </div>
            <div className="lms-card__body">
              {note ? <p className="lms-note" style={{ color: '#137333' }}>{note}</p> : null}
              {error ? <p className="lms-note" style={{ color: '#b3261e' }}>{error}</p> : null}
              {editing ? (
                <form
                  className="lms-fields"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveGroupEdit();
                  }}
                >
                  <label>
                    Group name
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} required />
                  </label>
                  <label>
                    Location
                    <input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
                  </label>
                  <label>
                    P.O. Box
                    <input value={editBox} onChange={(e) => setEditBox(e.target.value)} />
                  </label>
                  <label>
                    Bank
                    <input value={editBank} onChange={(e) => setEditBank(e.target.value)} />
                  </label>
                  <label>
                    Account
                    <input value={editAccount} onChange={(e) => setEditAccount(e.target.value)} />
                  </label>
                  <label>
                    Status
                    <input value={editStatus} onChange={(e) => setEditStatus(e.target.value)} />
                  </label>
                  <p className="lms-muted" style={{ fontSize: '0.82rem' }}>
                    Saves offline and syncs to live LMS when online (with receipts / member edits).
                  </p>
                  <button type="submit" className="btn-primary btn-sm" disabled={busy}>
                    {busy ? 'Saving…' : 'Save group'}
                  </button>
                </form>
              ) : (
                <>
                  <p style={{ margin: '0 0 0.55rem' }}>
                    <strong>{String(group.ward_name)}</strong>
                    <br />
                    <span className="lms-muted">{String(group.location || '—')}</span>
                  </p>
                  <p style={{ margin: '0 0 0.55rem' }}>
                    <strong>{String(group.sector || 'N/A')}</strong>
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.55rem' }}>
                    <div>
                      <small className="lms-muted">Formed</small>
                      <div>{String(group.date_formed || '—')}</div>
                    </div>
                    <div>
                      <small className="lms-muted">Registered</small>
                      <div>{String(group.date_registered || '—')}</div>
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '0.55rem' }}>
                    <small className="lms-muted" style={{ textTransform: 'uppercase', fontWeight: 700 }}>
                      Banking Details
                    </small>
                    <div style={{ fontWeight: 700 }}>{String(group.bank || '—')}</div>
                    <code className="text-info">{String(group.account || '—')}</code>
                  </div>
                  <p className="lms-muted" style={{ fontStyle: 'italic', marginTop: '0.65rem' }}>
                    &ldquo;{String(group.activity_desc || group.activity || 'No activity description')}&rdquo;
                  </p>
                  <button type="button" className="btn-info btn-block btn-sm" style={{ marginTop: '0.65rem' }} onClick={() => onNavigate('receipts')}>
                    Add / view receipts
                  </button>
                </>
              )}
            </div>
          </section>
        </div>

        <section className="lms-card">
          <div className="lms-pill-tabs">
            <button type="button" className={tab === 'members' ? 'active' : ''} onClick={() => setTab('members')}>
              Group Members
            </button>
            <button type="button" className={tab === 'loans' ? 'active' : ''} onClick={() => setTab('loans')}>
              Loan History
            </button>
            <button type="button" className={tab === 'defaulters' ? 'active' : ''} onClick={() => setTab('defaulters')}>
              Defaulters <span className="lms-badge lms-badge--danger">{defaulters.length}</span>
            </button>
          </div>

          {tab === 'members' ? (
            <div className="lms-card__body">
              <div className="lms-pill-tabs" style={{ background: 'transparent', border: 0, padding: 0, marginBottom: '0.65rem' }}>
                {groupLoans.map((loan) => (
                  <button
                    key={String(loan.id)}
                    type="button"
                    className={activeLoanId === String(loan.id) ? 'active' : ''}
                    onClick={() => setLoanTab(String(loan.id))}
                  >
                    {String(loan.gfs_code || loan.loan_phase_id || `Loan #${loan.id}`)}
                  </button>
                ))}
              </div>
              <div className="lms-table-wrap">
                <table className="lms-table lms-table--navy">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Full Name</th>
                      <th>Gender</th>
                      <th>ID Number</th>
                      <th>Position</th>
                      <th>Contact</th>
                      <th>PWD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phaseMembers.length ? (
                      phaseMembers.map((row, index) => (
                        <tr key={`${row.id ?? row.member_id}-${index}`}>
                          <td>{index + 1}</td>
                          <td style={{ fontWeight: 700 }}>{String(row.name)}</td>
                          <td>
                            <span className={`lms-badge ${String(row.gender).toLowerCase().startsWith('m') ? 'lms-badge--info' : 'lms-badge--danger'}`}>
                              {String(row.gender).charAt(0) || '—'}
                            </span>
                          </td>
                          <td>
                            <code>{String(row.id_number)}</code>
                          </td>
                          <td className="lms-muted" style={{ textTransform: 'uppercase', fontSize: '0.72rem', fontWeight: 700 }}>
                            {String(row.role)}
                          </td>
                          <td>{String(row.phone)}</td>
                          <td>{row.disabled ? 'Yes' : 'No'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="lms-empty">
                          No members found for this phase.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === 'loans' ? (
            <div className="lms-timeline">
              {groupLoans.length ? (
                groupLoans.map((loan) => {
                  const loanReceipts = receipts.filter((r) => String(r.group_loans_id) === String(loan.id));
                  const paid = num(loan.amount_repaid) >= num(loan.amount_issued) && num(loan.amount_issued) > 0;
                  return (
                    <div key={String(loan.id)} className={`lms-timeline__item ${paid ? 'is-paid' : 'is-owing'}`}>
                      <strong>
                        {String(loan.gfs_code || `Loan #${loan.id}`)} · Issued {moneyKes(num(loan.amount_issued))}
                      </strong>
                      <div className="text-info" style={{ fontWeight: 700, marginTop: '0.25rem' }}>
                        Amount Repaid — {moneyKes(num(loan.amount_repaid))}
                      </div>
                      <small className="lms-muted">
                        Balance — {moneyKes(Math.max(0, num(loan.amount_issued) - num(loan.amount_repaid)))}
                      </small>
                      <div className="lms-table-wrap" style={{ marginTop: '0.55rem', maxHeight: '220px' }}>
                        <table className="lms-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Receipt</th>
                              <th>Date</th>
                              <th>Amount</th>
                              <th>Ref</th>
                            </tr>
                          </thead>
                          <tbody>
                            {loanReceipts.length ? (
                              loanReceipts.map((r, i) => (
                                <tr key={String(r.id ?? i)}>
                                  <td>{i + 1}</td>
                                  <td>{String(r.receipt_number || '—')}</td>
                                  <td>{String(r.transaction_date || '—')}</td>
                                  <td>{moneyKes(num(r.amount))}</td>
                                  <td>{String(r.reference_number || '—')}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="lms-empty">
                                  No receipts yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="lms-empty">No loan history for this group.</p>
              )}
            </div>
          ) : null}

          {tab === 'defaulters' ? (
            <div className="lms-card__body">
              {defaulters.length ? (
                <div className="lms-table-wrap">
                  <table className="lms-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Phase / GFS</th>
                        <th>Issued</th>
                        <th>Repaid</th>
                        <th>Arrears</th>
                      </tr>
                    </thead>
                    <tbody>
                      {defaulters.map((row, i) => (
                        <tr key={String(row.id)}>
                          <td>{i + 1}</td>
                          <td>{String(row.phase)}</td>
                          <td>{moneyKes(row.issued)}</td>
                          <td>{moneyKes(row.repaid)}</td>
                          <td className="text-danger" style={{ fontWeight: 700 }}>
                            {moneyKes(row.arrears)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-success" style={{ textAlign: 'center', fontWeight: 700 }}>
                  No Defaulter Found!
                </p>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export default function Groups({ email, constituency, revision, onNavigate }: LmsPageProps) {
  const [groups, setGroups] = useState<EnrichedGroup[]>([]);
  const [wards, setWards] = useState<Record<string, unknown>[]>([]);
  const [loans, setLoans] = useState<Record<string, unknown>[]>([]);
  const [receipts, setReceipts] = useState<Record<string, unknown>[]>([]);
  const [members, setMembers] = useState<Record<string, unknown>[]>([]);
  const [links, setLinks] = useState<Record<string, unknown>[]>([]);
  const [query, setQuery] = useState('');
  const [wardFilter, setWardFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [localRevision, setLocalRevision] = useState(0);
  const perPage = 25;

  useEffect(() => {
    void (async () => {
      const bundle = await loadConstituencyBundle(email);
      setWards(bundle.wards);
      setLoans(bundle.loans);
      setReceipts(bundle.receipts);
      setMembers(bundle.members);
      setLinks(bundle.links);
      setGroups(enrichGroups(bundle.groups, bundle.wards, bundle.loans));
    })();
  }, [email, revision, localRevision]);

  const demographics = useMemo(() => groupDemographics(groups, loans), [groups, loans]);

  const categories = useMemo(() => {
    const set = new Set(groups.map((g) => String(g.category || '').trim()).filter(Boolean));
    return [...set].sort();
  }, [groups]);

  const sectors = useMemo(() => {
    const set = new Set(groups.map((g) => String(g.sector || '').trim()).filter(Boolean));
    return [...set].sort();
  }, [groups]);

  const filtered = useMemo(() => {
    return groups.filter((row) => {
      if (wardFilter && String(row.ward_id) !== wardFilter) return false;
      if (categoryFilter && String(row.category) !== categoryFilter) return false;
      if (sectorFilter && String(row.sector) !== sectorFilter) return false;
      return matchesSearch(row, query, ['name', 'reg_number', 'identifier', 'code', 'gfs_code', 'ward_name', 'category', 'sector']);
    });
  }, [groups, wardFilter, categoryFilter, sectorFilter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);
  const selected = groups.find((g) => String(g.id) === selectedId) || null;

  if (selected) {
    return (
      <GroupDetail
        email={email}
        group={selected}
        loans={loans}
        receipts={receipts}
        members={members}
        links={links}
        onBack={() => setSelectedId(null)}
        onNavigate={onNavigate}
        onGroupSaved={() => setLocalRevision((n) => n + 1)}
      />
    );
  }

  return (
    <div>
      <div className="lms-hero-banner">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h2>{constituency || 'Constituency'} Constituency Groups</h2>
            <p>Groups Data</p>
          </div>
          <span className="lms-badge lms-badge--info">{filtered.length} groups</span>
        </div>
      </div>

      <h5 className="lms-muted" style={{ fontWeight: 700, margin: '0 0 0.65rem' }}>
        Groups Summary (Women, Youth, and PWDs)
      </h5>
      <div className="lms-demo-grid">
        {demographics.map((d) => (
          <div key={d.label} className="lms-demo-card">
            <div className="lms-demo-card__top">
              <div className={`lms-demo-card__icon tone-${d.color}`}>{d.val}</div>
              <div>
                <h3>{d.val}</h3>
                <p>{d.label}</p>
              </div>
            </div>
            {d.cat ? (
              <>
                <div className="lms-bar-list__meta">
                  <span className="lms-muted">Capital Share</span>
                  <strong>{d.percentage}%</strong>
                </div>
                <div className="lms-progress">
                  <span className={`tone-${d.color}`} style={{ width: `${d.percentage}%` }} />
                </div>
                <small className="lms-muted" style={{ fontWeight: 700 }}>
                  {moneyKes(d.amount || 0)}/=
                </small>
              </>
            ) : (
              <div className="lms-muted" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.35rem', fontSize: '0.72rem', fontWeight: 700 }}>
                Total Registry
              </div>
            )}
          </div>
        ))}
      </div>

      <section className="lms-card">
        <div className="lms-card__head">
          <h2>Beneficiary groups</h2>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-default btn-sm"
              onClick={() => {
                setQuery('');
                setWardFilter('');
                setCategoryFilter('');
                setSectorFilter('');
                setPage(1);
              }}
            >
              Clear filters
            </button>
            <button
              type="button"
              className="btn-outline-dark btn-sm"
              onClick={() => {
                const header = ['Name', 'Reg', 'GFS', 'Ward', 'Category', 'Sector', 'Identifier'];
                const lines = [
                  header.join(','),
                  ...filtered.map((g) =>
                    [g.name, g.reg_number, g.gfs_code, g.ward_name, g.category, g.sector, g.identifier]
                      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
                      .join(','),
                  ),
                ];
                const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `groups-${constituency || 'export'}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export Data
            </button>
          </div>
        </div>
        <div className="lms-card__body">
          <div className="lms-tools">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search groups/gfs/identifier..."
            />
          </div>
          <div className="lms-filter-grid">
            <label>
              Ward
              <select
                value={wardFilter}
                onChange={(e) => {
                  setWardFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Select</option>
                {wards.map((ward) => (
                  <option key={String(ward.id)} value={String(ward.id)}>
                    {String(ward.ward_name || ward.id)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sector
              <select
                value={sectorFilter}
                onChange={(e) => {
                  setSectorFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All</option>
                {sectors.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Display
              <select value={String(perPage)} disabled>
                <option value="25">25 per page</option>
              </select>
            </label>
          </div>
        </div>
        <div className="lms-table-wrap">
          <table className="lms-table">
            <thead>
              <tr>
                <th>Group Data</th>
                <th>GFS Code</th>
                <th>Ward</th>
                <th>Category</th>
                <th>Sector</th>
                <th>Identifier</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length ? (
                pageRows.map((group) => (
                  <tr key={String(group.id)} className="lms-row-clickable" onClick={() => setSelectedId(String(group.id))}>
                    <td>
                      <strong style={{ display: 'block' }}>{String(group.name)}</strong>
                      <small className="lms-muted" style={{ display: 'block' }}>
                        REG #: {String(group.reg_number || 'N/A')}
                      </small>
                      <small className="lms-muted">{String(group.date_registered || 'Date N/A')}</small>
                    </td>
                    <td className="font-mono">{String(group.gfs_code || '—')}</td>
                    <td>{String(group.ward_name)}</td>
                    <td>{String(group.category || '—')}</td>
                    <td>{String(group.sector || '—')}</td>
                    <td>{String(group.identifier || group.code || '—')}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-outline-info btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(String(group.id));
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="lms-empty">
                    No groups found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="lms-card__body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <span className="lms-muted">
            Page {page} of {pageCount} · {filtered.length} groups
          </span>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button type="button" className="btn-default btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Prev
            </button>
            <button type="button" className="btn-default btn-sm" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
