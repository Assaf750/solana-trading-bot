// api.mjs — HTTP contract. Pure handler ({method,path,body}) -> {status,body} for testability.
// Trading/config commands go through POST /api/commands with SSOT command_type names.
// Vault/session endpoints are local ops surfaces (auth-like), not trading commands.
// RULE: no response ever contains a raw secret — refs + masked previews only.
import { computeReadiness } from './readiness.mjs';
import { deriveRunMode, runModesCatalog } from './engine/run-modes.mjs';
import { assessRisk } from './engine/risk-center.mjs';

export function createApi({ config, wallets, killSwitch, operatingState, vault, signer, audit, broadcast, paperEngine, portfolio, livePortfolio, liveExecutor, rpc, analyzeWallet, analyzeToken, discoverTraders, discoverFromLeaders, tokenMeta, notifier, history }) {
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
        if (path === '/api/modes') return { status: 200, body: runModesCatalog(statusPayload()) };
        if (path === '/api/risk') return { status: 200, body: assessRisk({ status: statusPayload(), config: config.get(), portfolioSummary: portfolio ? portfolio.summary() : {} }) };
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
