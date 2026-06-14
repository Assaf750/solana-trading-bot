// token-safety.test.mjs — pre-trade anti-rug screen (mocked RPC, no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTokenSafety } from '../src/engine/token-safety.mjs';

function rpcReturning(value, ok = true) {
  return { rpc: async () => ({ ok, result: ok ? { value } : undefined }) };
}
function mint({ mintAuthority = null, freezeAuthority = null, extensions } = {}) {
  return { data: { parsed: { type: 'mint', info: { mintAuthority, freezeAuthority, ...(extensions ? { extensions } : {}) } } } };
}
const cfg = { safety: { enabled: true } };

test('token-safety: a clean mint (authorities revoked, no permanent delegate) is safe', async () => {
  const r = await checkTokenSafety({ mint: 'M', rpc: rpcReturning(mint()), cfg });
  assert.deepEqual(r, { safe: true, reasons: [] });
});

test('token-safety: live mint authority is unsafe', async () => {
  const r = await checkTokenSafety({ mint: 'M', rpc: rpcReturning(mint({ mintAuthority: 'AAA' })), cfg });
  assert.equal(r.safe, false);
  assert.ok(r.reasons.includes('mint_authority_not_revoked'));
});

test('token-safety: live freeze authority is unsafe', async () => {
  const r = await checkTokenSafety({ mint: 'M', rpc: rpcReturning(mint({ freezeAuthority: 'BBB' })), cfg });
  assert.ok(r.reasons.includes('freeze_authority_not_revoked'));
});

test('token-safety: Token-2022 permanent delegate is unsafe', async () => {
  const ext = [{ extension: 'permanentDelegate', state: { delegate: 'CCC' } }];
  const r = await checkTokenSafety({ mint: 'M', rpc: rpcReturning(mint({ extensions: ext })), cfg });
  assert.ok(r.reasons.includes('token2022_permanent_delegate'));
});

test('token-safety: unreadable / non-mint account fails closed (unsafe)', async () => {
  assert.equal((await checkTokenSafety({ mint: 'M', rpc: rpcReturning(null, false), cfg })).safe, false);
  assert.equal((await checkTokenSafety({ mint: 'M', rpc: rpcReturning({ data: { parsed: { type: 'account' } } }), cfg })).reasons[0], 'safety_check_unavailable');
});

test('token-safety: disabled => always safe (no RPC dependency)', async () => {
  let called = false;
  const rpc = { rpc: async () => { called = true; return { ok: true, result: { value: null } }; } };
  const r = await checkTokenSafety({ mint: 'M', rpc, cfg: { safety: { enabled: false } } });
  assert.deepEqual(r, { safe: true, reasons: [] });
  assert.equal(called, false, 'no RPC call when disabled');
});

test('token-safety: per-check toggles (allow live freeze when require_freeze_revoked=false)', async () => {
  const r = await checkTokenSafety({ mint: 'M', rpc: rpcReturning(mint({ freezeAuthority: 'BBB' })), cfg: { safety: { enabled: true, require_freeze_revoked: false } } });
  assert.equal(r.safe, true);
});
