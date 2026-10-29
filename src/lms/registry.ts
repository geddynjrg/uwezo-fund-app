import type { ComponentType } from 'react';
import {
  LMS_PAGES,
  constituencyMenu,
  inferConstituencyBase,
  loadLmsCache,
  menuForEmail,
  type LmsRole,
} from '../lib/lmsSync';
import type { LmsMenuItem, LmsPageLoader, LmsPageProps } from './types';

/** Lazy loaders — only the signed-in role’s chunks are imported. */
const constituencyLoaders: Record<string, LmsPageLoader> = {
  dashboard: () => import('./pages/constituency/Dashboard'),
  groups: () => import('./pages/constituency/Groups'),
  'group-members': () => import('./pages/constituency/GroupMembers'),
  contagious: () => import('./pages/constituency/Contagious'),
  'loan-phase': () => import('./pages/constituency/LoanPhases'),
  'group-loans': () => import('./pages/constituency/GroupLoans'),
  receipts: () => import('./pages/constituency/Receipts'),
  applications: () => import('./pages/constituency/Applications'),
  tasks: () => import('./pages/constituency/Applications').then((m) => ({ default: m.ApplicationTasks })),
  'applied-loans': () => import('./pages/constituency/Applications').then((m) => ({ default: m.AppliedLoans })),
  upload: () => import('./pages/constituency/ReportTable').then((m) => ({ default: m.UploadData })),
  volume: () => import('./pages/constituency/ReportTable').then((m) => ({ default: m.VolumeReport })),
  report: () => import('./pages/constituency/ReportTable').then((m) => ({ default: m.DynamicReport })),
  ledger: () => import('./pages/constituency/ReportTable').then((m) => ({ default: m.LedgerReport })),
  restore: () => import('./pages/constituency/ReportTable').then((m) => ({ default: m.RestoreData })),
  audit: () => import('./pages/constituency/ReportTable').then((m) => ({ default: m.AuditReport })),
  disbursement: () => import('./pages/constituency/ReportTable').then((m) => ({ default: m.DisbursementReport })),
  sector: () => import('./pages/constituency/ReportTable').then((m) => ({ default: m.SectorReport })),
  users: () => import('./pages/constituency/ReportTable').then((m) => ({ default: m.CountyUsers })),
  'add-user': () => import('./pages/constituency/ReportTable').then((m) => ({ default: m.AddUser })),
  'county-audit': () => import('./pages/constituency/ReportTable').then((m) => ({ default: m.CountyAudit })),
  help: () => import('./pages/shared/Help'),
};

const hqLoaders: Record<string, LmsPageLoader> = {
  dashboard: () => import('./pages/hq/Dashboard'),
  applications: () => import('./pages/hq/LiveList').then((m) => ({ default: m.HqApplications })),
  tasks: () => import('./pages/hq/LiveList').then((m) => ({ default: m.HqTasks })),
  allocations: () => import('./pages/hq/LiveList').then((m) => ({ default: m.HqAllocations })),
  groups: () => import('./pages/hq/LiveList').then((m) => ({ default: m.HqGroups })),
  'group-loans': () => import('./pages/hq/LiveList').then((m) => ({ default: m.HqGroupLoans })),
  receipts: () => import('./pages/hq/LiveList').then((m) => ({ default: m.HqReceipts })),
  volume: () => import('./pages/hq/LiveList').then((m) => ({ default: m.HqVolume })),
  report: () => import('./pages/hq/LiveList').then((m) => ({ default: m.HqReport })),
  aging: () => import('./pages/hq/LiveList').then((m) => ({ default: m.HqAging })),
  help: () => import('./pages/shared/Help'),
};

const secretariatLoaders: Record<string, LmsPageLoader> = {
  phases: () => import('./pages/secretariat/Pages').then((m) => ({ default: m.SecretariatPhases })),
  dashboard: () => import('./pages/secretariat/Pages').then((m) => ({ default: m.SecretariatNational })),
  volume: () => import('./pages/secretariat/Pages').then((m) => ({ default: m.SecretariatVolume })),
  help: () => import('./pages/shared/Help'),
};

const accountantLoaders: Record<string, LmsPageLoader> = {
  dashboard: () => import('./pages/accountant/Pages').then((m) => ({ default: m.AccountantHome })),
  phases: () => import('./pages/accountant/Pages').then((m) => ({ default: m.AccountantPhases })),
  help: () => import('./pages/shared/Help'),
};

const staffLoaders: Record<string, LmsPageLoader> = {
  dashboard: () => import('./pages/shared/StaffDashboard'),
  help: () => import('./pages/shared/Help'),
};

const LOADERS: Record<LmsRole, Record<string, LmsPageLoader>> = {
  constituency: constituencyLoaders,
  headquarters: hqLoaders,
  secretariat: secretariatLoaders,
  accountant: accountantLoaders,
  staff: staffLoaders,
};

export function menuForRole(email: string, role: LmsRole): LmsMenuItem[] {
  if (role === 'constituency') {
    const cache = loadLmsCache(email);
    const base = inferConstituencyBase(cache?.menu);
    if (base) return constituencyMenu(base);
    const fromEmail = menuForEmail(email);
    if (fromEmail.length > 1) return fromEmail;
  }
  return LMS_PAGES[role] || LMS_PAGES.staff;
}

export function pageLoaderFor(role: LmsRole, pageId: string): LmsPageLoader {
  const map = LOADERS[role] || LOADERS.staff;
  return map[pageId] || map.help || map.dashboard || (() => import('./pages/shared/Help'));
}

const cache = new Map<string, Promise<{ default: ComponentType<LmsPageProps> }>>();

export function loadRolePage(role: LmsRole, pageId: string): Promise<{ default: ComponentType<LmsPageProps> }> {
  const key = `${role}:${pageId}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const pending = pageLoaderFor(role, pageId)();
  cache.set(key, pending);
  return pending;
}
