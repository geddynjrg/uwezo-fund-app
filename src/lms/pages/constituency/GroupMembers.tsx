import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../shell/PageHeader';
import { Card } from '../../shell/Card';
import { DataTable } from '../../shell/DataTable';
import { SearchBar } from '../../shell/SearchBar';
import { StatusBadge } from '../../shell/StatusBadge';
import { loadTable, matchesSearch } from '../../lib/localQuery';
import type { LmsPageProps } from '../../types';

export default function GroupMembers({ email, constituency, revision }: LmsPageProps) {
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
    const byId = new Map(members.map((m) => [String(m.id), m]));
    return links.map((link) => {
      const member = byId.get(String(link.member_id ?? link.member_Id ?? '')) || {};
      return {
        ...link,
        member_name: member.name || member.full_name || member.member_name || '—',
        id_number: member.id_number || member.national_id || member.member_Id || '—',
        phone: member.phone || member.mobile || '—',
      };
    });
  }, [members, links]);

  const filtered = useMemo(
    () => rows.filter((row) => matchesSearch(row, query, ['member_name', 'id_number', 'phone', 'role', 'group_id', 'status'])),
    [rows, query],
  );

  return (
    <div>
      <PageHeader title="Group" accent="Members" crumb={constituency || 'Constituency'} />
      <Card title={`Members (${filtered.length})`} flush>
        <div className="lms-card__body">
          <SearchBar value={query} onChange={setQuery} placeholder="Search members…" />
        </div>
        <DataTable
          rows={filtered}
          empty="No group members in the encrypted copy."
          columns={[
            { key: 'member_name', label: 'Name' },
            { key: 'id_number', label: 'ID' },
            { key: 'phone', label: 'Phone' },
            { key: 'role', label: 'Role' },
            { key: 'group_id', label: 'Group id' },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
          ]}
        />
      </Card>
    </div>
  );
}
