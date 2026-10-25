import { PageHeader } from '../../shell/PageHeader';
import { Card } from '../../shell/Card';
import type { LmsPageProps } from '../../types';

export default function StaffDashboard({ role, online }: LmsPageProps) {
  return (
    <div>
      <PageHeader title="Staff" accent="Portal" crumb={role} />
      <Card title="Limited staff access">
        <p className="lms-muted">
          This account has a basic staff role. {online ? 'Sync is available when LMS is reachable.' : 'Connect online to sync.'}
        </p>
      </Card>
    </div>
  );
}
