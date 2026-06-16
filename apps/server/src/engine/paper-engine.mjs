// paper-engine.mjs — the trading-engine IMPLEMENTATION substrate. ADR-0001 Phase 5F separated the
// name/ownership: the runtime orchestrator is OWNED by `trading-engine.mjs` (which re-exports
// `createPaperEngine` as `createTradingEngine`); this file holds the implementation. A later phase
// extracts the live orchestration into a pure `packages/trading-engine`, leaving this simulation-only.
// ---
// The live-data engine (simulated fills in PAPER mode, real market data). Supervises: leader-wallet
// ingestion (WS) -> swap detection -> risk gates -> exit feasibility -> fill -> TP/SL monitoring.
// Fail-closed at every step. In PAPER mode quotes only, fills simulated, always labeled simulated;
// LIVE execution (real money) is delegated to the injected liveExecutor — never signed here.
import { detectLeaderSwap, WSOL_MINT, USDC_MINT } from './swap-detector.mjs';
import { checkEntryGates } from './risk-gates.mjs';
import { checkTokenSafety } from './token-safety.mjs';
import { checkEvGate } from './ev-gate.mjs';
import { trailingStopHit, firstTierHit, breakevenStopHit } from './exit-rules.mjs';
import { proportionalLeaderUsd } from './sizing.mjs';
import { checkMarketFilters } from './market-filters.mjs';
import { shouldFire, nextOrderState } from './orders.mjs';
import { createLatencyTracker } from './latency-tracker.mjs';
import { deriveDesiredState, recommendLeader, scoreLeader, finalizeLeaderInsights } from '../../../../packages/trading-engine/src/index.mjs';
import { readJson, writeJson, nowIso } from '../util.mjs';

const EVENTS_FILE = 'engine-events.json';
const MAX_EVENTS = 200;
const FEE_EST_USD = 0.05; // conservative per-trade network fee estimate (labeled estimate)

// Money-safety invariant in ONE place: only book realized P&L from a REAL on-chain fill (the
// native-SOL proceeds were actually read). A finite proceeds of 0 IS real (a rug sale yields ~0);
// an unreadable/estimate fill is NOT and must be flagged for reconciliation instead.
const isRealOnChainProceeds = (fill) => fill?.fillSource === 'on_chain' && Number.isFinite(fill?.proceedsUsd);

