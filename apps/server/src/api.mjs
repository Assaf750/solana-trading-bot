// api.mjs — HTTP contract. Pure handler ({method,path,body}) -> {status,body} for testability.
// Trading/config commands go through POST /api/commands with SSOT command_type names.
// Vault/session endpoints are local ops surfaces (auth-like), not trading commands.
// RULE: no response ever contains a raw secret — refs + masked previews only.
import { computeReadiness } from './readiness.mjs';
import { deriveRunMode, runModesCatalog } from './engine/run-modes.mjs';
import { assessRisk } from './engine/risk-center.mjs';
import { runScenario, listScenarios } from './engine/strategy-sim.mjs';
import { mapProviderEventToRecord } from '../../../packages/storage/src/index.mjs';

// ADR-0001 Phase 5B: map a DiagnosticRun readiness (valid/warning/invalid) to an operator-facing
// summary. `safe_to_run_live` is ADVISORY ONLY — it never arms or activates live trading; it merely
// reports whether the pre-flight checks all passed.
function diagSummary(readiness) {
  const overall = readiness === 'valid' ? 'pass' : readiness === 'warning' ? 'warn' : 'fail';
  return { overall, safe_to_run_live: readiness === 'valid' };
}

// ADR-0001 Phase 5C: every diagnostics response declares these guarantees explicitly, so any caller
// (UI or legacy action routed here) carries the same contract: a diagnostic NEVER sends a
// transaction, opens a position, or claims an execution intent. These are structural facts about the
// DiagnosticExecutionAdapter (it accepts only read providers), surfaced for the operator.
const DIAG_SAFETY = Object.freeze({ diagnostic_only: true, no_transaction_sent: true, no_position_opened: true, no_intent_claimed: true });

