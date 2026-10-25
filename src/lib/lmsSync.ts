import { Capacitor, CapacitorCookies, CapacitorHttp } from '@capacitor/core';

export type LmsRole = 'constituency' | 'headquarters' | 'secretariat' | 'accountant' | 'staff';

const CACHE_KEY = 'uwezo.lms.cache';

export type LmsPage = { id: string; group: string; title: string; path: string };

export type LmsSummary = { label: string; value: string; note: string };
export type LmsRowAction = { label: string; method: string; params: Array<string | number> };
export type LmsTable = { title: string; headers: string[]; rows: string[][]; rowActions?: LmsRowAction[][] };
export type LmsField = { key: string; label: string; value?: string; type?: string; placeholder?: string };
export type LmsPageView = { summary: LmsSummary[]; tables: LmsTable[]; notes: string[]; fields: LmsField[]; actions: string[] };
export type LmsMapping = { found: boolean; role: LmsRole; constituency: string; base: string };
export type LmsCompareRow = { label: string; server: string; phone: string; different: boolean };
export type LmsPageKit = {
  intro: string;
  empty: string;
  fields: LmsField[];
  actions: { method: string; label: string }[];
};

export type LmsCache = {
  email: string;
  role: LmsRole;
  fetchedAt: string;
  detail: string;
  pages: Record<string, LmsPageView>;
  menu?: LmsPage[];
  host?: string;
  cookie?: string;
};

const LMS_HOSTS = ['https://lms.uwezo.go.ke', 'https://lms-staging.uwezo.go.ke'];

const CONSTITUENCY_SUFFIXES: { id: string; group: string; title: string; suffix: string }[] = [
  { id: 'dashboard', group: 'Constituency', title: 'Dashboard', suffix: '/dashboard' },
  { id: 'groups', group: 'Groups', title: 'Groups Information', suffix: '/groups' },
  { id: 'group-members', group: 'Groups', title: 'Group Members', suffix: '/groups/members' },
  { id: 'contagious', group: 'Groups', title: 'Contagious Members', suffix: '/groups/multi-group-members' },
  { id: 'loan-phase', group: 'Loans', title: 'Loan Phase', suffix: '/loans/phases' },
  { id: 'group-loans', group: 'Loans', title: 'Group Loans', suffix: '/loans' },
  { id: 'receipts', group: 'Loans', title: 'Receipts', suffix: '/loans/receipts' },
  { id: 'applications', group: 'Applications', title: 'Applications', suffix: '/applications' },
  { id: 'tasks', group: 'Applications', title: 'Tasks', suffix: '/applications/phases' },
  { id: 'applied-loans', group: 'Applications', title: 'Applied Loans', suffix: '/applications/loans' },
  { id: 'upload', group: 'Reports', title: 'Upload Data', suffix: '/reports/data-upload' },
  { id: 'volume', group: 'Reports', title: 'Apps by Constituency', suffix: '/reports/application-volume' },
  { id: 'report', group: 'Reports', title: 'Generate Report', suffix: '/reports/dynamic-report' },
  { id: 'ledger', group: 'Reports', title: 'Loan Submission / Ledger (F.5)', suffix: '/reports/loan-sub-form' },
  { id: 'restore', group: 'Reports', title: 'Restore Deleted Data', suffix: '/reports/restore-deleted-data' },
  { id: 'audit', group: 'Reports', title: 'Audit Trail', suffix: '/reports/audit-trail' },
  { id: 'disbursement', group: 'Reports', title: 'Disbursement Reports', suffix: '/reports/disbursement' },
  { id: 'sector', group: 'Reports', title: 'Sectoral Analysis', suffix: '/reports/dynamic-report?view=sector' },
  { id: 'users', group: 'County', title: 'Users', suffix: '/../users' },
  { id: 'add-user', group: 'County', title: 'Add User', suffix: '/../users/add' },
  { id: 'county-audit', group: 'County', title: 'County Audit Trail', suffix: '/../audit-trail' },
  { id: 'help', group: 'Help', title: 'Help', suffix: '/help' },
];

export function constituencyMenu(basePath: string): LmsPage[] {
  const base = basePath.replace(/\/$/, '');
  const county = base.split('/').filter(Boolean)[0] || '';
  return CONSTITUENCY_SUFFIXES.flatMap((item) => {
    if (item.suffix === '/help') return [{ id: item.id, group: item.group, title: item.title, path: '/help' }];
    if (!base) {
      if (item.id === 'dashboard') return [{ id: item.id, group: item.group, title: item.title, path: '/dashboard' }];
      return [];
    }
    if (item.suffix.startsWith('/../')) {
      return county ? [{ id: item.id, group: item.group, title: item.title, path: `/${county}${item.suffix.slice(3)}` }] : [];
    }
    const suffix = item.suffix.split('?')[0];
    return [{ id: item.id, group: item.group, title: item.title, path: `${base}${suffix}` }];
  });
}

export const LMS_PAGES: Record<LmsRole, LmsPage[]> = {
  constituency: constituencyMenu(''),
  headquarters: [
    { id: 'dashboard', group: 'Headquarters', title: 'HQ Dashboard', path: '/dashboard' },
    { id: 'applications', group: 'Submissions', title: 'Applications', path: '/hq/applications' },
    { id: 'tasks', group: 'Submissions', title: 'Approval Tasks', path: '/hq/applications/approval-tasks' },
    { id: 'allocations', group: 'Headquarters', title: 'Allocations', path: '/hq/allocations' },
    { id: 'groups', group: 'Groups', title: 'Groups', path: '/hq/groups/list' },
    { id: 'group-loans', group: 'Loans', title: 'Group Loans', path: '/hq/loans/group-loans' },
    { id: 'receipts', group: 'Loans', title: 'Receipts', path: '/hq/loans/receipts' },
    { id: 'volume', group: 'Reports', title: 'Apps by Constituency', path: '/hq/reports/application-volume' },
    { id: 'report', group: 'Reports', title: 'Generate Report', path: '/hq/reports' },
    { id: 'aging', group: 'Headquarters', title: 'Phase Aging', path: '/phase-aging' },
    { id: 'help', group: 'Help', title: 'Help', path: '/help' },
  ],
  secretariat: [
    { id: 'phases', group: 'Secretariat', title: 'Phases', path: '/secretariat/phases' },
    { id: 'dashboard', group: 'Secretariat', title: 'National Dashboard', path: '/dashboard?national=1' },
    { id: 'volume', group: 'Reports', title: 'Application Volume', path: '/secretariat/application-volume' },
    { id: 'help', group: 'Help', title: 'Help', path: '/help' },
  ],
  accountant: [
    { id: 'phases', group: 'Accounts', title: 'Phases for Payment', path: '/accountant/phases' },
    { id: 'help', group: 'Help', title: 'Help', path: '/help' },
  ],
  staff: [
    { id: 'dashboard', group: 'LMS', title: 'Dashboard', path: '/dashboard' },
    { id: 'help', group: 'Help', title: 'Help', path: '/help' },
  ],
};

export function roleLabel(role: LmsRole): string {
  if (role === 'headquarters') return 'headquarters';
  if (role === 'accountant') return 'accountant';
  if (role === 'secretariat') return 'secretariat';
  if (role === 'constituency') return 'constituency officer';
  return 'staff';
}

/** Infer /county/constituency base from cached menu paths. */
export function inferConstituencyBase(menu: LmsPage[] | undefined): string {
  if (!menu?.length) return '';
  for (const item of menu) {
    const match = /^(\/[^/]+\/[^/]+)(?:\/|$)/.exec(item.path || '');
    if (match && match[1] !== '/hq' && !match[1].startsWith('/secretariat') && !match[1].startsWith('/accountant')) {
      return match[1];
    }
  }
  return '';
}

