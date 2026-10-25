import type { ReactNode } from 'react';

type CardProps = {
  title: string;
  tools?: ReactNode;
  flush?: boolean;
  children: ReactNode;
};

export function Card({ title, tools, flush, children }: CardProps) {
  return (
    <section className="lms-card">
      <div className="lms-card__head">
        <h2>{title}</h2>
        {tools || null}
      </div>
      <div className={flush ? 'lms-card__body lms-card__body--flush' : 'lms-card__body'}>{children}</div>
    </section>
  );
}
