import { useEffect, useMemo, useState } from 'react';
import { enrichGroups, loadConstituencyBundle, type EnrichedGroup } from '../../lib/analytics';
import { matchesSearch } from '../../lib/localQuery';
import type { LmsPageProps } from '../../types';

export default function Contagious({ email, constituency, revision, onNavigate }: LmsPageProps) {
  const [members, setMembers] = useState<Record<string, unknown>[]>([]);
  const [links, setLinks] = useState<Record<string, unknown>[]>([]);
  const [groups, setGroups] = useState<EnrichedGroup[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void (async () => {
      const bundle = await loadConstituencyBundle(email);
      setMembers(bundle.members);
      setLinks(bundle.links);
      setGroups(enrichGroups(bundle.groups, bundle.wards, bundle.loans));
    })();
  }, [email, revision]);

  const groupById = useMemo(() => new Map(groups.map((g) => [String(g.id), g])), [groups]);

  const rows = useMemo(() => {
    const counts = new Map<string, { count: number; groups: Set<string> }>();
    for (const link of links) {
      const mid = String(link.member_id ?? link.member_Id ?? '');
      if (!mid) continue;
      const entry = counts.get(mid) || { count: 0, groups: new Set<string>() };
      entry.count += 1;
      entry.groups.add(String(link.group_id ?? ''));
      counts.set(mid, entry);
    }
    const byId = new Map(members.map((m) => [String(m.id), m]));
    return [...counts.entries()]
      .filter(([, value]) => value.groups.size > 1)
      .map(([id, value]) => {
        const member = byId.get(id) || {};
        const names = [...value.groups]
          .filter(Boolean)
          .map((gid) => String(groupById.get(gid)?.name || gid))
          .join(', ');
        return {
          id,
          name: member.name || member.full_name || '—',
          id_number: member.id_number || member.national_id || '—',
          phone: member.phone || member.mobile || member.number || '—',
          groups: value.groups.size,
          group_names: names,
        };
      })
      .sort((a, b) => b.groups - a.groups);
  }, [members, links, groupById]);

  const filtered = useMemo(
    () => rows.filter((row) => matchesSearch(row, query, ['name', 'id_number', 'group_names', 'phone'])),
    [rows, query],
  );

  return (
    <div>
      <div className="lms-hero-banner">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <h2>Contagious Members</h2>
            <p>{constituency || 'Constituency'} · members linked to more than one group</p>
          </div>
          <button type="button" className="btn-outline-info btn-sm" onClick={() => onNavigate('group-members')}>
            All members
          </button>
        </div>
      </div>

      <div className="lms-kpi-grid">
        <div className="lms-kpi">
          <div className="lms-kpi__label">Contagious</div>
          <div className="lms-kpi__value">{filtered.length}</div>
        </div>
        <div className="lms-kpi">
          <div className="lms-kpi__label">Max groups</div>
          <div className="lms-kpi__value">{filtered[0]?.groups ?? 0}</div>
        </div>
      </div>

      <section className="lms-card">
        <div className="lms-card__head">
          <h2>Members in multiple groups ({filtered.length})</h2>
        </div>
        <div className="lms-card__body">
          <div className="lms-tools">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contagious members…" />
          </div>
        </div>
        <div className="lms-table-wrap">
          <table className="lms-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>ID number</th>
                <th>Phone</th>
                <th>Groups</th>
                <th>Group names</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((row) => (
                  <tr key={String(row.id)}>
                    <td style={{ fontWeight: 700 }}>{String(row.name)}</td>
                    <td>
                      <code>{String(row.id_number)}</code>
                    </td>
                    <td>{String(row.phone)}</td>
                    <td>
                      <span className="lms-badge lms-badge--warn">{Number(row.groups)}</span>
                    </td>
                    <td className="lms-muted">{String(row.group_names)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="lms-empty">
                    No multi-group members found in the encrypted copy.
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
