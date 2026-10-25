import type { ComponentType } from 'react';
import type { LmsRole } from '../lib/lmsSync';

export type LmsPageProps = {
  email: string;
  role: LmsRole;
  constituency: string;
  online: boolean | null;
  busy: boolean;
  setBusy: (value: boolean) => void;
  setNotice: (value: string) => void;
  onNavigate: (pageId: string) => void;
  revision: number;
};

export type LmsMenuItem = {
  id: string;
  group: string;
  title: string;
  path: string;
};

export type LmsPageLoader = () => Promise<{ default: ComponentType<LmsPageProps> }>;