/** Full LMS menu for this officer (role + constituency base), never the empty stub. */
export function menuForEmail(email: string): LmsPage[] {
  const cache = loadLmsCache(email);
  const role = (cache?.role || 'staff') as LmsRole;
  if (role === 'constituency') {
    const base = inferConstituencyBase(cache?.menu);
    if (base) return constituencyMenu(base);
  }
  if (cache?.menu && cache.menu.length > 1) return cache.menu;
  return LMS_PAGES[role] || LMS_PAGES.staff;
}

export function loadLmsCache(email: string): LmsCache | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || '') as LmsCache;
    if (parsed.email !== email) return null;
    const pages: Record<string, LmsPageView> = {};
    for (const [path, value] of Object.entries(parsed.pages || {})) {
      if (value && typeof value === 'object' && Array.isArray((value as LmsPageView).tables)) pages[path] = value;
    }
    return { ...parsed, pages };
  } catch {
    return null;
  }
}

export function saveLmsCache(cache: LmsCache) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  if (cache.host && cache.cookie) void installLmsCookies(cache.host, cache.cookie);
}

/** Push LMS session cookies into the native WebView cookie jar. */
export async function installLmsCookies(host: string, cookieHeader: string) {
  if (!Capacitor.isNativePlatform() || !host || !cookieHeader) return;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!key) continue;
    try {
      await CapacitorCookies.setCookie({ url: host, key, value });
    } catch {
      /* ignore */
    }
  }
}

export function pageHasFigures(view: LmsPageView | null | undefined): boolean {
  if (!view) return false;
  if (view.summary.length) return true;
  if (view.tables.some((table) => table.rows.length > 0)) return true;
  return view.notes.some((note) => note && !isJunkText(note));
}

export function cacheHasFigures(cache: LmsCache | null | undefined): boolean {
  if (!cache?.pages) return false;
  return Object.values(cache.pages).some((page) => pageHasFigures(page));
}

function roleFromPage(url: string, html: string): LmsRole {
  let path = url;
  try {
    path = new URL(url, 'https://lms.uwezo.go.ke').pathname;
  } catch {
    path = url;
  }
  if (path.startsWith('/accountant')) return 'accountant';
  if (path.startsWith('/secretariat')) return 'secretariat';
  if (path.startsWith('/hq') || /href="[^"]*\/hq\//.test(html)) return 'headquarters';
  if (constituencyBase(url)) return 'constituency';
  return 'staff';
}

function constituencyBase(value: string): string {
  const match = /\/([a-z0-9-]+)\/([a-z0-9-]+)\/dashboard/i.exec(value);
  return match ? `/${match[1]}/${match[2]}` : '';
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&times;/g, ' ')
    .replace(/&rarr;|&larr;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCharCode(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, digits: string) => String.fromCharCode(parseInt(digits, 16)))
    .replace(/&amp;/g, '&');
}

function stripTags(html: string): string {
  // Do not cut tags early when attributes contain ">" (Alpine/Livewire does this).
  return html.replace(/<\/?[a-zA-Z][^>]*?(?:"[^"]*"|'[^']*'|[^>"'])*>/g, ' ');
}

function textOf(html: string): string {
  return decodeEntities(stripTags(html)).replace(/\s+/g, ' ').trim();
}

function isJunkText(value: string): boolean {
  return /isShaking|filteredOptions|x-on:|x-data|x-effect|wire:|Processing\.\.\.|\$el|\$watch|getSelectedColor|No results found for|custom-action-modal|confirm-delete|@keydown|@form-validation|function\s*\(|=>\s*\{/i.test(value);
}

function removeMatchingDivs(html: string, test: (openTag: string) => boolean): string {
  let out = html;
  let guard = 0;
  while (guard < 40) {
    guard += 1;
    const open = /<div\b[^>]*>/i.exec(out);
    if (!open) break;
    let changed = false;
    const re = /<div\b[^>]*>/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(out))) {
      if (!test(match[0])) continue;
      const start = match.index;
      let depth = 1;
      let cursor = start + match[0].length;
      while (cursor < out.length && depth > 0) {
        const nextOpen = out.slice(cursor).search(/<div\b/i);
        const nextClose = out.slice(cursor).search(/<\/div>/i);
        if (nextClose < 0) {
          depth = 0;
          cursor = out.length;
          break;
        }
        if (nextOpen >= 0 && nextOpen < nextClose) {
          depth += 1;
          cursor += nextOpen + 4;
        } else {
          depth -= 1;
          cursor += nextClose + 6;
        }
      }
      out = `${out.slice(0, start)} ${out.slice(cursor)}`;
      changed = true;
      break;
    }
    if (!changed) break;
  }
  return out;
}

function humanize(key: string): string {
  const last = key.split('.').pop() || key;
  return last.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
}

function fieldKey(attrs: string): string {
  return /wire:model(?:\.[\w.]+)?="([^"]+)"/.exec(attrs)?.[1] || '';
}

export function pageFields(html: string): LmsField[] {
  const body = contentHtml(html);
  const fields: LmsField[] = [];
  const choices = new Map<string, string[]>();
  const pushChoice = (attrs: string) => {
    const key = fieldKey(attrs);
    if (!key || key === 'selectedColumns') return;
    const type = (/type="([^"]+)"/i.exec(attrs)?.[1] || '').toLowerCase();
    if (type !== 'checkbox' && type !== 'radio') return;
    if (!/\schecked(?:\s|=|>|$)/i.test(attrs)) return;
    const value = decodeEntities(/value="([^"]*)"/.exec(attrs)?.[1] || 'yes');
    const list = choices.get(key) || [];
    list.push(value);
    choices.set(key, list);
  };
  for (const match of body.matchAll(/<input\b([^>]*)>/gi)) {
    const attrs = match[1];
    const type = (/type="([^"]+)"/i.exec(attrs)?.[1] || 'text').toLowerCase();
    if (type === 'checkbox' || type === 'radio') {
      pushChoice(attrs);
      continue;
    }
    if (type === 'hidden' || type === 'password' || type === 'file' || type === 'submit' || type === 'button') continue;
    const key = fieldKey(attrs);
    if (!key || key === '_token' || /search|Filter|perPage|workspace|analysisDimension/i.test(key)) continue;
    fields.push({ key, label: humanize(key), value: decodeEntities(/value="([^"]*)"/.exec(attrs)?.[1] || ''), type: type === 'date' || type === 'number' ? type : 'text' });
  }
  for (const match of body.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/gi)) {
    const key = fieldKey(match[1]);
    if (!key) continue;
    fields.push({ key, label: humanize(key), value: textOf(match[2]) });
  }
  for (const match of body.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    const key = fieldKey(match[1]);
    if (!key || /Filter|perPage/i.test(key)) continue;
    const selected = /<option\b[^>]*selected[^>]*>([\s\S]*?)<\/option>/i.exec(match[2]);
    fields.push({ key, label: humanize(key), value: textOf(selected?.[1] || '') });
  }
  for (const [key, values] of choices) fields.push({ key, label: humanize(key), value: values.join(', ') });
  const seen = new Set<string>();
  return fields.filter((field) => {
    if (seen.has(field.key) || isJunkText(field.label) || isJunkText(field.value || '')) return false;
    seen.add(field.key);
    return true;
  }).slice(0, 40);
}

