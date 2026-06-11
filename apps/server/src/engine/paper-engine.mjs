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

export function createPaperEngine({ config, walletsRegistry, killSwitch, operatingState, vault, portfolio, rpc, jupiter, audit, broadcast }) {
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

  // ---------- entry pipeline ----------
  async function handleLeaderBuy({ leader, wallet, swap }) {
    const cfg = config.get();
    const sizeUsd = cfg.execution?.sizing_mode === 'fixed_usd' ? cfg.execution.sizing_value : cfg.execution?.sizing_value || 10;

    const gate = checkEntryGates({
      cfg, portfolio, sizeUsd, tokenMint: swap.mint,
      killBlocked: killSwitch.isBlocked({ mode: 'paper', wallet_id: wallet.wallet_id }).blocked,
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

    const pos = portfolio.recordEntry({
      leader_address: leader, wallet_id: wallet.wallet_id, token_mint: swap.mint,
      qty_ui: qtyUi, decimals: swap.decimals, cost_usd: sizeUsd,
      fee_usd_est: FEE_EST_USD, price_impact_pct: buyQuote.priceImpactPct,
      copy_mode: wallet.copy_mode,
      tp_pct: wallet.config?.take_profit_pct ?? cfg.copy_defaults?.take_profit_pct ?? 50,
      sl_pct: wallet.config?.stop_loss_pct ?? cfg.copy_defaults?.stop_loss_pct ?? 30,
    });
    pushEvent({ kind: 'paper_entry', leader, mint: swap.mint, position_id: pos.position_id, size_usd: sizeUsd, qty_ui: qtyUi, impact_pct: buyQuote.priceImpactPct });
    audit({ audit_scope: 'position', audit_reason: 'paper_entry_recorded', command_type: null, detail: { position_id: pos.position_id, mint: swap.mint, size_usd: sizeUsd, simulated: true } });
  }

  async function handleLeaderSell({ leader, wallet, swap }) {
    const open = portfolio.openPositions().filter((p) => p.leader_address === leader && p.token_mint === swap.mint);
    if (!open.length) {
      pushEvent({ kind: 'leader_sell_no_position', leader, mint: swap.mint });
      return;
    }
    if (wallet.copy_mode !== 'full_mirror') {
      pushEvent({ kind: 'leader_sell_risk_modifier_only', leader, mint: swap.mint, note: 'follow_entry_user_exit ignores leader sells by policy' });
      return;
    }
    const fraction = swap.fullExit ? 1 : Math.min(1, swap.soldFraction || 1);
    for (const p of open) {
      const qtySell = p.qty_ui * fraction;
      const q = await jupiter.usdValueOf({ mint: p.token_mint, qtyUi: qtySell, decimals: p.decimals });
      if (!q.ok) {
        pushEvent({ kind: 'mirror_sell_route_unhealthy', position_id: p.position_id, error: q.error });
        continue; // exit stays pending; the monitor loop will retry pricing
      }
      const res = portfolio.recordExit({
        position_id: p.position_id, fraction, proceeds_usd: q.usd,
        fee_usd_est: FEE_EST_USD, price_impact_pct: q.priceImpactPct,
        reason: swap.fullExit ? 'leader_full_exit_mirrored' : 'leader_partial_sell_mirrored',
      });
      if (res.ok) pushEvent({ kind: 'paper_exit', position_id: p.position_id, fraction, proceeds_usd: q.usd, realized_usd: res.realized_usd });
    }
  }

  async function onSignature(sig) {
    if (!rememberSig(sig)) return;
    lastEventAt = Date.now();
    const tx = await rpc.getTransaction(sig);
    if (!tx.ok || !tx.result) return;
    for (const w of followedWallets()) {
      const swap = detectLeaderSwap({ tx: tx.result, leaderAddress: w.tracked_wallet_address });
      if (swap.kind === 'buy') await handleLeaderBuy({ leader: w.tracked_wallet_address, wallet: w, swap });
      else if (swap.kind === 'sell') await handleLeaderSell({ leader: w.tracked_wallet_address, wallet: w, swap });
    }
  }

  // ---------- TP/SL + mark loop ----------
  async function markPass() {
    const cfg = config.get();
    for (const p of portfolio.openPositions()) {
      const q = await jupiter.usdValueOf({ mint: p.token_mint, qtyUi: p.qty_ui, decimals: p.decimals });
      if (!q.ok) { portfolio.setMark(p.position_id, p.mark_usd, 'unavailable'); continue; }
      portfolio.setMark(p.position_id, q.usd, 'valid');
      const pnlPct = p.cost_usd > 0 ? ((q.usd - p.cost_usd) / p.cost_usd) * 100 : 0;
      const op = operatingState.get().operating_state;
      const exitsAllowed = op === 'ACTIVE' || op === 'EXITS_ONLY' || op === 'PAUSED';
      if (!exitsAllowed) continue;
      if (pnlPct >= p.tp_pct) {
        const r = portfolio.recordExit({ position_id: p.position_id, fraction: 1, proceeds_usd: q.usd, fee_usd_est: FEE_EST_USD, price_impact_pct: q.priceImpactPct, reason: 'take_profit_hit' });
        if (r.ok) pushEvent({ kind: 'paper_exit', position_id: p.position_id, reason: 'take_profit_hit', pnl_pct: pnlPct, realized_usd: r.realized_usd });
      } else if (pnlPct <= -p.sl_pct) {
        const r = portfolio.recordExit({ position_id: p.position_id, fraction: 1, proceeds_usd: q.usd, fee_usd_est: FEE_EST_USD, price_impact_pct: q.priceImpactPct, reason: 'stop_loss_hit' });
        if (r.ok) pushEvent({ kind: 'paper_exit', position_id: p.position_id, reason: 'stop_loss_hit', pnl_pct: pnlPct, realized_usd: r.realized_usd });
      }
    }
    // daily loss enforcement (paper-faithful): block entries + EXITS_ONLY
    const hr = cfg.hard_risk || {};
    const capital = cfg.execution?.capital_limit;
    const dailyLoss = -portfolio.dailyRealized();
    if (Number.isFinite(hr.max_daily_loss_usdt) && dailyLoss >= hr.max_daily_loss_usdt
      || (Number.isFinite(hr.max_daily_loss_pct) && Number.isFinite(capital) && capital > 0 && dailyLoss >= capital * hr.max_daily_loss_pct / 100)) {
      if (!portfolio.summary().entries_blocked) {
        portfolio.setEntriesBlocked(true);
        operatingState.transition('EXITS_ONLY', 'paper daily loss limit hit');
        pushEvent({ kind: 'daily_loss_limit_hit', daily_loss_usd: dailyLoss });
        audit({ audit_scope: 'position', audit_reason: 'paper_daily_loss_limit_hit', command_type: null, detail: { daily_loss_usd: dailyLoss, simulated: true } });
      }
    }
  }

  // ---------- supervision ----------
  function startSubscription() {
    const addrs = followedWallets().map((w) => w.tracked_wallet_address);
    subscribedAddrs = addrs;
    sub = rpc.subscribeLogs({
      addresses: addrs,
      onSignature: (sig) => { onSignature(sig).catch(() => { /* per-event errors contained */ }); },
      onUp: () => {
        engineState = 'active';
        const op = operatingState.get().operating_state;
        if (op === 'WARMING_UP' || op === 'EXITS_ONLY') operatingState.transition('ACTIVE', 'stream connected + readiness ok');
        pushEvent({ kind: 'stream_connected', wallets: addrs.length });
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
      simulated: true,
      followed_wallets: followedWallets().length,
      subscribed: subscribedAddrs.length,
      last_leader_event_at: lastEventAt ? new Date(lastEventAt).toISOString() : null,
      portfolio: portfolio.summary(),
    };
  }

  return { start, stop, status, events, _internal: { onSignature, markPass, handleLeaderBuy, handleLeaderSell, desiredState } };
}
