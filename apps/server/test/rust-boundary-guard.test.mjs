// rust-boundary-guard.test.mjs — ADR-0001 Phase Rust-2 (boundary closed at signing) → Rust-3 (REOPENED: Rust
// is the hot-path EXECUTION OWNER) → Rust-4 (Rust owns the submit/bundle request-BODY assembly) → Rust-5
// (Rust understands a whole buy/sell command via `build_execution_plan`: sign all legs + assemble the body in
// one op). The guard's job is to keep the expansion DELIBERATE + the signer NETWORK-FREE: Rust signs +
// assembles execution payloads (sign / sign_bundle / build_submit / build_bundle / build_execution_plan), but
// the actual network POST and the decision-ledger idempotency stay in the JS control plane. The signer must
// not gain a socket without a documented decision (Rust-2's revisit criterion: a measured latency need).
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

test('the hot-executor client signs + assembles (sign/signBundle/buildSubmit/buildBundle/buildExecutionPlan) but never POSTs', () => {
  const client = read('apps/server/src/engine/hot-executor-client.mjs');
  assert.match(client, /return \{ sign, signBundle, buildSubmit, buildBundle, buildExecutionPlan, ping, close \}/, 'client surface includes buildExecutionPlan (Phase Rust-5)');
  // it must hold NO network primitive — it speaks to the signer over stdin/stdout (spawn + readline) ONLY.
  // (Checking for a real socket beats the old method-name-string proxy, which now false-matches the JSDoc.)
  assert.ok(!/\bfetch\s*\(|https?:\/\/|new WebSocket|require\(['"]node:https?['"]\)/.test(client), 'the hot-executor client must not POST to the network (stdin/stdout transport only)');
});

test('Phase Rust-5: the live-executor uses the Rust execution envelope (build_execution_plan); JS persists + posts', () => {
  const le = read('apps/server/src/engine/live-executor.mjs');
  assert.match(le, /hotSigner\.buildExecutionPlan/, 'the buy/sell path builds the execution envelope via Rust when available');
  assert.match(le, /buildEnvelopePlan/, 'the envelope helper exists and is the preferred path (with fallback)');
  // the deterministic signature (signatures[0]) is persisted in JS BEFORE the POST -> reconcilable + idempotent
  assert.match(le, /env\.signatures\[0\]/, 'JS reads the envelope deterministic signature (signatures[0])');
  assert.match(le, /setIntent\(intent_id, 'SENT_PENDING'/, 'JS persists SENT_PENDING before broadcasting');
});

test('Phase Rust-4: the live-executor sources the request body from Rust when available (build_submit/build_bundle), still POSTs in JS', () => {
  const le = read('apps/server/src/engine/live-executor.mjs');
  assert.match(le, /hotSigner\.buildSubmit/, 'the sendTransaction body is assembled by Rust when configured');
  assert.match(le, /hotSigner\.buildBundle/, 'the bundle body is assembled by Rust when configured');
  // the POST still happens in JS, carrying the (optional) Rust-built body to the JS transports
  assert.match(le, /\{ body: submitBody \}/, 'the rpc POST carries the Rust-built submit body when present');
  assert.match(le, /\{ body: bundleBody \}/, 'the jito POST carries the Rust-built bundle body when present');
});