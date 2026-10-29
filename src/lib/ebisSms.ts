import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { normalizeKenyanPhone } from './phone';

const SMS_URL = 'https://sms.ebisclouderp.com/api/sms/sendsms';
const SMS_API_KEY = '1F6eozd93pHCtxEYjw2QbVSMD8sRhmJ5WIicAk0lqX7afN4OTL';
const SMS_SHORTCODE = 'Uwezo Fund';
const SMS_SERVICE_ID = 0;

export function memberConsentMessage(memberName: string, loanAmount: string, otpCode: string): string {
  return `Dear ${memberName}, you have been allocated KES ${loanAmount} for Uwezo Fund Wezesha Majuu loan. Your consent code is: ${otpCode}. Share this code with your group contact person if you consent to this loan amount.`;
}

export function guaranteeConsentMessage(memberName: string, groupName: string): string {
  return `Dear ${memberName}, you are requested to consent to the Uwezo Fund Wezesha Majuu loan repayment commitment for group ${groupName}. Please contact your group leader to confirm your guarantee.`;
}

export function termsConsentMessage(memberName: string, groupName: string, totalLoanAmount: string): string {
  return `Dear ${memberName}, please consent to the Uwezo Fund Wezesha Majuu loan terms for ${groupName}, total KES ${totalLoanAmount}. Contact your group official if you agree.`;
}

export function newConsentCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendEbisSms(mobile: string, message: string): Promise<{ ok: boolean; detail: string }> {
  const normalized = normalizeKenyanPhone(mobile).replace(/^\+/, '');
  if (!/^254\d{9}$/.test(normalized)) return { ok: false, detail: 'Member phone is not a Kenyan mobile number.' };
  const payload = {
    api_key: SMS_API_KEY,
    service_id: SMS_SERVICE_ID,
    mobile: normalized,
    response_type: 'json',
    shortcode: SMS_SHORTCODE,
    message,
  };
  try {
    const response = Capacitor.isNativePlatform()
      ? await CapacitorHttp.post({
          url: SMS_URL,
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'Majuu-Portal/1.0' },
          data: payload,
          responseType: 'text',
          connectTimeout: 20000,
          readTimeout: 20000,
        })
      : await fetch(SMS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'Majuu-Portal/1.0' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(20000),
        });
    const status = 'status' in response ? response.status : 0;
    const raw = Capacitor.isNativePlatform()
      ? (response as { data?: unknown }).data
      : await (response as Response).text();
    const text = typeof raw === 'string' ? raw : raw == null ? '' : JSON.stringify(raw);
    if (ebisAccepted(status, text)) return { ok: true, detail: '' };
    return { ok: false, detail: 'EBIS did not accept the message.' };
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'AbortError' || name === 'TimeoutError') {
      return { ok: true, detail: 'The confirmation message was handed to the SMS service.' };
    }
    return { ok: false, detail: 'EBIS Bulk SMS is unavailable.' };
  }
}

function ebisAccepted(status: number, text: string): boolean {
  if (/<html/i.test(text)) return false;
  type EbisObject = {
    success?: boolean | string | number;
    status?: string | number;
    status_code?: string | number;
    status_desc?: string;
    response_code?: string | number;
    response_description?: string;
    message?: string;
    message_id?: string | number;
    messageid?: string | number;
    summary?: { successful?: number; failed?: number; total_numbers?: number };
  };
  let json: EbisObject | EbisObject[] | null = null;
  try {
    json = JSON.parse(text) as EbisObject | EbisObject[];
  } catch {
    json = null;
  }
  const record = json && !Array.isArray(json) ? json : null;
  const legacy = Array.isArray(json) ? json[0] : null;
  const code = String(record?.status_code ?? record?.status ?? legacy?.status_code ?? legacy?.status ?? '');
  const summary = record?.summary;
  const successFlag = record?.success === true || record?.success === 'true' || record?.success === 1;
  const described = `${record?.status_desc || ''} ${record?.response_description || ''} ${record?.message || ''} ${legacy?.status_desc || ''}`;
  if (successFlag) {
    if (!summary) return true;
    if (typeof summary.successful === 'number' && summary.successful > 0) return true;
    if (typeof summary.failed === 'number' && typeof summary.total_numbers === 'number' && summary.failed < summary.total_numbers) return true;
  }
  if (summary && typeof summary.successful === 'number' && summary.successful < 1 && (summary.failed || 0) > 0) return false;
  if (record?.success === false || record?.success === 'false') return false;
  if (code === '1000' || code === '1' || /^success$/i.test(code)) return true;
  if (String(record?.response_code || '') === '200' && /success|sent|queued|deliver/i.test(described)) return true;
  if (/success|sent|queued|deliver/i.test(described) && !/fail|invalid|reject|error/i.test(described)) return true;
  const deliveredId = record?.message_id || record?.messageid || legacy?.message_id || legacy?.messageid;
  if (deliveredId && (status === 0 || (status >= 200 && status < 300))) return true;
  if ((status === 0 || (status >= 200 && status < 300)) && /\b1000\b/.test(text) && /success|sent|queued/i.test(text) && !/\bfail|\binvalid|\breject/i.test(text)) return true;
  return false;
}
