// live-executor.test.mjs — the real-money path invariants:
// base58 + signing correctness, fee-payer refusal, gate matrix, idempotency.
// NO network in tests: rpc/jupiter mocked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync, verify as edVerify, createPublicKey } from 'node:crypto';

process.env.SOLTRADE_DATA_DIR = process.env.SOLTRADE_DATA_DIR || mkdtempSync(join(tmpdir(), 'soltrade-live-'));

const { b58decode, b58encode } = await import('../src/engine/base58.mjs');
const { seedFromStoredSecret, keypairFromSeed, signSerializedTransaction } = await import('../src/engine/tx-signer.mjs');
const { createLiveExecutor } = await import('../src/engine/live-executor.mjs');

// ---------- base58 ----------
test('base58: roundtrip including leading zeros', () => {
  const cases = [Buffer.from([0, 0, 1, 2, 3]), Buffer.from('hello world'), Buffer.alloc(32, 7)];
  for (const c of cases) {
    assert.deepEqual(b58decode(b58encode(c)), c);
  }
  assert.throws(() => b58decode('0OIl'), /b58_invalid_char/);
});

// ---------- key handling + signing ----------
function freshSeed() {
  const { privateKey } = generateKeyPairSync('ed25519');
  const pkcs8 = privateKey.export({ format: 'der', type: 'pkcs8' });
  return Buffer.from(pkcs8.subarray(pkcs8.length - 32)); // seed = last 32 bytes of PKCS8
}

test('tx-signer: seed normalization accepts base58(64), base58(32), JSON array', () => {
  const seed = freshSeed();
  const pub = keypairFromSeed(seed).pubkeyRaw;
  const sixtyFour = Buffer.concat([seed, pub]);
  assert.deepEqual(seedFromStoredSecret(b58encode(sixtyFour)), seed);
  assert.deepEqual(seedFromStoredSecret(b58encode(seed)), seed);
  assert.deepEqual(seedFromStoredSecret(JSON.stringify([...sixtyFour])), seed);
  assert.throws(() => seedFromStoredSecret('tooShort'), /key_length_invalid|b58_invalid/);
});

function buildUnsignedTx({ feePayerRaw, numKeys = 2, versioned = true }) {
  // 1 signature slot (zeroed) + message: [version?] header(3) + compactU16 numKeys + keys
  const sigSection = Buffer.concat([Buffer.from([1]), Buffer.alloc(64)]);
  const header = Buffer.from([1, 0, 1]);
  const keys = [feePayerRaw];
  for (let i = 1; i < numKeys; i += 1) keys.push(Buffer.alloc(32, i));
  const msg = Buffer.concat([
    ...(versioned ? [Buffer.from([0x80])] : []),
    header, Buffer.from([numKeys]), ...keys,
    Buffer.from([0]), // empty instructions etc. (enough for signer parsing)
  ]);
  return { txBase64: Buffer.concat([sigSection, msg]).toString('base64'), message: msg };
}

test('tx-signer: signs a v0 tx, signature verifies against the message, fee payer enforced', () => {
  const seed = freshSeed();
  const kp = keypairFromSeed(seed);
  const { txBase64, message } = buildUnsignedTx({ feePayerRaw: kp.pubkeyRaw });
  const out = signSerializedTransaction({ txBase64, seed });
  assert.equal(out.signerAddress, kp.address);
  const signedTx = Buffer.from(out.signedTxBase64, 'base64');
  const sig = signedTx.subarray(1, 65);
  const pubObj = createPublicKey({
    key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), kp.pubkeyRaw]),
    format: 'der', type: 'spki',
  });
  assert.equal(edVerify(null, message, pubObj, sig), true, 'ed25519 signature must verify');
});

test('tx-signer: REFUSES to sign when fee payer is not the owner wallet', () => {
  const seed = freshSeed();
  const { txBase64 } = buildUnsignedTx({ feePayerRaw: Buffer.alloc(32, 9) });
  assert.throws(() => signSerializedTransaction({ txBase64, seed }), /fee_payer_mismatch/);
});

