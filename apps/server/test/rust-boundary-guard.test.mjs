// rust-boundary-guard.test.mjs — ADR-0001 Phase Rust-2. The Rust hot-executor is the official SIGNING
// boundary and is NETWORK-FREE BY DESIGN: it signs and builds PURE JSON-RPC / Jito-bundle payloads and
// selects tips, but the actual network POST (sendTransaction / Jito sendBundle), the retries, and the
// intent-ledger idempotency stay in the JS control plane (live-executor + @soltrade/provider-adapters).
// Decision (Rust-2): do NOT move the send into the signer — that would add an HTTP client + async runtime
// to the most security-critical component for no real benefit. These guards keep the responsibilities
// from mixing: the signer never gains a socket, and the send never leaves JS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// HTTP / async-runtime crates that would give the signer a socket — forbidden as a direct dependency.
const FORBIDDEN_CRATES = ['reqwest', 'hyper', 'tokio', 'ureq', 'isahc', 'curl', 'surf', 'attohttpc', 'async-std', 'tonic'];

test('Rust hot-executor stays network-free (no HTTP/async crate in Cargo.toml) — signing boundary only', () => {
  const cargo = read('services/hot-executor/Cargo.toml');
  const deps = cargo.slice(cargo.indexOf('[dependencies]')); // deps onward (the crate has no dev-deps)
  for (const c of FORBIDDEN_CRATES) {
    assert.ok(!new RegExp(`(^|\\n)\\s*${c}\\s*=`).test(deps), `services/hot-executor must not depend on '${c}' — the fee-payer-locked signer is network-free by design (submit/bundle send stays in JS)`);
  }
});

test('submit/bundle SEND stays in the JS control plane (live-executor sends via rpc / jitoSendBundle)', () => {
  const le = read('apps/server/src/engine/live-executor.mjs');
  assert.match(le, /rpc\.rpc\('sendTransaction'/, 'tx send is the JS rpc client');
  assert.match(le, /jitoSendBundle\(/, 'bundle send is the JS jito path');
});

test('the hot-executor client is sign/ping/close only — it never sends a transaction or bundle', () => {
  const client = read('apps/server/src/engine/hot-executor-client.mjs');
  assert.match(client, /return \{ sign, ping, close \}/, 'client surface is sign/ping/close only');
  assert.ok(!/sendTransaction|sendBundle/.test(client), 'the client must not POST sends to the network');
});
