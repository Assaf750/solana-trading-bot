// paper-engine.mjs — the live-data PAPER trading engine (simulated fills, real market).
// Supervises: leader-wallet ingestion (WS) -> swap detection -> risk gates ->
// exit feasibility -> paper fill -> TP/SL monitoring. Fail-closed at every step.
// REAL money never moves here: quotes only, fills simulated, always labeled simulated.
import { detectLeaderSwap } from './swap-detector.mjs';
import { checkEntryGates } from './risk-gates.mjs';
import { readJson, writeJson, nowIso } from '../util.mjs';

const EVENTS_FILE = 'engine-events.json';
const MAX_EVENTS = 200;
const FEE_EST_USD = 0.05; // conservative per-trade network fee estimate (labeled estimate)

export function createPaperEngine({ config, walletsRegistry, killSwitch, operatingState, vault, portfolio, livePortfolio = null, liveExecutor = null, rpc, jupiter, audit, broadcast }) {
  let sub = null;
  let supervisor = null;
  let markTimer = null;
  let engineState = 'stopped';
  let subscribedAddrs = [];
  const processedSigs = [];
  const processedSet = new Set();
  let lastEventAt = null;

  function pushEvent(ev) {
    const s = readJson(EVENTS_FILE, { events: [] }).value;
    s.events.push({ ts: nowIso(), ...ev });
    if (s.events.length > MAX_EVENTS) s.events.splice(0, s.events.length - MAX_EVENTS);
    writeJson(EVENTS_FILE, s);
    broadcast({ event_type: 'position_update', engine_event: ev.kind || ev.type || 'event' });
  }

  function events(limit = 50) {
    const s = readJson(EVENTS_FILE, { events: [] }).value;
    return s.events.slice(-limit);
  }

  function rememberSig(sig) {
    if (processedSet.has(sig)) return false;
    processedSet.add(sig);
    processedSigs.push(sig);
    if (processedSigs.length > 10000) processedSet.delete(processedSigs.shift()); // bounded memory
    return true;
  }

  function followedWallets() {
    return walletsRegistry.list().filter((w) => w.follow_enabled);
  }

  function rpcUrl() {
    const ref = config.get().providers?.rpc_url_ref;
    if (!ref || !ref.startsWith('vault:')) return null;
    const r = vault.getSecretForUse(ref.slice(6));
    return r.ok ? r.value : null;
  }

  function desiredState() {
    if (killSwitch.isBlocked({}).blocked) return 'stopped_killed';
    if (!vault.isUnlocked()) return 'waiting_vault_unlock';
    if (!rpcUrl()) return 'waiting_rpc_config';
    if (followedWallets().length === 0) return 'no_followed_wallets';
    const op = operatingState.get().operating_state;
    if (op === 'PAUSED' || op === 'KILLED') return 'paused_by_operator';
    return 'active';
  }

  function liveMode() {
    return config.get().mode === 'real_live' && livePortfolio && liveExecutor;
  }
  function activePf() {
    return liveMode() ? livePortfolio : portfolio;
  }

  // ---------- entry pipeline ----------
  async function handleLeaderBuy({ leader, wallet, swap }) {
    const cfg = config.get();
    const sizeUsd = cfg.execution?.sizing_mode === 'fixed_usd' ? cfg.execution.sizing_value : cfg.execution?.sizing_value || 10;
    const isLive = liveMode();
    const pf = activePf();

    const gate = checkEntryGates({
      cfg, portfolio: pf, sizeUsd, tokenMint: swap.mint,
      killBlocked: killSwitch.isBlocked({ mode: isLive ? 'real_live' : 'paper', wallet_id: wallet.wallet_id }).blocked,
      operatingState: operatingState.get().operating_state,
    });
    if (!gate.allowed) {
      pushEvent({ kind: 'entry_rejected', leader, mint: swap.mint, rejections: gate.rejections });
      return;
    }

    // Exit feasibility BEFORE entry: a sell route must exist for the would-be position
    const slipBps = Math.round((cfg.copy_defaults?.max_entry_slippage_vs_leader || 5) * 100);
    const buyQuote = await jupiter.paperBuy({ mint: swap.mint, sizeUsd, slippageBps: slipBps });
    if (!buyQuote.ok) {
      pushEvent({ kind: 'entry_rejected', leader, mint: swap.mint, rejections: [`route_invalid:${buyQuote.error}`] });
      return;
    }
    const qtyUi = buyQuote.outAmountBase / 10 ** swap.decimals;
    const sellCheck = await jupiter.usdValueOf({ mint: swap.mint, qtyUi, decimals: swap.decimals });
    if (!sellCheck.ok) {
      pushEvent({ kind: 'entry_rejected', leader, mint: swap.mint, rejections: [`exit_feasibility_fail:${sellCheck.error}`] });
      return;
    }
    const roundTripLossPct = sizeUsd > 0 ? ((sizeUsd - sellCheck.usd) / sizeUsd) * 100 : 100;
    if (roundTripLossPct > Math.max(10, (cfg.copy_defaults?.max_entry_slippage_vs_leader || 5) * 2)) {
      pushEvent({ kind: 'entry_rejected', leader, mint: swap.mint, rejections: [`exit_feasibility_fail:round_trip_loss_${roundTripLossPct.toFixed(1)}pct`] });
      return;
    }

    const tp = wallet.config?.take_profit_pct ?? cfg.copy_defaults?.take_profit_pct ?? 50;
    const sl = wallet.config?.stop_loss_pct ?? cfg.copy_defaults?.stop_loss_pct ?? 30;

    if (isLive) {
      // REAL execution — only through the fully-gated live executor
      const exec = await liveExecutor.executeSwap({
        side: 'buy', mint: swap.mint, sizeUsd, decimals: swap.decimals, slippageBps: slipBps,
        intentParts: ['buy', leader, swap.mint, String(swap.uiDelta)],
      });
      if (!exec.ok) {
        pushEvent({ kind: 'live_entry_refused', leader, mint: swap.mint, error: exec.error, refusals: exec.refusals || [] });
        if (exec.refusals?.some((r) => r.startsWith('signer_'))) {
          // risk-rejection accounting belongs to the gate layer, not here
        }
        return;
      }
      const pos = pf.recordEntry({
        leader_address: leader, wallet_id: wallet.wallet_id, token_mint: swap.mint,
        qty_ui: exec.outUi, decimals: swap.decimals, cost_usd: sizeUsd,
        fee_usd_est: FEE_EST_USD, price_impact_pct: exec.priceImpactPct,
        copy_mode: wallet.copy_mode, tp_pct: tp, sl_pct: sl,
      });
      pushEvent({ kind: 'live_entry', leader, mint: swap.mint, position_id: pos.position_id, size_usd: sizeUsd, qty_ui: exec.outUi, signature: exec.signature });
      audit({ audit_scope: 'position', audit_reason: 'live_entry_recorded', command_type: null, detail: { position_id: pos.position_id, mint: swap.mint, size_usd: sizeUsd, signature: exec.signature, simulated: false } });
      return;
    }

    const pos = pf.recordEntry({
      leader_address: leader, wallet_id: wallet.wallet_id, token_mint: swap.mint,
      qty_ui: qtyUi, decimals: swap.decimals, cost_usd: sizeUsd,
      fee_usd_est: FEE_EST_USD, price_impact_pct: buyQuote.priceImpactPct,
      copy_mode: wallet.copy_mode, tp_pct: tp, sl_pct: sl,
    });
    pushEvent({ kind: 'paper_entry', leader, mint: swap.mint, position_id: pos.position_id, size_usd: sizeUsd, qty_ui: qtyUi, impact_pct: buyQuote.priceImpactPct });
    audit({ audit_scope: 'position', audit_reason: 'paper_entry_recorded', command_type: null, detail: { position_id: pos.position_id, mint: swap.mint, size_usd: sizeUsd, simulated: true } });
  }

  /** Exit helper: real sell when the position is live, quoted simulated sell when paper. */
  async function performExit({ pf, p, fraction, reason }) {
    const qtySell = p.qty_ui * fraction;
    if (p.simulated === false && liveExecutor) {
      const est = await jupiter.usdValueOf({ mint: p.token_mint, qtyUi: qtySell, decimals: p.decimals });
      const exec = await liveExecutor.executeSwap({
        side: 'sell', mint: p.token_mint, qtyUi: qtySell, decimals: p.decimals,
        sizeUsd: est.ok ? est.usd : 0, slippageBps: 150,
        intentParts: ['sell', p.position_id, reason, new Date().toISOString().slice(0, 10)],
      });
      if (!exec.ok) {
        pushEvent({ kind: 'live_exit_refused', position_id: p.position_id, reason, error: exec.error, refusals: exec.refusals || [] });
        return { ok: false };
      }
      const res = pf.recordExit({
        position_id: p.position_id, fraction, proceeds_usd: exec.proceedsUsd ?? (est.ok ? est.usd : 0),
        fee_usd_est: FEE_EST_USD, price_impact_pct: exec.priceImpactPct, reason,
      });
      if (res.ok) pushEvent({ kind: 'live_exit', position_id: p.position_id, reason, proceeds_usd: exec.proceedsUsd, realized_usd: res.realized_usd, signature: exec.signature });
      return res;
    }
    const q = await jupiter.usdValueOf({ mint: p.token_mint, qtyUi: qtySell, decimals: p.decimals });
    if (!q.ok) {
      pushEvent({ kind: 'exit_route_unhealthy', position_id: p.position_id, reason, error: q.error });
      return { ok: false };
    }
    const res = pf.recordExit({
      position_id: p.position_id, fraction, proceeds_usd: q.usd,
      fee_usd_est: FEE_EST_USD, price_impact_pct: q.priceImpactPct, reason,
    });
    if (res.ok) pushEvent({ kind: 'paper_exit', position_id: p.position_id, reason, proceeds_usd: q.usd, realized_usd: res.realized_usd });
    return res;
  }

  async function handleLeaderSell({ leader, wallet, swap }) {
    // mirror sells act on BOTH books (paper history continues while live runs)
    const books = [portfolio, ...(livePortfolio ? [livePortfolio] : [])];
    let found = false;
    for (const pf of books) {
      const open = pf.openPositions().filter((p) => p.leader_address === leader && p.token_mint === swap.mint);
      if (!open.length) continue;
      found = true;
      if (wallet.copy_mode !== 'full_mirror') {
        pushEvent({ kind: 'leader_sell_risk_modifier_only', leader, mint: swap.mint, note: 'follow_entry_user_exit ignores leader sells by policy' });
        return;
      }
      const fraction = swap.fullExit ? 1 : Math.min(1, swap.soldFraction || 1);
      for (const p of open) {
        await performExit({ pf, p, fraction, reason: swap.fullExit ? 'leader_full_exit_mirrored' : 'leader_partial_sell_mirrored' });
      }
    }
    if (!found) pushEvent({ kind: 'leader_sell_no_position', leader, mint: swap.mint });
  }

  // Unified leader-activity handler. txInline present on Helius transactionSubscribe
  // (no round-trip); null on generic logsSubscribe (we fetch once, deduped).
  async function onLeaderActivity({ signature, tx: txInline }) {
    if (!rememberSig(signature)) return;
    lastEventAt = Date.now();
    let txResult = txInline;
    if (!txResult) {
      const tx = await rpc.getTransaction(signature);
      if (!tx.ok || !tx.result) return;
      txResult = tx.result;
    }
    for (const w of followedWallets()) {
      const swap = detectLeaderSwap({ tx: txResult, leaderAddress: w.tracked_wallet_address });
      if (swap.kind === 'buy') await handleLeaderBuy({ leader: w.tracked_wallet_address, wallet: w, swap });
      else if (swap.kind === 'sell') await handleLeaderSell({ leader: w.tracked_wallet_address, wallet: w, swap });
    }
  }
  // back-compat alias used by tests/probes
  const onSignature = (sig) => onLeaderActivity({ signature: sig, tx: null });

  // ---------- TP/SL + mark loop (both books; exits routed per book) ----------
  async function markPass() {
    const cfg = config.get();
    const books = [portfolio, ...(livePortfolio ? [livePortfolio] : [])];
    for (const pf of books) {
      for (const p of pf.openPositions()) {
        const q = await jupiter.usdValueOf({ mint: p.token_mint, qtyUi: p.qty_ui, decimals: p.decimals });
        if (!q.ok) { pf.setMark(p.position_id, p.mark_usd, 'unavailable'); continue; }
        pf.setMark(p.position_id, q.usd, 'valid');
        const pnlPct = p.cost_usd > 0 ? ((q.usd - p.cost_usd) / p.cost_usd) * 100 : 0;
        const op = operatingState.get().operating_state;
        const exitsAllowed = op === 'ACTIVE' || op === 'EXITS_ONLY' || op === 'PAUSED';
        if (!exitsAllowed) continue;
        if (pnlPct >= p.tp_pct) {
          await performExit({ pf, p, fraction: 1, reason: 'take_profit_hit' });
        } else if (pnlPct <= -p.sl_pct) {
          await performExit({ pf, p, fraction: 1, reason: 'stop_loss_hit' });
        }
      }
      // daily loss enforcement per book: block entries + EXITS_ONLY (live book is binding for real money)
      const hr = cfg.hard_risk || {};
      const capital = cfg.execution?.capital_limit;
      const dailyLoss = -pf.dailyRealized();
      if (Number.isFinite(hr.max_daily_loss_usdt) && dailyLoss >= hr.max_daily_loss_usdt
        || (Number.isFinite(hr.max_daily_loss_pct) && Number.isFinite(capital) && capital > 0 && dailyLoss >= capital * hr.max_daily_loss_pct / 100)) {
        if (!pf.summary().entries_blocked) {
          pf.setEntriesBlocked(true);
          operatingState.transition('EXITS_ONLY', 'daily loss limit hit');
          pushEvent({ kind: 'daily_loss_limit_hit', daily_loss_usd: dailyLoss, simulated: pf.summary().simulated });
          audit({ audit_scope: 'position', audit_reason: 'daily_loss_limit_hit', command_type: null, detail: { daily_loss_usd: dailyLoss, simulated: pf.summary().simulated } });
          if (pf === livePortfolio) {
            // real money: also engage the per-mode kill switch for real_live entries
            killSwitch.engage({ level: 'per_mode', key: 'real_live', reason: 'daily_loss_limit_hit' });
          }
        }
      }
    }
  }

  // ---------- supervision ----------
  function startSubscription() {
    const addrs = followedWallets().map((w) => w.tracked_wallet_address);
    subscribedAddrs = addrs;
    sub = rpc.subscribeWallets({
      addresses: addrs,
      onLeaderActivity: (evt) => { onLeaderActivity(evt).catch(() => { /* per-event errors contained */ }); },
      onUp: ({ provider } = {}) => {
        engineState = 'active';
        const op = operatingState.get().operating_state;
        if (op === 'WARMING_UP' || op === 'EXITS_ONLY') operatingState.transition('ACTIVE', 'stream connected + readiness ok');
        pushEvent({ kind: 'stream_connected', wallets: addrs.length, provider, enhanced: provider === 'helius' });
      },
      onGap: () => {
        engineState = 'exits_only_stream_gap';
        if (operatingState.get().operating_state === 'ACTIVE') operatingState.transition('EXITS_ONLY', 'stream gap beyond recovery window');
        pushEvent({ kind: 'stream_gap_exits_only' });
      },
    });
  }

  function stopSubscription() {
    if (sub) { sub.close(); sub = null; }
    subscribedAddrs = [];
  }

  function superviseTick() {
    const want = desiredState();
    const addrs = followedWallets().map((w) => w.tracked_wallet_address).sort().join(',');
    const have = subscribedAddrs.slice().sort().join(',');
    if (want === 'active') {
      if (!sub) { engineState = 'connecting'; startSubscription(); }
      else if (addrs !== have) { stopSubscription(); startSubscription(); } // follow set changed
      else if (engineState === 'connecting' || engineState === 'stopped') engineState = 'active';
    } else {
      if (sub) stopSubscription();
      engineState = want;
    }
  }

  function start() {
    if (supervisor) return;
    supervisor = setInterval(superviseTick, 5000);
    markTimer = setInterval(() => { markPass().catch(() => { /* contained */ }); }, 25000);
    superviseTick();
  }

  function stop() {
    if (supervisor) clearInterval(supervisor);
    if (markTimer) clearInterval(markTimer);
    supervisor = null; markTimer = null;
    stopSubscription();
    engineState = 'stopped';
  }

  function status() {
    return {
      paper_engine: engineState,
      mode: config.get().mode,
      followed_wallets: followedWallets().length,
      subscribed: subscribedAddrs.length,
      last_leader_event_at: lastEventAt ? new Date(lastEventAt).toISOString() : null,
      portfolio: portfolio.summary(),
      live_portfolio: livePortfolio ? livePortfolio.summary() : null,
    };
  }

  return { start, stop, status, events, _internal: { onSignature, markPass, handleLeaderBuy, handleLeaderSell, performExit, desiredState } };
}