test('tx-signer: legacy (non-versioned) message also signs', () => {
  const seed = freshSeed();
  const kp = keypairFromSeed(seed);
  const { txBase64 } = buildUnsignedTx({ feePayerRaw: kp.pubkeyRaw, versioned: false });
  const out = signSerializedTransaction({ txBase64, seed });
  assert.equal(out.signerAddress, kp.address);
});

// ---------- live executor gate matrix + idempotency ----------
function buildExecutor(overrides = {}) {
  const seed = freshSeed();
  const kp = keypairFromSeed(seed);
  const stored = b58encode(Buffer.concat([seed, kp.pubkeyRaw]));
  const calls = { sent: 0 };
  const deps = {
    config: { get: () => ({ mode: 'real_live', execution: { capital_limit: 1000 } }), ...overrides.config },
    vault: { isUnlocked: () => true, getSecretForUse: () => ({ ok: true, value: stored }) },
    signer: { canSignNow: () => ({ allowed: true }), recordSigned: () => {} },
    killSwitch: { isBlocked: () => ({ blocked: false }) },
    operatingState: { get: () => ({ operating_state: 'ACTIVE' }) },
    rpc: {
      rpc: async (method) => {
        if (method === 'getBalance') return { ok: true, result: { value: 10e9 } };
        if (method === 'sendTransaction') { calls.sent += 1; return { ok: true, result: 'SiG'.repeat(20) }; }
        if (method === 'getSignatureStatuses') return { ok: true, result: { value: [{ confirmationStatus: 'confirmed', err: null }] } };
        return { ok: true, result: null };
      },
      getTransaction: async () => ({ ok: true, result: null }),
    },
    jupiter: {
      quote: async ({ inputMint }) => ({ ok: true, inAmount: 1e9, outAmount: inputMint === 'So11111111111111111111111111111111111111112' ? 67e6 : 1e9, priceImpactPct: 0.2, raw: {} }),
      swapTransaction: async ({ userPublicKey }) => {
        const { txBase64 } = buildUnsignedTx({ feePayerRaw: b58decode(userPublicKey) });
        return { ok: true, txBase64 };
      },
    },
    audit: () => {},
    broadcast: () => {},
    ...overrides.deps,
  };
  return { exec: createLiveExecutor(deps), calls, deps, kp };
}

// speed up the confirm poll (2.5s real) by mocking timers? confirm loop sleeps 2.5s once.
// Acceptable: tests below that send wait one poll (~2.5s).

test('live-executor: refuses when mode is paper / kill engaged / signer blocked / vault locked', async () => {
  const m1 = buildExecutor({ config: { get: () => ({ mode: 'paper', execution: {} }) } });
  const r1 = await m1.exec.executeSwap({ side: 'buy', mint: 'M1', sizeUsd: 10, intentParts: ['a'] });
  assert.equal(r1.error, 'gates_refused');
  assert.ok(r1.refusals.includes('mode_not_real_live'));

  const m2 = buildExecutor({ deps: { killSwitch: { isBlocked: () => ({ blocked: true, level: 'global' }) } } });
  const r2 = await m2.exec.executeSwap({ side: 'buy', mint: 'M1', sizeUsd: 10, intentParts: ['b'] });
  assert.ok(r2.refusals.includes('kill_switch_global'));

  const m3 = buildExecutor({ deps: { signer: { canSignNow: () => ({ allowed: false, reason: 'no_active_session' }), recordSigned: () => {} } } });
  const r3 = await m3.exec.executeSwap({ side: 'buy', mint: 'M1', sizeUsd: 10, intentParts: ['c'] });
  assert.ok(r3.refusals.includes('signer_no_active_session'));

  const m4 = buildExecutor({ deps: { vault: { isUnlocked: () => false, getSecretForUse: () => ({ ok: false, error: 'vault_locked' }) } } });
  const r4 = await m4.exec.executeSwap({ side: 'buy', mint: 'M1', sizeUsd: 10, intentParts: ['d'] });
  assert.ok(r4.refusals.includes('vault_locked'));
});

