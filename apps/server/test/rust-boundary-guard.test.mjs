// rust-boundary-guard.test.mjs — ADR-0001 Phase Rust-2 (boundary closed at signing) → Phase Rust-3 (boundary
// REOPENED: Rust is now the hot-path EXECUTION OWNER, expanding from signing). The guard's job shifts from
// "signing only" to "keep the expansion DELIBERATE + the signer NETWORK-FREE": Rust signs + assembles
// execution payloads (sign / sign_bundle + the build_submit / build_bundle / select_tip primitives), but the
// actual network POST and the decision-ledger idempotency stay in the JS control plane. The signer must not
// gain a socket without a documented decision (Rust-2's revisit criterion: a measured latency need).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// HTTP / async-runtime crates that would give the signer a socket — forbidden as a direct dependency.
const FORBIDDEN_CRATES = ['reqwest', 'hyper', 'tokio', 'ureq', 'isahc', 'curl', 'surf', 'attohttpc', 'async-std', 'tonic'];

test('Rust hot-executor stays network-free (no HTTP/async crate in Cargo.toml) — execution owner, but the POST is JS', () => {
  const cargo = read('services/hot-executor/Cargo.toml');
  const deps = cargo.slice(cargo.indexOf('[dependencies]')); // deps onward (the crate has no dev-deps)
  for (const c of FORBIDDEN_CRATES) {
    assert.ok(!new RegExp(`(^|\\n)\\s*${c}\\s*=`).test(deps), `services/hot-executor must not depend on '${c}' — the signer is network-free; the actual send stays in the JS control plane until a documented decision changes that`);
  }
});

test('the network POST + idempotency stay in the JS control plane (live-executor sends + owns the intent ledger)', () => {
  const le = read('apps/server/src/engine/live-executor.mjs');
  assert.match(le, /rpc\.rpc\('sendTransaction'/, 'tx send is the JS rpc client');
  assert.match(le, /jitoSendBundle\(/, 'bundle send is the JS jito path');
  assert.match(le, /claimIntent\(/, 'idempotency (intent claim) stays in JS');
});

test('the hot-executor client signs + assembles (sign/signBundle) but never POSTs to the network', () => {
  const client = read('apps/server/src/engine/hot-executor-client.mjs');
  assert.match(client, /return \{ sign, signBundle, ping, close \}/, 'client surface = sign / signBundle / ping / close');
  assert.ok(!/sendTransaction|sendBundle/.test(client), 'the client must not POST sends to the network');
});