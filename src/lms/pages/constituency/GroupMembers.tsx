import { useEffect, useMemo, useState } from 'react';
import { createMemberOffline, deleteMemberOffline, saveMemberOffline } from '../../../lib/lmsOfflineSync';
import { enrichGroups, loadConstituencyBundle, type EnrichedGroup } from '../../lib/analytics';
import { matchesSearch } from '../../lib/localQuery';
import { PageHeader } from '../../shell/PageHeader';
import { StatusBadge } from '../../shell/StatusBadge';
import type { LmsPageProps } from '../../types';

export default function GroupMembers({ email, constituency, revision, onNavigate, setNotice }: LmsPageProps) {
  const [members, setMembers] = useState<Record<string, unknown>[]>([]);
  const [links, setLinks] = useState<Record<string, unknown>[]>([]);
  const [loans, setLoans] = useState<Record<string, unknown>[]>([]);
  const [groups, setGroups] = useState<EnrichedGroup[]>([]);
  const [query, setQuery] = useState('');
  const [wardFilter, setWardFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editGender, setEditGender] = useState('Male');
  const [editDisabled, setEditDisabled] = useState(false);
  const [editIdNumber, setEditIdNumber] = useState('');
  const [editRole, setEditRole] = useState('Member');
  const [loanId, setLoanId] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [localRevision, setLocalRevision] = useState(0);

  useEffect(() => {
    void (async () => {
      const bundle = await loadConstituencyBundle(email);
      setMembers(bundle.members);
      setLinks(bundle.links);
      setLoans(bundle.loans);
      setGroups(enrichGroups(bundle.groups, bundle.wards, bundle.loans));
    })();
  }, [email, revision, localRevision]);

  const groupById = useMemo(() => new Map(groups.map((g) => [String(g.id), g])), [groups]);

  const rows = useMemo(() => {
    return links.map((link) => {
      const key = String(link.member_id ?? link.member_Id ?? '');
      const member =
        members.find((m) => String(m.id) === key || String(m.member_Id) === key) || {};
      const group = groupById.get(String(link.group_id ?? '')) || ({} as EnrichedGroup);
      return {
        ...link,
        member_pk: member.id,
        member_name: member.name || member.full_name || member.member_name || '—',
        gender: member.gender || '—',
        id_number: member.id_number || member.national_id || link.member_Id || '—',
        phone: member.phone || member.mobile || member.number || '—',
        disabled: Boolean(member.disabled || member.pwd),
        role: link.role || 'Member',
        group_name: group.name || `Group #${link.group_id}`,
        ward_name: group.ward_name || '—',
        ward_id: group.ward_id,
        status: link.status || member.status || 'Active',
      } as Record<string, unknown>;
    });
  }, [links, members, groupById]);

  const wards = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) map.set(String(g.ward_id || ''), String(g.ward_name || ''));
    return [...map.entries()].filter(([id, name]) => id && name).map(([id, name]) => ({ id, name }));
  }, [groups]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (wardFilter && String(row.ward_id) !== wardFilter) return false;
      if (groupFilter && String(row.group_id) !== groupFilter) return false;
      return matchesSearch(row, query, ['member_name', 'id_number', 'phone', 'role', 'group_name', 'ward_name', 'status']);
    });
  }, [rows, query, wardFilter, groupFilter]);

  function openEdit(row: Record<string, unknown>) {
    setSelected(row);
    setEditing(true);
    setAdding(false);
    setEditName(String(row.member_name || ''));
    setEditPhone(String(row.phone === '—' ? '' : row.phone || ''));
    const g = String(row.gender || 'Male');
    setEditGender(g.toLowerCase().startsWith('f') ? 'Female' : 'Male');
    setEditDisabled(Boolean(row.disabled));
    setNote('');
    setError('');
  }

  function openAdd() {
    setAdding(true);
    setEditing(false);
    setSelected(null);
    setEditName('');
    setEditPhone('');
    setEditGender('Male');
    setEditDisabled(false);
    setEditIdNumber('');
    setEditRole('Member');
    setLoanId(loans[0] ? String(loans[0].id) : '');
    setNote('');
    setError('');
  }

  async function saveEdit() {
    const memberId = Number(selected?.member_pk);
    if (!memberId || !editName.trim()) {
      setError('Enter the member name.');
      return;
    }
    setBusy(true);
    setError('');
    const result = await saveMemberOffline({
      email,
      id: memberId,
      name: editName.trim(),
      number: editPhone.trim(),
      gender: editGender,
      disabled: editDisabled,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    setNote(result.detail);
    setNotice?.(result.detail);
    setEditing(false);
    setLocalRevision((n) => n + 1);
    setSelected((current) =>
      current
        ? {
            ...current,
            member_name: editName.trim(),
            phone: editPhone.trim() || '—',
            gender: editGender,
            disabled: editDisabled,
          }
        : current,
    );
  }

  async function saveAdd() {
    if (!loanId || !editName.trim() || !editIdNumber.trim()) {
      setError('Select a loan and enter name plus national ID.');
      return;
    }
    setBusy(true);
    setError('');
    const result = await createMemberOffline({
      email,
      group_loans_id: Number(loanId),
      name: editName.trim(),
      member_Id: editIdNumber.trim(),
      number: editPhone.trim(),
      gender: editGender,
      role: editRole.trim() || 'Member',
      disabled: editDisabled,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    setNotice?.(result.detail);
    setAdding(false);
    setLocalRevision((n) => n + 1);
  }

  async function removeMember(row: Record<string, unknown>) {
    if (!window.confirm(`Remove ${String(row.member_name)} from this loan group?`)) return;
    setBusy(true);
    const result = await deleteMemberOffline({
      email,
      group_member_id: row.id as string | number,
    });
    setBusy(false);
    setNotice?.(result.detail);
    if (result.ok) {
      setSelected(null);
      setLocalRevision((n) => n + 1);
    } else {
      setError(result.detail);
    }
  }

  const memberStats = useMemo(() => {
    const unique = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      const key = String(row.member_pk || row.id_number || row.member_name);
      if (!unique.has(key)) unique.set(key, row);
    }
    const list = [...unique.values()];
    const female = list.filter((r) => /^f/i.test(String(r.gender || ''))).length;
    const male = list.filter((r) => /^m/i.test(String(r.gender || ''))).length;
    const pwd = list.filter((r) => Boolean(r.disabled)).length;
    return { total: list.length, female, male, pwd };
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Members Information"
        crumb={`${constituency || 'Constituency'} · group members registry`}
        actions={
          <button type="button" className="btn-primary btn-sm" onClick={openAdd}>
            Add member
          </button>
        }
      />

      <div className="lms-stat-grid">
        <div className="lms-stat lms-stat--info">
          <h3>{memberStats.total}</h3>
          <p>Total members</p>
        </div>
        <div className="lms-stat lms-stat--success">
          <h3>{memberStats.female}</h3>
          <p>Female</p>
        </div>
        <div className="lms-stat lms-stat--warning">
          <h3>{memberStats.male}</h3>
          <p>Male</p>
        </div>
        <div className="lms-stat lms-stat--primary" style={{ background: 'var(--lms-danger)' }}>
          <h3>{memberStats.pwd}</h3>
          <p>PWD</p>
        </div>
      </div>

      {adding ? (
        <section className="lms-card">
          <div className="lms-card__head">
            <h2>Add member</h2>
          </div>
          <div className="lms-card__body">
            {error ? <p className="lms-note" style={{ color: '#b3261e' }}>{error}</p> : null}
            <form
              className="lms-form"
              onSubmit={(event) => {
                event.preventDefault();
                void saveAdd();
              }}
            >
              <label>
                Group loan
                <select value={loanId} onChange={(e) => setLoanId(e.target.value)} required>
                  <option value="">Select loan…</option>
                  {loans.map((loan) => {
                    const group = groupById.get(String(loan.group_id));
                    return (
                      <option key={String(loan.id)} value={String(loan.id)}>
                        #{String(loan.id)} · {String(group?.name || loan.gfs_code || 'loan')}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label>
                Full name
                <input value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </label>
              <label>
                National ID
                <input value={editIdNumber} onChange={(e) => setEditIdNumber(e.target.value)} required />
              </label>
              <label>
                Phone
                <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} inputMode="tel" />
              </label>
              <label>
                Position
                <input value={editRole} onChange={(e) => setEditRole(e.target.value)} />
              </label>
              <label>
                Gender
                <select value={editGender} onChange={(e) => setEditGender(e.target.value)}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </label>
              <label className="lms-check">
                <input type="checkbox" checked={editDisabled} onChange={(e) => setEditDisabled(e.target.checked)} />
                Person with disability (PWD)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Add member'}
                </button>
                <button type="button" className="btn-default" onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      <section className="lms-outline-card">
        <div className="lms-outline-card__head">
          <h2>Members Information Data</h2>
          <button type="button" className="btn-outline-info btn-sm" onClick={() => onNavigate('groups')}>
            Groups registry
          </button>
        </div>
        <div className="lms-card__body">
          <div className="lms-tools">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name / ID / phone…" />
          </div>
          <div className="lms-filter-grid">
            <label>
              Ward
              <select value={wardFilter} onChange={(e) => setWardFilter(e.target.value)}>
                <option value="">All wards</option>
                {wards.map((ward) => (
                  <option key={ward.id} value={ward.id}>
                    {ward.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Group
              <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                <option value="">All groups</option>
                {groups.map((group) => (
                  <option key={String(group.id)} value={String(group.id)}>
                    {String(group.name)}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
                <th>Group</th>
                <th>Contact</th>
                <th>PWD</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.slice(0, 500).map((row, index) => (
                  <tr key={`${row.id ?? row.member_id}-${index}`}>
                    <td>{index + 1}</td>
                    <td style={{ fontWeight: 700 }}>{String(row.member_name)}</td>
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
                    <td>{String(row.group_name)}</td>
                    <td>{String(row.phone)}</td>
                    <td>{row.disabled ? 'Yes' : 'No'}</td>
                    <td>
                      <StatusBadge value={row.status} />
                    </td>
                    <td style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      <button type="button" className="btn-outline-info btn-xs" onClick={() => { setSelected(row); setEditing(false); setAdding(false); setNote(''); setError(''); }}>
                        View
                      </button>
                      <button type="button" className="btn-outline-primary btn-xs" onClick={() => openEdit(row)}>
                        Edit
                      </button>
                      <button type="button" className="btn-outline-danger btn-xs" onClick={() => void removeMember(row)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="lms-empty">
                    No group members in the encrypted copy.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <div
          className="lms-modal-backdrop"
          onClick={() => {
            setSelected(null);
            setEditing(false);
          }}
        >
          <div className="lms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lms-modal__head">
              <h2>{editing ? 'Edit member' : 'Member profile'}</h2>
              <button
                type="button"
                className="btn-default btn-sm"
                onClick={() => {
                  setSelected(null);
                  setEditing(false);
                }}
              >
                Close
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
                    void saveEdit();
                  }}
                >
                  <label>
                    Full name
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} required />
                  </label>
                  <label>
                    Phone
                    <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} inputMode="tel" />
                  </label>
                  <label>
                    Gender
                    <select value={editGender} onChange={(e) => setEditGender(e.target.value)}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </label>
                  <label className="lms-check">
                    <input type="checkbox" checked={editDisabled} onChange={(e) => setEditDisabled(e.target.checked)} />
                    Person with disability (PWD)
                  </label>
                  <p className="lms-muted" style={{ fontSize: '0.82rem' }}>
                    Saves to the encrypted offline database and syncs to the live LMS when online (same path as receipts).
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="submit" className="btn-primary btn-sm" disabled={busy}>
                      {busy ? 'Saving…' : 'Save changes'}
                    </button>
                    <button type="button" className="btn-default btn-sm" onClick={() => setEditing(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <ul className="lms-kv">
                    <li>
                      <b>Name</b>
                      <span>{String(selected.member_name)}</span>
                    </li>
                    <li>
                      <b>ID Number</b>
                      <span>{String(selected.id_number)}</span>
                    </li>
                    <li>
                      <b>Gender</b>
                      <span>{String(selected.gender)}</span>
                    </li>
                    <li>
                      <b>Phone</b>
                      <span>{String(selected.phone)}</span>
                    </li>
                    <li>
                      <b>Position</b>
                      <span>{String(selected.role)}</span>
                    </li>
                    <li>
                      <b>Group</b>
                      <span>{String(selected.group_name)}</span>
                    </li>
                    <li>
                      <b>Ward</b>
                      <span>{String(selected.ward_name)}</span>
                    </li>
                    <li>
                      <b>PWD</b>
                      <span>{selected.disabled ? 'Yes' : 'No'}</span>
                    </li>
                  </ul>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn-outline-primary btn-sm" onClick={() => openEdit(selected)}>
                      Edit member
                    </button>
                    <button type="button" className="btn-outline-danger btn-sm" disabled={busy} onClick={() => void removeMember(selected)}>
                      Delete from group
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
