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
