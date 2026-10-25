type StatusBadgeProps = {
  value?: unknown;
};

export function StatusBadge({ value }: StatusBadgeProps) {
  const text = value == null || value === '' ? '—' : String(value);
  const lower = text.toLowerCase();
  let tone = '';
  if (/active|approved|paid|disbursed|ok|synced/.test(lower)) tone = 'lms-badge--ok';
  else if (/pending|review|submitted|draft/.test(lower)) tone = 'lms-badge--warn';
  else if (/reject|default|arrear|fail|locked/.test(lower)) tone = 'lms-badge--danger';
  else if (/hq|phase|open/.test(lower)) tone = 'lms-badge--info';
  return <span className={`lms-badge ${tone}`.trim()}>{text}</span>;
}