export function pageActions(html: string): string[] {
  const body = contentHtml(html);
  const found: string[] = [];
  for (const match of body.matchAll(/wire:(?:click|submit)(?:\.[\w.]+)?="([A-Za-z_][\w]*)/g)) {
    const name = match[1];
    if (found.includes(name) || /^(toggle|select|clear|remove|reset|open|close|show|hide|set|updated|updating)/i.test(name)) continue;
    if (/save|submit|update|store|create|approve|reject|restore|generate|preview|lock|unlock|pay|confirm|delete|upload|refresh|export|assign/i.test(name)) found.push(name);
  }
  return found.slice(0, 12);
}

function contentHtml(html: string): string {
  const marked = /<div class="content-wrapper">([\s\S]*?)<\/div>\s*<!-- \/\.content-wrapper -->/i.exec(html);
  const start = html.search(/<div class="content-wrapper">/i);
  const end = html.search(/<footer class="main-footer/i);
  let body = marked?.[1] || (start >= 0 && end > start ? html.slice(start, end) : html);
  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<template[\s\S]*?<\/template>/gi, ' ')
    .replace(/<ol class="breadcrumb[\s\S]*?<\/ol>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  body = removeMatchingDivs(body, (tag) => /(?:\bmodal\b|x-data=|wire:ignore\.self|custom-action-modal|dropdown-search|officer-guide)/i.test(tag));
  return body;
}

export function pageKit(path: string): LmsPageKit | null {
  const clean = path.split('?')[0];
  if (/\/applications\/phases$/.test(clean)) {
    return {
      intro: 'Create a review phase the same way as on the online LMS. Use a name like Phase 3, set the scheduled review date, then create it.',
      empty: 'No phases are listed yet. Create a phase to start a review cycle.',
      fields: [
        { key: 'phaseName', label: 'Phase name', placeholder: 'Phase 3' },
        { key: 'reviewDate', label: 'Scheduled review date', type: 'date' },
        { key: 'reviewVenue', label: 'Review venue (optional)', placeholder: 'Optional venue' },
      ],
      actions: [{ method: 'createPhase', label: 'Create phase' }],
    };
  }
  if (/\/loans\/phases$/.test(clean)) {
    return {
      intro: 'Open a phase to edit its details. Enter the phase id from the list, load it, update the fields, then save.',
      empty: 'No loan phases are listed for this constituency yet.',
      fields: [
        { key: 'editingPhaseId', label: 'Phase id', type: 'number', placeholder: 'From the Action / View row' },
        { key: 'editPhaseName', label: 'Phase name', placeholder: 'Phase 3' },
        { key: 'editReviewDate', label: 'Review date', type: 'date' },
        { key: 'editReviewVenue', label: 'Review venue' },
        { key: 'editAmountDisbursed', label: 'Amount disbursed', type: 'number' },
        { key: 'editAmountRepaid', label: 'Amount repaid', type: 'number' },
      ],
      actions: [
        { method: 'openEditPhaseModal', label: 'Load phase for editing' },
        { method: 'savePhaseDetails', label: 'Save phase details' },
      ],
    };
  }
  if (/\/applications\/loans$/.test(clean)) {
    return {
      intro: 'Applied loans are group loans in pending, approved, deferred, or cancelled status for this constituency.',
      empty: 'No applied loans for this constituency yet. Applications still under HQ review appear under Applications, not Applied Loans.',
      fields: [],
      actions: [{ method: 'refreshData', label: 'Refresh applied loans' }],
    };
  }
  if (/\/dashboard$/.test(clean) || /national=1/.test(path)) {
    return {
      intro: 'Constituency dashboard figures from the LMS. Save the bank balance when an open phase request needs it.',
      empty: 'Dashboard figures will appear after Refresh pages while online.',
      fields: [{ key: 'constituencyBankBalance', label: 'Available bank balance (KES)', type: 'number', placeholder: 'Optional' }],
      actions: [
        { method: 'saveConstituencyBankBalance', label: 'Save bank balance' },
        { method: 'refreshData', label: 'Refresh dashboard' },
      ],
    };
  }
  if (/\/reports\/data-upload$/.test(clean)) {
    return {
      intro: 'Upload historical or correction data on the LMS. The phone lists the page tools; file picks stay on the online LMS when the browser file control is required.',
      empty: 'Open Upload Data on the LMS if a file picker is required for this step.',
      fields: [],
      actions: [{ method: 'refreshData', label: 'Refresh upload page' }],
    };
  }
  if (/dynamic-report|\/reports$|\/hq\/reports$/.test(clean) || /view=sector/.test(path)) {
    return {
      intro: path.includes('sector')
        ? 'Sectoral analysis uses the same LMS report engine. Choose columns, compare, then generate.'
        : 'Generate the same LMS report columns on this phone, then submit them to the LMS.',
      empty: 'Choose report columns, then generate the report.',
      fields: [],
      actions: [{ method: reportMethod(path) || 'generateReport', label: path.includes('sector') ? 'Generate sectoral analysis' : 'Generate report' }],
    };
  }
  if (/\/users\/add$/.test(clean)) {
    return {
      intro: 'Create a county user with the same fields used on the online LMS.',
      empty: 'Fill the user details, compare, then submit.',
      fields: [],
      actions: [{ method: 'createUser', label: 'Create user' }, { method: 'save', label: 'Save user' }],
    };
  }
  if (/\/groups(\/members|\/multi-group-members)?$/.test(clean) || /\/loans$/.test(clean) || /\/loans\/receipts$/.test(clean) || /\/applications$/.test(clean)) {
    return {
      intro: 'Rows and actions below mirror the online LMS list. Use a row action or refresh to sync the latest copy.',
      empty: 'No rows on this page yet. Refresh while online, or open the page on the LMS if the list is still empty there.',
      fields: [],
      actions: [{ method: 'refreshData', label: 'Refresh list' }],
    };
  }
  return null;
}

function formatCount(raw: string, prefix = '', compact = false): string {
  const amount = Number(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(amount)) return `${prefix}${raw}`.trim();
  if (compact && Math.abs(amount) >= 1_000_000_000) {
    return `${prefix}${(amount / 1_000_000_000).toFixed(2).replace(/\.00$/, '')}B`;
  }
  if (compact && Math.abs(amount) >= 1_000_000) {
    return `${prefix}${(amount / 1_000_000).toFixed(2).replace(/\.00$/, '')}M`;
  }
  return `${prefix}${amount.toLocaleString('en-KE')}`;
}

function countUpValue(block: string, fallback = ''): string {
  const amount = /data-count-up="([^"]+)"/i.exec(block)?.[1];
  if (!amount) return fallback;
  const prefix = decodeEntities(/data-count-prefix="([^"]*)"/i.exec(block)?.[1] || '');
  const compact = /data-count-compact="true"/i.test(block);
  return formatCount(amount, prefix, compact);
}

function isLoginHtml(url: string, html: string): boolean {
  if (/\/login\/?(?:\?|$)/.test(url)) return true;
  return /name="password"/.test(html) && /name="email"/.test(html) && !/content-wrapper/.test(html);
}

function rowActionsIn(rowHtml: string): LmsRowAction[] {
  const actions: LmsRowAction[] = [];
  for (const match of rowHtml.matchAll(/wire:click(?:\.[\w.]+)?="([A-Za-z_][\w]*)\(([^)]*)\)"/g)) {
    const method = match[1];
    if (/^(toggle|select|clear|remove|reset|open|close|show|hide|set|updated)/i.test(method) && !/Modal|Phase|Receipt|Group|Application|Approve|Delete|Edit|View/i.test(method)) {
      continue;
    }
    if (!/edit|view|delete|approve|reject|cancel|open|save|confirm|assign|download|statement|phase|receipt|group|modal/i.test(method)) continue;
    const params = match[2]
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        if (/^['"]/.test(item)) return item.replace(/^['"]|['"]$/g, '');
        const amount = Number(item);
        return Number.isFinite(amount) ? amount : item;
      });
    const label = method
      .replace(/Modal$/i, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^open\s+/i, '')
      .replace(/\bphase\b/i, 'phase');
    if (!actions.some((item) => item.method === method && JSON.stringify(item.params) === JSON.stringify(params))) {
      actions.push({ label: label.charAt(0).toUpperCase() + label.slice(1), method, params });
    }
  }
  return actions.slice(0, 4);
}

