// tx-signer.mjs — Ed25519 transaction signing over the owner's vault-held key.
// SECURITY CONTRACT:
//  - the raw key is fetched from the vault AT SIGN TIME, used, and never returned/logged
//  - the derived public key is exposed (it is public on-chain anyway)
//  - signing refuses if the tx fee payer is not the owner's wallet (no signing for
//    arbitrary accounts), and on any parse anomaly (fail-closed)
import { createPrivateKey, createPublicKey, sign as edSign } from 'node:crypto';
import { b58decode, b58encode } from './base58.mjs';

const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

/** Normalize a stored secret (base58 string of 32/64 bytes, or JSON byte array) to a 32-byte seed. */
export function seedFromStoredSecret(stored) {
  let bytes = null;
  if (typeof stored === 'string') {
    const s = stored.trim();
    if (s.startsWith('[')) {
      const arr = JSON.parse(s);
      if (!Array.isArray(arr)) throw new Error('key_format_invalid');
      bytes = Buffer.from(arr);
    } else {
      bytes = b58decode(s);
    }
  }
  if (!bytes || (bytes.length !== 64 && bytes.length !== 32)) throw new Error('key_length_invalid');
  return bytes.length === 64 ? bytes.subarray(0, 32) : bytes;
}

export function keypairFromSeed(seed) {
  const priv = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]), format: 'der', type: 'pkcs8' });
  const spki = createPublicKey(priv).export({ format: 'der', type: 'spki' });
  const pubkeyRaw = Buffer.from(spki.subarray(spki.length - 32));
  return { priv, pubkeyRaw, address: b58encode(pubkeyRaw) };
}

function readCompactU16(buf, offset) {
  let value = 0, shift = 0, o = offset;
  for (;;) {
    const b = buf[o]; o += 1;
    value |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
    if (shift > 14) throw new Error('compact_u16_overflow');
  }
  return { value, offset: o };
}

/**
 * Sign a serialized (legacy or v0) Solana transaction (base64, e.g. Jupiter /swap output).
 * Replaces the fee-payer signature (slot 0). Refuses unless the message's fee payer
 * equals the signer's address.
 */
export function signSerializedTransaction({ txBase64, seed }) {
  const tx = Buffer.from(txBase64, 'base64');
  const { value: numSigs, offset: sigStart } = readCompactU16(tx, 0);
  if (numSigs < 1 || numSigs > 16) throw new Error('tx_sig_count_invalid');
  const msgStart = sigStart + numSigs * 64;
  if (msgStart >= tx.length) throw new Error('tx_truncated');
  const message = tx.subarray(msgStart);

  // locate fee payer (first static account key) in the message
  let mo = 0;
  if ((message[0] & 0x80) !== 0) mo = 1; // versioned message prefix
  mo += 3; // header: numRequired, numReadonlySigned, numReadonlyUnsigned
  const { value: numKeys, offset: keysStart } = readCompactU16(message, mo);
  if (numKeys < 1) throw new Error('tx_no_account_keys');
  const feePayer = message.subarray(keysStart, keysStart + 32);

  const kp = keypairFromSeed(seed);
  if (!feePayer.equals(kp.pubkeyRaw)) throw new Error('fee_payer_mismatch_refusing_to_sign');

  const signature = edSign(null, message, kp.priv);
  if (signature.length !== 64) throw new Error('signature_length_invalid');
  signature.copy(tx, sigStart); // fee payer = signature slot 0

  return {
    signedTxBase64: tx.toString('base64'),
    signatureB58: b58encode(signature),
    signerAddress: kp.address,
  };
}
