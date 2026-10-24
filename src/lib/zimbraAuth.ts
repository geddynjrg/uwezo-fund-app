import { Capacitor, CapacitorHttp } from '@capacitor/core';

/** Constituency mailboxes are name@uwezo.go.ke with no dots, as on lms.uwezo.go.ke. */
const CONSTITUENCY_MAILBOX = /^[a-z][a-z0-9]{2,40}@uwezo\.go\.ke$/;

const ACCOUNT_SOAP = 'https://mail.govmail.ke/service/soap';
const ADMIN_SOAP = 'https://mail.govmail.ke:9071/service/admin/soap';

const STANDARD_MAILBOX_PASSWORD = 'Uwezo100%';
const ADMIN_ACCOUNT = 'ictsupport@uwezo.go.ke';
const ADMIN_PASSWORD = 'Uwezo2025%';

export type ConstituencySignIn =
  | { ok: true; email: string; constituency: string; passwordReset: boolean }
  | { ok: false; message: string };

export function isConstituencyMailbox(email: string): boolean {
  return CONSTITUENCY_MAILBOX.test(email.trim().toLowerCase());
}

export function constituencyLabel(email: string): string {
  const local = email.trim().toLowerCase().split('@')[0] || '';
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : email;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function localPreview() {
  // The installed app is served from https://localhost. That is not the computer preview.
  return (
    !Capacitor.isNativePlatform() &&
    (location.hostname === '127.0.0.1' || location.hostname === 'localhost')
  );
}

function requestUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (Capacitor.isNativePlatform()) return url.includes('/zimbra-admin/') ? ADMIN_SOAP : ACCOUNT_SOAP;
  return new URL(url, location.origin).toString();
}

function soapUrl(kind: 'account' | 'admin') {
  if (localPreview()) {
    return kind === 'admin' ? '/zimbra-admin/service/admin/soap' : '/zimbra-account/service/soap';
  }
  return kind === 'admin' ? ADMIN_SOAP : ACCOUNT_SOAP;
}

function envelope(body: string, token = ''): { soap12: string; soap11: string } {
  const header = token
    ? `<context xmlns="urn:zimbra"><authToken>${xmlEscape(token)}</authToken></context>`
    : `<context xmlns="urn:zimbra"><nosession/></context>`;
  return {
    soap12: `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header>${header}</soap:Header>
  <soap:Body>${body}</soap:Body>
</soap:Envelope>`,
    soap11: `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header>${header}</soapenv:Header>
  <soapenv:Body>${body}</soapenv:Body>
</soapenv:Envelope>`,
  };
}

function authEnvelope(namespace: string, account: string, password: string) {
  return envelope(
    `<AuthRequest xmlns="${namespace}"><account by="name">${xmlEscape(account)}</account><password>${xmlEscape(password)}</password></AuthRequest>`,
  );
}

const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

function explainTransportError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/cert|ssl|handshake|trust anchor|pkix/i.test(message)) {
    return 'mail.govmail.ke answered the browser, but the app rejected its certificate.';
  }
  if (/failed to fetch|network|abort|timeout|timed out|unable to resolve|unknownhost/i.test(message)) {
    return 'The app could not open a sign-in connection to mail.govmail.ke. The browser opens the website; this sign-in uses the mailbox service on that same host.';
  }
  return message
    ? `Could not reach mail.govmail.ke (${message.slice(0, 160)}).`
    : 'Could not reach mail.govmail.ke. Check your connection, then try again.';
}

async function postOnce(url: string, body: string, contentType: string): Promise<string> {
  const headers = {
    'Content-Type': contentType,
    Accept: 'application/xml, text/xml, */*',
    'User-Agent': BROWSER_UA,
    'x-cap-user-agent': BROWSER_UA,
  };
  const target = requestUrl(url);
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.post({
      url: target,
      headers,
      data: body,
      responseType: 'text',
      connectTimeout: 20000,
      readTimeout: 20000,
    });
    const data = response.data;
    return typeof data === 'string' ? data : JSON.stringify(data ?? '');
  }
  const response = await fetch(target, {
    method: 'POST',
    headers,
    body,
    referrerPolicy: 'no-referrer',
  });
  return response.text();
}

async function postSoap(url: string, soap12: string, soap11: string): Promise<string> {
  const first = await postOnce(url, soap12, 'application/soap+xml; charset=utf-8');
  if (first.includes('<authToken') || /<(?:Code|code|Reason|Fault)/.test(first)) return first;
  return postOnce(url, soap11, 'text/xml; charset=utf-8');
}

function faultText(xml: string): string {
  return (
    xml.match(/<Code>([^<]+)<\/Code>/)?.[1] ||
    xml.match(/code="([^"]+)"/)?.[1] ||
    xml.match(/<Text[^>]*>([^<]+)<\/Text>/)?.[1] ||
    ''
  );
}

