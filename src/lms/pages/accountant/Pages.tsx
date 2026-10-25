import { PageHeader } from '../../shell/PageHeader';
import { Card } from '../../shell/Card';
import { LiveList } from '../hq/LiveList';
import type { LmsPageProps } from '../../types';

export function AccountantPhases(props: LmsPageProps) {
  return <LiveList {...props} title="Phases for" accent="Payment" pathIncludes="/accountant/phases" />;
}

export function AccountantHome({ online, onNavigate }: LmsPageProps) {
  return (
    <div>
      <PageHeader title="Accounts" accent="LMS" crumb={online ? 'Online' : 'Offline'} />
      <Card title="Accountant">
        <p className="lms-muted">Accountant modules load only for this role.</p>
        <button type="button" className="btn-primary" onClick={() => onNavigate('phases')}>
          Open phases for payment
        </button>
      </Card>
    </div>
  );
}
