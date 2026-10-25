import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { xmlEscape, zimbraAccountRequest } from './zimbraAuth';

export const MAIL_FOLDERS = [
  { id: 'inbox', label: 'Inbox', query: 'in:inbox' },
  { id: 'sent', label: 'Sent', query: 'in:sent' },
  { id: 'drafts', label: 'Drafts', query: 'in:drafts' },
  { id: 'spam', label: 'Spam', query: 'in:junk' },
  { id: 'archive', label: 'Archive', query: 'in:archive OR in:"/Archive"' },
  { id: 'deleted', label: 'Deleted', query: 'in:trash' },
] as const;

export type MailFolderId = (typeof MAIL_FOLDERS)[number]['id'];

export type MailItem = {
  id: string;
  from: string;
  to: string;
  subject: string;
  preview: string;
  date: string;
};

export type MailPart = {
  part: string;
  name: string;
  type: string;
  size: number;
};

export type MailDetail = {
  id: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  html: string;
  date: string;
  attachments: MailPart[];
};

export type MailAttachment = { name: string; type: string; base64: string };

export type MailPayload = {
  to: string;
  cc?: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
  signature?: MailAttachment | null;
  origId?: string;
};

const ACCOUNT_HOST = 'https://mail.govmail.ke';

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function textOf(value: string): string {
  return decodeXml(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function when(stamp: number): string {
  if (!stamp) return '';
  const ms = stamp < 1e12 ? stamp * 1000 : stamp;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

function addresses(xml: string, type: string): string[] {
  const found: string[] = [];
  for (const match of xml.matchAll(/<e\b([^>]*)\/?>/g)) {
    const attrs = match[1];
    const kind = /\bt="([a-z])"/i.exec(attrs)?.[1] || '';
    if (kind !== type) continue;
    const address = decodeXml(/\ba="([^"]+)"/i.exec(attrs)?.[1] || '');
    const personal = decodeXml(/\bp="([^"]+)"/i.exec(attrs)?.[1] || '');
    const value = address || personal;
    if (value && !found.includes(value)) found.push(value);
  }
  return found;
}

function splitAddresses(value: string): string[] {
  return value
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter((item) => item.includes('@'));
}

export function parseMessages(xml: string): MailItem[] {
  const items: MailItem[] = [];
  for (const match of xml.matchAll(/<m\b([^>]*)>([\s\S]*?)<\/m>/g)) {
    const attrs = match[1];
    const body = match[2];
    const id = /id="([^"]+)"/.exec(attrs)?.[1] || '';
    if (!id) continue;
    const from = addresses(body, 'f')[0] || '';
    const to = addresses(body, 't')[0] || '';
    items.push({
      id,
      from,
      to,
      subject: textOf(body.match(/<su\b[^>]*>([\s\S]*?)<\/su>/)?.[1] || '') || '(no subject)',
      preview: textOf(body.match(/<fr\b[^>]*>([\s\S]*?)<\/fr>/)?.[1] || ''),
      date: when(Number(/\sd="(\d+)"/.exec(attrs)?.[1] || 0)),
    });
  }
  return items;
}

export function parseMessageBody(xml: string): string {
  const parts = [...xml.matchAll(/<content\b[^>]*>([\s\S]*?)<\/content>/g)].map((match) => textOf(match[1])).filter(Boolean);
  return parts.sort((left, right) => right.length - left.length)[0] || '';
}

function partAttrs(tag: string): { part: string; ct: string; name: string; size: number; body: boolean } {
  const part = /\bpart="([^"]+)"/i.exec(tag)?.[1] || '';
  const ct = (/\bct="([^"]+)"/i.exec(tag)?.[1] || '').toLowerCase();
  const name = decodeXml(/\bfilename="([^"]+)"/i.exec(tag)?.[1] || /\bname="([^"]+)"/i.exec(tag)?.[1] || '');
  const size = Number(/\bs="(\d+)"/i.exec(tag)?.[1] || 0);
  const body = /\bbody="1"/i.test(tag);
  return { part, ct, name, size, body };
}

