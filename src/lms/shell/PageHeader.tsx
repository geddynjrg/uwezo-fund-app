type PageHeaderProps = {
  title: string;
  accent?: string;
  crumb?: string;
};

export function PageHeader({ title, accent, crumb }: PageHeaderProps) {
  return (
    <div className="lms-page-head">
      <h1>
        {title}
        {accent ? (
          <>
            {' '}
            <span>{accent}</span>
          </>
        ) : null}
      </h1>
      {crumb ? <p className="lms-crumb">{crumb}</p> : null}
    </div>
  );
}
