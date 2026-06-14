// paper-engine.mjs — the live-data PAPER trading engine (simulated fills, real market).
// Supervises: leader-wallet ingestion (WS) -> swap detection -> risk gates ->
// exit feasibility -> paper fill -> TP/SL monitoring. Fail-closed at every step.
// REAL money never moves here: quotes only, fills simulated, always labeled simulated.
import { detectLeaderSwap, WSOL_MINT, USDC_MINT } from './swap-detector.mjs';
import { checkEntryGates } from './risk-gates.mjs';
import { readJson, writeJson, nowIso } from '../util.mjs';

const EVENTS_FILE = 'engine-events.json';
const MAX_EVENTS = 200;
const FEE_EST_USD = 0.05; // conservative per-trade network fee estimate (labeled estimate)

export function createPaperEngine({ config, walletsRegistry, killSwitch, operatingState, vault, portfolio, livePortfolio = null, liveExecutor = null, signer = null, rpc, jupiter, audit, broadcast }) {
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

  async function solUsd() {
    // reuse the live executor's 60s-cached SOL price when available (avoids an uncached
    // Jupiter round-trip on every fixed_sol entry); fall back to a direct quote in paper-only.
    if (liveExecutor?.solPriceUsd) return liveExecutor.solPriceUsd();
    const q = await jupiter.quote({ inputMint: WSOL_MINT, outputMint: USDC_MINT, amountBaseUnits: 1e9 });
    return q.ok ? q.outAmount / 1e6 : null;
  }

  /** Resolve trade size in USD honoring the (per-wallet, else global) sizing mode.
   *  Fail-closed: returns {ok:false} rather than silently mis-sizing a real trade. */
  async function resolveSizeUsd({ cfg, wallet }) {
    const wc = wallet.config || {};
    const mode = wc.sizing_mode || cfg.execution?.sizing_mode || 'fixed_usd';
    const value = wc.sizing_value ?? cfg.execution?.sizing_value;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return { ok: false, error: 'sizing_value_unset' };
    }
    if (mode === 'fixed_usd') return { ok: true, usd: value };
    if (mode === 'pct_of_capital') {
      const cap = cfg.execution?.capital_limit;
      if (typeof cap !== 'number' || !Number.isFinite(cap) || cap <= 0) return { ok: false, error: 'capital_limit_unset' };
      return { ok: true, usd: (cap * value) / 100 };
    }
    if (mode === 'fixed_sol') {
      const px = await solUsd();
      if (!px) return { ok: false, error: 'sol_price_unavailable' };
      return { ok: true, usd: value * px };
    }
    return { ok: false, error: `unsupported_sizing_mode_${mode}` };
  }

  // ---------- entry pipeline ----------
  async function handleLeaderBuy({ leader, wallet, swap, signature }) {
    const cfg = config.get();
    const isLive = liveMode();
    const pf = activePf();

    // rebuy cooldown: don't open another position for this leader+mint within the configured window
    const cooldownSec = wallet.config?.rebuy_cooldown;
    if (Number.isFinite(cooldownSec) && cooldownSec > 0) {
      const recent = pf.openPositions().find((p) => p.leader_address === leader && p.token_mint === swap.mint
        && (Date.now() - new Date(p.entry_ts).getTime()) / 1000 < cooldownSec);
      if (recent) { pushEvent({ kind: 'entry_skipped_rebuy_cooldown', leader, mint: swap.mint }); return; }
    }

    const sized = await resolveSizeUsd({ cfg, wallet });
    if (!sized.ok) {
      pushEvent({ kind: 'entry_rejected', leader, mint: swap.mint, rejections: [`sizing_${sized.error}`] });
      return;
    }
    const sizeUsd = sized.usd;

    const gate = checkEntryGates({
      cfg, portfolio: pf, sizeUsd, tokenMint: swap.mint,
      killBlocked: killSwitch.isBlocked({ mode: isLive ? 'real_live' : 'paper', wallet_id: wallet.wallet_id }).blocked,
      operatingState: operatingState.get().operating_state,
      entriesBlocked: pf.summary().entries_blocked,
      leaderAddress: leader,
    });
    if (!gate.allowed) {
      // ONLY a genuine risk-cap breach feeds the signer's consecutive-rejection lockout —
      // never a benign pause/EXITS_ONLY/kill/unset-limit block (those would freeze the signer).
      if (isLive && signer && gate.riskRejection) signer.recordRiskRejection();
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
        // keyed by the leader's on-chain signature so two distinct same-size buys are NOT
        // collapsed into one (idempotent per leader tx, not per amount)
        intentParts: ['buy', leader, swap.mint, signature || String(swap.uiDelta)],
        // recovery context: lets the reconciler rebuild this position if the buy confirms late
        // (SENT_UNCONFIRMED) after executeSwap already returned, instead of orphaning real tokens
        recovery: { leader_address: leader, wallet_id: wallet.wallet_id, decimals: swap.decimals, cost_usd: sizeUsd, copy_mode: wallet.copy_mode, tp_pct: tp, sl_pct: sl },
      });
      if (!exec.ok) {
        pushEvent({ kind: 'live_entry_refused', leader, mint: swap.mint, error: exec.error, refusals: exec.refusals || [] });
        return;
      }
      const pos = pf.recordEntry({
        leader_address: leader, wallet_id: wallet.wallet_id, token_mint: swap.mint,
        // cost basis = ACTUAL SOL spent on-chain (incl. fees) when available, else intended sizeUsd
        qty_ui: exec.outUi, decimals: swap.decimals, cost_usd: exec.costUsd ?? sizeUsd,
        fee_usd_est: FEE_EST_USD, price_impact_pct: exec.priceImpactPct,
        copy_mode: wallet.copy_mode, tp_pct: tp, sl_pct: sl, intent_id: exec.intent_id,
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

  /** Exit helper: real sell when the position is live, quoted simulated sell when paper.
   *  intentParts defaults to (position, reason) — a stable key per logical exit. It is NOT
   *  day-bucketed (that would mint a new intent across UTC midnight and defeat dedup); a
   *  provably-unsent failure is still retryable via the live-executor RETRYABLE statuses. */
  async function performExit({ pf, p, fraction, reason, intentParts }) {
    // re-confirm the position is still OPEN right before acting — a concurrent exit (TP/SL vs
    // leader-mirror) may have closed it since the caller snapshotted it; avoids a second real sell.
    const fresh = pf.openPositions().find((x) => x.position_id === p.position_id);
    if (!fresh) { pushEvent({ kind: 'exit_skipped_not_open', position_id: p.position_id, reason }); return { ok: false }; }
    p = fresh;
    const qtySell = p.qty_ui * fraction;
    if (p.simulated === false && liveExecutor) {
      const est = await jupiter.usdValueOf({ mint: p.token_mint, qtyUi: qtySell, decimals: p.decimals });
      const exec = await liveExecutor.executeSwap({
        side: 'sell', mint: p.token_mint, qtyUi: qtySell, decimals: p.decimals,
        sizeUsd: est.ok ? est.usd : 0, slippageBps: 150,
        intentParts: intentParts || ['sell', p.position_id, reason],
        positionId: p.position_id, // so a late-confirmed (SENT_UNCONFIRMED) sell can close THIS position
      });
      if (!exec.ok) {
        pushEvent({ kind: 'live_exit_refused', position_id: p.position_id, reason, error: exec.error, refusals: exec.refusals || [] });
        return { ok: false };
      }
      // Only book realized P&L when the REAL on-chain proceeds were read. Otherwise the sell
      // confirmed but proceeds are unknown -> flag for manual reconciliation; never record an estimate.
      if (exec.fillSource !== 'on_chain' || !Number.isFinite(exec.proceedsUsd)) {
        pf.flagNeedsReconciliation(p.position_id, `exit_proceeds_unconfirmed_${reason}`);
        pushEvent({ kind: 'exit_needs_reconciliation', position_id: p.position_id, reason, signature: exec.signature });
        return { ok: false, needs_reconciliation: true };
      }
      const res = pf.recordExit({
        position_id: p.position_id, fraction, proceeds_usd: exec.proceedsUsd,
        // proceeds come from the on-chain native-SOL delta, already net of network/priority fees —
        // do NOT subtract an extra fee estimate (that would double-count fees in realized P&L)
        fee_usd_est: 0, price_impact_pct: exec.priceImpactPct, reason,
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

  async function handleLeaderSell({ leader, wallet, swap, signature }) {
    const cfg = config.get();
    const fraction = swap.fullExit ? 1 : Math.min(1, swap.soldFraction || 1);
    // ignore trivial leader trims below the configured mirror threshold (avoid dust churn/slippage)
    const minPct = wallet.config?.min_mirror_sell_pct ?? cfg.copy_defaults?.min_mirror_sell_pct ?? 5;
    if (wallet.copy_mode === 'full_mirror' && !swap.fullExit && fraction * 100 < minPct) {
      pushEvent({ kind: 'leader_partial_sell_below_min', leader, mint: swap.mint, fraction_pct: Number((fraction * 100).toFixed(1)), min_pct: minPct });
      return;
    }
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
      for (const p of open) {
        const reason = swap.fullExit ? 'leader_full_exit_mirrored' : 'leader_partial_sell_mirrored';
        // keyed by the leader's signature so each distinct leader sell mirrors independently;
        // if the signature is unavailable, fall back to the stable per-logical-exit key (no date).
        const intentParts = signature ? ['sell', p.position_id, reason, signature] : ['sell', p.position_id, reason];
        await performExit({ pf, p, fraction, reason, intentParts });
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
      if (swap.kind === 'buy') await handleLeaderBuy({ leader: w.tracked_wallet_address, wallet: w, swap, signature });
      else if (swap.kind === 'sell') await handleLeaderSell({ leader: w.tracked_wallet_address, wallet: w, swap, signature });
    }
  }
  // back-compat alias used by tests/probes
  const onSignature = (sig) => onLeaderActivity({ signature: sig, tx: null });

  // ---------- reconcile broadcast-but-unconfirmed live intents (orphan buys / phantom sells) ----------
  // A live buy/sell that broadcast but whose confirmation timed out (SENT_UNCONFIRMED) is resolved
  // here against the chain: a late-confirmed BUY rebuilds its position (no orphaned tokens); a
  // late-confirmed SELL closes the still-open position; a never-landed/reverted intent is marked
  // retryable so the normal TP/SL loop re-attempts it.
  async function reconcilePass() {
    if (!liveExecutor || !livePortfolio || typeof liveExecutor.pendingIntents !== 'function') return;
    let pending = [];
    try { pending = liveExecutor.pendingIntents(); } catch { return; }
    for (const it of pending) {
      let r;
      try { r = await liveExecutor.reconcile({ intent_id: it.intent_id }); } catch { continue; }
      if (!r || r.resolved !== 'confirmed') continue;
      const d = r.detail || it.detail || {};
      if (d.side === 'buy' && d.recovery) {
        const already = livePortfolio.state().positions.some((p) => p.intent_id === it.intent_id);
        if (!already && Number(r.fill?.outUi) > 0) {
          const pos = livePortfolio.recordEntry({
            ...d.recovery, token_mint: d.mint, qty_ui: r.fill.outUi,
            cost_usd: r.fill?.costUsd ?? d.recovery.cost_usd, // actual SOL spent when known
            fee_usd_est: FEE_EST_USD, price_impact_pct: 0, intent_id: it.intent_id,
          });
          pushEvent({ kind: 'reconciled_orphan_entry', position_id: pos.position_id, mint: d.mint, signature: it.signature });
          audit({ audit_scope: 'position', audit_reason: 'reconciled_orphan_entry', command_type: null, detail: { position_id: pos.position_id, intent_id: it.intent_id, signature: it.signature } });
        }
      } else if (d.side === 'sell' && d.positionId) {
        const open = livePortfolio.openPositions().find((p) => p.position_id === d.positionId);
        if (open) {
          // ONLY record realized P&L from REAL on-chain proceeds; otherwise flag for manual
          // reconciliation (the sell confirmed but proceeds are unknown) — never fabricate a number.
          if (r.fill?.fillSource === 'on_chain' && Number.isFinite(r.fill.proceedsUsd) && r.fill.proceedsUsd > 0) {
            const res = livePortfolio.recordExit({ position_id: d.positionId, fraction: 1, proceeds_usd: r.fill.proceedsUsd, fee_usd_est: 0, price_impact_pct: 0, reason: 'reconciled_exit' });
            if (res.ok) {
              pushEvent({ kind: 'reconciled_exit', position_id: d.positionId, realized_usd: res.realized_usd, signature: it.signature });
              audit({ audit_scope: 'position', audit_reason: 'reconciled_exit', command_type: null, detail: { position_id: d.positionId, intent_id: it.intent_id, signature: it.signature } });
            }
          } else {
            livePortfolio.flagNeedsReconciliation(d.positionId, 'reconciled_exit_proceeds_unconfirmed');
            pushEvent({ kind: 'exit_needs_reconciliation', position_id: d.positionId, signature: it.signature });
            audit({ audit_scope: 'position', audit_reason: 'exit_needs_reconciliation', command_type: null, detail: { position_id: d.positionId, intent_id: it.intent_id, signature: it.signature } });
          }
        }
      }
    }
  }

  // ---------- TP/SL + mark loop (both books; exits routed per book) ----------
  async function markPass() {
    await reconcilePass().catch(() => { /* contained — never block marks/exits */ });
    const cfg = config.get();
    const books = [portfolio, ...(livePortfolio ? [livePortfolio] : [])];
    for (const pf of books) {
      for (const p of pf.openPositions()) {
        if (p.needs_reconciliation) continue; // true state unknown — don't auto-mark/exit; await manual resolution
        const q = await jupiter.usdValueOf({ mint: p.token_mint, qtyUi: p.qty_ui, decimals: p.decimals });
        if (!q.ok) { pf.setMark(p.position_id, p.mark_usd, 'unavailable'); continue; }
        pf.setMark(p.position_id, q.usd, 'valid');
        const pnlPct = p.cost_usd > 0 ? ((q.usd - p.cost_usd) / p.cost_usd) * 100 : 0;
        const op = operatingState.get().operating_state;
        const exitsAllowed = op === 'ACTIVE' || op === 'EXITS_ONLY' || op === 'PAUSED';
        if (!exitsAllowed) continue;
        // max time in position (per-wallet): auto-exit a stale position regardless of P&L
        const w = walletsRegistry.list().find((x) => x.wallet_id === p.wallet_id);
        const maxAge = w?.config?.max_time_in_position;
        if (Number.isFinite(maxAge) && maxAge > 0 && (Date.now() - new Date(p.entry_ts).getTime()) / 1000 > maxAge) {
          await performExit({ pf, p, fraction: 1, reason: 'max_time_in_position' });
          continue;
        }
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
          // NOTE: deliberately NOT engaging a per_mode real_live kill here — that also blocks
          // the live signer/gates, freezing the exits EXITS_ONLY is meant to keep open. Entries
          // are already blocked by EXITS_ONLY + the persisted entries_blocked flag (checkEntryGates).
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
        // Don't auto-resume entries after a daily-loss trip: if either book has entries
        // blocked, stay EXITS_ONLY (a reconnect must not undo the daily-loss entry block).
        const entriesBlocked = portfolio.summary().entries_blocked
          || Boolean(livePortfolio && livePortfolio.summary().entries_blocked);
        if (op === 'WARMING_UP' || (op === 'EXITS_ONLY' && !entriesBlocked)) {
          operatingState.transition('ACTIVE', 'stream connected + readiness ok');
        }
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

  /** Operator-initiated full exit of one position (either book). Gives a manual liquidation
   *  path independent of TP/SL/leader signals, and lets the operator clear a stuck position. */
  async function closePosition(position_id) {
    for (const pf of [portfolio, ...(livePortfolio ? [livePortfolio] : [])]) {
      const p = pf.openPositions().find((x) => x.position_id === position_id);
      if (!p) continue;
      const res = await performExit({ pf, p, fraction: 1, reason: 'manual_close', intentParts: ['sell', p.position_id, 'manual_close'] });
      if (res?.ok) { pushEvent({ kind: 'manual_close', position_id }); return { ok: true, position_id }; }
      return { ok: false, error: res?.error || 'exit_failed' };
    }
    return { ok: false, error: 'position_not_found' };
  }

  return { start, stop, status, events, closePosition, _internal: { onSignature, markPass, reconcilePass, handleLeaderBuy, handleLeaderSell, performExit, desiredState } };
}
