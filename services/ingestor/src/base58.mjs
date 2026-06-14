// base58.mjs — Solana base58 ENCODE (bytes -> string). The Yellowstone gRPC feed delivers
// pubkeys/signatures as raw bytes; the engine's swap-detector expects base58 strings, so the
// ingestor encodes them at the boundary. Encode-only by design (the ingestor never decodes).
// Injectable into parse() so the server can pass its own encoder and avoid any duplication.
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function b58encode(input) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let zeros = 0;
  while (zeros < b.length && b[zeros] === 0) zeros += 1;
  const digits = [0];
  for (let i = zeros; i < b.length; i += 1) {
    let carry = b[i];
    for (let j = 0; j < digits.length; j += 1) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = '1'.repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i -= 1) out += ALPHABET[digits[i]];
  return out;
}
