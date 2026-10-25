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

function messageXml(to: string, subject: string, body: string): string {
  return `<m><e t="t" a="${xmlEscape(to)}"/><su>${xmlEscape(subject)}</su><mp ct="text/plain"><content>${xmlEscape(body)}</content></mp></m>`;
}

export async function sendMail(token: string, to: string, subject: string, body: string) {
  return call(token, `<SendMsgRequest xmlns="urn:zimbraMail">${messageXml(to, subject, body)}</SendMsgRequest>`);
}

export async function saveDraft(token: string, to: string, subject: string, body: string) {
  return call(token, `<SaveDraftRequest xmlns="urn:zimbraMail">${messageXml(to, subject, body)}</SaveDraftRequest>`);
}

export async function moveMail(token: string, id: string, op: 'trash' | 'spam' | 'archive' | 'delete') {
  return call(token, `<MsgActionRequest xmlns="urn:zimbraMail"><action id="${xmlEscape(id)}" op="${op}"/></MsgActionRequest>`);
}
