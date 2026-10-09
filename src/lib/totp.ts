const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export type TotpAccount = {
  id: string;
  issuer: string;
  label: string;
  secret: string;
  digits: number;
  period: number;
  enrolledAt: string;
};

export function normalizeBase32(input: string) {
  return input.replace(/[\s=-]/g, '').toUpperCase().replace(/0/g, 'O').replace(/1/g, 'I');
}

export function generateTotpSecret(bytes = 20) {
  const raw = new Uint8Array(bytes);
  crypto.getRandomValues(raw);
  return base32Encode(raw);
}

function base32Encode(data: Uint8Array) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string) {
  const clean = normalizeBase32(input);
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = ALPHABET.indexOf(char);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function parseOtpauth(uri: string): Omit<TotpAccount, 'id' | 'enrolledAt'> | null {
  const text = uri.trim();
  if (!text.toLowerCase().startsWith('otpauth://totp/')) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const secret = url.searchParams.get('secret') || '';
  if (normalizeBase32(secret).length < 8) return null;
  const pathLabel = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const issuerParam = url.searchParams.get('issuer') || '';
  let issuer = issuerParam;
  let label = pathLabel;
  const colon = pathLabel.indexOf(':');
  if (colon >= 0) {
    issuer = issuer || pathLabel.slice(0, colon);
    label = pathLabel.slice(colon + 1);
  }
  const digits = Number(url.searchParams.get('digits') || '6');
  const period = Number(url.searchParams.get('period') || '30');
  return {
    issuer: issuer || 'Uwezo Fund',
    label: label || 'application',
    secret: normalizeBase32(secret),
    digits: digits === 8 ? 8 : 6,
    period: period > 0 ? period : 30,
  };
}

export function otpauthUri(account: Pick<TotpAccount, 'issuer' | 'label' | 'secret' | 'digits' | 'period'>) {
  const label = encodeURIComponent(`${account.issuer}:${account.label}`);
  const params = new URLSearchParams({
    secret: account.secret,
    issuer: account.issuer,
    algorithm: 'SHA1',
    digits: String(account.digits),
    period: String(account.period),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** RFC 6238 code. SHA1, matching Microsoft Authenticator defaults. */
export async function totpCode(account: Pick<TotpAccount, 'secret' | 'digits' | 'period'>, now = Date.now()) {
  const counter = Math.floor(now / 1000 / account.period);
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter >>> 0);
  const key = await crypto.subtle.importKey(
    'raw',
    base32Decode(account.secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
  const offset = sig[sig.length - 1] & 0x0f;
  const bin =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff);
  return String(bin % 10 ** account.digits).padStart(account.digits, '0');
}

export function secondsRemaining(period: number, now = Date.now()) {
  const elapsed = Math.floor(now / 1000) % period;
  return period - elapsed;
}
