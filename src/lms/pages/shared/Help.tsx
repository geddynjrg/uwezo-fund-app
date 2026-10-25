import { PageHeader } from '../../shell/PageHeader';
import { Card } from '../../shell/Card';
import type { LmsPageProps } from '../../types';

export default function Help({ role, constituency, online }: LmsPageProps) {
  return (
    <div>
      <PageHeader title="Help" accent="LMS" crumb={`${role} · ${constituency || 'National'}`} />
      <Card title="Using the in-app LMS">
        <p className="lms-muted">
          This React LMS mirrors the screens on lms.uwezo.go.ke for your role. Only the modules for your account are loaded.
        </p>
        <ul className="lms-muted">
          <li>Tap <strong>Sync</strong> while online to download and encrypt your constituency database.</li>
          <li>Tap <strong>Compare</strong> when you have offline changes waiting to send.</li>
          <li>Mail and mailbox password stay under the Menu.</li>
          <li>Status: {online === null ? 'checking…' : online ? 'online' : 'offline'}.</li>
        </ul>
      </Card>
    </div>
  );
}
