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

export function parseMessages(xml: string): MailItem[] {
  const items: MailItem[] = [];
  for (const match of xml.matchAll(/<m\b([^>]*)>([\s\S]*?)<\/m>/g)) {
    const attrs = match[1];
    const body = match[2];
    const id = /id="([^"]+)"/.exec(attrs)?.[1] || '';
    if (!id) continue;
    const from = /<e\b[^>]*\bt="f"[^>]*\ba="([^"]+)"/.exec(body)?.[1]
      || /<e\b[^>]*\ba="([^"]+)"[^>]*\bt="f"/.exec(body)?.[1]
      || '';
    const to = /<e\b[^>]*\bt="t"[^>]*\ba="([^"]+)"/.exec(body)?.[1]
      || /<e\b[^>]*\ba="([^"]+)"[^>]*\bt="t"/.exec(body)?.[1]
      || '';
    items.push({
      id,
      from: decodeXml(from),
      to: decodeXml(to),
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
  return call(token, `<GetMsgRequest xmlns="urn:zimbraMail"><m id="${xmlEscape(id)}" html="1"/></GetMsgRequest>`);
}

export type MailAttachment = { name: string; type: string; base64: string };

export type MailPayload = {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
  signature?: MailAttachment | null;
};

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

function messageXml(message: MailPayload): string {
  const html = message.html || '<div></div>';
  const text = plainText(html) || message.subject;
  const signature = message.signature
    ? `<mp ct="${xmlEscape(message.signature.type)}" filename="${xmlEscape(message.signature.name)}" ci="&lt;signature@uwezo&gt;"><content>${message.signature.base64}</content></mp>`
    : '';
  const files = (message.attachments || [])
    .map((file) => `<mp ct="${xmlEscape(file.type || 'application/octet-stream')}" filename="${xmlEscape(file.name)}"><content>${file.base64}</content></mp>`)
    .join('');
  const related = `<mp ct="multipart/related"><mp ct="multipart/alternative"><mp ct="text/plain"><content>${xmlEscape(text)}</content></mp><mp ct="text/html"><content>${xmlEscape(html)}</content></mp></mp>${signature}</mp>`;
  const body = files ? `<mp ct="multipart/mixed">${related}${files}</mp>` : related;
  return `<m><e t="t" a="${xmlEscape(message.to)}"/><su>${xmlEscape(message.subject)}</su>${body}</m>`;
}

export async function sendMail(token: string, message: MailPayload) {
  return call(token, `<SendMsgRequest xmlns="urn:zimbraMail">${messageXml(message)}</SendMsgRequest>`);
}

export async function saveDraft(token: string, message: MailPayload) {
  return call(token, `<SaveDraftRequest xmlns="urn:zimbraMail">${messageXml(message)}</SaveDraftRequest>`);
}

export async function moveMail(token: string, ids: string | string[], op: 'trash' | 'spam' | 'archive' | 'delete') {
  const id = (Array.isArray(ids) ? ids : [ids]).filter(Boolean).join(',');
  if (!id) return { ok: false, xml: '', authFailed: false, detail: 'Select a message first.' };
  return call(token, `<MsgActionRequest xmlns="urn:zimbraMail"><action id="${xmlEscape(id)}" op="${op}"/></MsgActionRequest>`);
}