export function pageView(html: string): LmsPageView {
  const body = contentHtml(html);
  const summary: LmsSummary[] = [];
  for (const match of body.matchAll(/hq-kpi-card[\s\S]{0,900}?<\/div>\s*<\/div>\s*<\/div>/gi)) {
    const block = match[0];
    const label = textOf(/text-uppercase[^>]*>([\s\S]*?)<\//i.exec(block)?.[1] || /small[^>]*>([\s\S]*?)<\//i.exec(block)?.[1] || '');
    const value = textOf(/<h4[^>]*>([\s\S]*?)<\/h4>/i.exec(block)?.[1] || '');
    const note = textOf(/<small class="text-muted"[^>]*>([\s\S]*?)<\/small>/i.exec(block)?.[1] || '');
    if (label && value && !isJunkText(label) && !isJunkText(value)) summary.push({ label, value, note });
  }
  for (const match of body.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]{0,400}?)<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const value = textOf(match[1]);
    const label = textOf(match[3]);
    if ((/^\d/.test(value) || /^(KES|Ksh)/i.test(value)) && label && !isJunkText(label)) summary.push({ label, value, note: '' });
  }
  for (const match of body.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>/gi)) {
    const value = textOf(match[1]);
    if (!(/^\d/.test(value) || /^(KES|Ksh)/i.test(value))) continue;
    const before = body.slice(Math.max(0, (match.index || 0) - 280), match.index || 0);
    const after = body.slice((match.index || 0), (match.index || 0) + 280);
    const label = textOf(/text-uppercase[^>]*>([\s\S]*?)<\//i.exec(before)?.[1] || /<span[^>]*>([\s\S]*?)<\/span>/i.exec(before)?.[1] || '');
    const note = textOf(/<small[^>]*>([\s\S]*?)<\/small>/i.exec(after)?.[1] || '');
    if (label && !isJunkText(label)) summary.push({ label, value, note });
  }
  for (const match of body.matchAll(/<div class="[^"]*nat-kpi-tile[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi)) {
    const block = match[0];
    const label = textOf(/class="[^"]*nat-kpi-tile__label[^"]*"[^>]*>([\s\S]*?)<\//i.exec(block)?.[1] || '');
    const note = textOf(/class="[^"]*nat-kpi-tile__hint[^"]*"[^>]*>([\s\S]*?)<\//i.exec(block)?.[1] || '');
    const visible = textOf(/class="[^"]*nat-kpi-tile__value[^"]*"[^>]*>([\s\S]*?)<\//i.exec(block)?.[1] || '');
    const value = countUpValue(block, visible);
    if (label && value) summary.push({ label, value, note });
  }
  for (const match of body.matchAll(/class="[^"]*kpi-label[^"]*"[^>]*>([\s\S]*?)<\//gi)) {
    const label = textOf(match[1]);
    const after = body.slice(match.index || 0, (match.index || 0) + 500);
    const value = countUpValue(after, textOf(/class="[^"]*kpi-value[^"]*"[^>]*>([\s\S]*?)<\//i.exec(after)?.[1] || ''));
    if (label && value && !isJunkText(label)) summary.push({ label, value, note: '' });
  }
  for (const match of body.matchAll(/class="info-box-number"[^>]*>([\s\S]*?)<\/span>/gi)) {
    const value = countUpValue(match[0], textOf(match[1]));
    const before = body.slice(Math.max(0, (match.index || 0) - 300), match.index || 0);
    const label = textOf(/class="info-box-text"[^>]*>([\s\S]*?)<\/span>/i.exec(before)?.[1] || '');
    if (label && value && !isJunkText(label)) summary.push({ label, value, note: '' });
  }
  const tables: LmsTable[] = [];
  for (const match of body.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const block = match[0];
    const headers = [...block.matchAll(/<th[\s\S]*?>([\s\S]*?)<\/th>/gi)]
      .map((cell) => textOf(cell[1]))
      .filter((header) => header && !isJunkText(header) && !/^action$/i.test(header))
      .slice(0, 8);
    const collected: { cells: string[]; actions: LmsRowAction[] }[] = [];
    for (const row of block.matchAll(/<tr[\s\S]*?>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...row[1].matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi)]
        .map((cell) => textOf(cell[1]).slice(0, 120))
        .filter((cell) => !isJunkText(cell))
        .slice(0, 8);
      const actions = rowActionsIn(row[1]);
      if (!cells.some(Boolean) && !actions.length) continue;
      collected.push({ cells, actions });
      if (collected.length >= 40) break;
    }
    const rows = collected.map((item) => item.cells);
    const alignedActions = collected.map((item) => item.actions);
    if (headers.length || rows.length) {
      const caption = textOf(block.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i)?.[1] || '');
      const heading = textOf(
        body.slice(Math.max(0, (match.index || 0) - 400), match.index || 0).match(/<h[1-5][^>]*>([\s\S]*?)<\/h[1-5]>/i)?.[1] || '',
      );
      tables.push({
        title: caption || heading,
        headers,
        rows,
        rowActions: alignedActions.some((item) => item.length) ? alignedActions : undefined,
      });
    }
    if (tables.length >= 4) break;
  }
  const notes = summary.length || tables.some((table) => table.rows.length)
    ? []
    : [...body.matchAll(/<(?:h1|h3|h5|p)[^>]*>([\s\S]*?)<\/(?:h1|h3|h5|p)>/gi)]
      .map((item) => textOf(item[1]))
      .filter((item) => item.length > 8 && item.length < 180)
      .filter((item) => !isJunkText(item) && !/brad diesel|john pierce|nora silvester|welcome back|quick reference/i.test(item))
      .slice(0, 5);
  const seen = new Set<string>();
  return {
    summary: summary.filter((item) => {
      const key = `${item.label}|${item.value}`;
      if (seen.has(key) || isJunkText(item.label) || isJunkText(item.value)) return false;
      seen.add(key);
      return true;
    }).slice(0, 12),
    tables,
    notes,
    fields: pageFields(html),
    actions: pageActions(html),
  };
}

export function reportMethod(path: string): string {
  if (path.includes('application-volume')) return 'previewReport';
  if (path.includes('dynamic-report') || path.endsWith('/reports') || path.endsWith('/hq/reports')) return 'generateReport';
  return '';
}

function cookieHeader(setCookie: string): string {
  const kept = new Map<string, string>();
  const pieces = setCookie.split(/,(?=\s*[^;,\s]+=)/);
  for (const piece of pieces) {
    for (const segment of piece.split(';')) {
      const match = /^\s*([A-Za-z0-9_.-]+)=([^;\s].*)$/.exec(segment.trim());
      if (!match) continue;
      const name = match[1];
      const lower = name.toLowerCase();
      if (['path', 'domain', 'expires', 'max-age', 'samesite', 'secure', 'httponly'].includes(lower)) continue;
      if (name === 'XSRF-TOKEN' || name.endsWith('_session')) kept.set(name, match[2].trim());
    }
  }
  return [...kept.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

function bodyText(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data == null) return '';
  try {
    return JSON.stringify(data);
  } catch {
    return '';
  }
}

function headersOf(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value ?? '');
  }
  return out;
}

function rawSetCookies(headers: unknown): string[] {
  if (!headers || typeof headers !== 'object') return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (key.toLowerCase() !== 'set-cookie') continue;
    if (Array.isArray(value)) out.push(...value.map((item) => String(item ?? '')));
    else if (value != null) out.push(String(value));
  }
  return out.filter(Boolean);
}

function mergeSessionCookie(existing: string, setCookies: string | string[]): string {
  const kept = new Map<string, string>();
  const takePair = (pair: string) => {
    const match = /^\s*([A-Za-z0-9_.-]+)=([^;\s].*)$/.exec(pair.trim());
    if (!match) return;
    const name = match[1];
    if (name === 'XSRF-TOKEN' || name.endsWith('_session')) kept.set(name, match[2].trim());
  };
  if (existing) {
    for (const piece of existing.split(';')) takePair(piece);
  }
  const list = Array.isArray(setCookies) ? setCookies : String(setCookies || '').split('\n');
  for (const header of list) {
    if (!header) continue;
    // One Set-Cookie line is one cookie. Do not split on commas (Expires uses them).
    takePair(header.split(';')[0]);
  }
  return [...kept.entries()].map(([name, item]) => `${name}=${item}`).join('; ');
}

function sessionCookie(setCookie: string | string[]): string {
  const value = mergeSessionCookie('', setCookie);
  return /(?:^|; )[A-Za-z0-9_.-]*_session=/.test(value) ? value : '';
}

async function readText(url: string, cookie: string): Promise<{ status: number; url: string; setCookie: string; text: string }> {
  const headers: Record<string, string> = { Accept: 'text/html' };
  if (cookie) headers.Cookie = cookie;
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url,
      headers,
      connectTimeout: 20000,
      readTimeout: 20000,
    });
    const setCookies = rawSetCookies(response.headers);
    return {
      status: response.status,
      url: response.url || url,
      setCookie: setCookies.join('\n'),
      text: bodyText(response.data),
    };
  }
  const response = await fetch(url, { headers, credentials: 'include', signal: AbortSignal.timeout(20000) });
  return { status: response.status, url: response.url, setCookie: '', text: await response.text() };
}

