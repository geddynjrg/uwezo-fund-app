import { Capacitor, CapacitorHttp } from '@capacitor/core';

/** Constituency mailboxes are name@uwezo.go.ke with no dots, as on lms.uwezo.go.ke. */
const CONSTITUENCY_MAILBOX = /^[a-z][a-z0-9]{2,40}@uwezo\.go\.ke$/;

const ACCOUNT_SOAP = 'https://mail.govmail.ke/service/soap';
/**
 * Real admin SOAP is on :9071 (same as 1.1.50). :443 /service/admin/soap often returns
 * service.FAILURE and must not short-circuit before :9071 is tried.
 */
const ADMIN_SOAP_URLS = [
  'https://mail.govmail.ke:9071/service/admin/soap',
  'https://mail.govmail.ke/service/admin/soap',
] as const;
const ADMIN_SOAP = ADMIN_SOAP_URLS[0];

const STANDARD_MAILBOX_PASSWORD = 'Uwezo100%';
/** Mail admin used for DelegateAuth + SetPassword (same as 1.1.50 builds). Never show this address in UX. */
const ADMIN_ACCOUNT = 'ictsupport@uwezo.go.ke';
/** Live password after CHANGE_PASSWORD renew (was Uwezo2025%, expired Oct 2026). */
const ADMIN_PASSWORD = 'Uwezo2026%';
const ADMIN_PASSWORD_CANDIDATES = [ADMIN_PASSWORD, 'Uwezo2025%', 'Uwezo2026%'] as const;

