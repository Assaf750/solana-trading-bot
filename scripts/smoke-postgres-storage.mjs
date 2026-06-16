// Postgres storage smoke test (ADR-0001 Phase 4C). Proves STORAGE_BACKEND=postgres works end to end:
// connect -> build backend -> append audit -> claim decision-ledger intent (+ duplicate refused) ->
// create/mark/close position -> read recent/tail. OPT-IN and NOT part of `node --test`: it SKIPS
// (exit 0) unless RUN_POSTGRES_SMOKE=1 or POSTGRES_URL/DATABASE_URL/PGHOST is set. Run migrations first
// (npm run db:postgres:migrate). Lives OUTSIDE packages (root tooling).
import { createStorageBackend, createDecisionLedgerStore, createPositionStore, createAuditStore } from '../apps/server/src/storage/storage-backend.mjs';
import { createDecisionLedger } from '../packages/decision-ledger/src/index.mjs';
import { createPositionsBook } from '../packages/positions/src/index.mjs';

const env = process.env;
const enabled = env.RUN_POSTGRES_SMOKE === '1' || env.POSTGRES_URL || env.DATABASE_URL || env.PGHOST;
if (!enabled) {
  console.log('smoke:postgres — SKIPPED (set RUN_POSTGRES_SMOKE=1 and POSTGRES_URL to run).');
  process.exit(0);
}

const fail = (msg, e) => { console.error(`smoke:postgres — FAIL: ${msg}${e ? `: ${e.message || e}` : ''}`); process.exit(1); };
const stamp = new Date().toISOString();

const backend = await createStorageBackend({ env: { ...env, STORAGE_BACKEND: 'postgres' } }).catch((e) => fail('createStorageBackend', e));
if (!backend || backend.backend !== 'postgres') fail('expected a postgres backend');

// connectivity probe
try { await backend.executor.query('SELECT 1', []); } catch (e) { fail('connection', e); }

// audit (append-only)
const auditStore = await createAuditStore(backend).catch((e) => fail('createAuditStore', e));
const auditId = `smoke_aud_${Date.now()}`;
auditStore.append({ audit_id: auditId, event_timestamp: stamp, audit_actor: 'smoke', audit_scope: 'config', audit_reason: 'smoke_test', command_type: null, detail: { smoke: true } });
await auditStore.flush().catch((e) => fail('audit flush', e));
if (!auditStore.recent(1).length) fail('audit recent empty');

// decision-ledger (idempotency)
const dlStore = await createDecisionLedgerStore(backend).catch((e) => fail('createDecisionLedgerStore', e));
const dl = createDecisionLedger({ store: dlStore, now: () => new Date().toISOString(), intentIdFor: (p) => `smoke_${p.join('_')}` });
const intentId = `smoke_intent_${Date.now()}`;
if (!dl.claimIntent(intentId, { side: 'buy', smoke: true }).ok) fail('claimIntent');
if (dl.claimIntent(intentId, {}).ok) fail('duplicate intent must be refused');
await dlStore.flush().catch((e) => fail('decision-ledger flush', e));

// positions (create -> mark -> close)
const posStore = await createPositionStore(backend, { file: 'smoke-portfolio.json', simulated: true }).catch((e) => fail('createPositionStore', e));
let n = 0;
const book = createPositionsBook({ store: posStore, newId: (p) => `smoke_${p}_${(n += 1)}_${Date.now()}`, nowIso: () => new Date().toISOString(), simulated: true });
const pos = book.recordEntry({ leader_address: 'smokeL', wallet_id: 'w', token_mint: 'SMOKE', qty_ui: 1, decimals: 6, cost_usd: 1, fee_usd_est: 0, price_impact_pct: 0, copy_mode: 'follow_entry_user_exit', tp_pct: null, sl_pct: null });
book.setMark(pos.position_id, 2, 'valid');
const exit = book.recordExit({ position_id: pos.position_id, fraction: 1, proceeds_usd: 2, fee_usd_est: 0, reason: 'smoke_close' });
if (!exit.ok || !exit.closed) fail('position close');
await posStore.flush().catch((e) => fail('positions flush', e));

// best-effort cleanup of the smoke namespace (audit_events is append-only by design — left in place)
try {
  await backend.executor.execute("DELETE FROM decision_ledger_intents WHERE intent_id LIKE 'smoke_%'", []);
  await backend.executor.execute("DELETE FROM decision_ledger_traces WHERE intent_id LIKE 'smoke_%'", []);
  await backend.executor.execute("DELETE FROM positions_state WHERE book = 'smoke-portfolio'", []);
  await backend.executor.execute("DELETE FROM positions_book_meta WHERE book = 'smoke-portfolio'", []);
} catch (e) { console.warn(`smoke:postgres — cleanup warning: ${e?.message || e}`); }

await backend.client?.end?.();
console.log('smoke:postgres — OK: connection + audit + decision-ledger + positions verified against Postgres.');
process.exit(0);