export function createPaperEngine({ config, walletsRegistry, killSwitch, operatingState, vault, portfolio, livePortfolio = null, liveExecutor = null, signer = null, rpc, jupiter, audit, broadcast, notifier = null, ordersStore = null }) {
  let sub = null;
  let supervisor = null;
  let markTimer = null;
  let engineState = 'stopped';
  let subscribedAddrs = [];
  const processedSigs = [];
  const processedSet = new Set();
  let lastEventAt = null;
  const latency = createLatencyTracker(); // Phase 0: measure before any Rust/gRPC investment

  function pushEvent(ev) {
    const s = readJson(EVENTS_FILE, { events: [] }).value;
    s.events.push({ ts: nowIso(), ...ev });
    if (s.events.length > MAX_EVENTS) s.events.splice(0, s.events.length - MAX_EVENTS);
    writeJson(EVENTS_FILE, s);
    broadcast({ event_type: 'position_update', engine_event: ev.kind || ev.type || 'event' });
    maybeNotify(ev);
  }

  // Forward notable engine events to the operator notifier (best-effort; never throws/blocks).
  const shortId = (a) => (a ? `${String(a).slice(0, 4)}…${String(a).slice(-4)}` : '');
  function maybeNotify(ev) {
    if (!notifier) return;
    const k = ev.kind;
    let text = null;
    if (k === 'paper_entry' || k === 'live_entry') {
      text = `🟢 ENTRY ${k === 'live_entry' ? 'LIVE' : 'paper'} ${shortId(ev.mint)} ~$${Number(ev.size_usd || 0).toFixed(2)} · leader ${shortId(ev.leader)}`;
    } else if (k === 'paper_exit' || k === 'live_exit') {
      const r = Number(ev.realized_usd || 0);
      text = `${r >= 0 ? '🟢' : '🔴'} EXIT ${k === 'live_exit' ? 'LIVE' : 'paper'} realized $${r.toFixed(2)} · ${ev.reason}`;
    } else if (k === 'daily_loss_limit_hit') {
      text = `⛔ Daily loss limit hit: $${Number(ev.daily_loss_usd || 0).toFixed(2)} — new entries blocked (exits only)`;
    } else if (k === 'leader_auto_paused') {
      text = `⏸ Leader auto-paused after ${ev.consecutive_losses} losses · ${shortId(ev.leader)}`;
    }
    if (text) { try { notifier.notify({ kind: k, text }); } catch { /* never throws into the engine */ } }
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
    // Lifecycle state machine is OWNED by @soltrade/trading-engine (Phase Engine-2). This gathers the
    // runtime inputs from the injected deps; the derivation (ordering + values) lives in the package.
    return deriveDesiredState({
      killBlocked: killSwitch.isBlocked({}).blocked,
      vaultUnlocked: vault.isUnlocked(),
      rpcConfigured: !!rpcUrl(),
      followedCount: followedWallets().length,
      operatingState: operatingState.get().operating_state,
    });
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
  async function resolveSizeUsd({ cfg, wallet, swap }) {
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
    if (mode === 'proportional_leader') {
      // value = % of the leader's own buy size. Needs the leader's spend (from the swap).
      const px = await solUsd();
      const leaderUsd = (swap?.quoteSpentSol || 0) * (px || 0) + (swap?.quoteSpentUsdc || 0);
      const usd = proportionalLeaderUsd({
        leaderUsd, valuePct: value,
        capUsd: cfg.execution?.capital_limit, maxPosPct: cfg.hard_risk?.max_position_size_pct,
      });
      if (usd == null) return { ok: false, error: 'leader_size_unavailable' };
      return { ok: true, usd };
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

    const sized = await resolveSizeUsd({ cfg, wallet, swap });
    if (!sized.ok) {
      pushEvent({ kind: 'entry_rejected', leader, mint: swap.mint, rejections: [`sizing_${sized.error}`] });
      return;
    }
    let sizeUsd = sized.usd;

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

    // Token safety (anti-rug) pre-trade screen — reject ruggable mints (live mint/freeze authority,
    // Token-2022 permanent delegate). Not a risk-cap breach, so it does NOT feed the signer lockout.
    const safety = await checkTokenSafety({ mint: swap.mint, rpc, cfg });
    if (!safety.safe) {
      pushEvent({ kind: 'entry_rejected', leader, mint: swap.mint, rejections: safety.reasons.map((r) => `token_safety:${r}`) });
      return;
    }

    // EV quality gate — block (strict) or warn (warning_only) entries from leaders whose realized
    // history (this book) fails the configured ev.* thresholds, once enough closed trades exist.
    const evGate = checkEvGate({ cfg, stats: typeof pf.leaderStats === 'function' ? pf.leaderStats(leader) : null });
    if (!evGate.allowed) {
      pushEvent({ kind: 'entry_rejected', leader, mint: swap.mint, rejections: evGate.rejections.map((r) => `ev_gate:${r}`) });
      return;
    }
    if (evGate.rejections.length) {
      pushEvent({ kind: 'ev_gate_warning', leader, mint: swap.mint, rejections: evGate.rejections });
    }

    // Exit feasibility BEFORE entry: a sell route must exist for the would-be position
    const slipBps = Math.round((cfg.copy_defaults?.max_entry_slippage_vs_leader || 5) * 100);
    let buyQuote = await jupiter.paperBuy({ mint: swap.mint, sizeUsd, slippageBps: slipBps });
    if (!buyQuote.ok) {
      pushEvent({ kind: 'entry_rejected', leader, mint: swap.mint, rejections: [`route_invalid:${buyQuote.error}`] });
      return;
    }
    let qtyUi = buyQuote.outAmountBase / 10 ** swap.decimals;

    // Late-entry drift guard: if the token already ran past the leader's fill price, skip or shrink
    // (the #1 reason copies lose — you fill after the pump). OFF unless max_entry_drift_pct is set.
    const driftThresh = wallet.config?.max_entry_drift_pct ?? cfg.copy_defaults?.max_entry_drift_pct;
    if (Number.isFinite(driftThresh) && driftThresh > 0 && swap.uiDelta > 0 && qtyUi > 0) {
      const solPx = await solUsd();
      const leaderUsd = (swap.quoteSpentSol || 0) * (solPx || 0) + (swap.quoteSpentUsdc || 0);
      const leaderPx = leaderUsd > 0 ? leaderUsd / swap.uiDelta : 0; // leader's USD price/token
      const ourPx = sizeUsd / qtyUi;                                 // our would-be USD price/token
      if (leaderPx > 0) {
        const driftPct = ((ourPx - leaderPx) / leaderPx) * 100;
        if (driftPct > driftThresh) {
          const action = wallet.config?.drift_action ?? cfg.copy_defaults?.drift_action ?? 'skip';
          if (action === 'shrink') {
            const shrunk = sizeUsd * Math.max(0, Math.min(1, driftThresh / driftPct));
            if (shrunk < 1) {
              pushEvent({ kind: 'entry_skipped_late_entry', leader, mint: swap.mint, drift_pct: Number(driftPct.toFixed(1)), threshold: driftThresh });
              return;
            }
            const rq = await jupiter.paperBuy({ mint: swap.mint, sizeUsd: shrunk, slippageBps: slipBps });
            if (!rq.ok) { pushEvent({ kind: 'entry_rejected', leader, mint: swap.mint, rejections: [`route_invalid:${rq.error}`] }); return; }
            sizeUsd = shrunk; buyQuote = rq; qtyUi = rq.outAmountBase / 10 ** swap.decimals;
            pushEvent({ kind: 'entry_drift_shrunk', leader, mint: swap.mint, drift_pct: Number(driftPct.toFixed(1)), new_size_usd: Number(shrunk.toFixed(2)) });
          } else {
            pushEvent({ kind: 'entry_skipped_late_entry', leader, mint: swap.mint, drift_pct: Number(driftPct.toFixed(1)), threshold: driftThresh });
            return;
          }
        }
      }
    }

    // Optional FDV (market-cap) band — quality filter; skips (allows) when supply/price unreadable.
    const mfilt = await checkMarketFilters({ mint: swap.mint, rpc, cfg, priceUsdPerToken: qtyUi > 0 ? sizeUsd / qtyUi : null });
    if (!mfilt.ok) {
      pushEvent({ kind: 'entry_rejected', leader, mint: swap.mint, rejections: mfilt.reasons.map((r) => `market_filter:${r}`) });
      return;
    }
    if (mfilt.skipped?.length) pushEvent({ kind: 'market_filter_skipped', leader, mint: swap.mint, skipped: mfilt.skipped });

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
      // confirmed tx but no tokens credited (unreadable/zero on-chain fill) — do NOT book a
      // 0-qty phantom position (it would read as instant -100% and churn a sell of nothing).
      // The intent stays CONFIRMED in the ledger for the operator to inspect.
      if (!Number.isFinite(exec.outUi) || exec.outUi <= 0) {
        pushEvent({ kind: 'live_entry_zero_fill', leader, mint: swap.mint, signature: exec.signature, intent_id: exec.intent_id });
        audit({ audit_scope: 'position', audit_reason: 'live_entry_zero_fill', command_type: null, detail: { mint: swap.mint, signature: exec.signature, intent_id: exec.intent_id } });
        return;
      }
      const pos = pf.recordEntry({
        leader_address: leader, wallet_id: wallet.wallet_id, token_mint: swap.mint,
        // cost basis = ACTUAL exact swap input (excl. fee/rent) when available, else intended sizeUsd
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
  // Auto-pause a leader after N consecutive losing closed positions (GMGN/OdinBot-style
  // protection). Off unless copy_defaults.auto_pause_after_losses (or the per-wallet override) is set.
  function maybeAutoPause(p, pf) {
    if (typeof pf.leaderConsecutiveLosses !== 'function') return;
    const w = walletsRegistry.list().find((x) => x.wallet_id === p.wallet_id);
    if (!w || !w.follow_enabled) return;
    const cfg = config.get();
    const threshold = w.config?.auto_pause_after_losses ?? cfg.copy_defaults?.auto_pause_after_losses;
    if (!Number.isFinite(threshold) || threshold <= 0) return;
    const losses = pf.leaderConsecutiveLosses(p.leader_address);
    if (losses >= threshold) {
      walletsRegistry.setFollow(w.wallet_id, false);
      pushEvent({ kind: 'leader_auto_paused', leader: p.leader_address, wallet_id: w.wallet_id, consecutive_losses: losses, threshold });
      audit({ audit_scope: 'wallet', audit_reason: 'leader_auto_paused', command_type: null, detail: { wallet_id: w.wallet_id, leader: p.leader_address, consecutive_losses: losses } });
    }
  }

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
      if (!isRealOnChainProceeds(exec)) {
        pf.flagNeedsReconciliation(p.position_id, `exit_proceeds_unconfirmed_${reason}`);
        pushEvent({ kind: 'exit_needs_reconciliation', position_id: p.position_id, reason, signature: exec.signature });
        return { ok: false, needs_reconciliation: true };
      }
      const res = pf.recordExit({
        position_id: p.position_id, fraction, proceeds_usd: Math.max(0, exec.proceedsUsd),
        // proceeds come from the on-chain native-SOL delta, already net of network/priority fees —
        // do NOT subtract an extra fee estimate (that would double-count fees in realized P&L)
        fee_usd_est: 0, price_impact_pct: exec.priceImpactPct, reason,
      });
      if (res.ok) { pushEvent({ kind: 'live_exit', position_id: p.position_id, reason, proceeds_usd: exec.proceedsUsd, realized_usd: res.realized_usd, signature: exec.signature }); maybeAutoPause(p, pf); }
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
    if (res.ok) { pushEvent({ kind: 'paper_exit', position_id: p.position_id, reason, proceeds_usd: q.usd, realized_usd: res.realized_usd }); maybeAutoPause(p, pf); }
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
    // front-run the dump: optionally exit our position when the leader sells, even in
    // follow_entry_user_exit mode (a leader/dev sell is a strong exit signal). OFF by default.
    const exitOnLeaderSell = wallet.config?.exit_on_leader_sell ?? cfg.copy_defaults?.exit_on_leader_sell ?? false;
    // mirror sells act on BOTH books (paper history continues while live runs)
    const books = [portfolio, ...(livePortfolio ? [livePortfolio] : [])];
    let found = false;
    for (const pf of books) {
      // skip positions awaiting manual reconciliation — their on-chain exit already happened
      // (tokens likely gone); re-selling them here would be a duplicate / wasted intent.
      const open = pf.openPositions().filter((p) => p.leader_address === leader && p.token_mint === swap.mint && !p.needs_reconciliation);
      if (!open.length) continue;
      found = true;
      if (wallet.copy_mode === 'full_mirror') {
        for (const p of open) {
          const reason = swap.fullExit ? 'leader_full_exit_mirrored' : 'leader_partial_sell_mirrored';
          // keyed by the leader's signature so each distinct leader sell mirrors independently;
          // if the signature is unavailable, fall back to the stable per-logical-exit key (no date).
          const intentParts = signature ? ['sell', p.position_id, reason, signature] : ['sell', p.position_id, reason];
          await performExit({ pf, p, fraction, reason, intentParts });
        }
      } else if (exitOnLeaderSell) {
        // follow_entry mode but operator opted to front-run: full-exit on any leader sell
        for (const p of open) {
          const intentParts = signature ? ['sell', p.position_id, 'leader_sell_frontrun', signature] : ['sell', p.position_id, 'leader_sell_frontrun'];
          await performExit({ pf, p, fraction: 1, reason: 'leader_sell_frontrun', intentParts });
        }
        pushEvent({ kind: 'leader_sell_frontrun_exit', leader, mint: swap.mint, positions: open.length });
      } else {
        pushEvent({ kind: 'leader_sell_risk_modifier_only', leader, mint: swap.mint, note: 'follow_entry_user_exit ignores leader sells by policy' });
      }
    }
    if (!found) pushEvent({ kind: 'leader_sell_no_position', leader, mint: swap.mint });
  }

  // Unified leader-activity handler. txInline present on Helius transactionSubscribe
  // (no round-trip); null on generic logsSubscribe (we fetch once, deduped).
  async function onLeaderActivity({ signature, tx: txInline }) {
    if (!rememberSig(signature)) return;
    const recvAt = Date.now();
    lastEventAt = recvAt;
    let txResult = txInline;
    if (!txResult) {
      const tx = await rpc.getTransaction(signature);
      if (!tx.ok || !tx.result) return;
      txResult = tx.result;
    }
    // Phase 0 gate: how stale was the leader signal when we received it? Solana blockTime is
    // in SECONDS; this lag is exactly what a gRPC/ShredStream ingestion upgrade would shrink.
    // NOTE: blockTime is present only on the generic logsSubscribe path (we fetch via
    // getTransaction). On Helius inline / gRPC it is absent, so ingestion_lag_ms is simply not
    // recorded there (decision_ms still is) — see docs/RESTRUCTURE_PLAN.md. A slot-based timing
    // source for those transports is a follow-up; we never record a fabricated lag.
    const blockTimeMs = Number.isFinite(txResult?.blockTime) ? txResult.blockTime * 1000 : null;
    let acted = false;
    for (const w of followedWallets()) {
      const swap = detectLeaderSwap({ tx: txResult, leaderAddress: w.tracked_wallet_address });
      if (swap.kind === 'buy') { await handleLeaderBuy({ leader: w.tracked_wallet_address, wallet: w, swap, signature }); acted = true; }
      else if (swap.kind === 'sell') { await handleLeaderSell({ leader: w.tracked_wallet_address, wallet: w, swap, signature }); acted = true; }
    }
    if (acted) {
      latency.record({
        ingestion_lag_ms: blockTimeMs != null ? recvAt - blockTimeMs : undefined,
        decision_ms: Date.now() - recvAt,
      });
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
            // cost_usd from ...d.recovery is the exact ExactIn input recorded at send time
            ...d.recovery, token_mint: d.mint, qty_ui: r.fill.outUi,
            fee_usd_est: FEE_EST_USD, price_impact_pct: 0, intent_id: it.intent_id,
          });
          pushEvent({ kind: 'reconciled_orphan_entry', position_id: pos.position_id, leader: d.recovery.leader_address, mint: d.mint, signature: it.signature });
          audit({ audit_scope: 'position', audit_reason: 'reconciled_orphan_entry', command_type: null, detail: { position_id: pos.position_id, intent_id: it.intent_id, signature: it.signature } });
        }
      } else if (d.side === 'sell' && d.positionId) {
        const open = livePortfolio.openPositions().find((p) => p.position_id === d.positionId);
        if (open) {
          // the sell may have been a PARTIAL leader trim; derive the fraction actually sold from the
          // intent's requested token qty vs the still-open qty so we don't over-close the position.
          const soldQty = Number(d.qtyUi);
          const fraction = open.qty_ui > 0 && Number.isFinite(soldQty) && soldQty > 0
            ? Math.min(1, soldQty / open.qty_ui) : 1;
          // ONLY record realized P&L from REAL on-chain proceeds; otherwise flag for manual
          // reconciliation (the sell confirmed but proceeds are unknown) — never fabricate a number.
          if (isRealOnChainProceeds(r.fill)) {
            const res = livePortfolio.recordExit({ position_id: d.positionId, fraction, proceeds_usd: Math.max(0, r.fill.proceedsUsd), fee_usd_est: 0, price_impact_pct: 0, reason: 'reconciled_exit' });
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
    await pollOrders().catch(() => { /* contained — order polling never blocks marks/exits */ });
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
        // trailing stop (per-wallet override -> global default): protects gains once armed.
        const trailingPct = Number(w?.config?.trailing_stop_pct ?? cfg.copy_defaults?.trailing_stop_pct);
        const peakPct = Math.max(p.peak_pnl_pct ?? pnlPct, pnlPct);
        if (trailingStopHit({ pnlPct, peakPct, trailingPct })) {
          await performExit({ pf, p, fraction: 1, reason: 'trailing_stop_hit' });
          continue;
        }
        // break-even stop on the moonbag (only armed after the first tier banked profit)
        const breakevenAfterTp1 = (w?.config?.breakeven_after_tp1 ?? cfg.copy_defaults?.breakeven_after_tp1) === true;
        if (breakevenStopHit({ pnlPct, tp1Done: p.tp1_done, breakevenAfterTp1 })) {
          await performExit({ pf, p, fraction: 1, reason: 'breakeven_stop' });
          continue;
        }
        // first-tier partial take-profit: bank tp1_sell_pct of the position, let the rest ride
        const tp1Pct = Number(w?.config?.tp1_pct ?? cfg.copy_defaults?.tp1_pct);
        if (firstTierHit({ pnlPct, tp1Pct, done: p.tp1_done })) {
          const sellRaw = Number(w?.config?.tp1_sell_pct ?? cfg.copy_defaults?.tp1_sell_pct);
          const sellPct = Number.isFinite(sellRaw) && sellRaw > 0 ? sellRaw : 50;
          const frac = Math.min(1, Math.max(0.01, sellPct / 100));
          const res = await performExit({ pf, p, fraction: frac, reason: 'take_profit_tier1' });
          // Only mark the tier done (which arms break-even) when the partial ACTUALLY banked AND
          // the position still rides. A refused/unconfirmed live sell leaves tp1_done false so it
          // retries next tick; a 100% sell closed the position so there is nothing to arm.
          if (res?.ok && res.closed !== true) pf.markTp1Done(p.position_id);
          continue; // one exit attempt per tick — don't also run full TP/SL this pass
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
      // a flagged position already exited on-chain (proceeds unread) — a fresh sell would try to
      // move tokens that are gone. Route the operator to resolve_position (book real proceeds).
      if (p.needs_reconciliation) return { ok: false, error: 'position_needs_reconciliation', position_id };
      const res = await performExit({ pf, p, fraction: 1, reason: 'manual_close', intentParts: ['sell', p.position_id, 'manual_close'] });
      if (res?.ok) { pushEvent({ kind: 'manual_close', position_id }); return { ok: true, position_id }; }
      return { ok: false, error: res?.error || 'exit_failed', needs_reconciliation: res?.needs_reconciliation };
    }
    return { ok: false, error: 'position_not_found' };
  }

  /** Operator resolution of a needs_reconciliation position: book the REAL proceeds the operator
   *  read off-chain, close it, clear the flag, and surface the realized P&L (which now feeds the
   *  daily-loss breaker). The only path that retires a flagged position. */
  function resolvePosition(position_id, proceeds_usd) {
    for (const pf of [portfolio, ...(livePortfolio ? [livePortfolio] : [])]) {
      const p = pf.state().positions.find((x) => x.position_id === position_id);
      if (!p) continue;
      if (typeof pf.resolveReconciliation !== 'function') return { ok: false, error: 'unsupported' };
      const res = pf.resolveReconciliation(position_id, proceeds_usd);
      if (res.ok) {
        pushEvent({ kind: 'position_reconciled', position_id, proceeds_usd, realized_usd: res.realized_usd });
        audit({ audit_scope: 'position', audit_reason: 'position_reconciled', command_type: 'resolve_position', detail: { position_id, proceeds_usd, realized_usd: res.realized_usd } });
      }
      return res;
    }
    return { ok: false, error: 'position_not_found' };
  }

  /** Operator-initiated MANUAL buy of an arbitrary mint (sniper mode). Runs the SAME gates as a
   *  copy entry (risk caps, anti-rug, FDV, exit-feasibility) — there is no leader, so no drift/
   *  rebuy-cooldown. paper or live by mode. leader_address='MANUAL', wallet_id='manual'. */
  async function manualBuy({ mint, sizeUsd }) {
    const cfg = config.get();
    const isLive = liveMode();
    const pf = activePf();
    if (typeof mint !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return { ok: false, error: 'invalid_mint' };
    const size = Number(sizeUsd);
    if (!Number.isFinite(size) || size <= 0) return { ok: false, error: 'invalid_size' };

    const sup = await rpc.rpc('getTokenSupply', [mint, { commitment: 'confirmed' }]);
    const decimals = sup.ok ? Number(sup.result?.value?.decimals) : NaN;
    if (!Number.isFinite(decimals)) return { ok: false, error: 'mint_unreadable' };

    const gate = checkEntryGates({
      cfg, portfolio: pf, sizeUsd: size, tokenMint: mint,
      killBlocked: killSwitch.isBlocked({ mode: isLive ? 'real_live' : 'paper' }).blocked,
      operatingState: operatingState.get().operating_state,
      entriesBlocked: pf.summary().entries_blocked, leaderAddress: 'MANUAL',
    });
    if (!gate.allowed) { pushEvent({ kind: 'manual_entry_rejected', mint, rejections: gate.rejections }); return { ok: false, error: 'gates_refused', rejections: gate.rejections }; }

    const safety = await checkTokenSafety({ mint, rpc, cfg });
    if (!safety.safe) { pushEvent({ kind: 'manual_entry_rejected', mint, rejections: safety.reasons.map((r) => `token_safety:${r}`) }); return { ok: false, error: 'unsafe_token', rejections: safety.reasons }; }

    const slipBps = Math.round((cfg.copy_defaults?.max_entry_slippage_vs_leader || 5) * 100);
    const buyQuote = await jupiter.paperBuy({ mint, sizeUsd: size, slippageBps: slipBps });
    if (!buyQuote.ok) { pushEvent({ kind: 'manual_entry_rejected', mint, rejections: [`route_invalid:${buyQuote.error}`] }); return { ok: false, error: buyQuote.error }; }
    const qtyUi = buyQuote.outAmountBase / 10 ** decimals;

    const mfilt = await checkMarketFilters({ mint, rpc, cfg, priceUsdPerToken: qtyUi > 0 ? size / qtyUi : null });
    if (!mfilt.ok) { pushEvent({ kind: 'manual_entry_rejected', mint, rejections: mfilt.reasons.map((r) => `market_filter:${r}`) }); return { ok: false, error: 'market_filter', rejections: mfilt.reasons }; }

    const sellCheck = await jupiter.usdValueOf({ mint, qtyUi, decimals });
    if (!sellCheck.ok) { pushEvent({ kind: 'manual_entry_rejected', mint, rejections: [`exit_feasibility_fail:${sellCheck.error}`] }); return { ok: false, error: sellCheck.error }; }

    const tp = cfg.copy_defaults?.take_profit_pct ?? 50;
    const sl = cfg.copy_defaults?.stop_loss_pct ?? 30;

    if (isLive && liveExecutor) {
      const exec = await liveExecutor.executeSwap({
        side: 'buy', mint, sizeUsd: size, decimals, slippageBps: slipBps,
        intentParts: ['buy', 'MANUAL', mint, String(Date.now())], // each manual buy is a distinct intent
        recovery: { leader_address: 'MANUAL', wallet_id: 'manual', decimals, cost_usd: size, copy_mode: 'manual', tp_pct: tp, sl_pct: sl },
      });
      if (!exec.ok) { pushEvent({ kind: 'manual_entry_refused', mint, error: exec.error, refusals: exec.refusals || [] }); return { ok: false, error: exec.error, refusals: exec.refusals }; }
      if (!Number.isFinite(exec.outUi) || exec.outUi <= 0) { pushEvent({ kind: 'manual_entry_zero_fill', mint, signature: exec.signature }); return { ok: false, error: 'zero_fill', signature: exec.signature }; }
      const pos = pf.recordEntry({
        leader_address: 'MANUAL', wallet_id: 'manual', token_mint: mint,
        qty_ui: exec.outUi, decimals, cost_usd: exec.costUsd ?? size, fee_usd_est: FEE_EST_USD,
        price_impact_pct: exec.priceImpactPct, copy_mode: 'manual', tp_pct: tp, sl_pct: sl, intent_id: exec.intent_id,
      });
      pushEvent({ kind: 'manual_entry', mint, position_id: pos.position_id, size_usd: size, qty_ui: exec.outUi, signature: exec.signature });
      audit({ audit_scope: 'position', audit_reason: 'manual_entry_recorded', command_type: 'manual_buy', detail: { position_id: pos.position_id, mint, size_usd: size, signature: exec.signature, simulated: false } });
      return { ok: true, position_id: pos.position_id, signature: exec.signature };
    }

    const pos = pf.recordEntry({
      leader_address: 'MANUAL', wallet_id: 'manual', token_mint: mint,
      qty_ui: qtyUi, decimals, cost_usd: size, fee_usd_est: FEE_EST_USD,
      price_impact_pct: buyQuote.priceImpactPct, copy_mode: 'manual', tp_pct: tp, sl_pct: sl,
    });
    pushEvent({ kind: 'manual_entry', mint, position_id: pos.position_id, size_usd: size, qty_ui: qtyUi });
    audit({ audit_scope: 'position', audit_reason: 'manual_entry_recorded', command_type: 'manual_buy', detail: { position_id: pos.position_id, mint, size_usd: size, simulated: true } });
    return { ok: true, position_id: pos.position_id };
  }

  /** Operator-initiated partial/full MANUAL sell of an open position (either book). */
  async function manualSell({ position_id, fraction = 1 }) {
    const f = Math.min(1, Math.max(0.01, Number(fraction) || 1));
    for (const pf of [portfolio, ...(livePortfolio ? [livePortfolio] : [])]) {
      const p = pf.openPositions().find((x) => x.position_id === position_id);
      if (!p) continue;
      if (p.needs_reconciliation) return { ok: false, error: 'position_needs_reconciliation', position_id };
      const res = await performExit({ pf, p, fraction: f, reason: 'manual_sell', intentParts: ['sell', p.position_id, 'manual_sell', String(Date.now())] });
      if (res?.ok) { pushEvent({ kind: 'manual_sell', position_id, fraction: f }); return { ok: true, position_id, fraction: f, realized_usd: res.realized_usd, closed: res.closed }; }
      return { ok: false, error: res?.error || 'exit_failed', needs_reconciliation: res?.needs_reconciliation };
    }
    return { ok: false, error: 'position_not_found' };
  }

  // ---------- limit / DCA orders ----------
  async function priceOfMint(mint, decimals) {
    // buy-side USD price per token from a $1 quote (what a limit buy would actually pay)
    const q = await jupiter.paperBuy({ mint, sizeUsd: 1, slippageBps: 100 });
    if (!q.ok) return null;
    const tokens = q.outAmountBase / 10 ** decimals;
    return tokens > 0 ? 1 / tokens : null;
  }

  async function addOrder(spec) {
    if (!ordersStore) return { ok: false, error: 'orders_unsupported' };
    const { type, mint } = spec || {};
    if (typeof mint !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return { ok: false, error: 'invalid_mint' };
    const size = Number(spec?.size_usd);
    if (!Number.isFinite(size) || size <= 0) return { ok: false, error: 'invalid_size' };
    const sup = await rpc.rpc('getTokenSupply', [mint, { commitment: 'confirmed' }]);
    const decimals = sup.ok ? Number(sup.result?.value?.decimals) : NaN;
    if (!Number.isFinite(decimals)) return { ok: false, error: 'mint_unreadable' };
    if (type === 'limit_buy') {
      const target = Number(spec?.target_price_usd);
      if (!Number.isFinite(target) || target <= 0) return { ok: false, error: 'invalid_target_price' };
      return { ok: true, order: ordersStore.add({ type, mint, decimals, size_usd: size, target_price_usd: target }) };
    }
    if (type === 'dca') {
      const interval = Number(spec?.interval_sec);
      const total = Number(spec?.total);
      if (!Number.isFinite(interval) || interval < 30) return { ok: false, error: 'invalid_interval' }; // floor 30s
      if (!Number.isFinite(total) || total < 1 || total > 1000) return { ok: false, error: 'invalid_total' };
      return { ok: true, order: ordersStore.add({ type, mint, decimals, size_usd: size, interval_sec: interval, total, done: 0, next_at: Date.now() }) };
    }
    return { ok: false, error: 'invalid_order_type' };
  }

  function listOrders() { return ordersStore ? ordersStore.list() : []; }
  function cancelOrder(order_id) { return ordersStore ? ordersStore.cancel(order_id) : { ok: false, error: 'orders_unsupported' }; }

  // Poll open orders and fire matured ones through the SAME gated manualBuy path.
  async function pollOrders() {
    if (!ordersStore) return;
    for (const o of ordersStore.openOrders()) {
      const price = o.type === 'limit_buy' ? await priceOfMint(o.mint, o.decimals).catch(() => null) : null;
      if (!shouldFire({ order: o, price, now: Date.now() })) continue;
      const r = await manualBuy({ mint: o.mint, sizeUsd: o.size_usd });
      const updated = nextOrderState({ order: o, ok: !!r?.ok, now: Date.now(), error: r?.error || (r?.rejections ? r.rejections.join(',') : null) });
      ordersStore.replace(o.order_id, updated);
      if (r?.ok) pushEvent({ kind: o.type === 'dca' ? 'dca_buy_filled' : 'limit_buy_filled', order_id: o.order_id, mint: o.mint, position_id: r.position_id });
    }
  }

  /** Phase 0 latency report (pipeline-lag percentiles). Decides whether the gRPC/Rust
   *  investment is justified — see docs/RESTRUCTURE_PLAN.md. */
  function latencyReport() { return latency.summary(); }

  /** Per-leader insights from THIS bot's own realized history (active book) + a follow/drop/watch
   *  recommendation — closes the analyze->act loop using in-process data (no Python sidecar needed).
   *  watch = too few trades to judge; drop = enough sample but fails the EV thresholds (or net-loss);
   *  follow = enough sample and healthy. */
  function leaderInsights() {
    const pf = activePf();
    const cfg = config.get();
    const empty = { mode: cfg.mode, leaders: [], recommendation: { follow: [], drop: [], watch: [] } };
    if (!pf || typeof pf.leaderStats !== 'function') return empty;
    const minSample = Number(cfg.ev?.minimum_sample_size);
    const r2 = (n) => Math.round(n * 100) / 100;
    // Pure recommendation / score / roll-up are OWNED by @soltrade/trading-engine (Phase Engine-3). This
    // gathers the impure inputs (per-leader stats from the store + the EV-gate verdict, run only when there
    // is enough sample, exactly as before) and shapes the row; the package decides + ranks + groups.
    const leaders = walletsRegistry.list().map((w) => {
      const leader = w.tracked_wallet_address;
      const s = pf.leaderStats(leader);
      const inSample = Number.isFinite(minSample) && s.trades >= minSample;
      const evGateRejected = inSample ? checkEvGate({ cfg, stats: s }).rejections.length > 0 : false;
      return {
        leader, wallet_id: w.wallet_id, label: w.label || '', follow_enabled: w.follow_enabled,
        trades: s.trades, win_rate: r2(s.win_rate),
        profit_factor: Number.isFinite(s.profit_factor) ? r2(s.profit_factor) : null,
        total_realized_usd: r2(s.total_realized), avg_realized_usd: r2(s.avg_realized),
        consecutive_losses: typeof pf.leaderConsecutiveLosses === 'function' ? pf.leaderConsecutiveLosses(leader) : 0,
        score: r2(scoreLeader(s)),
        recommendation: recommendLeader({ stats: s, minSample, evGateRejected }),
      };
    });
    return finalizeLeaderInsights({ mode: cfg.mode, leaders });
  }

  return { start, stop, status, events, closePosition, resolvePosition, manualBuy, manualSell, addOrder, listOrders, cancelOrder, latencyReport, leaderInsights, _internal: { onSignature, markPass, reconcilePass, handleLeaderBuy, handleLeaderSell, performExit, pollOrders, resolvePosition, leaderInsights, desiredState } };
}
