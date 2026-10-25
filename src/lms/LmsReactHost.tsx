import { useEffect, useState, type ComponentType } from 'react';
import './lms-ui.css';
import { loadRolePage } from './registry';
import type { LmsPageProps } from './types';
import type { LmsRole } from '../lib/lmsSync';

type LmsReactHostProps = LmsPageProps & {
  pageId: string;
};

export function LmsReactHost({ pageId, role, ...rest }: LmsReactHostProps) {
  const [Page, setPage] = useState<ComponentType<LmsPageProps> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setPage(null);
    setError('');
    void loadRolePage(role as LmsRole, pageId)
      .then((mod) => {
        if (!cancelled) setPage(() => mod.default);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this LMS screen.');
      });
    return () => {
      cancelled = true;
    };
  }, [role, pageId]);

  if (error) {
    return (
      <div className="lms-react__body">
        <div className="lms-placeholder">
          <h2>Screen unavailable</h2>
          <p className="lms-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (!Page) {
    return (
      <div className="lms-react__body">
        <p className="lms-empty">Loading {pageId}…</p>
      </div>
    );
  }

  return (
    <div className="lms-react__body">
      <Page {...rest} role={role} />
    </div>
  );
}