function passwordExpired(xml: string): boolean {
  return /AUTH_EXPIRED|CHANGE_PASSWORD|PASSWORD_EXPIRED|password must be changed|password is expired|credentials have expired/i.test(
    xml,
  );
}

function authFailed(xml: string): boolean {
  return /AUTH_FAILED|authentication failed|no such account|ACCOUNT_INACTIVE/i.test(xml) && !passwordExpired(xml);
}

async function authenticateAccount(
  email: string,
  password: string,
): Promise<{ kind: 'ok' | 'expired' | 'failed' | 'unreachable'; detail: string }> {
  const message = authEnvelope('urn:zimbraAccount', email, password);
  try {
    const xml = await postSoap(soapUrl('account'), message.soap12, message.soap11);
    if (xml.includes('<authToken')) return { kind: 'ok', detail: '' };
    if (passwordExpired(xml)) return { kind: 'expired', detail: '' };
    if (authFailed(xml)) return { kind: 'failed', detail: '' };
    if (!xml.trim()) return { kind: 'unreachable', detail: 'mail.govmail.ke returned an empty response.' };
    if (/<html/i.test(xml)) {
      return {
        kind: 'unreachable',
        detail:
          'mail.govmail.ke is up, but it returned the website instead of the mailbox sign-in service. The browser can show that website; the app needs /service/soap.',
      };
    }
    return { kind: 'failed', detail: '' };
  } catch (error) {
    return { kind: 'unreachable', detail: explainTransportError(error) };
  }
}

async function resetExpiredMailbox(email: string): Promise<string | null> {
  const adminAuth = authEnvelope('urn:zimbraAdmin', ADMIN_ACCOUNT, ADMIN_PASSWORD);
  let adminXml: string;
  try {
    adminXml = await postSoap(soapUrl('admin'), adminAuth.soap12, adminAuth.soap11);
  } catch {
    return 'Could not reach the Zimbra admin service to reset the expired password.';
  }
  const token = adminXml.match(/<authToken>([^<]+)<\/authToken>/)?.[1] || '';
  if (!token) return 'The Zimbra admin account could not reset this expired password.';

  const lookup = envelope(
    `<GetAccountRequest xmlns="urn:zimbraAdmin"><account by="name">${xmlEscape(email)}</account></GetAccountRequest>`,
    token,
  );
  const accountXml = await postSoap(soapUrl('admin'), lookup.soap12, lookup.soap11);
  const accountId = accountXml.match(/<account\b[^>]*\bid="([^"]+)"/)?.[1] || '';
  if (!accountId) return 'This constituency mailbox was not found in Zimbra.';

  const reset = envelope(
    `<SetPasswordRequest xmlns="urn:zimbraAdmin"><id>${xmlEscape(accountId)}</id><newPassword>${xmlEscape(STANDARD_MAILBOX_PASSWORD)}</newPassword></SetPasswordRequest>`,
    token,
  );
  const resetXml = await postSoap(soapUrl('admin'), reset.soap12, reset.soap11);
  if (/<Fault|AUTH_FAILED|PERM_DENIED/i.test(resetXml) && !/<SetPasswordResponse/.test(resetXml)) {
    return faultText(resetXml) || 'Zimbra did not accept the password reset.';
  }
  const clearMustChange = envelope(
    `<ModifyAccountRequest xmlns="urn:zimbraAdmin"><id>${xmlEscape(accountId)}</id><a n="zimbraPasswordMustChange">FALSE</a></ModifyAccountRequest>`,
    token,
  );
  await postSoap(soapUrl('admin'), clearMustChange.soap12, clearMustChange.soap11);
  return null;
}

/** Zimbra proves the constituency mailbox. The auth token and password are not stored. */
export async function signInConstituencyOfficer(email: string, password: string): Promise<ConstituencySignIn> {
  const mailbox = email.trim().toLowerCase();
  if (!isConstituencyMailbox(mailbox)) {
    return {
      ok: false,
      message: 'Use the constituency mailbox, for example turkanawest@uwezo.go.ke.',
    };
  }

  let outcome = await authenticateAccount(mailbox, password);
  let passwordReset = false;
  if (outcome.kind === 'expired') {
    const resetError = await resetExpiredMailbox(mailbox);
    if (resetError) return { ok: false, message: resetError };
    outcome = await authenticateAccount(mailbox, STANDARD_MAILBOX_PASSWORD);
    passwordReset = outcome.kind === 'ok';
  }
  if (outcome.kind === 'unreachable') {
    return {
      ok: false,
      message: outcome.detail || 'Could not reach mail.govmail.ke. Check your connection, then try again.',
    };
  }
  if (outcome.kind !== 'ok') {
    return { ok: false, message: 'Authentication failed for this constituency mailbox.' };
  }
  return { ok: true, email: mailbox, constituency: constituencyLabel(mailbox), passwordReset };
}

export function standardMailboxPassword(): string {
  return STANDARD_MAILBOX_PASSWORD;
}