export function createApi({ config, wallets, killSwitch, operatingState, vault, signer, audit, broadcast, paperEngine, portfolio, livePortfolio, liveExecutor, rpc, analyzeWallet, analyzeToken, discoverTraders, discoverFromLeaders, tokenMeta, notifier, history, providerHealth, diagnostics = null, hotState = null, eventSink = null, runtimeProbes = null, analytics = null }) {
  // ADR-0001 Phase 6B: optional hot-state cache for provider-health + readiness ONLY. Hot-state is
  // never SoT; every access is FAIL-OPEN — a Redis error degrades to a cache-miss and NEVER changes
  // provider status, readiness, or any trading decision. cacheOp swallows errors and reports degraded.
  const HOT_CACHE_TTL = { providerHealth: 10_000, readiness: 15_000, idempotency: 120_000 };
  const cacheOp = async (fn) => { try { return { ok: true, value: await fn() }; } catch { return { ok: false, value: null }; } };

  // ADR-0001 Phase 7B: optional append-only analytics events for NON-CRITICAL surfaces only
  // (diagnostics + provider-health). Strictly BEST-EFFORT and FAIL-OPEN: a ClickHouse error is
  // swallowed and NEVER changes a response, status, or trading decision. Payloads are curated summaries
  // — never secrets / raw tx / keys / auth headers (diagnostics never touch signing material anyway).
  const eventEnabled = !!(eventSink && eventSink.backend && eventSink.backend !== 'none' && eventSink.writer);
  async function recordEvent(kind, fields = {}) {
    if (!eventEnabled) return false;
    try {
      const r = await eventSink.writer.writeEvent(mapProviderEventToRecord({ kind, at: fields.at || new Date().toISOString(), ...fields }));
      return !!(r && r.ok);
    } catch { return false; } // never let analytics throw into the request path
  }
  const _eventThrottle = new Map(); // event_type -> last-write ms; keeps polled GETs from spamming the sink
  const eventThrottleOk = (key, minMs = 10_000) => { const now = Date.now(); if (now - (_eventThrottle.get(key) || 0) < minMs) return false; _eventThrottle.set(key, now); return true; };
  const providerStatuses = (snap) => Object.fromEntries(Object.entries(snap || {}).map(([k, v]) => [k, (v && v.status) || 'unknown']));
  const remember = (entry) => { try { history?.record(entry); } catch { /* history is best-effort */ } };
  const emit = typeof broadcast === 'function' ? broadcast : () => {};
  const notify = (kind, text) => { try { notifier?.notify({ kind, text }); } catch { /* best-effort */ } };
  // Single-flight for the heavy on-chain scans: only one runs at a time so re-clicks can't
  // stack and compound RPC pressure on the shared client the live trading engine also uses.
  let discoveryBusy = false;
  let tokenAnalysisBusy = false;

  async function runTokenAnalysis(mint) {
    if (!vault.isUnlocked()) return { status: 409, body: { ok: false, error: 'vault_locked' } };
    if (typeof analyzeToken !== 'function') return { status: 503, body: { ok: false, error: 'analyzer_unavailable' } };
    if (typeof mint !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return { status: 400, body: { ok: false, error: 'invalid_mint' } };
    if (tokenAnalysisBusy) return { status: 429, body: { ok: false, error: 'analysis_in_progress' } };
    tokenAnalysisBusy = true;
    try {
      const r = await analyzeToken({ mint });
      if (r.ok) remember({ type: 'token_analysis', mint, symbol: r.token_identity?.symbol || null, verdict: r.final_verdict, risk_score: r.risk_score });
      return { status: r.ok ? 200 : 400, body: r };
    } finally { tokenAnalysisBusy = false; }
  }

  function readiness() {
    return computeReadiness({ config, vault, killSwitch, signerStatus: signer.status() });
  }

  function statusPayload() {
    const cfg = config.get();
    const payload = {
      operating_state: operatingState.get(),
      mode: cfg.mode,
      config_version: cfg.config_version,
      readiness: readiness(),
      vault: vault.status(),
      signer: signer.publicState(),
      kill_switch: killSwitch.status(),
      engine: {
        ...(paperEngine ? paperEngine.status() : { paper_engine: 'not_started' }),
        live_engine: !liveExecutor ? 'not_built'
          : cfg.mode === 'real_live' ? 'armed_real_money'
          : 'ready_gated_by_owner_activation',
      },
    };
    payload.providers = providerHealth ? providerHealth.snapshot() : {}; // live external-provider health
    payload.run_mode = deriveRunMode(payload); // operator-facing mode (read_only/paper/live_armed/live_active)
    return payload;
  }

  const commands = {
    update_config({ patch }) {
      const res = config.update(patch);
      if (res.ok) {
        audit({ audit_scope: 'config', audit_reason: 'config_updated', command_type: 'update_config', detail: { patch } });
        emit({ event_type: 'config_update', config_version: res.config_version });
      }
      return { status: res.ok ? 200 : 400, body: res };
    },
    preview_config_update({ patch }) {
      // preview = validate without saving
      return importValidate(patch);
    },
    register_wallet(p) {
      const res = wallets.register(p || {});
      if (res.ok) {
        audit({ audit_scope: 'wallet', audit_reason: 'wallet_registered', command_type: 'register_wallet', detail: { address: p.tracked_wallet_address } });
        emit({ event_type: 'config_update', wallets_changed: true });
      }
      return { status: res.ok ? 200 : 400, body: res };
    },
    update_wallet_config(p) {
      const res = wallets.updateConfig(p?.wallet_id, p?.patch);
      if (res.ok) audit({ audit_scope: 'wallet', audit_reason: 'wallet_config_updated', command_type: 'update_wallet_config', detail: p });
      return { status: res.ok ? 200 : res.api_error_code === 'RESOURCE_NOT_FOUND' ? 404 : 400, body: res };
    },
    enable_wallet_follow(p) {
      const res = wallets.setFollow(p?.wallet_id, true);
      if (res.ok) audit({ audit_scope: 'wallet', audit_reason: 'follow_enabled', command_type: 'enable_wallet_follow', detail: p });
      return { status: res.ok ? 200 : 404, body: res };
    },
    disable_wallet_follow(p) {
      const res = wallets.setFollow(p?.wallet_id, false);
      if (res.ok) audit({ audit_scope: 'wallet', audit_reason: 'follow_disabled', command_type: 'disable_wallet_follow', detail: p });
      return { status: res.ok ? 200 : 404, body: res };
    },
    pause_system() {
      const res = operatingState.transition('PAUSED', 'pause_system command');
      if (res.ok) {
        audit({ audit_scope: 'config', audit_reason: 'system_paused', command_type: 'pause_system', detail: {} });
        emit({ event_type: 'health_update', operating_state: res.state });
      }
      return { status: res.ok ? 200 : 409, body: res };
    },
    resume_system() {
      // resume goes through WARMING_UP (caches/health not guaranteed after pause/kill)
      const cur = operatingState.get().operating_state;
      if (cur === 'KILLED') {
        const kill = killSwitch.isBlocked({});
        if (kill.blocked) {
          return {
            status: 409,
            body: { ok: false, api_error_code: 'COMMAND_NOT_ALLOWED_IN_STATE', error: 'disengage_kill_switch_first' },
          };
        }
      }
      const res = operatingState.transition('WARMING_UP', 'resume_system command');
      if (res.ok) {
        audit({ audit_scope: 'config', audit_reason: 'system_resumed_via_warming_up', command_type: 'resume_system', detail: {} });
        emit({ event_type: 'health_update', operating_state: res.state });
      }
      return { status: res.ok ? 200 : 409, body: res };
    },
    trigger_kill_switch(p) {
      const res = killSwitch.engage({ level: p?.level || 'global', key: p?.key || null, reason: p?.reason || 'manual' });
      if (res.ok) {
        signer.lockSession('kill_switch'); // global kill locks the signer immediately
        if ((p?.level || 'global') === 'global') operatingState.transition('KILLED', `kill switch: ${p?.reason || 'manual'}`);
        audit({ audit_scope: 'config', audit_reason: `kill_engaged_${p?.level || 'global'}`, command_type: 'trigger_kill_switch', detail: p || {} });
        emit({ event_type: 'health_update', kill_switch: res.state, operating_state: operatingState.get() });
        notify('kill_engaged', `🛑 KILL SWITCH engaged (${p?.level || 'global'}) — all trading halted. Reason: ${p?.reason || 'manual'}`);
      }
      return { status: res.ok ? 200 : 400, body: res };
    },
    close_position(p) {
      // operator-initiated full exit of one position (manual liquidation / clear a stuck position)
      if (!paperEngine || typeof paperEngine.closePosition !== 'function') {
        return { status: 503, body: { ok: false, error: 'engine_unavailable' } };
      }
      return paperEngine.closePosition(p?.position_id).then((res) => {
        if (res.ok) audit({ audit_scope: 'position', audit_reason: 'manual_close', command_type: 'close_position', detail: { position_id: p?.position_id } });
        return { status: res.ok ? 200 : res.error === 'position_not_found' ? 404 : 400, body: res };
      });
    },
    resolve_position(p) {
      // operator books the REAL proceeds (read off an explorer) of a position whose on-chain exit
      // confirmed but whose proceeds couldn't be auto-read (needs_reconciliation): closes it,
      // clears the flag, records realized P&L. This is the only path that retires a flagged position.
      if (!paperEngine || typeof paperEngine.resolvePosition !== 'function') {
        return { status: 503, body: { ok: false, error: 'engine_unavailable' } };
      }
      const proceeds = Number(p?.proceeds_usd);
      if (!Number.isFinite(proceeds) || proceeds < 0) {
        return { status: 400, body: { ok: false, error: 'invalid_proceeds_usd' } };
      }
      const res = paperEngine.resolvePosition(p?.position_id, proceeds);
      const notFound = res.error === 'position_not_found' || res.error === 'position_not_open';
      return { status: res.ok ? 200 : notFound ? 404 : 400, body: res };
    },
    manual_buy(p) {
      // operator buys an arbitrary mint directly (not a copy). Same gates as a copy entry.
      if (!paperEngine || typeof paperEngine.manualBuy !== 'function') return { status: 503, body: { ok: false, error: 'engine_unavailable' } };
      return paperEngine.manualBuy({ mint: p?.mint, sizeUsd: Number(p?.size_usd) }).then((res) => {
        if (res.ok) audit({ audit_scope: 'position', audit_reason: 'manual_buy', command_type: 'manual_buy', detail: { mint: p?.mint, size_usd: p?.size_usd } });
        return { status: res.ok ? 200 : 400, body: res };
      });
    },
    manual_sell(p) {
      // operator sells a fraction (default full) of an open position, independent of TP/SL/leader.
      if (!paperEngine || typeof paperEngine.manualSell !== 'function') return { status: 503, body: { ok: false, error: 'engine_unavailable' } };
      return paperEngine.manualSell({ position_id: p?.position_id, fraction: p?.fraction }).then((res) => {
        if (res.ok) audit({ audit_scope: 'position', audit_reason: 'manual_sell', command_type: 'manual_sell', detail: { position_id: p?.position_id, fraction: p?.fraction } });
        return { status: res.ok ? 200 : res.error === 'position_not_found' ? 404 : 400, body: res };
      });
    },
    add_order(p) {
      // create a limit-buy or DCA order (fired later by the engine through the gated buy path)
      if (!paperEngine || typeof paperEngine.addOrder !== 'function') return { status: 503, body: { ok: false, error: 'engine_unavailable' } };
      return paperEngine.addOrder(p || {}).then((res) => {
        if (res.ok) audit({ audit_scope: 'position', audit_reason: 'order_created', command_type: 'add_order', detail: { type: p?.type, mint: p?.mint } });
        return { status: res.ok ? 200 : 400, body: res };
      });
    },
    cancel_order(p) {
      if (!paperEngine || typeof paperEngine.cancelOrder !== 'function') return { status: 503, body: { ok: false, error: 'engine_unavailable' } };
      const res = paperEngine.cancelOrder(p?.order_id);
      if (res.ok) audit({ audit_scope: 'position', audit_reason: 'order_cancelled', command_type: 'cancel_order', detail: { order_id: p?.order_id } });
      return { status: res.ok ? 200 : res.error === 'order_not_found' ? 404 : 400, body: res };
    },
    activate_real_live(p) {
      // THE OWNER'S SWITCH. Every readiness blocker must be gone AND the owner must
      // type the exact confirmation. Anything missing => refusal with the honest list.
      const r = readiness();
      const blockers = [...r.blockers];
      if (p?.confirm !== 'ACTIVATE-REAL-LIVE') {
        blockers.push({ blocker: 'explicit_confirmation_required', expected: 'confirm: ACTIVATE-REAL-LIVE' });
      }
      if (blockers.length > 0) {
        audit({ audit_scope: 'config', audit_reason: 'real_live_activation_refused', command_type: 'activate_real_live', detail: { blockers } });
        return { status: 409, body: { ok: false, api_error_code: 'REAL_LIVE_CONFIG_INVALID', blockers, readiness: r } };
      }
      const v = config._internal.setMode('real_live');
      audit({ audit_scope: 'config', audit_reason: 'REAL_LIVE_ACTIVATED_BY_OWNER', command_type: 'activate_real_live', detail: { config_version: v } });
      emit({ event_type: 'config_update', mode: 'real_live' });
      notify('real_live_activated', '🔴 REAL-LIVE ACTIVATED — real money is now at risk.');
      return { status: 200, body: { ok: true, mode: 'real_live', config_version: v, warning: 'REAL MONEY IS NOW AT RISK. The kill switch on the Alerts page stops everything instantly.' } };
    },
  };

  function importValidate(patch) {
    // local import to avoid circulars at module load
    return import('./config-service.mjs').then(({ validateConfigPatch }) => {
      const res = validateConfigPatch(patch);
      return { status: res.validation_status === 'valid' ? 200 : 400, body: { ok: res.validation_status === 'valid', ...res } };
    });
  }

  async function handle({ method, path, body }) {
    try {
      // ---------- GET resources ----------
      if (method === 'GET') {
        if (path === '/api/status') return { status: 200, body: statusPayload() };
        if (path === '/api/config') return { status: 200, body: config.get() };
        if (path === '/api/readiness') return { status: 200, body: readiness() };
        if (path === '/api/runtime/readiness') {
          // ADR-0001 Phase 8A-R: structured, READ-ONLY runtime status. OPEN-BY-DESIGN — this endpoint is
          // MONITORING, not enforcement: it reports capability status (available / not_configured /
          // degraded / unavailable), never imposes a lock/gate/hard-stop. A capability is `available`
          // once its config + dependencies are present; missing setup reads as `not_configured`; a failed
          // dependency reads as `degraded`/`unavailable`. cache (Redis) / analytics (ClickHouse) outages
          // never affect other capabilities. Nothing here opens live or mutates state.
          const status = statusPayload();
          const rd = readiness();
          const safeProbe = async (fn, fallback) => { if (typeof fn !== 'function') return fallback; try { return (await fn()) || fallback; } catch { return { ...fallback, status: 'degraded' }; } };
          const CAP = (s) => ({ ok: 'available', fail: 'unavailable', disabled: 'not_configured' }[s]
            || (['available', 'unavailable', 'degraded', 'not_configured'].includes(s) ? s : 'available'));
          const sp = await safeProbe(runtimeProbes && runtimeProbes.storage, { backend: 'json', status: 'ok' });
          const hp = await safeProbe(runtimeProbes && runtimeProbes.hotState, { backend: 'memory', status: 'ok' });
          const ep = await safeProbe(runtimeProbes && runtimeProbes.eventSink, { backend: 'none', status: 'disabled' });
          const storage = { backend: sp.backend, status: CAP(sp.status) };
          const hot_state = { backend: hp.backend, status: CAP(hp.status) };
          const event_sink = { backend: ep.backend, status: CAP(ep.status) };
          const provCap = (s) => ({ healthy: 'available', degraded: 'degraded', down: 'unavailable' }[s] || 'available');
          const providers = Object.fromEntries(Object.entries(providerStatuses(status.providers)).map(([k, v]) => [k, provCap(v)]));

          // live execution as a CAPABILITY (open-by-design). requirements come from the honest readiness
          // checks; `missing_config` is the not-yet-configured subset; it becomes available once met.
          const reqBlockers = (rd.blockers || []).filter((b) => b.blocker !== 'kill_switch_engaged');
          const missing_config = reqBlockers.map((b) => b.blocker);
          const requirements = ['hard_risk_limits', 'capital_limit', 'rpc_provider', 'signer_session_bounds', 'signer_ready'];
          const killEngaged = (rd.blockers || []).some((b) => b.blocker === 'kill_switch_engaged');
          let liveStatus;
          if (missing_config.length) liveStatus = 'not_configured';
          else if (killEngaged || storage.status === 'unavailable' || providers.rpc === 'unavailable') liveStatus = 'unavailable';
          else if (hot_state.status === 'degraded' || event_sink.status === 'degraded' || Object.values(providers).includes('degraded')) liveStatus = 'degraded';
          else liveStatus = 'available';
          const live_execution = { status: liveStatus, requirements, missing_config, can_execute_when_configured: true };

          // signer capability — no locked/unlocked terminology; can_sign is a factual capability check
          const sg = status.signer || {};
          const signer = { status: sg.key_imported ? 'available' : 'not_configured', can_sign: !!(sg.key_imported && sg.vault_unlocked && sg.session_active) };

          const degradedAny = [storage.status, hot_state.status, event_sink.status].includes('degraded') || Object.values(providers).includes('degraded');
          const unavailableCore = storage.status === 'unavailable' || live_execution.status === 'unavailable';
          const overall = unavailableCore ? 'unavailable' : degradedAny ? 'degraded' : live_execution.status === 'not_configured' ? 'not_configured' : 'ready';

          const unavailable_dependencies = [];
          if (storage.status === 'unavailable') unavailable_dependencies.push('storage');
          if (hot_state.status === 'degraded') unavailable_dependencies.push('hot_state');
          if (event_sink.status === 'degraded') unavailable_dependencies.push('event_sink');
          for (const [k, v] of Object.entries(providers)) if (v === 'unavailable' || v === 'degraded') unavailable_dependencies.push(`provider:${k}`);

          return { status: 200, body: {
            overall,
            mode: status.mode || null,
            run_mode: status.run_mode || null,
            operating_state: status.operating_state?.operating_state || null,
            capability_status: { storage: storage.status, hot_state: hot_state.status, event_sink: event_sink.status, signer: signer.status, live_execution: live_execution.status },
            storage, hot_state, event_sink, providers, signer,
            diagnostics: { backend: diagnostics ? 'package' : 'legacy', status: diagnostics ? 'available' : 'not_configured' },
            live_execution,
            unavailable_dependencies,
            read_only: true,                    // monitoring only — this endpoint never executes, mutates, or gates
            checked_at: new Date().toISOString(),
          } };
        }
        if (path === '/api/modes') return { status: 200, body: runModesCatalog(statusPayload()) };
        if (path === '/api/risk') return { status: 200, body: assessRisk({ status: statusPayload(), config: config.get(), portfolioSummary: portfolio ? portfolio.summary() : {} }) };
        if (path === '/api/providers/health') {
          // Live in-process monitor is authoritative + cheap; the hot-state cache is write-through and
          // (only on a cold/empty monitor) a fallback. A Redis error NEVER changes the reported status.
          const live = providerHealth ? providerHealth.snapshot() : {};
          let providers = live;
          const hot_state_cache = { enabled: !!hotState, hit: false, degraded: false };
          if (hotState) {
            if (Object.keys(live).length > 0) {
              const w = await cacheOp(() => hotState.setProviderHealth(live, HOT_CACHE_TTL.providerHealth));
              hot_state_cache.degraded = !w.ok;
            } else {
              const r = await cacheOp(() => hotState.getProviderHealth()); // cold start: serve last cached
              hot_state_cache.degraded = !r.ok;
              if (r.ok && r.value && typeof r.value === 'object') { providers = r.value; hot_state_cache.hit = true; }
            }
          }
          // best-effort analytics (throttled — this route is polled). Compact, no secrets.
          let event_written = false;
          if (eventEnabled && eventThrottleOk('provider.health')) {
            event_written = await recordEvent('provider.health', { providers: providerStatuses(providers), degraded: hot_state_cache.degraded });
          }
          return { status: 200, body: { providers, hot_state_cache, event_sink: { enabled: eventEnabled, written: event_written } } };
        }
        // ADR-0001 Phase 5B/6B: read-only live-readiness rollup (connectivity + provider health). The
        // readiness is always computed LIVE; the hot-state cache is written best-effort and the prior
        // cached snapshot is returned as `cached_readiness` (ADVISORY ONLY — never an activation decision).
        if (diagnostics && path === '/api/diagnostics/status') {
          const r = await diagnostics.runLiveReadinessDiagnostic();
          const summary = diagSummary(r.readiness);
          const hot_state_cache = { enabled: !!hotState, hit: false, degraded: false };
          let cached_readiness = null;
          if (hotState) {
            const prev = await cacheOp(() => hotState.getReadiness());
            if (!prev.ok) hot_state_cache.degraded = true;
            else if (prev.value) { cached_readiness = prev.value; hot_state_cache.hit = true; }
            const w = await cacheOp(() => hotState.setReadiness({ ...summary, readiness: r.readiness, checked_at: r.checked_at }, HOT_CACHE_TTL.readiness));
            if (!w.ok) hot_state_cache.degraded = true;
          }
          let event_written = false;
          if (eventEnabled && eventThrottleOk('diagnostic.status')) { // throttled — status is polled
            event_written = await recordEvent('diagnostic.status', { at: r.checked_at, readiness: r.readiness, overall: summary.overall, blockers: r.blockers });
          }
          return { status: 200, body: { ok: true, ...summary, readiness: r.readiness, blockers: r.blockers, checks: r.checks, checked_at: r.checked_at, safety: DIAG_SAFETY, hot_state_cache, cached_readiness, event_sink: { enabled: eventEnabled, written: event_written } } };
        }
        if (path.startsWith('/api/analytics/summary')) {
          // ADR-0001 Phase 7C: OPTIONAL read-only operator insights from ClickHouse analytics_events.
          // Always 200 — status carries available|not_configured|unavailable|degraded; never affects
          // readiness/trading; never SoT. not_configured when EVENT_SINK_BACKEND != clickhouse.
          if (!analytics || typeof analytics.summary !== 'function') return { status: 200, body: { status: 'not_configured' } };
          const qs = new URLSearchParams(path.split('?')[1] || '');
          const windowHours = Number(qs.get('hours')) || 24;
          return { status: 200, body: await analytics.summary({ windowHours }) };
        }
        if (path.startsWith('/api/history')) {
          const qs = new URLSearchParams(path.split('?')[1] || '');
          const limit = Number(qs.get('limit')) || 50;
          const type = qs.get('type') || null;
          return { status: 200, body: { events: history ? history.list({ limit, type }) : [], counts: history ? history.counts() : { total: 0, by_type: {} } } };
        }
        if (path === '/api/wallets') return { status: 200, body: { wallets: wallets.list() } };
        if (path === '/api/secrets') return { status: 200, body: { secrets: vault.listRefs() } };
        if (path.startsWith('/api/audit')) {
          const limit = Math.min(500, Number(new URLSearchParams(path.split('?')[1] || '').get('limit')) || 100);
          const { readAuditTail } = await import('./audit-log.mjs');
          return { status: 200, body: { audit: readAuditTail(limit) } };
        }
        if (path === '/api/positions') {
          const s = portfolio ? portfolio.state() : { positions: [] };
          return { status: 200, body: { simulated: true, positions: s.positions, summary: portfolio ? portfolio.summary() : null } };
        }
        if (path === '/api/trades') {
          const s = portfolio ? portfolio.state() : { trades: [] };
          return { status: 200, body: { simulated: true, trades: (s.trades || []).slice(-200) } };
        }
        if (path === '/api/engine-events') {
          return { status: 200, body: { events: paperEngine ? paperEngine.events(80) : [] } };
        }
        if (path === '/api/live-positions') {
          const s = livePortfolio ? livePortfolio.state() : { positions: [], trades: [] };
          return { status: 200, body: { simulated: false, positions: s.positions, trades: (s.trades || []).slice(-100), summary: livePortfolio ? livePortfolio.summary() : null } };
        }
        if (path === '/api/intents') {
          return { status: 200, body: { intents: liveExecutor ? liveExecutor.intents(80) : [] } };
        }
        if (path === '/api/latency') {
          // Phase 0 gate: pipeline-lag percentiles (decides the gRPC/Rust investment)
          return { status: 200, body: paperEngine && typeof paperEngine.latencyReport === 'function' ? paperEngine.latencyReport() : { count: 0, metrics: {} } };
        }
        if (path === '/api/leader-insights') {
          // per-leader realized performance (this bot's book) + follow/drop/watch recommendation
          return { status: 200, body: paperEngine && typeof paperEngine.leaderInsights === 'function' ? paperEngine.leaderInsights() : { leaders: [], recommendation: { follow: [], drop: [], watch: [] } } };
        }
        if (path.startsWith('/api/export/')) {
          // PnL/tax CSV export. Returns {filename, csv} (server only emits JSON); the UI downloads it.
          const which = path.split('?')[0].slice('/api/export/'.length);
          const qs = new URLSearchParams(path.split('?')[1] || '');
          const book = qs.get('book') === 'live' ? livePortfolio : portfolio;
          const state = book ? book.state() : { positions: [], trades: [] };
          const { positionsCsv, tradesCsv } = await import('./engine/export-csv.mjs');
          const stamp = new Date().toISOString().slice(0, 10);
          const tag = qs.get('book') === 'live' ? 'live' : 'paper';
          if (which === 'positions') return { status: 200, body: { filename: `soltrade-positions-${tag}-${stamp}.csv`, csv: positionsCsv(state) } };
          if (which === 'trades') return { status: 200, body: { filename: `soltrade-trades-${tag}-${stamp}.csv`, csv: tradesCsv(state) } };
          return { status: 404, body: { ok: false, api_error_code: 'RESOURCE_NOT_FOUND' } };
        }
        if (path === '/api/orders') {
          return { status: 200, body: { orders: paperEngine && typeof paperEngine.listOrders === 'function' ? paperEngine.listOrders() : [] } };
        }
        if (path.startsWith('/api/tokens/') && path.endsWith('/analysis')) {
          // full on-chain token report (identity, market, liquidity, holders, authorities,
          // Token-2022, route, smart-money, risk/opportunity/copyability, verdict). Vault-gated.
          const mint = decodeURIComponent(path.slice('/api/tokens/'.length, -'/analysis'.length));
          return runTokenAnalysis(mint);
        }
        if (path.startsWith('/api/strategy/scenarios')) {
          // PURE catalog of hypothetical preview scenarios. No vault/secret needed.
          return { status: 200, body: { scenarios: listScenarios() } };
        }
        if (path.startsWith('/api/token-meta')) {
          // DISPLAY-ONLY mint -> {symbol,name,icon}. No vault/secret needed; degrades to {}.
          if (typeof tokenMeta?.resolve !== 'function') return { status: 200, body: { tokens: {} } };
          const qs = new URLSearchParams(path.split('?')[1] || '');
          const mints = (qs.get('mints') || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100);
          const tokens = await tokenMeta.resolve(mints);
          return { status: 200, body: { tokens } };
        }
        return { status: 404, body: { ok: false, api_error_code: 'RESOURCE_NOT_FOUND' } };
      }

      // ---------- POST ops ----------
      if (method === 'POST') {
        if (path === '/api/commands') {
          const ct = body?.command_type;
          if (!ct || !Object.prototype.hasOwnProperty.call(commands, ct) || typeof commands[ct] !== 'function') {
            return { status: 400, body: { ok: false, api_error_code: 'COMMAND_NOT_ALLOWED_IN_STATE', error: 'unknown_or_unsupported_command_type' } };
          }
          const out = await commands[ct](body || {});
          return out;
        }
        if (path === '/api/strategy/simulate') {
          // PURE deterministic strategy preview — reuses the engine's exit logic on a
          // hypothetical price path. No vault/secret/market data. A candidate strategy may be
          // supplied in the body; otherwise the live config's copy_defaults is previewed.
          const strategy = (body && typeof body.strategy === 'object' && body.strategy) ? body.strategy : (config.get().copy_defaults || {});
          const out = runScenario({ strategy, scenario: body?.scenario || 'pump_then_dump' });
          return { status: out.ok ? 200 : 400, body: out };
        }
        // vault/session ops (local auth surface; bodies never logged)
        if (path === '/api/vault/create') {
          const res = vault.create(body?.passphrase);
          if (res.ok) audit({ audit_scope: 'config', audit_reason: 'vault_created', command_type: null, detail: {} });
          return { status: res.ok ? 200 : 400, body: res };
        }
        if (path === '/api/vault/unlock') {
          const res = vault.unlock(body?.passphrase);
          audit({ audit_scope: 'config', audit_reason: res.ok ? 'vault_unlocked' : 'vault_unlock_failed', command_type: null, detail: {} });
          return { status: res.ok ? 200 : 401, body: res };
        }
        if (path === '/api/vault/lock') {
          signer.lockSession('vault_locked');
          const res = vault.lock();
          audit({ audit_scope: 'config', audit_reason: 'vault_locked', command_type: null, detail: {} });
          return { status: 200, body: res };
        }
        if (path === '/api/secrets') {
          const res = vault.setSecret(body?.name, body?.value);
          if (res.ok) {
            audit({ audit_scope: 'config', audit_reason: 'secret_stored', command_type: 'candidate_cmd_register_provider', detail: { ref: res.ref } });
            emit({ event_type: 'config_update', secrets_changed: true });
          }
          return { status: res.ok ? 200 : 400, body: res };
        }
        if (path === '/api/discover/token-traders') {
          if (!vault.isUnlocked()) return { status: 409, body: { ok: false, error: 'vault_locked' } };
          if (typeof discoverTraders !== 'function') return { status: 503, body: { ok: false, error: 'discovery_unavailable' } };
          const mint = body?.mint;
          if (typeof mint !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) {
            return { status: 400, body: { ok: false, error: 'invalid_mint' } };
          }
          if (discoveryBusy) return { status: 429, body: { ok: false, error: 'scan_in_progress' } };
          discoveryBusy = true;
          try {
            const r = await discoverTraders({ mint });
            if (r.ok) remember({ type: 'radar_scan', mint, found: (r.traders || []).length, scanned: r.scanned });
            return { status: r.ok ? 200 : 502, body: r };
          } finally { discoveryBusy = false; }
        }
        if (path === '/api/discover/from-leaders') {
          // AUTOMATIC discovery — no mint needed; uses the followed leaders' recent tokens.
          if (!vault.isUnlocked()) return { status: 409, body: { ok: false, error: 'vault_locked' } };
          if (typeof discoverFromLeaders !== 'function') return { status: 503, body: { ok: false, error: 'discovery_unavailable' } };
          if (discoveryBusy) return { status: 429, body: { ok: false, error: 'scan_in_progress' } };
          discoveryBusy = true;
          try { const r = await discoverFromLeaders(); return { status: r.ok ? 200 : 502, body: r }; }
          finally { discoveryBusy = false; }
        }
        if (path === '/api/tokens/analyze') {
          return runTokenAnalysis(body?.mint);
        }
        if (path === '/api/wallets/analyze') {
          // READ-ONLY historical wallet intelligence. Needs unlocked vault (uses the RPC key).
          if (!vault.isUnlocked()) return { status: 409, body: { ok: false, error: 'vault_locked' } };
          if (typeof analyzeWallet !== 'function') return { status: 503, body: { ok: false, error: 'analyzer_unavailable' } };
          const address = body?.address;
          if (typeof address !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
            return { status: 400, body: { ok: false, error: 'invalid_address' } };
          }
          const r = await analyzeWallet({ address });
          if (r.ok) remember({ type: 'wallet_analysis', address, status: r.stats?.status || null, tier: r.intelligence?.tier || null, win_rate: r.stats?.win_rate ?? null });
          return { status: r.ok ? 200 : 502, body: r };
        }
        if (path === '/api/providers/test-connection') {
          // runtime readiness probe — confirms the stored RPC key actually works.
          // requires an unlocked vault (the key lives there); never echoes the key.
          if (!vault.isUnlocked()) return { status: 409, body: { ok: false, error: 'vault_locked' } };
          if (!rpc) return { status: 503, body: { ok: false, error: 'rpc_client_unavailable' } };
          const r = await rpc.testConnection();
          audit({ audit_scope: 'config', audit_reason: r.ok ? 'provider_connection_test_ok' : 'provider_connection_test_failed', command_type: null, detail: { ok: r.ok, provider: r.provider, latency_ms: r.latency_ms, error: r.error } });
          return { status: r.ok ? 200 : 502, body: r };
        }
        if (path === '/api/signer/wallet') {
          // confirm the execution wallet: public address + live SOL balance + connected.
          const d = signer.deriveAddress();
          if (!d.ok) return { status: 200, body: { connected: false, key_imported: signer.status() !== 'missing', reason: d.error } };
          let balance_sol = null; let connected = false;
          if (rpc) {
            const bal = await rpc.rpc('getBalance', [d.address, { commitment: 'confirmed' }]);
            if (bal.ok) { balance_sol = Number(bal.result?.value ?? 0) / 1e9; connected = true; }
          }
          return { status: 200, body: { connected, key_imported: true, address: d.address, balance_sol } };
        }
        if (path === '/api/holdings') {
          // read-only: all SPL balances of the execution wallet (+ SOL). Needs the RPC key (vault).
          if (!vault.isUnlocked()) return { status: 409, body: { ok: false, error: 'vault_locked' } };
          if (!rpc) return { status: 503, body: { ok: false, error: 'rpc_client_unavailable' } };
          const d = signer.deriveAddress();
          if (!d.ok) return { status: 200, body: { ok: false, error: d.error, key_imported: signer.status() !== 'missing' } };
          const { fetchHoldings } = await import('./engine/holdings.mjs');
          const bal = await rpc.rpc('getBalance', [d.address, { commitment: 'confirmed' }]);
          const h = await fetchHoldings({ rpc, owner: d.address });
          return { status: 200, body: { ok: true, address: d.address, sol_balance: bal.ok ? Number(bal.result?.value ?? 0) / 1e9 : null, tokens: h.ok ? h.tokens : [] } };
        }
        if (path === '/api/signer/import-key') {
          const res = signer.importKey(body?.secret);
          return { status: res.ok ? 200 : 400, body: res };
        }
        if (path === '/api/signer/open-session') {
          const res = signer.openSession();
          return { status: res.ok ? 200 : 409, body: res };
        }
        if (path === '/api/signer/lock') {
          return { status: 200, body: signer.lockSession('manual') };
        }
        if (path === '/api/real-live/deactivate') {
          // back to paper — always allowed, never blocked (de-risking direction)
          const v = config._internal.setMode('paper');
          audit({ audit_scope: 'config', audit_reason: 'real_live_deactivated_back_to_paper', command_type: null, detail: { config_version: v } });
          emit({ event_type: 'config_update', mode: 'paper' });
          return { status: 200, body: { ok: true, mode: 'paper', config_version: v } };
        }
        if (path === '/api/kill-switch/disengage') {
          // explicit human action; global disengage requires typed confirmation
          if ((body?.level || 'global') === 'global' && body?.confirm !== 'DISENGAGE') {
            return { status: 400, body: { ok: false, error: 'explicit_confirmation_required', expected: 'confirm: DISENGAGE' } };
          }
          const res = killSwitch.disengage({ level: body?.level || 'global', key: body?.key || null });
          if (res.ok) {
            audit({ audit_scope: 'config', audit_reason: `kill_disengaged_${body?.level || 'global'}`, command_type: null, detail: { level: body?.level, key: body?.key } });
            emit({ event_type: 'health_update', kill_switch: res.state });
          }
          return { status: res.ok ? 200 : 400, body: res };
        }
        // ADR-0001 Phase 5A/5B: pre-flight diagnostics (read-only; never opens a position, claims an
        // intent, or broadcasts). Present only when DIAGNOSTIC_BACKEND=package wired the adapter;
        // otherwise these fall through to 404. `/execution-test` is an explicit alias of `/run`.
        if (diagnostics && (path === '/api/diagnostics/run' || path === '/api/diagnostics/execution-test')) {
          // OPTIONAL idempotency (Phase 6C): a repeated request carrying the same idempotency_key replays
          // the prior result instead of re-running. Best-effort + FAIL-OPEN — if hot-state is down it is a
          // cache miss and the diagnostic simply runs again; never a gate, never a behavior change.
          const idemKey = (body && typeof body.idempotency_key === 'string' && body.idempotency_key) ? body.idempotency_key : null;
          if (hotState && idemKey) {
            const prior = await cacheOp(() => hotState.readIdempotencyKey(`diag_run:${idemKey}`));
            if (prior.ok && prior.value) return { status: 200, body: { ...prior.value, idempotent: true } };
          }
          const run = await diagnostics.runDiagnosticExecutionTest(body && typeof body === 'object' ? body : {});
          const summary = diagSummary(run.readiness);
          const hot_state_cache = { enabled: !!hotState, hit: false, degraded: false };
          if (hotState) {
            const w = await cacheOp(() => hotState.setReadiness({ ...summary, readiness: run.readiness, checked_at: run.created_at }, HOT_CACHE_TTL.readiness));
            hot_state_cache.degraded = !w.ok;
          }
          // best-effort analytics: one run summary + a compact sample per quote/route check (no secrets)
          let event_written = false;
          if (eventEnabled) {
            event_written = await recordEvent('diagnostic.run', { at: run.created_at, run_id: run.run_id, run_kind: run.kind, readiness: run.readiness, overall: summary.overall, checks: run.checks.map((c) => ({ name: c.name, status: c.status })) });
            for (const c of run.checks) {
              if (c.name === 'quote' || c.name === 'route') {
                await recordEvent(`diagnostic.${c.name}_check`, { at: c.checked_at, status: c.status, available: c.available, out_amount: c.out_amount, error: c.error });
              }
            }
          }
          const respBody = { ok: true, run, ...summary, safety: DIAG_SAFETY, hot_state_cache, event_sink: { enabled: eventEnabled, written: event_written }, idempotency_key: idemKey, idempotent: false };
          if (hotState && idemKey) await cacheOp(() => hotState.claimIdempotencyKey(`diag_run:${idemKey}`, HOT_CACHE_TTL.idempotency, respBody));
          return { status: 200, body: respBody };
        }
        if (diagnostics && path === '/api/diagnostics/provider-test') {
          const check = await diagnostics.runProviderHealthCheck();
          const event_written = await recordEvent('provider.health_check', { overall: check.status, degraded: check.degraded, providers: providerStatuses(check.providers) });
          return { status: 200, body: { ok: true, check, overall: check.status, safety: DIAG_SAFETY, event_sink: { enabled: eventEnabled, written: event_written } } };
        }
        return { status: 404, body: { ok: false, api_error_code: 'RESOURCE_NOT_FOUND' } };
      }

      if (method === 'DELETE') {
        if (path.startsWith('/api/secrets/')) {
          const name = decodeURIComponent(path.slice('/api/secrets/'.length));
          const res = vault.deleteSecret(name);
          if (res.ok) audit({ audit_scope: 'config', audit_reason: 'secret_deleted', command_type: null, detail: { name } });
          return { status: res.ok ? 200 : 400, body: res };
        }
        if (path === '/api/signer/key') {
          const res = signer.deleteKey();
          return { status: res.ok ? 200 : 400, body: res };
        }
        if (path.startsWith('/api/wallets/')) {
          const id = decodeURIComponent(path.slice('/api/wallets/'.length));
          const res = wallets.remove(id);
          if (res.ok) audit({ audit_scope: 'wallet', audit_reason: 'wallet_removed', command_type: null, detail: { wallet_id: id } });
          return { status: res.ok ? 200 : 404, body: res };
        }
        return { status: 404, body: { ok: false, api_error_code: 'RESOURCE_NOT_FOUND' } };
      }

      return { status: 405, body: { ok: false, error_message: 'method_not_allowed' } };
    } catch (err) {
      // fail-closed: structured error, never a crash, never a secret in the message
      return { status: 500, body: { ok: false, error_message: 'internal_error', detail: String(err?.message || '').slice(0, 200) } };
    }
  }

  return { handle, statusPayload };
}
