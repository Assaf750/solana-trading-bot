// jito-tip-tx.test.mjs — the tip-transfer tx builder: signable, fee-payer-locked to owner,
// correct SystemProgram.transfer encoding.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify as edVerify, createPublicKey } from 'node:crypto';
import { b58encode, b58decode } from '../src/engine/base58.mjs';
import { buildTipTransferTx } from '../src/engine/jito-tip-tx.mjs';
import { keypairFromSeed, signSerializedTransaction } from '../src/engine/tx-signer.mjs';

function freshSeed() {
  const { privateKey } = generateKeyPairSync('ed25519');
  const p = privateKey.export({ format: 'der', type: 'pkcs8' });
  return Buffer.from(p.subarray(p.length - 32));
}

test('jito tip tx: builds a signable transfer; fee payer = owner; lamports + tip account decode', () => {
  const seed = freshSeed();
  const kp = keypairFromSeed(seed);
  const tip = b58encode(Buffer.alloc(32, 5));
  const bh = b58encode(Buffer.alloc(32, 6));
  const txB64 = buildTipTransferTx({ owner: kp.address, tipAccount: tip, lamports: 12345, recentBlockhash: bh });

  const out = signSerializedTransaction({ txBase64: txB64, seed }); // enforces fee payer == owner
  assert.equal(out.signerAddress, kp.address);

  const signed = Buffer.from(out.signedTxBase64, 'base64');
  const sig = signed.subarray(1, 65);
  const msg = signed.subarray(65);
  const pub = createPublicKey({
    key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), kp.pubkeyRaw]),
    format: 'der', type: 'spki',
  });
  assert.equal(edVerify(null, msg, pub, sig), true, 'tip-tx signature verifies');

  // message: header(3) + shortvec(3)=1 + keys(96) + blockhash(32) + shortvec(1)=1 + instruction
  const tipKey = msg.subarray(4 + 32, 4 + 64);
  assert.deepEqual(Buffer.from(tipKey), Buffer.from(b58decode(tip)), 'tip account is key[1]');
  const instrStart = 3 + 1 + 96 + 32 + 1; // programIdIndex byte
  assert.equal(msg[instrStart], 2, 'programIdIndex = system program');
  const dataLenPos = instrStart + 1 + 1 + 2; // +programIdIndex +accLenByte +2 accounts
  assert.equal(msg[dataLenPos], 12, 'data length = 12');
  const data = msg.subarray(dataLenPos + 1, dataLenPos + 1 + 12);
  assert.equal(data.readUInt32LE(0), 2, 'transfer discriminator');
  assert.equal(Number(data.readBigUInt64LE(4)), 12345, 'lamports');
});

test('jito tip tx: rejects bad key lengths and non-positive lamports', () => {
  const bh = b58encode(Buffer.alloc(32, 6));
  const tip = b58encode(Buffer.alloc(32, 5));
  const owner = b58encode(Buffer.alloc(32, 7));
  assert.throws(() => buildTipTransferTx({ owner: '1', tipAccount: tip, lamports: 1, recentBlockhash: bh }), /bad_key_length/);
  assert.throws(() => buildTipTransferTx({ owner, tipAccount: tip, lamports: 0, recentBlockhash: bh }), /bad_lamports/);
});
