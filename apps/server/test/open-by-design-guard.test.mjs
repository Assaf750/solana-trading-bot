// open-by-design-guard.test.mjs — ADR-0001 Phase 9A. Regression guards for the open-by-design rule
// (Phase 8A-R): the lock/gate/hard-stop vocabulary must never return to the runtime-readiness API
// response or the operator-UI surfaces, and Paper must never be reframed as a readiness/execution-test
// tool. Precise, high-signal patterns only (vault "locked/unlocked" is legitimate state, NOT a readiness
// gate, so it is intentionally NOT matched).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PAGES = join(ROOT, 'apps', 'operator-ui', 'src', 'pages');

// banned readiness/activation framing — specific phrases + field names (not bare locked/blocked, which
// are legitimate vault/kill-switch state elsewhere).
const BANNED_READINESS = /live_send_enabled|live send\s*:?\s*off|structurally disabled|activation[_ ]required|owner-only|hard[_ ]stop/i;
// Paper must not be presented as a readiness / live-execution test surface.
const BANNED_PAPER = /paper\s+readiness|paper\s+execution\s+test|paper\s+as\s+(a\s+)?live|paper[^.\n]{0,24}readiness tool/i;

// ---------- API: runtime-readiness response must stay clean ----------
test('runtime-readiness response carries no lock/gate/hard-stop vocabulary', async () => {
  process.env.SOLTRADE_DATA_DIR = mkdtempSync(join(tmpdir(), 'soltrade-obg-'));
  const { createVaultService } = await import('../src/vault.mjs');
  const { createConfigService } = await import('../src/config-service.mjs');
  const { createWalletRegistry } = await import('../src/wallet-registry.mjs');
  const { createKillSwitch } = await import('../src/kill-switch.mjs');
  const { createOperatingState } = await import('../src/operating-state.mjs');
  const { createSignerService } = await import('../src/signer-service.mjs');
  const { createApi } = await import('../src/api.mjs');
  const { appendAudit } = await import('../src/audit-log.mjs');
  const vault = createVaultService();
  const config = createConfigService();
  const killSwitch = createKillSwitch();
  const api = createApi({
    config, wallets: createWalletRegistry(), killSwitch, operatingState: createOperatingState(), vault,
    signer: createSignerService({ vault, config, killSwitch, audit: appendAudit }),
    audit: appendAudit, broadcast: () => {}, providerHealth: { snapshot: () => ({}) },
  });
  const r = await api.handle({ method: 'GET', path: '/api/runtime/readiness', body: null });
  const blob = JSON.stringify(r.body);
  assert.ok(!BANNED_READINESS.test(blob), `banned readiness vocabulary in response: ${blob}`);
  assert.equal('activation' in r.body, false);
  assert.equal('blockers' in r.body, false);
});

// ---------- UI: operator-ui pages must not carry the banned framing ----------
test('operator-ui pages carry no banned readiness/activation wording', () => {
  const offenders = [];
  for (const f of readdirSync(PAGES).filter((x) => x.endsWith('.jsx'))) {
    const src = readFileSync(join(PAGES, f), 'utf8');
    if (BANNED_READINESS.test(src)) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `banned readiness wording in UI pages: ${offenders.join(', ')}`);
});

// ---------- Paper must not be reframed as a readiness / execution-test tool ----------
test('no "Paper as readiness / Paper execution test" wording in UI pages or key docs', () => {
  const targets = [
    ...readdirSync(PAGES).filter((x) => x.endsWith('.jsx')).map((f) => join(PAGES, f)),
    join(ROOT, 'docs', 'ADR-0001-live-first-runtime-unification.md'),
    join(ROOT, 'docs', 'architecture', 'legacy-audit.md'),
  ];
  const offenders = targets.filter((p) => existsSync(p) && BANNED_PAPER.test(readFileSync(p, 'utf8')));
  assert.deepEqual(offenders, [], `Paper-as-readiness wording found in: ${offenders.join(', ')}`);
});

// ---------- the audit document exists ----------
test('legacy audit document exists (Phase 9A deliverable)', () => {
  assert.ok(existsSync(join(ROOT, 'docs', 'architecture', 'legacy-audit.md')));
});
