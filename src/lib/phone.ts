/** Normalize Kenyan mobile numbers toward E.164-style +254… for OTP APIs. */
export function normalizeKenyanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('254') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+254${digits.slice(1)}`;
  }
  // Local 9-digit: 07… → 7XXXXXXXX or 01… → 1XXXXXXXX
  if (digits.length === 9 && /^[17]/.test(digits)) {
    return `+254${digits}`;
  }
  if (raw.trim().startsWith('+') && digits.length >= 10) {
    return `+${digits}`;
  }
  return raw.trim();
}

/** Accept Safaricom/Airtel-style 07… and 01… mobiles (E.164 +2547 / +2541). */
export function isLikelyKenyanMobile(raw: string): boolean {
  const n = normalizeKenyanPhone(raw).replace(/\D/g, '');
  return /^254[17]\d{8}$/.test(n);
}

/** +254720501239, 254720501239, 0720501239, and 720501239 are one line. */
export function sameKenyanLine(a: string, b: string): boolean {
  const left = normalizeKenyanPhone(a).replace(/\D/g, '').slice(-9);
  const right = normalizeKenyanPhone(b).replace(/\D/g, '').slice(-9);
  return left.length === 9 && left === right;
}
