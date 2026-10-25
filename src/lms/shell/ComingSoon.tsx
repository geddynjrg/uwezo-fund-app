import { PageHeader } from './PageHeader';
import type { LmsPageProps } from '../types';

type ComingSoonProps = LmsPageProps & {
  title: string;
  detail?: string;
};

export function ComingSoon({ title, detail, constituency, role }: ComingSoonProps) {
  return (
    <div>
      <PageHeader title={title} accent="LMS" crumb={`${role} · ${constituency || 'National'}`} />
      <div className="lms-placeholder">
        <h2>{title}</h2>
        <p className="lms-muted">
          {detail || 'This screen is part of the React LMS rebuild and will match the live site in a following update.'}
        </p>
      </div>
    </div>
  );
}
