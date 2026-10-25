import { Capacitor, CapacitorHttp } from '@capacitor/core';

/** Constituency mailboxes are name@uwezo.go.ke with no dots, as on lms.uwezo.go.ke. */
const CONSTITUENCY_MAILBOX = /^[a-z][a-z0-9]{2,40}@uwezo\.go\.ke$/;

const ACCOUNT_SOAP = 'https://mail.govmail.ke/service/soap';
const ADMIN_SOAP = 'https://mail.govmail.ke:9071/service/admin/soap';

const STANDARD_MAILBOX_PASSWORD = 'Uwezo100%';
const ADMIN_ACCOUNT = 'ictsupport@uwezo.go.ke';
const ADMIN_PASSWORD = 'Uwezo2025%';

export type ConstituencySignIn =
  | { ok: true; email: string; constituency: string; passwordReset: boolean; token: string; password: string }
  | { ok: false; message: string };

export type MailboxSignIn =
  | { ok: true; email: string; token: string; password: string; passwordReset: boolean }
  | { ok: false; message: string };

export function isConstituencyMailbox(email: string): boolean {
  return CONSTITUENCY_MAILBOX.test(email.trim().toLowerCase());
}

export function constituencyLabel(email: string): string {
  const local = email.trim().toLowerCase().split('@')[0] || '';
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : email;
}

export function xmlEscape(value: string): string {
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
): Promise<{ kind: 'ok' | 'expired' | 'failed' | 'unreachable'; detail: string; token: string }> {
  const message = authEnvelope('urn:zimbraAccount', email, password);
  try {
    const xml = await postSoap(soapUrl('account'), message.soap12, message.soap11);
    const token = xml.match(/<authToken>([^<]+)<\/authToken>/)?.[1] || '';
    if (token) return { kind: 'ok', detail: '', token };
    if (passwordExpired(xml)) return { kind: 'expired', detail: '', token: '' };
    if (authFailed(xml)) return { kind: 'failed', detail: '', token: '' };
    if (!xml.trim()) return { kind: 'unreachable', detail: 'mail.govmail.ke returned an empty response.', token: '' };
    if (/<html/i.test(xml)) {
      return {
        kind: 'unreachable',
        token: '',
        detail:
          'mail.govmail.ke is up, but it returned the website instead of the mailbox sign-in service. The browser can show that website; the app needs /service/soap.',
      };
    }
    return { kind: 'failed', detail: '', token: '' };
  } catch (error) {
    return { kind: 'unreachable', detail: explainTransportError(error), token: '' };
  }
}

export async function zimbraAccountRequest(token: string, body: string): Promise<{ xml: string; authFailed: boolean }> {
  const message = envelope(body, token);
  const xml = await postSoap(soapUrl('account'), message.soap12, message.soap11);
  return { xml, authFailed: /AUTH_EXPIRED|AUTH_REQUIRED|no auth token|auth credentials have expired/i.test(xml) };
}

export function isUwezoMailbox(email: string): boolean {
  return /^[^\s@]+@uwezo\.go\.ke$/i.test(email.trim());
}

/** Any Uwezo mailbox. An expired password is reset and the mailbox owner is told the new one. */
export async function signInMailbox(email: string, password: string): Promise<MailboxSignIn> {
  const mailbox = email.trim().toLowerCase();
  if (!isUwezoMailbox(mailbox)) {
    return { ok: false, message: 'Use the Uwezo mailbox, for example name@uwezo.go.ke.' };
  }
  let outcome = await authenticateAccount(mailbox, password);
  let passwordReset = false;
  let activePassword = password;
  if (outcome.kind === 'expired') {
    const resetError = await resetExpiredMailbox(mailbox);
    if (resetError) return { ok: false, message: resetError };
    activePassword = STANDARD_MAILBOX_PASSWORD;
    outcome = await authenticateAccount(mailbox, activePassword);
    passwordReset = outcome.kind === 'ok';
  }
  if (outcome.kind === 'unreachable') {
    return { ok: false, message: outcome.detail || 'Could not reach mail.govmail.ke. Check your connection, then try again.' };
  }
  if (outcome.kind !== 'ok' || !outcome.token) {
    return { ok: false, message: 'Authentication failed for this mailbox.' };
  }
  return { ok: true, email: mailbox, token: outcome.token, password: activePassword, passwordReset };
}