// #region agent log
function debugLog(hypothesisId: string, location: string, message: string, data: Record<string, unknown> = {}) {
  fetch('http://127.0.0.1:7591/ingest/fc16f6e6-2411-411d-be27-2c94d7813f56', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '9becc5' },
    body: JSON.stringify({
      sessionId: '9becc5',
      runId: 'post-fix',
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

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
  return kind === 'admin' ? ADMIN_SOAP_URLS[0] : ACCOUNT_SOAP;
}

function adminSoapCandidates(): string[] {
  if (localPreview()) return ['/zimbra-admin/service/admin/soap'];
  return [...ADMIN_SOAP_URLS];
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

/** Try each admin SOAP endpoint until one returns authToken or a success Response. */
async function postAdminSoap(soap12: string, soap11: string): Promise<string> {
  let lastXml = '';
  let lastError = '';
  for (const url of adminSoapCandidates()) {
    try {
      const xml = await postSoap(url, soap12, soap11);
      lastXml = xml;
      if (xml.includes('<authToken')) {
        // #region agent log
        debugLog('A', 'zimbraAuth.ts:postAdminSoap', 'admin SOAP got authToken', {
          urlHost: url.replace(/^https?:\/\//, '').split('/')[0],
        });
        // #endregion
        return xml;
      }
      if (/<(?:SetPassword|DelegateAuth|GetAccount|ModifyAccount)Response\b/i.test(xml)) return xml;
      // Fault / empty on this URL — try next (:443 often FAILS; :9071 may still work).
      // #region agent log
      debugLog('E', 'zimbraAuth.ts:postAdminSoap', 'admin SOAP no token, trying next', {
        urlHost: url.replace(/^https?:\/\//, '').split('/')[0],
        fault: faultText(xml).slice(0, 80),
      });
      // #endregion
    } catch (error) {
      lastError = explainTransportError(error);
      // #region agent log
      debugLog('A', 'zimbraAuth.ts:postAdminSoap', 'admin SOAP transport error', {
        urlHost: url.replace(/^https?:\/\//, '').split('/')[0],
        error: lastError.slice(0, 120),
      });
      // #endregion
    }
  }
  if (lastXml) return lastXml;
  if (lastError) throw new Error(lastError);
  throw new Error('Could not reach the mail admin service.');
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
    // Admin SetPassword via ictsupport (with ChangePassword :443 fallback).
    const resetError = await resetExpiredMailbox(mailbox, password);
    if (resetError) return { ok: false, message: resetError };
    activePassword = STANDARD_MAILBOX_PASSWORD;
    outcome = await authenticateAccount(mailbox, activePassword);
    passwordReset = outcome.kind === 'ok';
    if (!passwordReset && outcome.kind !== 'ok') {
      return {
        ok: false,
        message:
          'Your mailbox password was renewed, but sign-in with the new password failed. Try again with the standard mailbox password.',
      };
    }
  }
  if (outcome.kind === 'unreachable') {
    return { ok: false, message: outcome.detail || 'Could not reach mail.govmail.ke. Check your connection, then try again.' };
  }
  if (outcome.kind !== 'ok' || !outcome.token) {
    return { ok: false, message: 'Authentication failed for this mailbox.' };
  }
  return { ok: true, email: mailbox, token: outcome.token, password: activePassword, passwordReset };
}

function publicMailboxError(raw: string, fallback: string): string {
  const text = (raw || '').trim();
  if (!text) return fallback;
  // Never surface Zimbra fault codes or admin identities to officers.
  if (/account\.|zimbra|CHANGE_PASSWORD|AUTH_|PERM_|admin|ictsupport|ictuwezo/i.test(text)) {
    return fallback;
  }
  return text.slice(0, 180);
}

/**
 * Renew an expired mailbox via account SOAP on :443 (no admin port).
 * Zimbra accepts ChangePassword with the current (expired) password as oldPassword.
 */
async function changePasswordViaAccount(
  email: string,
  oldPassword: string,
  newPassword: string,
): Promise<string | null> {
  const body = envelope(
    `<ChangePasswordRequest xmlns="urn:zimbraAccount"><account by="name">${xmlEscape(email)}</account><oldPassword>${xmlEscape(oldPassword)}</oldPassword><password>${xmlEscape(newPassword)}</password></ChangePasswordRequest>`,
  );
  let xml: string;
  try {
    xml = await postSoap(soapUrl('account'), body.soap12, body.soap11);
  } catch (error) {
    return explainTransportError(error);
  }
  if (/<ChangePasswordResponse/i.test(xml)) return null;
  if (/<Fault|AUTH_FAILED|PERM_DENIED|INVALID_PASSWORD|password/i.test(xml)) {
    return publicMailboxError(
      faultText(xml),
      'Could not update this mailbox password on mail.govmail.ke right now. Try again shortly.',
    );
  }
  // Empty / unexpected — treat as failure so admin fallback can run.
  return 'Could not update this mailbox password on mail.govmail.ke right now. Try again shortly.';
}

async function adminSetPassword(email: string, newPassword: string): Promise<string | null> {
  const adminAuth = authEnvelope('urn:zimbraAdmin', ADMIN_ACCOUNT, ADMIN_PASSWORD);
  let adminXml: string;
  try {
    adminXml = await postAdminSoap(adminAuth.soap12, adminAuth.soap11);
  } catch {
    return 'Could not update this mailbox password on mail.govmail.ke right now. Try again shortly.';
  }
  const token = adminXml.match(/<authToken>([^<]+)<\/authToken>/)?.[1] || '';
  if (!token) {
    return 'Could not update this mailbox password on mail.govmail.ke right now. Try again shortly.';
  }

  const lookup = envelope(
    `<GetAccountRequest xmlns="urn:zimbraAdmin"><account by="name">${xmlEscape(email)}</account></GetAccountRequest>`,
    token,
  );
  let accountXml: string;
  try {
    accountXml = await postAdminSoap(lookup.soap12, lookup.soap11);
  } catch {
    return 'Could not update this mailbox password on mail.govmail.ke right now. Try again shortly.';
  }
  const accountId = accountXml.match(/<account\b[^>]*\bid="([^"]+)"/)?.[1] || '';
  if (!accountId) return 'This mailbox was not found on mail.govmail.ke.';

  const reset = envelope(
    `<SetPasswordRequest xmlns="urn:zimbraAdmin"><id>${xmlEscape(accountId)}</id><newPassword>${xmlEscape(newPassword)}</newPassword></SetPasswordRequest>`,
    token,
  );
  let resetXml: string;
  try {
    resetXml = await postAdminSoap(reset.soap12, reset.soap11);
  } catch {
    return 'Could not renew this mailbox password right now. Try again shortly.';
  }
  if (/<Fault|AUTH_FAILED|PERM_DENIED/i.test(resetXml) && !/<SetPasswordResponse/.test(resetXml)) {
    return publicMailboxError(faultText(resetXml), 'Could not renew this mailbox password right now. Try again shortly.');
  }
  const clearMustChange = envelope(
    `<ModifyAccountRequest xmlns="urn:zimbraAdmin"><id>${xmlEscape(accountId)}</id><a n="zimbraPasswordMustChange">FALSE</a></ModifyAccountRequest>`,
    token,
  );
  try {
    await postAdminSoap(clearMustChange.soap12, clearMustChange.soap11);
  } catch {
    /* password already set; must-change clear is best-effort */
  }
  return null;
}

async function resetExpiredMailbox(email: string, oldPassword: string): Promise<string | null> {
  // Prefer admin SetPassword (ictsupport) so renew works even when the typed password is not the mail password.
  const viaAdmin = await adminSetPassword(email, STANDARD_MAILBOX_PASSWORD);
  if (!viaAdmin) return null;
  // Fallback: ChangePassword on :443 when admin :9071 is blocked.
  const viaAccount = await changePasswordViaAccount(email, oldPassword, STANDARD_MAILBOX_PASSWORD);
  if (!viaAccount) return null;
  return viaAdmin;
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

/**
 * Saves a new mailbox password on mail.govmail.ke.
 * Prefer ictsupport admin SetPassword; if :9071 is blocked, ChangePassword on :443 with a known current password.
 */
export async function setMailboxPassword(
  email: string,
  newPassword: string,
  oldPasswordCandidates: string[] = [],
): Promise<MailboxPasswordChange> {
  const mailbox = email.trim().toLowerCase();
  if (!isUwezoMailbox(mailbox)) return { ok: false, message: 'Use the Uwezo mailbox, for example name@uwezo.go.ke.' };
  if (newPassword.length < 8 || newPassword.length > 64) {
    return { ok: false, message: 'Use a mailbox password between 8 and 64 characters.' };
  }

  const adminError = await adminSetPassword(mailbox, newPassword);
  if (!adminError) {
    const outcome = await authenticateAccount(mailbox, newPassword);
    if (outcome.kind === 'ok' && outcome.token) {
      return {
        ok: true,
        message: 'The mailbox password is saved on mail.govmail.ke.',
        email: mailbox,
        token: outcome.token,
        password: newPassword,
      };
    }
  }

  const olds = [
    ...oldPasswordCandidates,
    STANDARD_MAILBOX_PASSWORD,
  ]
    .map((value) => String(value || '').trim())
    .filter((value, index, all) => value.length > 0 && value !== newPassword && all.indexOf(value) === index);

  let lastChangeError =
    adminError || 'Could not save the mailbox password on mail.govmail.ke right now. Try again shortly.';
  for (const oldPassword of olds) {
    const changeError = await changePasswordViaAccount(mailbox, oldPassword, newPassword);
    if (changeError) {
      lastChangeError = changeError;
      continue;
    }
    const outcome = await authenticateAccount(mailbox, newPassword);
    if (outcome.kind === 'ok' && outcome.token) {
      return {
        ok: true,
        message: 'The mailbox password is saved on mail.govmail.ke.',
        email: mailbox,
        token: outcome.token,
        password: newPassword,
      };
    }
    lastChangeError = 'The password was updated, but sign-in with the new password failed. Try again.';
  }

  return {
    ok: false,
    message: publicMailboxError(lastChangeError, lastChangeError),
  };
}

export function standardMailboxPassword(): string {
  return STANDARD_MAILBOX_PASSWORD;
}

async function adminAuthToken(): Promise<{ token: string; detail: string }> {
  const tried = [...new Set(ADMIN_PASSWORD_CANDIDATES.map((value) => String(value)))];
  let lastXml = '';
  for (const password of tried) {
    const adminAuth = authEnvelope('urn:zimbraAdmin', ADMIN_ACCOUNT, password);
    let adminXml: string;
    try {
      adminXml = await postAdminSoap(adminAuth.soap12, adminAuth.soap11);
    } catch (error) {
      // #region agent log
      debugLog('A', 'zimbraAuth.ts:adminAuthToken', 'admin auth unreachable', {
        detail: explainTransportError(error).slice(0, 120),
      });
      // #endregion
      return { token: '', detail: explainTransportError(error) };
    }
    lastXml = adminXml;
    const token = adminXml.match(/<authToken>([^<]+)<\/authToken>/)?.[1] || '';
    if (token) {
      // #region agent log
      debugLog('B', 'zimbraAuth.ts:adminAuthToken', 'admin auth ok', { passwordIndex: tried.indexOf(password) });
      // #endregion
      return { token, detail: '' };
    }
    if (passwordExpired(adminXml)) {
      // #region agent log
      debugLog('B', 'zimbraAuth.ts:adminAuthToken', 'admin password expired, renewing', {
        fault: faultText(adminXml).slice(0, 80),
      });
      // #endregion
      const renewError = await changePasswordViaAccount(ADMIN_ACCOUNT, password, ADMIN_PASSWORD);
      if (!renewError) {
        const retry = authEnvelope('urn:zimbraAdmin', ADMIN_ACCOUNT, ADMIN_PASSWORD);
        try {
          adminXml = await postAdminSoap(retry.soap12, retry.soap11);
        } catch (error) {
          return { token: '', detail: explainTransportError(error) };
        }
        lastXml = adminXml;
        const renewedToken = adminXml.match(/<authToken>([^<]+)<\/authToken>/)?.[1] || '';
        if (renewedToken) return { token: renewedToken, detail: '' };
      }
    }
  }
  // #region agent log
  debugLog('B', 'zimbraAuth.ts:adminAuthToken', 'admin auth failed', {
    fault: faultText(lastXml).slice(0, 80),
  });
  // #endregion
  return {
    token: '',
    detail: publicMailboxError(
      faultText(lastXml),
      'Could not open this mailbox right now. Try the mailbox password, or try again shortly.',
    ),
  };
}

/**
 * Open a user’s mailbox without their Zimbra password by delegating through the mail admin service.
 * Used when the officer signed in via the LMS database rather than Zimbra.
 */
export async function delegateAuthMailbox(email: string): Promise<MailboxSignIn> {
  const mailbox = email.trim().toLowerCase();
  if (!isUwezoMailbox(mailbox)) {
    return { ok: false, message: 'Use the Uwezo mailbox, for example name@uwezo.go.ke.' };
  }
  const admin = await adminAuthToken();
  if (!admin.token) {
    // #region agent log
    debugLog('C', 'zimbraAuth.ts:delegateAuthMailbox', 'delegate skipped, no admin token', {
      mailboxLocal: mailbox.split('@')[0],
      detail: (admin.detail || '').slice(0, 120),
    });
    // #endregion
    return { ok: false, message: admin.detail || 'Could not open this mailbox through mail.govmail.ke right now.' };
  }
  const request = envelope(
    `<DelegateAuthRequest xmlns="urn:zimbraAdmin" duration="86400"><account by="name">${xmlEscape(mailbox)}</account></DelegateAuthRequest>`,
    admin.token,
  );
  let xml: string;
  try {
    xml = await postAdminSoap(request.soap12, request.soap11);
  } catch (error) {
    // #region agent log
    debugLog('A', 'zimbraAuth.ts:delegateAuthMailbox', 'delegate transport fail', {
      mailboxLocal: mailbox.split('@')[0],
      error: explainTransportError(error).slice(0, 120),
    });
    // #endregion
    return { ok: false, message: explainTransportError(error) };
  }
  const token = xml.match(/<authToken>([^<]+)<\/authToken>/)?.[1] || '';
  if (!token) {
    // #region agent log
    debugLog('D', 'zimbraAuth.ts:delegateAuthMailbox', 'delegate no user token', {
      mailboxLocal: mailbox.split('@')[0],
      fault: faultText(xml).slice(0, 80),
    });
    // #endregion
    return {
      ok: false,
      message:
        faultText(xml) ||
        'Could not open this mailbox. Confirm the address exists on mail.govmail.ke.',
    };
  }
  // #region agent log
  debugLog('C', 'zimbraAuth.ts:delegateAuthMailbox', 'delegate ok', {
    mailboxLocal: mailbox.split('@')[0],
  });
  // #endregion
  return { ok: true, email: mailbox, token, password: '', passwordReset: false };
}

/** When admin can see the account, renew expired / must-change mailboxes to Uwezo100%. */
async function renewExpiredViaAdminIfNeeded(email: string): Promise<boolean> {
  const admin = await adminAuthToken();
  if (!admin.token) return false;
  const lookup = envelope(
    `<GetAccountRequest xmlns="urn:zimbraAdmin"><account by="name">${xmlEscape(email)}</account></GetAccountRequest>`,
    admin.token,
  );
  let accountXml: string;
  try {
    accountXml = await postAdminSoap(lookup.soap12, lookup.soap11);
  } catch {
    return false;
  }
  const mustChange = /n="zimbraPasswordMustChange"[^>]*>\s*TRUE/i.test(accountXml);
  if (!mustChange) {
    // Also catch “standard password itself is expired” without the must-change flag.
    const std = await authenticateAccount(email, STANDARD_MAILBOX_PASSWORD);
    if (std.kind !== 'expired') return false;
  }
  const resetError = await adminSetPassword(email, STANDARD_MAILBOX_PASSWORD);
  if (resetError) return false;
  const again = await authenticateAccount(email, STANDARD_MAILBOX_PASSWORD);
  return again.kind === 'ok';
}

/**
 * Open mailbox as the user.
 * - preferDelegate (LMS password login): ictsupport DelegateAuth first — LMS password ≠ mail password.
 * - otherwise: try mail password / Uwezo100% on :443, then DelegateAuth.
 * Expired passwords: admin SetPassword to Uwezo100% (then ChangePassword fallback) inside signInMailbox.
 */
export async function openMailboxForOfficer(
  email: string,
  password = '',
  preferDelegate = false,
): Promise<MailboxSignIn & { via?: 'password' | 'delegate' }> {
  const mailbox = email.trim().toLowerCase();
  if (!isUwezoMailbox(mailbox)) {
    return { ok: false, message: 'Use the Uwezo mailbox, for example name@uwezo.go.ke.' };
  }

  if (preferDelegate) {
    const delegated = await delegateAuthMailbox(mailbox);
    if (delegated.ok) {
      const renewed = await renewExpiredViaAdminIfNeeded(mailbox);
      if (renewed) {
        return {
          ...delegated,
          password: STANDARD_MAILBOX_PASSWORD,
          passwordReset: true,
          via: 'delegate',
        };
      }
      return { ...delegated, via: 'delegate' };
    }
    // Fall through to Uwezo100% if admin SOAP is unreachable.
  }

  const candidates = preferDelegate
    ? [STANDARD_MAILBOX_PASSWORD] // do not treat LMS password as the mail password
    : [password, STANDARD_MAILBOX_PASSWORD]
        .map((value) => String(value || '').trim())
        .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);

  let lastPasswordError = '';
  for (const candidate of candidates) {
    const signed = await signInMailbox(mailbox, candidate);
    if (signed.ok) return { ...signed, via: 'password' };
    lastPasswordError = signed.message;
    if (/could not reach|could not open a sign-in connection|certificate/i.test(signed.message)) {
      break;
    }
  }

  if (!preferDelegate) {
    const delegated = await delegateAuthMailbox(mailbox);
    if (delegated.ok) return { ...delegated, via: 'delegate' };
    if (lastPasswordError) return { ok: false, message: lastPasswordError };
    return {
      ok: false,
      message:
        delegated.message ||
        'Could not open this mailbox. Sign in with the mailbox password, or try again shortly.',
    };
  }

  if (lastPasswordError) return { ok: false, message: lastPasswordError };
  return {
    ok: false,
    message: 'Could not open this mailbox right now. Try again shortly.',
  };
}