test('live-executor: insufficient SOL balance refuses BEFORE signing/sending', async () => {
  const m = buildExecutor({ deps: { rpc: {
    rpc: async (method) => method === 'getBalance' ? { ok: true, result: { value: 0.01e9 } } : { ok: true, result: null },
    getTransaction: async () => ({ ok: true, result: null }),
  } } });
  const r = await m.exec.executeSwap({ side: 'buy', mint: 'M1', sizeUsd: 10, intentParts: ['e'] });
  assert.equal(r.error, 'insufficient_sol_balance');
  assert.equal(m.calls.sent, 0, 'nothing sent');
});

test('live-executor: happy path sends ONCE, confirms, idempotent retry refuses duplicate', async () => {
  const m = buildExecutor();
  const parts = ['buy', 'leaderX', 'MintY', '123'];
  const r = await m.exec.executeSwap({ side: 'buy', mint: 'MintY', sizeUsd: 10, decimals: 6, intentParts: parts });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(m.calls.sent, 1);
  // retry with the SAME intent parts => refused, nothing re-sent
  const r2 = await m.exec.executeSwap({ side: 'buy', mint: 'MintY', sizeUsd: 10, decimals: 6, intentParts: parts });
  assert.equal(r2.ok, false);
  assert.ok(String(r2.error).startsWith('intent_duplicate'));
  assert.equal(m.calls.sent, 1, 'no duplicate on-chain transaction');
});

test('live-executor: audit failure before signing aborts (fail-closed, nothing sent)', async () => {
  const m = buildExecutor({ deps: { audit: () => { throw new Error('disk full'); } } });
  const r = await m.exec.executeSwap({ side: 'buy', mint: 'M2', sizeUsd: 10, intentParts: ['f'] });
  assert.equal(r.error, 'audit_unavailable_before_sign');
  assert.equal(m.calls.sent, 0);
});

test('live-executor: reconcile resolves a SENT_UNCONFIRMED intent (confirmed) and lists it pending', async () => {
  const m = buildExecutor({ deps: { rpc: {
    rpc: async (method) => (method === 'getSignatureStatuses'
      ? { ok: true, result: { value: [{ confirmationStatus: 'confirmed', err: null }] } }
      : { ok: true, result: null }),
    getTransaction: async () => ({ ok: true, result: { meta: { err: null }, transaction: { message: { accountKeys: [] } } } }),
  } } });
  m.exec._internal.claimIntent('int_rec_ok', { side: 'buy', mint: 'MintR', decimals: 6, recovery: { wallet_id: 'w' } });
  m.exec._internal.setIntent('int_rec_ok', 'SENT_UNCONFIRMED', { signature: 'SIGOK' });
  assert.ok(m.exec.pendingIntents().some((p) => p.intent_id === 'int_rec_ok'), 'pendingIntents lists the unconfirmed intent');
  const r = await m.exec.reconcile({ intent_id: 'int_rec_ok' });
  assert.equal(r.resolved, 'confirmed');
  assert.equal(r.detail.side, 'buy');
});

test('live-executor: reconcile marks a never-landed intent FAILED_SEND (retryable) only after N misses', async () => {
  const m = buildExecutor({ deps: { rpc: {
    rpc: async (method) => (method === 'getSignatureStatuses' ? { ok: true, result: { value: [null] } } : { ok: true, result: null }),
    getTransaction: async () => ({ ok: true, result: null }),
  } } });
  m.exec._internal.claimIntent('int_rec_gone', { side: 'sell', mint: 'MintR', positionId: 'pos9' });
  m.exec._internal.setIntent('int_rec_gone', 'SENT_UNCONFIRMED', { signature: 'SIGGONE' });
  // early "not found" passes stay PENDING (the tx may still be propagating) — NOT yet retryable,
  // so a premature rebroadcast can't double-execute an in-flight tx.
  assert.equal((await m.exec.reconcile({ intent_id: 'int_rec_gone' })).resolved, 'pending');
  assert.equal(m.exec._internal.claimIntent('int_rec_gone', { side: 'sell' }).ok, false, 'still blocked while pending');
  assert.equal((await m.exec.reconcile({ intent_id: 'int_rec_gone' })).resolved, 'pending');
  const r = await m.exec.reconcile({ intent_id: 'int_rec_gone' });
  assert.equal(r.resolved, 'never_landed');
  // now retryable: a fresh claim on the same id succeeds
  assert.equal(m.exec._internal.claimIntent('int_rec_gone', { side: 'sell' }).ok, true);
});

