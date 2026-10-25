/**
 * Offline LMS shells — full HTML pages from lms.uwezo.go.ke so offline UX/UI
 * matches the online site in the same WebView.
 */

import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { readLmsOfflinePage, saveLmsOfflinePage } from './native';
import { loadLmsCache, type LmsPage } from './lmsSync';

const SHELL_KEY = 'uwezo.lms.page.shells.v1';

export type LmsPageShells = {
  email: string;
  host: string;
  savedAt: string;
  pages: Record<string, string>; // path -> offline-ready HTML
};

function loadAll(): Record<string, LmsPageShells> {
  try {
    return JSON.parse(localStorage.getItem(SHELL_KEY) || '{}') as Record<string, LmsPageShells>;
  } catch {
    return {};
  }
}

function saveAll(all: Record<string, LmsPageShells>) {
  localStorage.setItem(SHELL_KEY, JSON.stringify(all));
}

export function loadPageShells(email: string): LmsPageShells | null {
  const row = loadAll()[email.trim().toLowerCase()];
  return row?.pages ? row : null;
}

export function getCachedPageHtml(email: string, path: string): string | null {
  const shells = loadPageShells(email);
  if (!shells) return null;
  if (shells.pages[path]) return shells.pages[path];
  const normalized = path.endsWith('/') ? path.slice(0, -1) : `${path}/`;
  return shells.pages[normalized] || shells.pages[path.split('?')[0]] || null;
}

/** Prefer full native-disk HTML, then localStorage index. Scrub Alpine/JS leaks. */
export async function resolveCachedPageHtml(email: string, path: string): Promise<string | null> {
  const fromDisk = await readLmsOfflinePage(path);
  const raw = fromDisk && fromDisk.length > 200 ? fromDisk : getCachedPageHtml(email, path);
  if (!raw) return null;
  const cleaned = scrubCachedPageHtml(raw);
  if (cleaned !== raw && fromDisk) {
    void saveLmsOfflinePage(path, cleaned);
  }
  return cleaned;
}

export function hasAnyCachedScreens(email: string): boolean {
  const shells = loadPageShells(email);
  return Boolean(shells && Object.keys(shells.pages).length);
}

async function fetchText(url: string, cookie: string): Promise<string> {
  const headers: Record<string, string> = { Accept: 'text/html,*/*' };
  if (cookie) headers.Cookie = cookie;
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url,
      headers,
      connectTimeout: 30000,
      readTimeout: 60000,
    });
    const data = response.data;
    return typeof data === 'string' ? data : String(data ?? '');
  }
  const response = await fetch(url, { headers, credentials: 'include', signal: AbortSignal.timeout(60000) });
  return response.text();
}

function absoluteUrl(host: string, href: string): string {
  if (!href || href.startsWith('data:') || href.startsWith('blob:')) return href;
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('//')) return `https:${href}`;
  if (href.startsWith('/')) return `${host}${href}`;
  return `${host}/${href}`;
}

