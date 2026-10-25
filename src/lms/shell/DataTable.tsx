import type { ReactNode } from 'react';

type Column = {
  key: string;
  label: string;
  render?: (row: Record<string, unknown>) => ReactNode;
};

type DataTableProps = {
  columns: Column[];
  rows: Record<string, unknown>[];
  empty?: string;
};

function cellText(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function DataTable({ columns, rows, empty = 'No records yet.' }: DataTableProps) {
  if (!rows.length) {
    return <p className="lms-empty">{empty}</p>;
  }
  return (
    <div className="lms-table-wrap">
      <table className="lms-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id ?? index)}>
              {columns.map((col) => (
                <td key={col.key}>{col.render ? col.render(row) : cellText(row[col.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
