import type { ReactNode } from 'react';
import { currentFyLabel } from '../lib/fyLabel';

type PageHeaderProps = {
  title: string;
  accent?: string;
  crumb?: string;
  badge?: string;
  showFyBadge?: boolean;
  actions?: ReactNode;
};

/** Live AdminLTE `border-left-info` page header (5px #17a2b8). */
export function PageHeader({ title, accent, crumb, badge, showFyBadge = true, actions }: PageHeaderProps) {
  const fy = badge || (showFyBadge ? currentFyLabel() : '');
  return (
    <div className="lms-info-header">
      <div className="lms-info-header__row">
        <div className="lms-info-header__main">
          <h1>
            {title}
            {accent ? <span className="lms-info-header__accent"> {accent}</span> : null}
          </h1>
          {crumb ? <p>{crumb}</p> : null}
        </div>
        <div className="lms-info-header__aside">
          {fy ? <span className="lms-fy-badge">{fy}</span> : null}
          {actions ? <div className="lms-info-header__actions">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