export async function lmsHostOnline(): Promise<boolean> {
  for (const host of LMS_HOSTS) {
    if (await hostAnswers(host)) return true;
  }
  return false;
}

async function hostAnswers(url: string): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.get({ url: `${url}/login`, connectTimeout: 8000, readTimeout: 8000, disableRedirects: true });
      return response.status > 0 && response.status < 500;
    }
    const response = await fetch(`${url}/login`, { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(8000) });
    return response.status < 500;
  } catch {
    return false;
  }
}

type HostLogin = {
  ok: boolean;
  role: LmsRole;
  cookie: string;
  html: string;
  detail: string;
  account?: { role?: string; constituency?: string; base?: string };
};

async function loginToHost(host: string, email: string, password: string): Promise<HostLogin> {
  const direct = await postForm(
    `${host}/app/password-session`,
    '',
    `${host}/login`,
    `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
  );
  if (direct.status !== 404 && direct.status !== 405) {
    let data: { ok?: boolean; detail?: string; role?: string; constituency?: string; base?: string } = {};
    try {
      data = JSON.parse(direct.text) as typeof data;
    } catch {
      data = {};
    }
    if (direct.status === 429) {
      return { ok: false, role: 'staff', cookie: '', html: '', detail: data.detail || 'Too many sign-in attempts. Wait a minute, then try the same password again.' };
    }
    if (data.ok) {
      return {
        ok: true,
        role: isRole(data.role) ? data.role : 'staff',
        cookie: sessionCookie(direct.setCookie),
        html: '',
        detail: '',
        account: data,
      };
    }
    return {
      ok: false,
      role: 'staff',
      cookie: '',
      html: '',
      detail: data.detail || 'The LMS database did not accept this email and password.',
    };
  }
  const loginPage = await readText(`${host}/login`, '');
  const token = /name="_token"\s+value="([^"]+)"/.exec(loginPage.text)?.[1] || '';
  if (!token) return { ok: false, role: 'staff', cookie: '', html: '', detail: `${host.replace('https://', '')} did not return a sign-in form.` };
  const cookie = cookieHeader(loginPage.setCookie);
  const body = `_token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  const formHeaders: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html', Referer: `${host}/login` };
  if (cookie) formHeaders.Cookie = cookie;
  const posted = Capacitor.isNativePlatform()
    ? await CapacitorHttp.post({
        url: `${host}/login`,
        headers: formHeaders,
        data: body,
        connectTimeout: 20000,
        readTimeout: 20000,
      })
    : await fetch(`${host}/login`, {
        method: 'POST',
        headers: formHeaders,
        body,
        credentials: 'include',
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
      });
  const postedHeaders = Capacitor.isNativePlatform() ? headersOf((posted as { headers?: unknown }).headers) : {};
  const postedStatus = Capacitor.isNativePlatform() ? Number((posted as { status?: number }).status || 0) : (posted as Response).status;
  const postedText = Capacitor.isNativePlatform()
    ? bodyText((posted as { data?: unknown }).data)
    : await (posted as Response).text();
  const location = postedHeaders.location || (Capacitor.isNativePlatform() ? String((posted as { url?: string }).url || '') : (posted as Response).url);
  const session = Capacitor.isNativePlatform()
    ? sessionCookie(rawSetCookies((posted as { headers?: unknown }).headers))
    : sessionCookie((posted as Response).headers.get('set-cookie') || '');
  if (postedStatus === 429) {
    return { ok: false, role: 'staff', cookie: '', html: postedText, detail: 'Too many sign-in attempts. Wait a minute, then try the same password again.' };
  }
  const rejected = /credentials do not match|invalid email or password|these credentials|auth\.failed/i.test(postedText) || postedStatus === 422 || postedStatus === 419;
  const returnedToLogin = /\/login\/?(?:\?|$)/.test(location);
  const loginForm = /name="password"/.test(postedText) && /name="email"/.test(postedText) && !/content-wrapper/.test(postedText);
  if (rejected || returnedToLogin || (loginForm && postedStatus !== 302 && postedStatus !== 303)) {
    return { ok: false, role: 'staff', cookie: '', html: postedText, detail: 'The LMS database did not accept this email and password.' };
  }
  if (/content-wrapper/.test(postedText) && !loginForm) {
    return { ok: true, role: roleFromPage(location || `${host}/dashboard`, postedText), cookie: session, html: `${location}\n${postedText}`, detail: '' };
  }
  const nextUrl = location.startsWith('http')
    ? location
    : `${host}${location.startsWith('/') ? location : '/dashboard'}`;
  const landed = await readText(nextUrl, session);
  const landedLogin = /\/login\/?(?:\?|$)/.test(landed.url)
    || (/name="password"/.test(landed.text) && /name="email"/.test(landed.text) && !/content-wrapper/.test(landed.text));
  if (landedLogin) return { ok: false, role: 'staff', cookie: '', html: landed.text, detail: 'The LMS database did not accept this email and password.' };
  const html = `${landed.url}\n${landed.text}`;
  return { ok: true, role: roleFromPage(landed.url || nextUrl, landed.text), cookie: sessionCookie(landed.setCookie) || session, html, detail: '' };
}

function isRole(value: unknown): value is LmsRole {
  return value === 'constituency' || value === 'headquarters' || value === 'secretariat' || value === 'accountant' || value === 'staff';
}

export async function fetchStaffRole(host: string, email: string): Promise<LmsMapping> {
  const empty: LmsMapping = { found: false, role: 'staff', constituency: '', base: '' };
  try {
    const loaded = await readText(`${host}/app/staff-role?email=${encodeURIComponent(email)}`, '');
    const data = JSON.parse(loaded.text) as Partial<LmsMapping>;
    return {
      found: Boolean(data.found),
      role: isRole(data.role) ? data.role : 'staff',
      constituency: typeof data.constituency === 'string' ? data.constituency : '',
      base: typeof data.base === 'string' && /^\/[a-z0-9-]+\/[a-z0-9-]+$/.test(data.base) ? data.base : '',
    };
  } catch {
    return empty;
  }
}

export type OfficerProfile = {
  email: string;
  name: string;
  phone: string;
  idNumber: string;
  role: LmsRole;
  constituency: string;
  base: string;
};

export async function fetchOfficerProfile(host: string, cookie: string, email: string): Promise<OfficerProfile | null> {
  try {
    const loaded = await readText(`${host}/app/me`, cookie);
    const data = JSON.parse(loaded.text) as Partial<OfficerProfile> & { found?: boolean };
    if (!data || data.found === false || !data.role) return null;
    return {
      email: (data.email || email).trim().toLowerCase(),
      name: typeof data.name === 'string' ? data.name : '',
      phone: typeof data.phone === 'string' ? data.phone : '',
      idNumber: typeof data.idNumber === 'string' ? data.idNumber : '',
      role: isRole(data.role) ? data.role : 'staff',
      constituency: typeof data.constituency === 'string' ? data.constituency : '',
      base: typeof data.base === 'string' ? data.base : '',
    };
  } catch {
    return null;
  }
}

export function rememberMappedMenu(email: string, mapped: LmsMapping) {
  if (!mapped.found) return;
  const cached = loadLmsCache(email);
  const menu = mapped.role === 'constituency' ? constituencyMenu(mapped.base) : LMS_PAGES[mapped.role];
  saveLmsCache({
    email,
    role: mapped.role,
    fetchedAt: cached?.fetchedAt || new Date().toISOString(),
    detail: cached?.detail || `Signed in as ${roleLabel(mapped.role)}.`,
    pages: cached?.pages || {},
    menu,
    host: cached?.host,
    cookie: cached?.cookie,
  });
}

async function downloadMenu(
  host: string,
  email: string,
  role: LmsRole,
  base: string,
  constituency: string,
  cookie: string,
  lead: string,
): Promise<{ role: LmsRole; detail: string; constituency: string }> {
  const menu = role === 'constituency' ? constituencyMenu(base) : LMS_PAGES[role];
  const pages: Record<string, LmsPageView> = {};
  const seen = new Set<string>();
  let nextCookie = cookie;
  let signedPages = 0;
  for (const page of menu) {
    if (!page.path || seen.has(page.path)) continue;
    seen.add(page.path);
    const loaded = await readText(`${host}${page.path}`, nextCookie);
    nextCookie = mergeSessionCookie(nextCookie, loaded.setCookie ? loaded.setCookie.split('\n') : []);
    if (isLoginHtml(loaded.url, loaded.text)) continue;
    if (!/content-wrapper/.test(loaded.text)) continue;
    const view = pageView(loaded.text);
    pages[page.path] = view;
    signedPages += 1;
  }
  if (!signedPages) {
    throw new Error('The LMS session did not return dashboard pages.');
  }
  const withFigures = Object.values(pages).filter((page) => pageHasFigures(page)).length;
  const detail = withFigures
    ? `${lead} Signed in to ${host.replace('https://', '')} as ${roleLabel(role)}. Figures and tables from each page are saved on this phone.`
    : `${lead} Signed in to ${host.replace('https://', '')} as ${roleLabel(role)}. Open Refresh pages if a screen still has no figures.`;
  const name = constituency || (role === 'constituency' ? (base.split('/').filter(Boolean)[1]?.replace(/-/g, ' ') || '') : '');
  saveLmsCache({ email, role, fetchedAt: new Date().toISOString(), detail, pages, menu, host, cookie: nextCookie });
  return { role, detail, constituency: name };
}

export async function syncLmsMailbox(email: string, password: string, options?: { refresh?: boolean }): Promise<{ authenticated: boolean; role: LmsRole; detail: string; constituency: string }> {
  const cached = loadLmsCache(email);
  let lastDetail = 'lms.uwezo.go.ke did not answer.';
  try {
    for (const host of LMS_HOSTS) {
      if (!(await hostAnswers(host))) continue;
      const signed = await loginToHost(host, email, password);
      if (!signed.ok) {
        lastDetail = signed.detail;
        continue;
      }
      const mapped = signed.account?.role
        ? {
            found: true,
            role: isRole(signed.account.role) ? signed.account.role : signed.role,
            constituency: signed.account.constituency || '',
            base: signed.account.base && /^\/[a-z0-9-]+\/[a-z0-9-]+$/.test(signed.account.base) ? signed.account.base : '',
          }
        : await fetchStaffRole(host, email);
      const landedUrl = signed.html.split('\n')[0] || '';
      const base = mapped.base || constituencyBase(landedUrl);
      const role = mapped.found ? mapped.role : signed.role;
      const keepPages = options?.refresh === false && cacheHasFigures(cached);
      if (keepPages && cached) {
        const menu = role === 'constituency' ? constituencyMenu(base) : LMS_PAGES[role];
        const detail = `Signed in to ${host.replace('https://', '')} as ${roleLabel(role)}. Officer details on this phone are still within 15 days.`;
        saveLmsCache({
          email,
          role,
          pages: cached.pages,
          menu,
          host,
          cookie: signed.cookie || cached.cookie,
          detail,
          fetchedAt: cached.fetchedAt,
        });
        return { authenticated: true, role, detail, constituency: mapped.constituency };
      }
      try {
        let session = signed.cookie;
        if (!session) {
          const probe = await readText(`${host}/dashboard`, '');
          session = mergeSessionCookie('', probe.setCookie ? probe.setCookie.split('\n') : []);
          if (!session && !isLoginHtml(probe.url, probe.text) && /content-wrapper/.test(probe.text)) {
            session = cached?.cookie || '';
          }
        }
        const saved = await downloadMenu(host, email, role, base, mapped.constituency, session, 'Signed in.');
        return { authenticated: true, role: saved.role, detail: saved.detail, constituency: saved.constituency };
      } catch {
        if (cacheHasFigures(cached)) {
          const menu = role === 'constituency' ? constituencyMenu(base) : LMS_PAGES[role];
          const detail = `Signed in to ${host.replace('https://', '')} as ${roleLabel(role)}. Showing the last figures saved on this phone.`;
          saveLmsCache({ ...cached!, email, role, menu, host, cookie: signed.cookie || cached?.cookie, detail });
          return { authenticated: true, role, detail, constituency: mapped.constituency };
        }
        const menu = role === 'constituency' ? constituencyMenu(base) : LMS_PAGES[role];
        const detail = `Signed in to ${host.replace('https://', '')} as ${roleLabel(role)}. The page copy will finish when the connection is steady. Use Refresh pages.`;
        saveLmsCache({ email, role, fetchedAt: new Date().toISOString(), detail, pages: {}, menu, host, cookie: signed.cookie });
        return { authenticated: true, role, detail, constituency: mapped.constituency };
      }
    }
    return {
      authenticated: false,
      role: cached?.role || 'staff',
      constituency: '',
      detail: cached ? `${lastDetail} The last copy on this phone is kept.` : lastDetail,
    };
  } catch {
    return {
      authenticated: false,
      role: cached?.role || 'staff',
      constituency: '',
      detail: cached
        ? 'lms.uwezo.go.ke did not answer. This phone is showing the last downloaded copy.'
        : 'lms.uwezo.go.ke did not answer.',
    };
  }
}

async function postForm(url: string, cookie: string, referer: string, body: string): Promise<{ status: number; setCookie: string; text: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', Referer: referer };
  if (cookie) headers.Cookie = cookie;
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.post({
      url,
      headers,
      data: body,
      connectTimeout: 20000,
      readTimeout: 20000,
      disableRedirects: true,
    });
    return { status: response.status, setCookie: rawSetCookies(response.headers).join('\n'), text: bodyText(response.data) };
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
    credentials: 'include',
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
  });
  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() || [];
  const setCookie = getSetCookie.length ? getSetCookie.join('\n') : (response.headers.get('set-cookie') || '');
  return { status: response.status, setCookie, text: await response.text() };
}

