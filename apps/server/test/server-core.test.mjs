// server-core.test.mjs — core invariants of the application server:
// vault security, config validation, hard-risk completeness, kill switch fail-safe,
// signer session bounds, API command surface, no-secret-leak guarantees.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// isolate ALL state into a temp dir before importing modules
process.env.SOLTRADE_DATA_DIR = mkdtempSync(join(tmpdir(), 'soltrade-test-'));

const { createVaultService } = await import('../src/vault.mjs');
const { createConfigService, validateConfigPatch, hardRiskComplete, HARD_RISK_FIELDS } = await import('../src/config-service.mjs');
const { createWalletRegistry } = await import('../src/wallet-registry.mjs');
const { createKillSwitch } = await import('../src/kill-switch.mjs');
const { createOperatingState } = await import('../src/operating-state.mjs');
const { createSignerService } = await import('../src/signer-service.mjs');
const { createApi } = await import('../src/api.mjs');
const { appendAudit, readAuditTail } = await import('../src/audit-log.mjs');

function buildStack() {
  const vault = createVaultService();
  const config = createConfigService();
  const wallets = createWalletRegistry();
  const killSwitch = createKillSwitch();
  const operatingState = createOperatingState();
  const signer = createSignerService({ vault, config, killSwitch, audit: appendAudit });
  const api = createApi({ config, wallets, killSwitch, operatingState, vault, signer, audit: appendAudit, broadcast: () => {} });
  return { vault, config, wallets, killSwitch, operatingState, signer, api };
}

const S = buildStack();

// ---------- vault ----------
test('vault: passphrase under 8 chars refused', () => {
  const r = createVaultService().create('1234567');
  assert.equal(r.ok, false);
  assert.equal(r.error, 'passphrase_too_short_min_8');
});

test('vault: full lifecycle — create, set, list masked, lock, wrong unlock fails, right unlock works', () => {
  const r1 = S.vault.create('correct horse battery');
  assert.equal(r1.ok, true);
  const RAW = 'super-secret-helius-key-AAAA1234';
  const r2 = S.vault.setSecret('helius_rpc_url', RAW);
  assert.equal(r2.ok, true);
  assert.equal(r2.ref, 'vault:helius_rpc_url');
  assert.ok(!JSON.stringify(r2).includes(RAW), 'raw secret must not appear in response');
  const list = S.vault.listRefs();
  assert.equal(list.length, 1);
  assert.ok(!JSON.stringify(list).includes(RAW), 'raw secret must not appear in listing');
  S.vault.lock();
  assert.equal(S.vault.isUnlocked(), false);
  assert.equal(S.vault.setSecret('x', 'value-1234').ok, false, 'locked vault refuses writes');
  assert.equal(S.vault.unlock('WRONG PASS').ok, false, 'wrong passphrase refused');
  assert.equal(S.vault.unlock('correct horse battery').ok, true);
  const use = S.vault.getSecretForUse('helius_rpc_url');
  assert.equal(use.ok, true);
  assert.equal(use.value, RAW, 'in-process consumer can decrypt');
});

test('vault: duplicate create refused', () => {
  assert.equal(S.vault.create('another pass 123').error, 'vault_already_exists');
});

// ---------- config ----------
test('config: defaults — hard risk UNSET (null) => real-live config invalid (no implicit infinity)', () => {
  const cfg = S.config.get();
  const hr = hardRiskComplete(cfg);
  assert.equal(hr.complete, false);
  assert.equal(hr.missing_limits.length, HARD_RISK_FIELDS.length);
  assert.equal(cfg.mode, 'paper');
  assert.equal(cfg.copy_defaults.copy_mode, 'follow_entry_user_exit', 'safe default copy mode');
});

test('config: validation rejects Infinity, NaN, unknown fields, bad enums', () => {
  assert.equal(validateConfigPatch({ hard_risk: { max_daily_loss_pct: Infinity } }).validation_status, 'invalid');
  assert.equal(validateConfigPatch({ hard_risk: { max_daily_loss_pct: NaN } }).validation_status, 'invalid');
  assert.equal(validateConfigPatch({ hard_risk: { made_up_field: 5 } }).validation_status, 'invalid');
  assert.equal(validateConfigPatch({ ev: { ev_gate_mode: 'bypass_everything' } }).validation_status, 'invalid');
  assert.equal(validateConfigPatch({ execution: { sizing_mode: 'yolo' } }).validation_status, 'invalid');
  assert.equal(validateConfigPatch({ providers: { rpc_url_ref: 'https://raw-url-not-a-ref' } }).validation_status, 'invalid');
  assert.equal(validateConfigPatch({ providers: { rpc_url_ref: 'vault:helius_rpc_url' } }).validation_status, 'valid');
});

test('config: update persists + bumps config_version; mode is not writable via update', () => {
  const before = S.config.get().config_version;
  const r = S.config.update({ hard_risk: { max_daily_loss_pct: 5 } });
  assert.equal(r.ok, true);
  assert.equal(S.config.get().config_version, before + 1);
  assert.equal(S.config.get().hard_risk.max_daily_loss_pct, 5);
  const r2 = S.config.update({ mode: { x: 1 } });
  assert.equal(r2.ok, false);
});