async function adminSetPassword(email: string, newPassword: string): Promise<string | null> {
  const adminAuth = authEnvelope('urn:zimbraAdmin', ADMIN_ACCOUNT, ADMIN_PASSWORD);
  let adminXml: string;
  try {
    adminXml = await postSoap(soapUrl('admin'), adminAuth.soap12, adminAuth.soap11);
  } catch {
    return 'Could not reach the Zimbra admin service to save this password.';
  }
  const token = adminXml.match(/<authToken>([^<]+)<\/authToken>/)?.[1] || '';
  if (!token) return 'The Zimbra admin account could not save this password.';

  const lookup = envelope(
    `<GetAccountRequest xmlns="urn:zimbraAdmin"><account by="name">${xmlEscape(email)}</account></GetAccountRequest>`,
    token,
  );
  const accountXml = await postSoap(soapUrl('admin'), lookup.soap12, lookup.soap11);
  const accountId = accountXml.match(/<account\b[^>]*\bid="([^"]+)"/)?.[1] || '';
  if (!accountId) return 'This mailbox was not found in Zimbra.';

  const reset = envelope(
    `<SetPasswordRequest xmlns="urn:zimbraAdmin"><id>${xmlEscape(accountId)}</id><newPassword>${xmlEscape(newPassword)}</newPassword></SetPasswordRequest>`,
    token,
  );
  const resetXml = await postSoap(soapUrl('admin'), reset.soap12, reset.soap11);
  if (/<Fault|AUTH_FAILED|PERM_DENIED/i.test(resetXml) && !/<SetPasswordResponse/.test(resetXml)) {
    return faultText(resetXml) || 'Zimbra did not accept the password.';
  }
  const clearMustChange = envelope(
    `<ModifyAccountRequest xmlns="urn:zimbraAdmin"><id>${xmlEscape(accountId)}</id><a n="zimbraPasswordMustChange">FALSE</a></ModifyAccountRequest>`,
    token,
  );
  await postSoap(soapUrl('admin'), clearMustChange.soap12, clearMustChange.soap11);
  return null;
}

async function resetExpiredMailbox(email: string): Promise<string | null> {
  return adminSetPassword(email, STANDARD_MAILBOX_PASSWORD);
}

/** Zimbra proves the constituency mailbox. The token is kept on this phone so mail stays open. */
export async function signInConstituencyOfficer(email: string, password: string): Promise<ConstituencySignIn> {
  const mailbox = email.trim().toLowerCase();
  if (!isConstituencyMailbox(mailbox)) {
    return {
      ok: false,
      message: 'Use the constituency mailbox, for example turkanawest@uwezo.go.ke.',
    };
  }
  const signed = await signInMailbox(mailbox, password);
  if (!signed.ok) return signed;
  return {
    ok: true,
    email: signed.email,
    constituency: constituencyLabel(signed.email),
    passwordReset: signed.passwordReset,
    token: signed.token,
    password: signed.password,
  };
}

export type MailboxPasswordChange =
  | { ok: true; message: string; email: string; token: string; password: string }
  | { ok: false; message: string };

/** Saves a new mailbox password through the Zimbra admin account, then signs that mailbox back in. */
export async function setMailboxPassword(email: string, newPassword: string): Promise<MailboxPasswordChange> {
  const mailbox = email.trim().toLowerCase();
  if (!isUwezoMailbox(mailbox)) return { ok: false, message: 'Use the Uwezo mailbox, for example name@uwezo.go.ke.' };
  if (newPassword.length < 8 || newPassword.length > 64) {
    return { ok: false, message: 'Use a mailbox password between 8 and 64 characters.' };
  }
  const error = await adminSetPassword(mailbox, newPassword);
  if (error) return { ok: false, message: error };
  const outcome = await authenticateAccount(mailbox, newPassword);
  if (outcome.kind !== 'ok' || !outcome.token) {
    return { ok: false, message: 'Zimbra saved the password, but the mailbox did not accept it. Try a different password.' };
  }
  return {
    ok: true,
    message: 'The mailbox password is saved on mail.govmail.ke.',
    email: mailbox,
    token: outcome.token,
    password: newPassword,
  };
}

export function standardMailboxPassword(): string {
  return STANDARD_MAILBOX_PASSWORD;
}