function collectStylesheetHrefs(html: string, host: string): string[] {
  const hrefs: string[] = [];
  const re = /<link[^>]+rel=["']stylesheet["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const tag = match[0];
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
    if (href && !href.includes('fonts.bunny') && !href.includes('fonts.googleapis')) {
      hrefs.push(absoluteUrl(host, href));
    }
  }
  // Vite-built CSS often appears as <link rel="modulepreload"> or build assets in HTML
  const buildCss = html.match(/\/build\/assets\/[^"'\\s]+\.css/g) || [];
  for (const path of buildCss) hrefs.push(absoluteUrl(host, path));
  return [...new Set(hrefs)];
}

/** Remove Livewire/Alpine that otherwise leaks as visible JS/SQL-like text offline. */
function sanitizeOfflineHtml(html: string): string {
  let doc = html;
  // Drop executable / Alpine template blocks entirely
  doc = doc.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  doc = doc.replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, '');
  // Alpine / Livewire attributes (quoted, including multiline)
  doc = doc.replace(
    /\s(?:x-[\w.:-]+|wire:[\w.-]+|@[\w.:-]+|x-on:[\w.-]+)\s*=\s*(["'])[\s\S]*?\1/gi,
    '',
  );
  // Unquoted alpine-ish attributes
  doc = doc.replace(/\s(?:x-[\w.:-]+|wire:[\w.-]+)\s*=\s*[^\s>]+/gi, '');
  // Broken x-data / x-text bodies that browsers promote to text nodes
  doc = doc.replace(
    />\s*(?:\{[\s\S]{0,4000}?filteredOptions\s*\(|filteredOptions\s*\(|get\s+filteredOptions|found\s*&&\s*found\[|COUNTY\s+o\s*&&|Select County|this\.value\)\s*;\s*return|if\s*\(\s*!this\.options)[\s\S]*?(?=<)/gi,
    '>',
  );
  // Any leftover text chunks that look like JS source between tags
  doc = doc.replace(
    />\s*((?:function\s*\(|return\s+\[\]|Array\.isArray\(|this\.search|this\.options|o\s*&&\s*o\[|Select County|filteredOptions)[\s\S]{20,12000}?)\s*</gi,
    '><',
  );
  return doc;
}

function injectOfflineChrome(html: string, paths: string[]): string {
  const list = JSON.stringify(paths);
  const chrome = `
<style id="uwezo-offline-chrome">
  #uwezo-offline-banner{position:sticky;top:0;z-index:99999;background:#7a1f6a;color:#fff;padding:.28rem .55rem;font:600 12px/1.2 system-ui,sans-serif;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #uwezo-offline-banner[data-msg]:not([data-msg=""])::after{content:" · " attr(data-msg);font-weight:400;opacity:.92}
</style>
<div id="uwezo-offline-banner" data-msg="">Offline</div>
<script>
(function(){
  var paths = ${list};
  function tip(msg){
    var banner = document.getElementById('uwezo-offline-banner');
    if (banner) banner.setAttribute('data-msg', msg || '');
  }
  function scrubLeak(){
    try {
      var root = document.body;
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var drop = [];
      var node;
      while ((node = walker.nextNode())) {
        var t = node.nodeValue || '';
        if (t.length < 30) continue;
        if (/filteredOptions|Select County|Array\\.isArray\\s*\\(\\s*this\\.options|this\\.search|found\\s*&&\\s*found\\[|COUNTY\\s+o\\s*&&|o\\s*&&\\s*o\\['id'\\]/.test(t)) {
          drop.push(node);
        }
      }
      for (var i = 0; i < drop.length; i++) drop[i].nodeValue = '';
    } catch (e) {}
  }
  scrubLeak();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scrubLeak);
  else setTimeout(scrubLeak, 0);
  function norm(p){
    try { p = new URL(p, location.href).pathname; } catch(e) {}
    if (p.length > 1 && p.slice(-1) === '/') p = p.slice(0,-1);
    return p;
  }
  document.addEventListener('click', function(ev){
    var el = ev.target;
    if (!el || !el.closest) return;
    var a = el.closest('a[href]');
    if (a) {
      var href = a.getAttribute('href') || '';
      if (href.indexOf('#') === 0) return;
      if (/^(mailto:|tel:|javascript:)/i.test(href)) return;
      ev.preventDefault();
      ev.stopPropagation();
      var path = norm(href);
      if (paths.indexOf(path) >= 0 || paths.indexOf(path + '/') >= 0) {
        tip('');
        if (window.UwezoLmsOffline && window.UwezoLmsOffline.openPath) {
          window.UwezoLmsOffline.openPath(path);
          return;
        }
      }
      tip('Page not cached — sync online');
      return;
    }
    var btn = el.closest('button, [type=submit], .btn');
    if (btn && !btn.closest('#uwezo-offline-banner')) {
      ev.preventDefault();
      ev.stopPropagation();
      tip('Sync online to save changes');
    }
  }, true);
  document.addEventListener('submit', function(ev){
    ev.preventDefault();
    ev.stopPropagation();
  }, true);
})();
</script>`;
  if (/<body[^>]*>/i.test(html)) return html.replace(/<body([^>]*)>/i, `<body$1>${chrome}`);
  return chrome + html;
}

async function buildOfflineHtml(host: string, html: string, menuPaths: string[], styleCache: Map<string, string>): Promise<string> {
  const hrefs = collectStylesheetHrefs(html, host);
  // Always include AdminLTE shell used by the live LMS
  for (const extra of [
    `${host}/dist/css/adminlte.min.css`,
    `${host}/dist/css/custom.css`,
    `${host}/plugins/fontawesome-free/css/all.min.css`,
    `${host}/css/animate-lite.css`,
  ]) {
    if (!hrefs.includes(extra)) hrefs.push(extra);
  }
  const cssChunks: string[] = [];
  for (const href of hrefs.slice(0, 12)) {
    if (!styleCache.has(href)) {
      try {
        styleCache.set(href, await fetchText(href, ''));
      } catch {
        styleCache.set(href, '');
      }
    }
    const css = styleCache.get(href) || '';
    if (css) cssChunks.push(`/* ${href} */\n${css}`);
  }
  let doc = sanitizeOfflineHtml(html);
  // Drop remote stylesheet links; styles are inlined
  doc = doc.replace(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi, '');
  const styleBlock = `<style id="uwezo-offline-assets">${cssChunks.join('\n')}</style>`;
  if (/<\/head>/i.test(doc)) doc = doc.replace(/<\/head>/i, `${styleBlock}</head>`);
  else doc = styleBlock + doc;
  return injectOfflineChrome(doc, menuPaths);
}

/** Clean an already-cached offline page (fixes Alpine/JS text leaks on older copies). */
export function scrubCachedPageHtml(html: string): string {
  if (!html) return html;
  const pathMatch = /var paths = (\[[\s\S]*?\]);/.exec(html);
  let paths: string[] = [];
  if (pathMatch) {
    try {
      paths = JSON.parse(pathMatch[1]) as string[];
    } catch {
      paths = [];
    }
  }
  let doc = html;
  doc = doc.replace(/<style id="uwezo-offline-chrome">[\s\S]*?<\/style>/gi, '');
  doc = doc.replace(/<div id="uwezo-offline-banner"[^>]*>[\s\S]*?<\/div>/gi, '');
  doc = doc.replace(/<script>\s*\(function\(\)\{\s*var paths =[\s\S]*?<\/script>/gi, '');
  doc = sanitizeOfflineHtml(doc);
  return injectOfflineChrome(doc, paths);
}

/** Download live LMS screens for offline use (same UI as the website). */
export async function cacheLmsPageShells(email: string, menu: LmsPage[]): Promise<{ ok: boolean; detail: string; count: number }> {
  const cache = loadLmsCache(email);
  const host = cache?.host || 'https://lms.uwezo.go.ke';
  const cookie = cache?.cookie || '';
  if (!cookie) return { ok: false, detail: 'Sign in to the LMS first, then refresh to save offline screens.', count: 0 };

  const paths = menu.map((item) => item.path).filter(Boolean);
  const styleCache = new Map<string, string>();
  const pages: Record<string, string> = {};
  let okCount = 0;
  for (const path of paths) {
    try {
      const raw = await fetchText(`${host}${path}`, cookie);
      if (!raw || /name="_token"/i.test(raw) && /login/i.test(raw) && raw.length < 8000) continue;
      pages[path] = await buildOfflineHtml(host, raw, paths, styleCache);
      okCount += 1;
    } catch {
      /* skip failed page */
    }
  }
  if (!okCount) return { ok: false, detail: 'Could not download LMS screens for offline use.', count: 0 };
  for (const [path, html] of Object.entries(pages)) {
    await saveLmsOfflinePage(path, html);
  }
  const all = loadAll();
  // Keep lightweight index in localStorage (full HTML also on native disk for WebView nav)
  const indexPages: Record<string, string> = {};
  for (const [path, html] of Object.entries(pages)) {
    indexPages[path] = html.length > 350000 ? `${html.slice(0, 350000)}<!--trimmed-->` : html;
  }
  all[email.trim().toLowerCase()] = {
    email: email.trim().toLowerCase(),
    host,
    savedAt: new Date().toISOString(),
    pages: indexPages,
  };
  try {
    saveAll(all);
  } catch {
    const trimmed: Record<string, string> = {};
    let n = 0;
    for (const [path, html] of Object.entries(pages)) {
      if (n >= 6) break;
      trimmed[path] = html.slice(0, 200000);
      n += 1;
    }
    all[email.trim().toLowerCase()] = { email: email.trim().toLowerCase(), host, savedAt: new Date().toISOString(), pages: trimmed };
    try {
      saveAll(all);
    } catch {
      /* native files still hold full pages */
    }
    return { ok: true, detail: `Saved ${okCount} LMS screens offline — same UI as the website.`, count: okCount };
  }
  return { ok: true, detail: `Saved ${okCount} LMS screens offline — same UI as lms.uwezo.go.ke.`, count: okCount };
}
