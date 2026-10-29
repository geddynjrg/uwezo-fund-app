import type { LmsPageProps } from '../../types';

export default function StaffDashboard({ online, onNavigate }: LmsPageProps) {
  return (
    <div>
      <div className="lms-hero-banner">
        <h2>Staff LMS</h2>
        <p>{online ? 'Connected to LMS session' : 'Offline — limited modules for this role'}</p>
      </div>
      <section className="lms-card">
        <div className="lms-card__head">
          <h2>Available modules</h2>
        </div>
        <div className="lms-card__body">
          <p className="lms-muted">Staff accounts see role-gated modules only. Use Help for guidance, or Sync when online.</p>
          <button type="button" className="btn-info btn-sm" onClick={() => onNavigate('help')}>
            Open help
          </button>
        </div>
      </section>
    </div>
  );
}
