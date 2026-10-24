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
    const text = Capacitor.isNativePlatform()
      ? String((response as { data?: unknown }).data ?? '')
      : await (response as Response).text();
    let json: { success?: boolean; status?: string } | null = null;
    try {
      json = JSON.parse(text) as { success?: boolean; status?: string };
    } catch {
      json = null;
    }
    if (status === 200 && (json?.success === true || json?.status === '1000')) return { ok: true, detail: '' };
    return { ok: false, detail: 'EBIS did not accept the message.' };
  } catch {
    return { ok: false, detail: 'EBIS Bulk SMS is unavailable.' };
  }
}