export function parseMessageDetail(xml: string, fallback: MailItem): MailDetail {
  const message = /<m\b([^>]*)>([\s\S]*?)<\/m>/i.exec(xml);
  const attrs = message?.[1] || '';
  const bodyXml = message?.[2] || xml;
  const id = /id="([^"]+)"/.exec(attrs)?.[1] || fallback.id;
  const from = addresses(bodyXml, 'f')[0] || fallback.from;
  const to = addresses(bodyXml, 't');
  const cc = addresses(bodyXml, 'c');
  const subject = textOf(bodyXml.match(/<su\b[^>]*>([\s\S]*?)<\/su>/)?.[1] || '') || fallback.subject;
  const date = when(Number(/\sd="(\d+)"/.exec(attrs)?.[1] || 0)) || fallback.date;

  let html = '';
  let plain = '';
  for (const match of bodyXml.matchAll(/<mp\b([^>]*)>([\s\S]*?)<content\b[^>]*>([\s\S]*?)<\/content>/gi)) {
    const info = partAttrs(match[1]);
    if (/^multipart\//i.test(info.ct)) continue;
    if (!(info.body || info.ct.startsWith('text/'))) continue;
    const content = decodeXml(match[3] || '');
    if (!content) continue;
    if (info.ct.includes('html') && content.length > html.length) html = content;
    else if (textOf(content).length > plain.length) plain = textOf(content);
  }

  const attachments: MailPart[] = [];
  for (const match of bodyXml.matchAll(/<mp\b([^>]*?)(?:\/>|>)/gi)) {
    const info = partAttrs(match[1]);
    if (!info.part || /^multipart\//i.test(info.ct) || info.body || info.ct.startsWith('text/')) continue;
    if (attachments.some((item) => item.part === info.part)) continue;
    if (!info.name && !info.ct) continue;
    attachments.push({
      part: info.part,
      name: info.name || `attachment-${info.part.replace(/\W+/g, '_')}`,
      type: info.ct || 'application/octet-stream',
      size: info.size,
    });
  }

  const body = plain || textOf(html) || fallback.preview || 'This message has no text.';
  return {
    id,
    from,
    to: to.length ? to : (fallback.to ? [fallback.to] : []),
    cc,
    subject,
    body,
    html: html || `<p>${xmlEscape(body).replace(/\n/g, '<br>')}</p>`,
    date,
    attachments,
  };
}

async function call(token: string, body: string): Promise<{ ok: boolean; xml: string; authFailed: boolean; detail: string }> {
  try {
    const result = await zimbraAccountRequest(token, body);
    if (result.authFailed) return { ok: false, xml: result.xml, authFailed: true, detail: 'The mailbox sign-in expired.' };
    if (/<Fault\b/i.test(result.xml)) {
      const detail = result.xml.match(/<Text[^>]*>([^<]+)<\/Text>/)?.[1] || 'Zimbra could not complete that mail action.';
      return { ok: false, xml: result.xml, authFailed: false, detail: decodeXml(detail) };
    }
    return { ok: true, xml: result.xml, authFailed: false, detail: '' };
  } catch {
    return { ok: false, xml: '', authFailed: false, detail: 'Could not reach mail.govmail.ke.' };
  }
}

export async function listMail(token: string, query: string) {
  return call(
    token,
    `<SearchRequest xmlns="urn:zimbraMail" types="message" limit="25" offset="0"><query>${xmlEscape(query)}</query></SearchRequest>`,
  );
}

export async function readMail(token: string, id: string) {
  return call(token, `<GetMsgRequest xmlns="urn:zimbraMail"><m id="${xmlEscape(id)}" html="1" read="1"/></GetMsgRequest>`);
}

export async function fetchAttachment(
  token: string,
  messageId: string,
  part: string,
): Promise<{ ok: boolean; authFailed: boolean; detail: string; base64: string; type: string; name: string }> {
  const result = await call(
    token,
    `<GetMsgRequest xmlns="urn:zimbraMail"><m id="${xmlEscape(messageId)}" part="${xmlEscape(part)}"/></GetMsgRequest>`,
  );
  if (!result.ok) return { ok: false, authFailed: result.authFailed, detail: result.detail, base64: '', type: '', name: '' };
  const mp = /<mp\b([^>]*)>([\s\S]*?)<\/mp>/i.exec(result.xml) || /<mp\b([^>]*)\/>/i.exec(result.xml);
  const attrs = mp?.[1] || '';
  const inner = mp?.[2] || '';
  const type = (/\bct="([^"]+)"/i.exec(attrs)?.[1] || 'application/octet-stream').toLowerCase();
  const name = decodeXml(/\bfilename="([^"]+)"/i.exec(attrs)?.[1] || /\bname="([^"]+)"/i.exec(attrs)?.[1] || part);
  let content = decodeXml(inner.match(/<content\b[^>]*>([\s\S]*?)<\/content>/i)?.[1] || '');
  content = content.replace(/\s+/g, '');
  if (!content) {
    // Fallback to the authenticated content URL.
    try {
      const url = `${ACCOUNT_HOST}/service/home/~/?auth=qp&zauthtoken=${encodeURIComponent(token)}&id=${encodeURIComponent(messageId)}&part=${encodeURIComponent(part)}`;
      if (Capacitor.isNativePlatform()) {
        const response = await CapacitorHttp.get({
          url,
          responseType: 'blob',
          connectTimeout: 30000,
          readTimeout: 30000,
        });
        const data = response.data;
        if (typeof data === 'string' && data) {
          const base64 = data.includes('base64,') ? data.split('base64,').pop() || '' : data.replace(/\s+/g, '');
          if (base64) return { ok: true, authFailed: false, detail: '', base64, type, name };
        }
      } else {
        const response = await fetch(url);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          bytes.forEach((value) => {
            binary += String.fromCharCode(value);
          });
          return { ok: true, authFailed: false, detail: '', base64: btoa(binary), type: response.headers.get('content-type') || type, name };
        }
      }
    } catch {
      // Fall through to the SOAP failure message.
    }
    return { ok: false, authFailed: false, detail: 'The attachment could not be downloaded.', base64: '', type, name };
  }
  // Text parts may arrive as plain text instead of base64.
  if (/^text\//i.test(type) && !/^[A-Za-z0-9+/]+=*$/.test(content.slice(0, 80))) {
    const bytes = new TextEncoder().encode(content);
    let binary = '';
    bytes.forEach((value) => {
      binary += String.fromCharCode(value);
    });
    return { ok: true, authFailed: false, detail: '', base64: btoa(binary), type, name };
  }
  return { ok: true, authFailed: false, detail: '', base64: content, type, name };
}