export async function openLmsFromZimbra(email: string, token: string): Promise<{ authenticated: boolean; role: LmsRole; detail: string; constituency: string }> {
  const cached = loadLmsCache(email);
  let last = 'The LMS did not open this mailbox session.';
  try {
    for (const host of LMS_HOSTS) {
      if (!(await hostAnswers(host))) continue;
      const posted = await postForm(
        `${host}/app/zimbra-session`,
        '',
        `${host}/login`,
        `email=${encodeURIComponent(email)}&authToken=${encodeURIComponent(token)}`,
      );
      let data: { ok?: boolean; role?: string; constituency?: string; base?: string; detail?: string; found?: boolean } = {};
      try {
        data = JSON.parse(posted.text) as typeof data;
      } catch {
        data = {};
      }
      if (!data.ok) {
        last = data.detail || (posted.status === 404 ? 'The LMS has no mailbox session yet.' : 'The LMS did not accept this mailbox.');
        const mapped = await fetchStaffRole(host, email);
        if (mapped.found) rememberMappedMenu(email, mapped);
        continue;
      }
      const role = isRole(data.role) ? data.role : 'staff';
      const saved = await downloadMenu(
        host,
        email,
        role,
        typeof data.base === 'string' ? data.base : '',
        data.constituency || '',
        sessionCookie(posted.setCookie.split('\n')),
        'Signed in with the mailbox.',
      );
      return { authenticated: true, role: saved.role, detail: saved.detail, constituency: saved.constituency };
    }
  } catch {
    last = 'lms.uwezo.go.ke did not answer.';
  }
  return { authenticated: false, role: cached?.role || 'staff', constituency: '', detail: cached ? `${last} The last copy on this phone is kept.` : last };
}

