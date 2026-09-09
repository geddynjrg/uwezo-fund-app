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
  if (digits.length === 9 && digits.startsWith('7')) {
    return `+254${digits}`;
  }
  if (raw.trim().startsWith('+') && digits.length >= 10) {
    return `+${digits}`;
  }
  return raw.trim();
}

export function isLikelyKenyanMobile(raw: string): boolean {
  const n = normalizeKenyanPhone(raw).replace(/\D/g, '');
  return n.startsWith('254') && n.length === 12 && n[3] === '7';
}