test('config: completing ALL nine hard-risk fields => hardRiskComplete true', () => {
  const patch = { hard_risk: Object.fromEntries(HARD_RISK_FIELDS.map((f) => [f, f === 'max_open_positions' ? 5 : f === 'max_daily_loss_usdt' ? 100 : 10])) };
  assert.equal(S.config.update(patch).ok, true);
  assert.equal(hardRiskComplete(S.config.get()).complete, true);
});

// ---------- wallets ----------
test('wallets: register validates base58, rejects duplicates, follow defaults OFF', () => {
  const bad = S.wallets.register({ tracked_wallet_address: 'not-an-address' });
  assert.equal(bad.ok, false);
  const ok = S.wallets.register({ tracked_wallet_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', label: 'whale 1' });
  assert.equal(ok.ok, true);
  assert.equal(ok.wallet.follow_enabled, false, 'registered != followed (safe default)');
  const dup = S.wallets.register({ tracked_wallet_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' });
  assert.equal(dup.api_error_code, 'IDEMPOTENCY_CONFLICT');
  const follow = S.wallets.setFollow(ok.wallet.wallet_id, true);
  assert.equal(follow.wallet.follow_enabled, true);
});

// ---------- kill switch ----------
test('kill switch: engage global blocks everything; disengage restores; per-wallet scoped', () => {
  const ks = S.killSwitch;
  assert.equal(ks.isBlocked({}).blocked, false);
  ks.engage({ level: 'global', reason: 'test' });
  assert.equal(ks.isBlocked({}).blocked, true);
  assert.equal(ks.isBlocked({ mode: 'paper' }).level, 'global');
  ks.disengage({ level: 'global' });
  assert.equal(ks.isBlocked({}).blocked, false);
  ks.engage({ level: 'per_wallet', key: 'w_abc', reason: 'test' });
  assert.equal(ks.isBlocked({ wallet_id: 'w_abc' }).blocked, true);
  assert.equal(ks.isBlocked({ wallet_id: 'w_other' }).blocked, false);
  ks.disengage({ level: 'per_wallet', key: 'w_abc' });
});

// ---------- operating state ----------
test('operating state: KILLED can only go to WARMING_UP (human resume through warm-up)', () => {
  const os = S.operatingState;
  os.transition('WARMING_UP', 'test');
  assert.equal(os.transition('ACTIVE', 'ready').ok, true);
  assert.equal(os.transition('KILLED', 'limit hit').ok, true);
  assert.equal(os.transition('ACTIVE', 'jump back').ok, false, 'KILLED -> ACTIVE forbidden');
  assert.equal(os.transition('WARMING_UP', 'human resume').ok, true);
});

// ---------- signer ----------
test('signer: status missing -> degraded/locked -> ready only with session bounds + open session', () => {
  assert.equal(S.signer.status(), 'missing');
  const imp = S.signer.importKey(JSON.stringify(Array.from({ length: 64 }, (_, i) => i)));
  assert.equal(imp.ok, true);
  assert.ok(!JSON.stringify(imp).match(/\[0,1,2/), 'import response must not echo key bytes');
  assert.equal(S.signer.status(), 'degraded', 'bounds not configured => degraded, NOT ready');
  const r = S.signer.openSession();
  assert.equal(r.ok, false, 'cannot open session without bounds');
  S.config.update({ signer_session: { idle_timeout_ms: 600000, max_session_ms: 3600000, max_session_notional_usd: 500, lock_after_n_risk_rejections: 3 } });
  assert.equal(S.signer.openSession().ok, true);
  assert.equal(S.signer.status(), 'ready');
});

test('signer: notional cap + consecutive risk rejections lock the session', () => {
  assert.equal(S.signer.canSignNow({ notional_usd: 100 }).allowed, true);
  S.signer.recordSigned({ notional_usd: 450 });
  assert.equal(S.signer.canSignNow({ notional_usd: 100 }).allowed, false, 'cap 500 reached');
  S.signer.recordRiskRejection();
  S.signer.recordRiskRejection();
  S.signer.recordRiskRejection();
  assert.equal(S.signer.canSignNow({}).allowed, false, 'locked after 3 rejections');
  assert.equal(S.signer.status(), 'locked');
});

test('signer: deriveAddress returns a public base58 address (never the private key)', () => {
  const r = S.signer.deriveAddress();
  assert.equal(r.ok, true);
  assert.match(r.address, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  // publicState exposes the public address but never key material
  const st = S.signer.publicState();
  assert.equal(st.wallet_address, r.address);
  assert.ok(!JSON.stringify(st).match(/"[0-9]+,[0-9]+,[0-9]+/), 'no raw key bytes in public state');
});

test('signer: kill switch locks signer immediately', () => {
  S.signer.openSession();
  assert.equal(S.signer.status(), 'ready');
  S.killSwitch.engage({ level: 'global', reason: 'emergency' });
  assert.equal(S.signer.canSignNow({}).allowed, false);
  assert.equal(S.signer.status(), 'locked');
  S.killSwitch.disengage({ level: 'global' });
});

// ---------- API ----------
test('api: GET /api/status returns composite state, no secrets', async () => {
  const r = await S.api.handle({ method: 'GET', path: '/api/status', body: null });
  assert.equal(r.status, 200);
  assert.ok(r.body.readiness);
  assert.ok(r.body.signer);
  const s = JSON.stringify(r.body);
  assert.ok(!s.includes('super-secret-helius-key'), 'status must not leak secrets');
});

test('api: update_config command works; invalid patch rejected with CONFIG_VALIDATION_FAILED', async () => {
  const ok = await S.api.handle({ method: 'POST', path: '/api/commands', body: { command_type: 'update_config', patch: { copy_defaults: { take_profit_pct: 80 } } } });
  assert.equal(ok.status, 200);
  const bad = await S.api.handle({ method: 'POST', path: '/api/commands', body: { command_type: 'update_config', patch: { hard_risk: { max_daily_loss_pct: Infinity } } } });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.api_error_code, 'CONFIG_VALIDATION_FAILED');
});

test('api: forbidden opportunity commands are NOT part of the command surface', async () => {
  for (const ct of ['buy_opportunity', 'execute_opportunity', 'submit_opportunity', 'exit_all_positions', 'batch_exit_all_positions']) {
    const r = await S.api.handle({ method: 'POST', path: '/api/commands', body: { command_type: ct } });
    assert.equal(r.status, 400, `${ct} must be rejected`);
  }
});

test('api: activate_real_live refuses while ANY readiness blocker remains (honest list, no silent pass)', async () => {
  const r = await S.api.handle({ method: 'POST', path: '/api/commands', body: { command_type: 'activate_real_live', confirm: 'ACTIVATE-REAL-LIVE' } });
  assert.equal(r.status, 409);
  assert.equal(r.body.api_error_code, 'REAL_LIVE_CONFIG_INVALID');
  const blockers = r.body.blockers.map((b) => b.blocker);
  assert.ok(blockers.length > 0, 'must list real blockers');
  assert.ok(blockers.some((b) => ['rpc_provider_not_configured', 'jupiter_key_not_configured', 'signer_not_ready', 'capital_limit_missing_or_invalid'].includes(b)),
    `expected real readiness blockers, got: ${blockers.join(',')}`);
  // and without the typed confirmation it must also refuse even if config were ready
  const r2 = await S.api.handle({ method: 'POST', path: '/api/commands', body: { command_type: 'activate_real_live' } });
  assert.equal(r2.status, 409);
  assert.ok(r2.body.blockers.some((b) => b.blocker === 'explicit_confirmation_required'));
});

test('api: trigger_kill_switch (global) => KILLED + signer locked; resume blocked until disengage', async () => {
  const r = await S.api.handle({ method: 'POST', path: '/api/commands', body: { command_type: 'trigger_kill_switch', reason: 'test emergency' } });
  assert.equal(r.status, 200);
  const st = await S.api.handle({ method: 'GET', path: '/api/status', body: null });
  assert.equal(st.body.operating_state.operating_state, 'KILLED');
  assert.notEqual(st.body.signer.signer_status, 'ready');
  const resume = await S.api.handle({ method: 'POST', path: '/api/commands', body: { command_type: 'resume_system' } });
  assert.equal(resume.status, 409, 'resume refused while kill engaged');
  const dis = await S.api.handle({ method: 'POST', path: '/api/kill-switch/disengage', body: { level: 'global', confirm: 'DISENGAGE' } });
  assert.equal(dis.status, 200);
  const resume2 = await S.api.handle({ method: 'POST', path: '/api/commands', body: { command_type: 'resume_system' } });
  assert.equal(resume2.status, 200);
  assert.equal(resume2.body.state.operating_state, 'WARMING_UP', 'resume goes through WARMING_UP');
});

test('api: kill-switch global disengage requires typed confirmation', async () => {
  await S.api.handle({ method: 'POST', path: '/api/commands', body: { command_type: 'trigger_kill_switch', reason: 'x' } });
  const noConfirm = await S.api.handle({ method: 'POST', path: '/api/kill-switch/disengage', body: { level: 'global' } });
  assert.equal(noConfirm.status, 400);
  await S.api.handle({ method: 'POST', path: '/api/kill-switch/disengage', body: { level: 'global', confirm: 'DISENGAGE' } });
  await S.api.handle({ method: 'POST', path: '/api/commands', body: { command_type: 'resume_system' } });
});

// ---------- audit ----------
test('audit: records exist and secret-bearing keys are scrubbed', () => {
  appendAudit({ audit_scope: 'config', audit_reason: 'test', detail: { api_key: 'RAW-KEY-SHOULD-VANISH', nested: { passphrase: 'p@ss' }, fine: 'visible' } });
  const tail = readAuditTail(5);
  const last = tail[tail.length - 1];
  const s = JSON.stringify(last);
  assert.ok(!s.includes('RAW-KEY-SHOULD-VANISH'));
  assert.ok(!s.includes('p@ss'));
  assert.ok(s.includes('[REDACTED]'));
  assert.ok(s.includes('visible'));
});