function xsrfToken(cookie: string): string {
  const raw = /XSRF-TOKEN=([^;]+)/.exec(cookie)?.[1] || '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function postJson(url: string, cookie: string, referer: string, data: unknown): Promise<{ status: number; text: string }> {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Livewire': '',
    Cookie: cookie,
    'X-XSRF-TOKEN': xsrfToken(cookie),
    Referer: referer,
  };
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.post({ url, headers, data, connectTimeout: 30000, readTimeout: 45000 });
    const raw = response.data;
    return { status: response.status, text: typeof raw === 'string' ? raw : JSON.stringify(raw ?? '') };
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
    credentials: 'include',
    signal: AbortSignal.timeout(45000),
  });
  return { status: response.status, text: await response.text() };
}

export const REPORT_FIELDS: { key: string; label: string; group: string }[] = [
  { key: 'groups.name', label: 'Group name', group: 'Groups' },
  { key: 'groups.code', label: 'Group code', group: 'Groups' },
  { key: 'groups.reg_number', label: 'Registration number', group: 'Groups' },
  { key: 'groups.bank', label: 'Bank', group: 'Groups' },
  { key: 'groups.account', label: 'Account', group: 'Groups' },
  { key: 'location.ward_name', label: 'Ward', group: 'Groups' },
  { key: 'location.constituency_name', label: 'Constituency', group: 'Groups' },
  { key: 'location.county_name', label: 'County', group: 'Groups' },
  { key: 'group_loans.loan_status', label: 'Loan status', group: 'Loans' },
  { key: 'group_loans.sector', label: 'Sector', group: 'Loans' },
  { key: 'group_loans.category', label: 'Category', group: 'Loans' },
  { key: 'group_loans.amount_applied', label: 'Amount applied', group: 'Loans' },
  { key: 'group_loans.amount_approved', label: 'Amount approved', group: 'Loans' },
  { key: 'group_loans.amount_issued', label: 'Amount issued', group: 'Loans' },
  { key: 'group_loans.amount_repaid', label: 'Amount repaid', group: 'Loans' },
  { key: 'group_loans.total_arrears', label: 'Arrears', group: 'Loans' },
  { key: 'group_loans.disbursement_date', label: 'Disbursement date', group: 'Loans' },
  { key: 'members.name', label: 'Member name', group: 'Members' },
  { key: 'members.number', label: 'Phone', group: 'Members' },
  { key: 'members.gender', label: 'Gender', group: 'Members' },
  { key: 'financed_loans_filter', label: 'Financed loans', group: 'Filter' },
  { key: 'all_loans_filter', label: 'All loans', group: 'Filter' },
  { key: 'pending_loans_filter', label: 'Pending disbursements', group: 'Filter' },
  { key: 'fully_repaid', label: 'Fully repaid', group: 'Filter' },
];

export const DEFAULT_REPORT_COLUMNS = [
  'groups.name',
  'groups.code',
  'location.constituency_name',
  'group_loans.loan_status',
  'group_loans.amount_issued',
  'group_loans.amount_repaid',
  'financed_loans_filter',
];

const DRAFT_KEY = 'uwezo.lms.drafts.v1';
const emptyView = (): LmsPageView => ({ summary: [], tables: [], notes: [], fields: [], actions: [] });

function draftId(email: string, path: string): string {
  return `${email.trim().toLowerCase()}|${path}`;
}

export function loadLmsDraft(email: string, path: string): Record<string, string> {
  try {
    const all = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') as Record<string, { values?: Record<string, string> }>;
    return all[draftId(email, path)]?.values || {};
  } catch {
    return {};
  }
}

export function saveLmsDraft(email: string, path: string, values: Record<string, string>) {
  let all: Record<string, unknown> = {};
  try {
    all = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') as Record<string, unknown>;
  } catch {
    all = {};
  }
  all[draftId(email, path)] = { values, savedAt: new Date().toISOString() };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(all));
}

function reportColumnSet(html: string): Set<string> {
  const selected = new Set<string>();
  for (const match of contentHtml(html).matchAll(/<input\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/selectedColumns/.test(tag) || !/\schecked(?:\s|=|>|$)/i.test(tag)) continue;
    const value = decodeEntities(/value="([^"]+)"/.exec(tag)?.[1] || '');
    if (value) selected.add(value);
  }
  return selected;
}

function columnList(values: Record<string, string>): string[] {
  const raw = (values.selectedColumns || DEFAULT_REPORT_COLUMNS.join(','))
    .split(',')
    .map((item) => item.trim())
    .filter((item) => REPORT_FIELDS.some((field) => field.key === item));
  const selected = raw.length ? raw : [...DEFAULT_REPORT_COLUMNS];
  if (!selected.some((key) => REPORT_FIELDS.find((field) => field.key === key)?.group !== 'Filter')) {
    selected.push('groups.name', 'group_loans.amount_issued');
  }
  return [...new Set(selected)];
}

function reportLabel(key: string): string {
  return REPORT_FIELDS.find((field) => field.key === key)?.label || humanize(key);
}

export async function reviewLmsDraft(email: string, path: string, values: Record<string, string>): Promise<{ ok: boolean; detail: string; rows: LmsCompareRow[] }> {
  const cache = loadLmsCache(email);
  if (!cache?.host || !cache.cookie) return { ok: false, detail: 'Sign in to the LMS again, then compare this page.', rows: [] };
  const loaded = await readText(`${cache.host}${path}`, cache.cookie);
  const expired = /\/login\/?(?:\?|$)/.test(loaded.url) || (/name="_token"/.test(loaded.text) && !/content-wrapper/.test(loaded.text));
  if (expired) return { ok: false, detail: 'The LMS sign-in expired. Refresh the pages and try again.', rows: [] };
  const cookie = cookieHeader(`${cache.cookie}; ${loaded.setCookie}`) || cache.cookie;
  saveLmsCache({ ...cache, cookie, pages: { ...cache.pages, [path]: pageView(loaded.text) } });
  const rows = reportMethod(path) === 'generateReport' ? compareReport(loaded.text, values) : compareFields(loaded.text, values);
  const different = rows.some((row) => row.different);
  return {
    ok: true,
    detail: different
      ? 'Some values saved on this phone differ from the LMS. Change them, or submit the phone copy.'
      : 'The copy on this phone matches the LMS. You can still submit it.',
    rows,
  };
}

function compareReport(html: string, values: Record<string, string>): LmsCompareRow[] {
  const server = reportColumnSet(html);
  const phone = new Set(columnList(values));
  return REPORT_FIELDS.filter((field) => server.has(field.key) || phone.has(field.key)).map((field) => ({
    label: field.label,
    server: server.has(field.key) ? 'Selected' : 'Not selected',
    phone: phone.has(field.key) ? 'Selected' : 'Not selected',
    different: server.has(field.key) !== phone.has(field.key),
  }));
}

