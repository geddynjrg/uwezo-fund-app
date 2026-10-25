import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../shell/PageHeader';
import { Card } from '../../shell/Card';
import { DataTable } from '../../shell/DataTable';
import { SearchBar } from '../../shell/SearchBar';
import { loadTable, matchesSearch } from '../../lib/localQuery';
import type { LmsPageProps } from '../../types';

export default function Contagious({ email, constituency, revision }: LmsPageProps) {
  const [members, setMembers] = useState<Record<string, unknown>[]>([]);
  const [links, setLinks] = useState<Record<string, unknown>[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void (async () => {
      setMembers(await loadTable('members'));
      setLinks(await loadTable('group_members'));
    })();
  }, [email, revision]);

  const rows = useMemo(() => {
    const counts = new Map<string, { count: number; groups: Set<string>; sample: Record<string, unknown> }>();
    for (const link of links) {
      const mid = String(link.member_id ?? link.member_Id ?? '');
      if (!mid) continue;
      const entry = counts.get(mid) || { count: 0, groups: new Set<string>(), sample: link };
      entry.count += 1;
      entry.groups.add(String(link.group_id ?? ''));
      counts.set(mid, entry);
    }
    const byId = new Map(members.map((m) => [String(m.id), m]));
    return [...counts.entries()]
      .filter(([, value]) => value.count > 1)
      .map(([id, value]) => {
        const member = byId.get(id) || {};
        return {
          id,
          name: member.name || member.full_name || '—',
          id_number: member.id_number || member.national_id || '—',
          groups: value.count,
          group_ids: [...value.groups].filter(Boolean).join(', '),
        };
      });
  }, [members, links]);

  const filtered = useMemo(
    () => rows.filter((row) => matchesSearch(row, query, ['name', 'id_number', 'group_ids'])),
    [rows, query],
  );

  return (
    <div>
      <PageHeader title="Contagious" accent="Members" crumb={constituency || 'Constituency'} />
      <Card title={`Members in multiple groups (${filtered.length})`} flush>
        <div className="lms-card__body">
          <SearchBar value={query} onChange={setQuery} placeholder="Search contagious members…" />
        </div>
        <DataTable
          rows={filtered}
          empty="No multi-group members found in the encrypted copy."
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'id_number', label: 'ID number' },
            { key: 'groups', label: 'Groups' },
            { key: 'group_ids', label: 'Group ids' },
          ]}
        />
      </Card>
    </div>
  );
}
