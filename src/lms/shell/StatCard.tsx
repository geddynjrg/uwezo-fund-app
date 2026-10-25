type StatCardProps = {
  value: string | number;
  label: string;
  tone?: 'info' | 'primary' | 'warning' | 'success';
  actionLabel?: string;
  onAction?: () => void;
};

export function StatCard({ value, label, tone = 'info', actionLabel, onAction }: StatCardProps) {
  return (
    <div className={`lms-stat lms-stat--${tone}`}>
      <h3>{value}</h3>
      <p>{label}</p>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