function compareFields(html: string, values: Record<string, string>): LmsCompareRow[] {
  const server = new Map(pageFields(html).map((field) => [field.key, field.value]));
  return Object.entries(values).filter(([key]) => key && !key.startsWith('__')).map(([key, phone]) => {
    const current = server.get(key) || '';
    return { label: reportLabel(key), server: current || '—', phone: phone || '—', different: current !== phone };
  });
}

function componentSnapshot(html: string, hint: string): string {
  // Prefer the main page component. Guide/side-nav modals must not win.
  const snaps = [...html.matchAll(/wire:snapshot="([^"]+)"/g)].map((match) => decodeEntities(match[1]));
  const score = (snapshot: string) => {
    let name = '';
    try {
      name = String((JSON.parse(snapshot) as { memo?: { name?: string } }).memo?.name || '');
    } catch {
      name = '';
    }
    if (/modal|side-nav|guide|badge|historical-correction/i.test(name)) return -200;
    let value = Math.min(snapshot.length / 8000, 25);
    if (hint && snapshot.includes(`"${hint}"`)) value += 90;
    else if (hint && snapshot.includes(hint)) value += 55;
    if (/phase-manager|application-dashboard|group-loans|loan-receipts|groups-info|group-members|loan-phase|loan-applicants|constituency-dashboard|dynamic|data-upload|create-user|audit/i.test(name)) {
      value += 70;
    }
    if (snapshot.includes('selectedColumns') || snapshot.includes('previewRows') || snapshot.includes('hasPreview')) value += 25;
    if (snapshot.includes('phaseName') || snapshot.includes('editPhaseName') || snapshot.includes('constituencyBankBalance')) value += 15;
    return value;
  };
  return snaps.sort((left, right) => score(right) - score(left))[0] || '';
}

function livewireToast(text: string): string {
  try {
    const data = JSON.parse(text) as {
      message?: string;
      components?: { effects?: { dispatches?: { params?: unknown }[] } }[];
    };
    const dispatches = data.components?.[0]?.effects?.dispatches || [];
    for (const item of dispatches) {
      const params = item.params;
      const bag = Array.isArray(params) ? params[0] : params;
      if (bag && typeof bag === 'object' && 'message' in bag && typeof (bag as { message?: unknown }).message === 'string') {
        return (bag as { message: string }).message;
      }
    }
    if (typeof data.message === 'string' && data.message.length < 240 && !/stack trace/i.test(data.message)) return data.message;
  } catch {
    return '';
  }
  return '';
}

function livewireUpdates(path: string, values: Record<string, string>, html: string): Record<string, unknown> {
  if (reportMethod(path) === 'generateReport') return { selectedColumns: columnList(values) };
  const allowed = new Set([
    ...pageFields(html).map((field) => field.key),
    ...(pageKit(path)?.fields.map((field) => field.key) || []),
  ]);
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!key || key.startsWith('__') || !allowed.has(key)) continue;
    if (key === 'editingPhaseId' || /Id$/.test(key) || key.toLowerCase().includes('amount') || key === 'constituencyBankBalance') {
      const amount = Number(value);
      updates[key] = value === '' ? null : (Number.isFinite(amount) && value.trim() !== '' ? amount : value);
      continue;
    }
    updates[key] = value;
  }
  return updates;
}

function actionParams(values: Record<string, string>, method: string): Array<string | number> {
  if (values.__params) {
    try {
      const parsed = JSON.parse(values.__params) as Array<string | number>;
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall through to method-specific params.
    }
  }
  if (method === 'openEditPhaseModal' && values.editingPhaseId) {
    const id = Number(values.editingPhaseId);
    return [Number.isFinite(id) ? id : values.editingPhaseId];
  }
  if ((method === 'editReceipt' || method === 'cancelReceipt' || method === 'viewGroupLoan' || method === 'downloadStatement') && values.__id) {
    const id = Number(values.__id);
    return [Number.isFinite(id) ? id : values.__id];
  }
  return [];
}

export async function runLmsAction(
  email: string,
  path: string,
  values: Record<string, string>,
): Promise<{ ok: boolean; detail: string; view: LmsPageView }> {
  const cache = loadLmsCache(email);
  const current = cache?.pages[path] || emptyView();
  if (!cache?.host || !cache.cookie) return { ok: false, detail: 'Sign in to the LMS again, then submit this page.', view: current };
  const pageUrl = `${cache.host}${path}`;
  const loaded = await readText(pageUrl, cache.cookie);
  const expired = /\/login\/?(?:\?|$)/.test(loaded.url) || (/name="_token"/.test(loaded.text) && !/content-wrapper/.test(loaded.text));
  if (expired) return { ok: false, detail: 'The LMS sign-in expired. Refresh the pages and try again.', view: current };
  const kitMethods = (pageKit(path)?.actions || []).map((item) => item.method);
  const known = new Set([reportMethod(path), ...pageActions(loaded.text), ...kitMethods].filter(Boolean));
  const requested = values.__action || '';
  const method = requested && (known.has(requested) || kitMethods.includes(requested))
    ? requested
    : (reportMethod(path) || kitMethods[0] || pageActions(loaded.text)[0] || '');
  if (!method) return { ok: false, detail: 'This page has no submit action in the app. Refresh it, or open it on the LMS for a file upload.', view: pageView(loaded.text) };
  const snapshot = componentSnapshot(loaded.text, method);
  const token = /csrf-token"\s+content="([^"]+)"/.exec(loaded.text)?.[1] || /name="_token"\s+value="([^"]+)"/.exec(loaded.text)?.[1] || '';
  if (!snapshot || !token) return { ok: false, detail: 'This page did not include a save action.', view: pageView(loaded.text) };
  const cookie = cookieHeader(`${cache.cookie}; ${loaded.setCookie}`) || cache.cookie;
  const params = actionParams(values, method);
  const posted = await postJson(`${cache.host}/livewire/update`, cookie, pageUrl, {
    _token: token,
    components: [{ snapshot, updates: livewireUpdates(path, values, loaded.text), calls: [{ path: '', method, params }] }],
  });
  let html = '';
  try {
    const data = JSON.parse(posted.text) as { components?: { effects?: { html?: string } }[] };
    html = data.components?.[0]?.effects?.html || '';
  } catch {
    html = '';
  }
  const toast = livewireToast(posted.text);
  const failed = /must select|unauthorised|unauthorized|unexpected error|invalid selection|not authorised|permission denied|could not create|validation error/i.test(toast);
  if (failed) {
    return {
      ok: false,
      detail: toast || 'The LMS rejected that action.',
      view: html ? pageView(html) : pageView(loaded.text),
    };
  }
  // Some actions only toast / refresh without returning replacement HTML.
  const view = pageView(html || loaded.text);
  if (!html && method !== 'refreshData') {
    const refreshed = await readText(pageUrl, cookie);
    const next = pageView(refreshed.text);
    saveLmsCache({ ...cache, cookie: mergeSessionCookie(cookie, refreshed.setCookie ? refreshed.setCookie.split('\n') : []), pages: { ...cache.pages, [path]: next } });
    return {
      ok: true,
      detail: toast || 'Submitted to the LMS.',
      view: next,
    };
  }
  saveLmsCache({ ...cache, cookie, pages: { ...cache.pages, [path]: view } });
  const count = view.tables.reduce((sum, table) => sum + table.rows.length, 0);
  return {
    ok: true,
    detail: toast || (count ? `Updated. ${count} rows are on this phone.` : 'Submitted to the LMS.'),
    view,
  };
}

export async function generateLmsReport(email: string, path: string): Promise<{ ok: boolean; detail: string; view: LmsPageView }> {
  const draft = loadLmsDraft(email, path);
  const values = reportMethod(path) === 'generateReport'
    ? { ...draft, selectedColumns: draft.selectedColumns || DEFAULT_REPORT_COLUMNS.join(',') }
    : draft;
  return runLmsAction(email, path, values);
}