function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function recipientXml(message: MailPayload): string {
  const to = splitAddresses(message.to);
  const cc = splitAddresses(message.cc || '');
  return [
    ...to.map((address) => `<e t="t" a="${xmlEscape(address)}"/>`),
    ...cc.map((address) => `<e t="c" a="${xmlEscape(address)}"/>`),
  ].join('');
}

async function uploadOne(token: string, file: MailAttachment): Promise<{ ok: boolean; aid: string; detail: string; authFailed: boolean }> {
  const url = `${ACCOUNT_HOST}/service/upload?fmt=raw`;
  try {
    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.post({
        url,
        headers: {
          Cookie: `ZM_AUTH_TOKEN=${token}`,
          'Content-Type': 'multipart/form-data',
        },
        data: {
          file: {
            type: 'base64File',
            name: file.name,
            value: file.base64,
            contentType: file.type || 'application/octet-stream',
          },
        },
        connectTimeout: 60000,
        readTimeout: 60000,
      });
      const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data ?? '');
      if (/AUTH_EXPIRED|AUTH_REQUIRED|login/i.test(text) || response.status === 401) {
        return { ok: false, aid: '', detail: 'The mailbox sign-in expired.', authFailed: true };
      }
      const aid = /,?["']([0-9a-f-]{8,})["']/i.exec(text)?.[1] || /aid[=:]["']?([0-9a-f-]+)/i.exec(text)?.[1] || '';
      if (!aid) return { ok: false, aid: '', detail: `Could not upload ${file.name}.`, authFailed: false };
      return { ok: true, aid, detail: '', authFailed: false };
    }
    const binary = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0));
    const form = new FormData();
    form.append('file', new Blob([binary.buffer], { type: file.type || 'application/octet-stream' }), file.name);
    const response = await fetch(url, {
      method: 'POST',
      headers: { Cookie: `ZM_AUTH_TOKEN=${token}` },
      body: form,
      credentials: 'include',
    });
    const text = await response.text();
    if (/AUTH_EXPIRED|AUTH_REQUIRED|login/i.test(text) || response.status === 401) {
      return { ok: false, aid: '', detail: 'The mailbox sign-in expired.', authFailed: true };
    }
    const aid = /,?["']([0-9a-f-]{8,})["']/i.exec(text)?.[1] || '';
    if (!aid) return { ok: false, aid: '', detail: `Could not upload ${file.name}.`, authFailed: false };
    return { ok: true, aid, detail: '', authFailed: false };
  } catch {
    return { ok: false, aid: '', detail: `Could not upload ${file.name}.`, authFailed: false };
  }
}

