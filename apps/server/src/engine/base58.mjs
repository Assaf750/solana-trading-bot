// base58.mjs — minimal base58 (Bitcoin alphabet) encode/decode. Zero deps, pure.
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const MAP = new Map([...ALPHABET].map((c, i) => [c, i]));

export function b58decode(str) {
  if (typeof str !== 'string' || !str.length) throw new Error('b58_invalid_input');
  let zeros = 0;
  while (zeros < str.length && str[zeros] === '1') zeros += 1;
  const bytes = [];
  for (const ch of str) {
    const v = MAP.get(ch);
    if (v === undefined) throw new Error('b58_invalid_char');
    let carry = v;
    for (let i = 0; i < bytes.length; i += 1) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  for (let i = 0; i < zeros; i += 1) bytes.push(0);
  return Buffer.from(bytes.reverse());
}

export function b58encode(buf) {
  let zeros = 0;
  while (zeros < buf.length && buf[zeros] === 0) zeros += 1;
  const digits = [];
  for (const byte of buf) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = '1'.repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i -= 1) out += ALPHABET[digits[i]];
  return out;
}