test('live-executor: an ambiguous send failure keeps the deterministic signature so it stays reconcilable', async () => {
  const m = buildExecutor({ deps: { rpc: {
    rpc: async (method) => {
      if (method === 'getBalance') return { ok: true, result: { value: 10e9 } };
      // 5xx / timeout class = MAYBE sent (ambiguous) -> SENT_UNCONFIRMED, must not be lost
      if (method === 'sendTransaction') return { ok: false, error: 'rpc_http_503' };
      return { ok: true, result: null };
    },
    getTransaction: async () => ({ ok: true, result: null }),
  } } });
  const r = await m.exec.executeSwap({ side: 'sell', mint: 'MintY', qtyUi: 5, decimals: 6, intentParts: ['sell', 'posAmb', 'stop_loss_hit'] });
  assert.equal(r.ok, false);
  const pend = m.exec.pendingIntents();
  assert.equal(pend.length, 1, 'the unconfirmed intent is reconcilable (it has a stored signature)');
  assert.ok(pend[0].signature, 'the deterministic fee-payer signature was persisted BEFORE the ambiguous send');
});

test('live-executor: FAILED_ON_CHAIN is retryable (a reverted tx moved nothing)', () => {
  const m = buildExecutor();
  m.exec._internal.claimIntent('int_foc', { side: 'sell' });
  m.exec._internal.setIntent('int_foc', 'FAILED_ON_CHAIN', {});
  assert.equal(m.exec._internal.claimIntent('int_foc', { side: 'sell' }).ok, true);
});

test('live-executor: routes signing through the Rust hot-executor when signer_backend=rust', async () => {
  let signCalls = 0;
  const m = buildExecutor({
    config: { get: () => ({ mode: 'real_live', execution: { capital_limit: 1000, signer_backend: 'rust' } }) },
    deps: { hotSigner: { sign: async () => { signCalls += 1; return { ok: true, signedTxBase64: 'RUST', signatureB58: 'RSIG', signerAddress: 'x' }; } } },
  });
  const r = await m.exec.executeSwap({ side: 'buy', mint: 'MintY', sizeUsd: 10, decimals: 6, intentParts: ['buy', 'rust', 'MintY', '1'] });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(signCalls, 1, 'signing routed to the Rust hot-executor');
  assert.equal(m.calls.sent, 1);
});

test('live-executor: falls back to in-process signing when the hot-executor fails', async () => {
  let signCalls = 0;
  const m = buildExecutor({
    config: { get: () => ({ mode: 'real_live', execution: { capital_limit: 1000, signer_backend: 'rust' } }) },
    deps: { hotSigner: { sign: async () => { signCalls += 1; return { ok: false, error: 'executor_exited' }; } } },
  });
  const r = await m.exec.executeSwap({ side: 'buy', mint: 'MintY', sizeUsd: 10, decimals: 6, intentParts: ['buy', 'fb', 'MintY', '1'] });
  assert.equal(r.ok, true, 'still signs in-process when the hot-executor fails (fail-safe)');
  assert.equal(signCalls, 1, 'hot-executor was attempted');
  assert.equal(m.calls.sent, 1, 'transaction still broadcast');
});