function inlineMessageXml(message: MailPayload, attachAids: string[]): string {
  const html = message.html || '<div></div>';
  const text = plainText(html) || message.subject;
  const signature = message.signature
    ? `<mp ct="${xmlEscape(message.signature.type)}" filename="${xmlEscape(message.signature.name)}" ci="signature@uwezo"><content>${message.signature.base64}</content></mp>`
    : '';
  const withCid = message.signature
    ? html.includes('cid:signature@uwezo')
      ? html
      : `${html}<p><img src="cid:signature@uwezo" alt="Signature" style="max-width:240px"></p>`
    : html;
  const related = `<mp ct="multipart/related"><mp ct="multipart/alternative"><mp ct="text/plain"><content>${xmlEscape(text)}</content></mp><mp ct="text/html"><content>${xmlEscape(withCid)}</content></mp></mp>${signature}</mp>`;
  const inlineFiles = (message.attachments || [])
    .map((file) => `<mp ct="${xmlEscape(file.type || 'application/octet-stream')}" filename="${xmlEscape(file.name)}"><content>${file.base64}</content></mp>`)
    .join('');
  const body = inlineFiles ? `<mp ct="multipart/mixed">${related}${inlineFiles}</mp>` : related;
  const attach = attachAids.length ? `<attach aid="${xmlEscape(attachAids.join(','))}"/>` : '';
  const reply = message.origId ? ` origid="${xmlEscape(message.origId)}" rt="r"` : '';
  return `<m${reply}>${recipientXml(message)}<su>${xmlEscape(message.subject)}</su>${body}${attach}</m>`;
}

export async function sendMail(token: string, message: MailPayload) {
  if (!splitAddresses(message.to).length) {
    return { ok: false, xml: '', authFailed: false, detail: 'Enter at least one recipient email address.' };
  }
  const aids: string[] = [];
  const fallbackFiles: MailAttachment[] = [];
  for (const file of message.attachments || []) {
    const uploaded = await uploadOne(token, file);
    if (uploaded.authFailed) return { ok: false, xml: '', authFailed: true, detail: uploaded.detail };
    if (uploaded.ok) aids.push(uploaded.aid);
    else fallbackFiles.push(file);
  }
  const payload = { ...message, attachments: fallbackFiles };
  return call(token, `<SendMsgRequest xmlns="urn:zimbraMail">${inlineMessageXml(payload, aids)}</SendMsgRequest>`);
}

export async function saveDraft(token: string, message: MailPayload) {
  if (!splitAddresses(message.to).length) {
    return { ok: false, xml: '', authFailed: false, detail: 'Enter at least one recipient email address.' };
  }
  return call(token, `<SaveDraftRequest xmlns="urn:zimbraMail">${inlineMessageXml(message, [])}</SaveDraftRequest>`);
}

export async function moveMail(token: string, ids: string | string[], op: 'trash' | 'spam' | 'archive' | 'delete') {
  const id = (Array.isArray(ids) ? ids : [ids]).filter(Boolean).join(',');
  if (!id) return { ok: false, xml: '', authFailed: false, detail: 'Select a message first.' };
  return call(token, `<MsgActionRequest xmlns="urn:zimbraMail"><action id="${xmlEscape(id)}" op="${op}"/></MsgActionRequest>`);
}

export function replySubject(subject: string): string {
  return /^re:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim() || '(no subject)'}`;
}

export function quoteHtml(detail: MailDetail): string {
  const who = detail.from || 'the sender';
  const whenText = detail.date ? ` on ${detail.date}` : '';
  const quoted = (detail.html || `<p>${xmlEscape(detail.body)}</p>`)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '');
  return `<p></p><p>On ${who}${whenText} wrote:</p><blockquote style="margin:0 0 0 8px;padding-left:8px;border-left:2px solid #999">${quoted}</blockquote>`;
}

export function attachmentDataUrl(type: string, base64: string): string {
  return `data:${type || 'application/octet-stream'};base64,${base64}`;
}

export async function saveOrShareFile(name: string, type: string, base64: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const binary = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const blob = new Blob([binary], { type: type || 'application/octet-stream' });
    const file = new File([blob], name, { type: type || 'application/octet-stream' });
    const shareData = { files: [file], title: name };
    if (typeof navigator !== 'undefined' && navigator.canShare?.(shareData)) {
      await navigator.share(shareData);
      return { ok: true, detail: `${name} opened for saving or sharing.` };
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { ok: true, detail: `${name} is ready to download.` };
  } catch {
    return { ok: false, detail: `${name} could not be saved on this phone.` };
  }
}
