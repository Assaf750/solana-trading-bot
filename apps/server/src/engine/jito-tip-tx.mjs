// jito-tip-tx.mjs — PURE builder of a legacy Solana SystemProgram.transfer transaction
// (owner -> Jito tip account), used as the tip leg of a Jito bundle. Returns an UNSIGNED base64
// tx ready for the fee-payer-locked signer (owner is account 0 = fee payer). No network.
import { b58decode } from './base58.mjs';

const SYSTEM_PROGRAM = Buffer.alloc(32); // "111…1" = 32 zero bytes

/** Solana shortvec (compact-u16) encode. */
function shortvec(n) {
  const out = [];
  let v = n;
  for (;;) {
    const b = v & 0x7f;
    v >>>= 7;
    if (v) out.push(b | 0x80);
    else { out.push(b); break; }
  }
  return Buffer.from(out);
}

/** Build an unsigned legacy transfer tx: owner pays `lamports` to `tipAccount`. */
export function buildTipTransferTx({ owner, tipAccount, lamports, recentBlockhash }) {
  const ownerKey = Buffer.from(b58decode(owner));
  const tipKey = Buffer.from(b58decode(tipAccount));
  const blockhash = Buffer.from(b58decode(recentBlockhash));
  if (ownerKey.length !== 32 || tipKey.length !== 32 || blockhash.length !== 32) {
    throw new Error('tip_tx_bad_key_length');
  }
  if (!Number.isInteger(lamports) || lamports <= 0) throw new Error('tip_tx_bad_lamports');

  // header: 1 required sig, 0 readonly-signed, 1 readonly-unsigned (the system program)
  const header = Buffer.from([1, 0, 1]);
  // account order: owner (writable signer), tip (writable), system program (readonly)
  const keys = Buffer.concat([ownerKey, tipKey, SYSTEM_PROGRAM]);

  // SystemInstruction::Transfer = u32 LE 2 + u64 LE lamports
  const data = Buffer.alloc(12);
  data.writeUInt32LE(2, 0);
  data.writeBigUInt64LE(BigInt(lamports), 4);

  const instruction = Buffer.concat([
    Buffer.from([2]),                  // programIdIndex = system program (account 2)
    shortvec(2), Buffer.from([0, 1]),  // instruction accounts: owner(0), tip(1)
    shortvec(data.length), data,
  ]);

  const message = Buffer.concat([
    header,
    shortvec(3), keys,
    blockhash,
    shortvec(1), instruction,
  ]);

  // tx = shortvec(numSigs=1) + zeroed signature slot + message (signer replaces slot 0)
  const tx = Buffer.concat([shortvec(1), Buffer.alloc(64), message]);
  return tx.toString('base64');
}

/**
 * Pick the Jito tip in lamports. `floor` is the tip-floor row (values in SOL, keys like
 * landed_tips_50th_percentile). Falls back to `fixedLamports` when the floor/percentile is
 * unavailable, and clamps to `maxLamports` when set. Pure — no network.
 */
export function selectTipLamports({ floor, percentile = 50, fixedLamports = 10000, maxLamports = null }) {
  const fixed = Number.isFinite(fixedLamports) && fixedLamports > 0 ? Math.floor(fixedLamports) : 10000;
  // Ceiling = the explicit cap, else the fixed value. This keeps the selected tip <= what the
  // balance check reserves (maxTipReserveLamports mirrors this). Raise jito_tip_max_lamports to
  // let the live floor bid above the fixed tip. The fixed value also acts as the FLOOR (minimum).
  const cap = Math.max(fixed, Number.isFinite(maxLamports) && maxLamports > 0 ? Math.floor(maxLamports) : fixed);
  // snap the requested percentile to the nearest supported bucket (validator allows 1..100)
  const buckets = [25, 50, 75, 95, 99];
  const pn = Number(percentile);
  const pct = Number.isFinite(pn) ? buckets.reduce((a, b) => (Math.abs(b - pn) < Math.abs(a - pn) ? b : a), 50) : 50;
  const sol = floor ? Number(floor[`landed_tips_${pct}th_percentile`]) : NaN;
  if (!Number.isFinite(sol) || sol <= 0) return fixed; // no live floor -> fixed fallback
  const lamports = Math.floor(sol * 1e9);
  return Math.max(fixed, Math.min(lamports, cap)); // clamp into [fixed, cap]
}