test('live-executor: submits via Jito bundle when submit_backend=jito and configured', async () => {
  const tipAccount = b58encode(Buffer.alloc(32, 5));
  const blockhash = b58encode(Buffer.alloc(32, 6));
  let bundleCalls = 0; let bundleLen = 0; let rpcSends = 0;
  const m = buildExecutor({
    config: { get: () => ({ mode: 'real_live', execution: { capital_limit: 1000, submit_backend: 'jito', jito_tip_account: tipAccount, jito_tip_lamports: 12000 } }) },
    deps: {
      jitoSendBundle: async (txs) => { bundleCalls += 1; bundleLen = txs.length; return { ok: true, result: 'bundle1' }; },
      rpc: {
        rpc: async (method) => {
          if (method === 'getBalance') return { ok: true, result: { value: 10e9 } };
          if (method === 'getLatestBlockhash') return { ok: true, result: { value: { blockhash } } };
          if (method === 'sendTransaction') { rpcSends += 1; return { ok: true, result: 'rpcsig' }; }
          if (method === 'getSignatureStatuses') return { ok: true, result: { value: [{ confirmationStatus: 'confirmed', err: null }] } };
          return { ok: true, result: null };
        },
        getTransaction: async () => ({ ok: true, result: null }),
      },
    },
  });
  const r = await m.exec.executeSwap({ side: 'buy', mint: 'MintY', sizeUsd: 10, decimals: 6, intentParts: ['buy', 'jito', 'MintY', '1'] });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(bundleCalls, 1, 'submitted via Jito bundle');
  assert.equal(bundleLen, 2, 'swap tx + tip tx bundled');
  assert.equal(rpcSends, 0, 'did NOT use rpc sendTransaction');
});

test('live-executor: falls back to rpc sendTransaction when the Jito bundle fails', async () => {
  const tipAccount = b58encode(Buffer.alloc(32, 5));
  const blockhash = b58encode(Buffer.alloc(32, 6));
  let rpcSends = 0;
  const m = buildExecutor({
    config: { get: () => ({ mode: 'real_live', execution: { capital_limit: 1000, submit_backend: 'jito', jito_tip_account: tipAccount, jito_tip_lamports: 12000 } }) },
    deps: {
      jitoSendBundle: async () => ({ ok: false, error: 'jito_down' }),
      rpc: {
        rpc: async (method) => {
          if (method === 'getBalance') return { ok: true, result: { value: 10e9 } };
          if (method === 'getLatestBlockhash') return { ok: true, result: { value: { blockhash } } };
          if (method === 'sendTransaction') { rpcSends += 1; return { ok: true, result: 'rpcsig' }; }
          if (method === 'getSignatureStatuses') return { ok: true, result: { value: [{ confirmationStatus: 'confirmed', err: null }] } };
          return { ok: true, result: null };
        },
        getTransaction: async () => ({ ok: true, result: null }),
      },
    },
  });
  const r = await m.exec.executeSwap({ side: 'buy', mint: 'MintY', sizeUsd: 10, decimals: 6, intentParts: ['buy', 'jfb', 'MintY', '1'] });
  assert.equal(r.ok, true, 'still sends when Jito fails');
  assert.equal(rpcSends, 1, 'fell back to rpc sendTransaction');
});

test('live-executor: session notional is charged ONCE across a retried (reverted) intent', async () => {
  let charges = 0;
  const m = buildExecutor({ deps: {
    signer: { canSignNow: () => ({ allowed: true }), recordSigned: () => { charges += 1; } },
    rpc: {
      rpc: async (method) => {
        if (method === 'getBalance') return { ok: true, result: { value: 10e9 } };
        if (method === 'sendTransaction') return { ok: true, result: 'SiG'.repeat(20) };
        // tx reverts on-chain every time -> FAILED_ON_CHAIN (retryable)
        if (method === 'getSignatureStatuses') return { ok: true, result: { value: [{ err: { InstructionError: [] }, confirmationStatus: 'confirmed' }] } };
        return { ok: true, result: null };
      },
      getTransaction: async () => ({ ok: true, result: null }),
    },
  } });
  const parts = ['sell', 'posR', 'stop_loss_hit'];
  const r1 = await m.exec.executeSwap({ side: 'sell', mint: 'MintY', qtyUi: 5, decimals: 6, intentParts: parts });
  assert.equal(r1.ok, false);
  const r2 = await m.exec.executeSwap({ side: 'sell', mint: 'MintY', qtyUi: 5, decimals: 6, intentParts: parts });
  assert.equal(r2.ok, false);
  assert.equal(charges, 1, 'notional charged exactly once despite the retry re-broadcast');
});
