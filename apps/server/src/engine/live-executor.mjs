// live-executor.mjs — the ONLY path that moves real money. Every call passes the full
// gate chain, is idempotent via the intent ledger, audited before signing and after
// sending, and fails closed on ANY anomaly. SOL-denominated swaps (every funded
// wallet holds SOL): buy = SOL -> token, sell = token -> SOL.
import { createHash } from 'node:crypto';
import { readJson, writeJson, nowIso } from '../util.mjs';
import { seedFromStoredSecret, keypairFromSeed, signSerializedTransaction } from './tx-signer.mjs';
import { buildTipTransferTx, selectTipLamports } from './jito-tip-tx.mjs';
import { WSOL_MINT, USDC_MINT } from './swap-detector.mjs';
import { createDecisionLedger, createJsonIntentStore } from '../../../../packages/decision-ledger/src/index.mjs';

const INTENTS_FILE = 'intent-ledger.json';
const SOL_RESERVE_LAMPORTS = 0.05 * 1e9; // never spend the fee/rent reserve
const SIGNER_SECRET_NAME = 'signer_keypair';

export function createLiveExecutor({ config, vault, signer, killSwitch, operatingState, rpc, jupiter, audit, broadcast, hotSigner = null, jitoSendBundle = null, getJitoTipFloor = null, decisionLedgerStore = null }) {
  let solPriceCache = { usd: null, at: 0 };

  // Resolve the Jito tip in lamports: dynamic reads the live tip floor (with a fixed fallback),
  // fixed uses the configured lamports. Never throws — degrades to the fixed value.
  async function resolveTipLamports(exec) {
    const fixed = Number.isFinite(exec?.jito_tip_lamports) ? exec.jito_tip_lamports : 10000;
    if (exec?.jito_tip_mode !== 'dynamic' || typeof getJitoTipFloor !== 'function') return fixed;
    let floor = null;
    try { floor = await getJitoTipFloor(); } catch { floor = null; }
    return selectTipLamports({ floor, percentile: exec.jito_tip_percentile ?? 50, fixedLamports: fixed, maxLamports: exec.jito_tip_max_lamports ?? null });
  }

  // Worst-case tip to RESERVE in the balance check (no network). Must mirror selectTipLamports'
  // ceiling exactly so the reserve is always >= the tip actually sent: the explicit cap if set,
  // else the fixed value (which is also the ceiling when no cap is configured).
  function maxTipReserveLamports(exec) {
    const fixed = Number.isFinite(exec?.jito_tip_lamports) ? exec.jito_tip_lamports : 10000;
    if (exec?.jito_tip_mode !== 'dynamic') return fixed;
    return Math.max(fixed, Number.isFinite(exec?.jito_tip_max_lamports) ? exec.jito_tip_max_lamports : fixed);
  }

  // ---------- intent ledger (idempotency: a retry can NEVER duplicate an on-chain tx) ----------
  // The idempotent intent ledger is OWNED by @soltrade/decision-ledger (ADR-0001 Phase 2A) — the
  // canonical and only path. The store is injected by the host (STORAGE_BACKEND=postgres provides a
  // Postgres-backed store; default = the JSON store), and the ledger logic is identical either way.
  // (The legacy in-process ledger was removed in the hard legacy purge — see legacy-audit.md §10.)
  //
  // RETRYABLE statuses PROVABLY never reached the chain — safe to retry (e.g. a stop-loss whose
  // first broadcast hit a transient RPC error). SENT/SENT_PENDING/SENT_UNCONFIRMED/CONFIRMED may
  // have landed, so they stay blocked (no double-spend). FAILED_ON_CHAIN is retryable: a reverted
  // tx provably moved no funds, so a fresh tx (new blockhash/signature) is safe.
  const RETRYABLE_STATUSES = ['FAILED_PRE_SEND', 'FAILED_SEND', 'FAILED_ON_CHAIN'];
  // sha256 intent id — apps/server may use node:crypto (the package may not, by confinement), so we
  // inject this into the ledger to keep intent ids stable.
  const sha256IntentId = (parts) => `int_${createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16)}`;
  const ledger = createDecisionLedger({
    store: decisionLedgerStore || createJsonIntentStore({ file: INTENTS_FILE, readJson, writeJson, fallback: { intents: {} } }),
    now: nowIso,
    retryableStatuses: RETRYABLE_STATUSES,
    intentIdFor: sha256IntentId,
  });
  const { intentIdFor, claimIntent, setIntent, getIntent, listIntents, pendingIntents: pendingIntentsImpl } = ledger;

  // ---------- helpers ----------
  function safeAudit(record) {
    try { audit(record); return true; } catch { return false; }
  }

  function ownerKeypair() {
    const r = vault.getSecretForUse(SIGNER_SECRET_NAME);
    if (!r.ok) return { ok: false, error: r.error };
    try {
      const seed = seedFromStoredSecret(r.value);
      const kp = keypairFromSeed(seed);
      return { ok: true, kp, seed };
    } catch (e) {
      return { ok: false, error: String(e?.message || 'key_parse_failed') };
    }
  }

  async function solPriceUsd() {
    if (solPriceCache.usd && Date.now() - solPriceCache.at < 60000) return solPriceCache.usd;
    const q = await jupiter.quote({ inputMint: WSOL_MINT, outputMint: USDC_MINT, amountBaseUnits: 1e9 });
    if (!q.ok) return null;
    const usd = q.outAmount / 1e6;
    // plausibility band: a glitched/manipulated SOL-USDC quote must NOT silently mis-size every
    // buy (amountBaseUnits = sizeUsd/price). Reject anything outside a sane SOL price range.
    if (!Number.isFinite(usd) || usd < 1 || usd > 100000) return null;
    solPriceCache = { usd, at: Date.now() };
    return usd;
  }

  /** Full gate chain. action: 'entry' | 'exit'. Fail-closed: any uncertainty refuses. */
  function gates({ action, notionalUsd }) {
    const cfg = config.get();
    const refusals = [];
    if (cfg.mode !== 'real_live') refusals.push('mode_not_real_live');
    const kill = killSwitch.isBlocked({ mode: 'real_live' });
    if (kill.blocked) refusals.push(`kill_switch_${kill.level}`);
    const op = operatingState.get().operating_state;
    if (action === 'entry' && op !== 'ACTIVE') refusals.push(`operating_state_${op}_blocks_entry`);
    if (action === 'exit' && !['ACTIVE', 'EXITS_ONLY', 'PAUSED', 'KILLED'].includes(op)) refusals.push(`operating_state_${op}_blocks_exit`);
    if (!vault.isUnlocked()) refusals.push('vault_locked');
    const can = signer.canSignNow({ notional_usd: notionalUsd });
    if (!can.allowed) refusals.push(`signer_${can.reason}`);
    return { allowed: refusals.length === 0, refusals };
  }

  /** Broadcast a signed swap tx. Jito backend (flagged): bundle the swap tx with a tip-transfer
   *  tx (atomic, same slot). ANY Jito failure falls back to plain RPC sendTransaction, so a Jito
   *  outage/misconfig can never block a live send. Returns the rpc()-shaped { ok, result/error }. */
  async function submitSigned({ signedTxBase64, signatureB58, owner, seed }) {
    const cfg = config.get();
    if (cfg.execution?.submit_backend === 'jito' && jitoSendBundle && cfg.execution?.jito_tip_account) {
      try {
        const bh = await rpc.rpc('getLatestBlockhash', [{ commitment: 'confirmed' }]);
        const blockhash = bh.ok ? bh.result?.value?.blockhash : null;
        if (blockhash) {
          const tipLamports = await resolveTipLamports(cfg.execution);
          const tipTx = buildTipTransferTx({ owner, tipAccount: cfg.execution.jito_tip_account, lamports: tipLamports, recentBlockhash: blockhash });
          // Phase Rust-3: sign the bundle's TIP leg via the Rust hot-executor when configured (the swap leg
          // is already Rust-signed in rust mode) — so the WHOLE executed bundle is Rust-signed. Fail-safe:
          // any hot-executor failure falls back to in-process signing, so it can never block the bundle.
          let tipSignedTx = null;
          if (cfg.execution?.signer_backend === 'rust' && hotSigner && typeof hotSigner.signBundle === 'function') {
            const rb = await hotSigner.signBundle({ txsBase64: [tipTx], seed });
            if (rb?.ok && rb.signed?.[0]) tipSignedTx = rb.signed[0];
          }
          if (!tipSignedTx) tipSignedTx = signSerializedTransaction({ txBase64: tipTx, seed }).signedTxBase64;
          const bundleTxs = [signedTxBase64, tipSignedTx];
          // Phase Rust-4: assemble the Jito sendBundle request BODY via the Rust hot-executor when
          // configured (the execution owner owns hot-path assembly); the POST stays here in JS. Fail-safe:
          // any hot-executor failure leaves bundleBody null -> jitoSendBundle assembles the body itself.
          let bundleBody = null;
          if (cfg.execution?.signer_backend === 'rust' && hotSigner && typeof hotSigner.buildBundle === 'function') {
            const bb = await hotSigner.buildBundle({ signedTxs: bundleTxs });
            if (bb?.ok && bb.body) bundleBody = bb.body;
          }
          const res = await jitoSendBundle(bundleTxs, bundleBody ? { body: bundleBody } : undefined);
          // on accept, the swap tx still lands under its deterministic signature
          if (res?.ok) return { ok: true, result: signatureB58, via: 'jito' };
        }
      } catch { /* fall through to RPC */ }
    }
    // Phase Rust-4: assemble the sendTransaction request BODY via the Rust hot-executor when configured;
    // the POST itself — retries, health recording, JSON-RPC error mapping (the `rpc_*` codes the caller
    // keys idempotency off) — stays here in JS. Fail-safe: any hot-executor failure leaves submitBody null
    // -> rpc.rpc() assembles the body itself (byte-for-byte the same params).
    const skipPreflight = false;
    const maxRetries = 3;
    let submitBody = null;
    if (cfg.execution?.signer_backend === 'rust' && hotSigner && typeof hotSigner.buildSubmit === 'function') {
      const sb = await hotSigner.buildSubmit({ signedTxBase64, skipPreflight, maxRetries });
      if (sb?.ok && sb.body) submitBody = sb.body;
    }
    return rpc.rpc('sendTransaction', [signedTxBase64, { encoding: 'base64', skipPreflight, maxRetries }], submitBody ? { body: submitBody } : undefined);
  }

  // Phase Rust-5: prefer the Rust EXECUTION ENVELOPE — sign every leg AND assemble the submit/bundle body
  // in ONE call (Rust "understands" the buy/sell command as a unit). Returns { signed, doPost } or NULL to
  // fall back to the current sign + submitSigned path. PURE boundary: Rust never POSTs and never touches the
  // ledger — this JS plane persists signatures[0] (BEFORE the POST) and performs the POST + idempotency.
  async function buildEnvelopePlan({ swapTxBase64, owner, seed, side }) {
    const cfg = config.get();
    if (cfg.execution?.signer_backend !== 'rust' || !hotSigner || typeof hotSigner.buildExecutionPlan !== 'function') return null;
    let legs = [swapTxBase64];
    let mode = 'rpc';
    if (cfg.execution?.submit_backend === 'jito' && jitoSendBundle && cfg.execution?.jito_tip_account) {
      const bh = await rpc.rpc('getLatestBlockhash', [{ commitment: 'confirmed' }]);
      const blockhash = bh.ok ? bh.result?.value?.blockhash : null;
      if (!blockhash) return null; // cannot build the tip leg -> fall back to the current path
      const tipLamports = await resolveTipLamports(cfg.execution);
      const tipTx = buildTipTransferTx({ owner, tipAccount: cfg.execution.jito_tip_account, lamports: tipLamports, recentBlockhash: blockhash });
      legs = [swapTxBase64, tipTx];
      mode = 'jito';
    }
    let ep;
    try { ep = await hotSigner.buildExecutionPlan({ unsignedTxs: legs, seed, mode, side, skipPreflight: false, maxRetries: 3 }); }
    catch { return null; }
    const env = ep?.ok ? ep.envelope : null;
    if (!env || !Array.isArray(env.signed_txs) || !env.signed_txs.length || !Array.isArray(env.signatures) || !env.signatures.length) return null;
    const signed = { signatureB58: env.signatures[0], signedTxBase64: env.signed_txs[0] };
    const doPost = async () => {
      if (mode === 'jito') {
        const res = await jitoSendBundle(env.signed_txs, env.bundle_body ? { body: env.bundle_body } : undefined);
        if (res?.ok) return { ok: true, result: signed.signatureB58, via: 'jito' };
        // Jito failed -> fall back to a plain RPC send of the (already-signed) swap leg, so a Jito outage
        // can never block the send (JS assembles the fallback body).
        return rpc.rpc('sendTransaction', [signed.signedTxBase64, { encoding: 'base64', skipPreflight: false, maxRetries: 3 }]);
      }
      return rpc.rpc('sendTransaction', [signed.signedTxBase64, { encoding: 'base64', skipPreflight: false, maxRetries: 3 }], env.submit_body ? { body: env.submit_body } : undefined);
    };
    return { signed, doPost };
  }

  async function confirmSignature(signatureB58) {
    for (let i = 0; i < 24; i += 1) {
      await new Promise((r) => setTimeout(r, 2500));
      const st = await rpc.rpc('getSignatureStatuses', [[signatureB58], { searchTransactionHistory: false }]);
      const v = st.ok ? st.result?.value?.[0] : null;
      if (v) {
        if (v.err) return { confirmed: false, error: 'tx_failed_on_chain' };
        if (v.confirmationStatus === 'confirmed' || v.confirmationStatus === 'finalized') return { confirmed: true };
      }
    }
    return { confirmed: false, error: 'confirmation_timeout' };
  }

  /** Read the actual fill of a confirmed tx (token delta for buys, net SOL delta for sells);
   *  bounded attempts, falls back to the supplied estimate. Shared by execute + reconcile. */
  async function extractFill({ txSig, side, mint, owner, fallbackOutUi = 0 }) {
    let actualOutUi = fallbackOutUi;
    let fillSource = 'quote_estimate';
    let solDelta = null; // owner's native SOL change: spent (<0) on a buy, received (>0) on a sell
    for (let i = 0; i < 3; i += 1) {
      const tx = await rpc.getTransaction(txSig);
      if (tx.ok && tx.result) {
        const meta = tx.result.meta;
        if (meta && !meta.err) {
          const keys = tx.result.transaction?.message?.accountKeys || [];
          const idx = keys.findIndex((k) => (typeof k === 'string' ? k : k?.pubkey) === owner);
          if (idx >= 0 && Array.isArray(meta.postBalances) && Array.isArray(meta.preBalances)) {
            solDelta = (meta.postBalances[idx] - meta.preBalances[idx]) / 1e9;
          }
          const target = side === 'buy' ? mint : WSOL_MINT;
          const pre = (meta.preTokenBalances || []).find((b) => b.owner === owner && b.mint === target);
          const post = (meta.postTokenBalances || []).find((b) => b.owner === owner && b.mint === target);
          if (side === 'buy' && post) {
            actualOutUi = Number(post.uiTokenAmount.uiAmount ?? 0) - Number(pre?.uiTokenAmount?.uiAmount ?? 0);
            fillSource = 'on_chain';
          } else if (side === 'sell' && solDelta != null) {
            actualOutUi = solDelta; // SOL received (net of fee)
            fillSource = 'on_chain';
          }
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return { actualOutUi, fillSource, solDelta };
  }

  /**
   * Execute a real swap. side 'buy': spend sizeUsd worth of SOL into mint.
   * side 'sell': sell qtyUi of mint back to SOL. Returns actual fill data.
   */
  async function executeSwapInner({ side, mint, sizeUsd = 0, qtyUi = 0, decimals = 6, slippageBps = 100, intentParts, recovery = null, positionId = null }, releaseLock = () => {}) {
    const notionalUsd = sizeUsd; // buy: sizeUsd; sell: estimated proceeds passed in sizeUsd
    const g = gates({ action: side === 'buy' ? 'entry' : 'exit', notionalUsd });
    if (!g.allowed) return { ok: false, error: 'gates_refused', refusals: g.refusals };

    const intent_id = intentIdFor(intentParts);
    // store enough context to RECONCILE later: decimals (fill extraction), recovery (rebuild an
    // orphan buy position), positionId (close the right position for a confirmed sell).
    const claim = claimIntent(intent_id, { side, mint, sizeUsd, qtyUi, decimals, recovery, positionId });
    if (!claim.ok) return { ok: false, error: claim.error };

    const kpRes = ownerKeypair();
    if (!kpRes.ok) { setIntent(intent_id, 'FAILED_PRE_SEND', { error: kpRes.error }); return { ok: false, error: kpRes.error }; }
    const owner = kpRes.kp.address;

    // amounts
    const price = await solPriceUsd();
    if (!price) { setIntent(intent_id, 'FAILED_PRE_SEND', { error: 'sol_price_unavailable' }); return { ok: false, error: 'sol_price_unavailable' }; }
    let inputMint, outputMint, amountBaseUnits;
    if (side === 'buy') {
      inputMint = WSOL_MINT; outputMint = mint;
      amountBaseUnits = Math.floor((sizeUsd / price) * 1e9);
      const bal = await rpc.rpc('getBalance', [owner, { commitment: 'confirmed' }]);
      const lamports = bal.ok ? Number(bal.result?.value ?? 0) : 0;
      // on the Jito backend the bundle also pays a tip leg — reserve it so a tight balance is
      // refused up front instead of silently degrading to a no-tip RPC send.
      const cfgExec = config.get().execution || {};
      const tipReserve = cfgExec.submit_backend === 'jito' ? maxTipReserveLamports(cfgExec) : 0;
      if (!bal.ok || lamports < amountBaseUnits + SOL_RESERVE_LAMPORTS + tipReserve) {
        setIntent(intent_id, 'FAILED_PRE_SEND', { error: 'insufficient_sol_balance' });
        return { ok: false, error: 'insufficient_sol_balance', balance_sol: lamports / 1e9 };
      }
    } else {
      inputMint = mint; outputMint = WSOL_MINT;
      amountBaseUnits = Math.floor(qtyUi * 10 ** decimals);
    }
    if (amountBaseUnits <= 0) { setIntent(intent_id, 'FAILED_PRE_SEND', { error: 'amount_zero' }); return { ok: false, error: 'amount_zero' }; }

    const q = await jupiter.quote({ inputMint, outputMint, amountBaseUnits, slippageBps });
    if (!q.ok) { setIntent(intent_id, 'FAILED_PRE_SEND', { error: q.error }); return { ok: false, error: q.error }; }

    const swap = await jupiter.swapTransaction({ quoteRaw: q.raw, userPublicKey: owner });
    if (!swap.ok) { setIntent(intent_id, 'FAILED_PRE_SEND', { error: swap.error }); return { ok: false, error: swap.error }; }

    // audit BEFORE signing — if audit cannot be written, we do not sign (fail-closed)
    if (!safeAudit({ audit_scope: 'intent', audit_reason: 'live_sign_requested', command_type: null, detail: { intent_id, side, mint, notional_usd: notionalUsd, owner } })) {
      setIntent(intent_id, 'FAILED_PRE_SEND', { error: 'audit_unavailable_before_sign' });
      return { ok: false, error: 'audit_unavailable_before_sign' };
    }

    // Sign + submit. PREFERRED: the Rust EXECUTION ENVELOPE (Phase Rust-5) — one call signs every leg and
    // assembles the submit/bundle body. On ANY failure (or an older binary without the op) fall back to the
    // current path: sign the swap via the Rust hot-executor (signer_backend=rust; byte-identical to the
    // in-process signer) or the in-process signer, then submitSigned (its own Rust-3/Rust-4 sign-tip / body
    // assembly + fail-safe fallbacks). Either way a dead/missing helper can NEVER block a live signature.
    const plan = await buildEnvelopePlan({ swapTxBase64: swap.txBase64, owner, seed: kpRes.seed, side });
    let signed = plan ? plan.signed : null;
    if (!signed) {
      if (config.get().execution?.signer_backend === 'rust' && hotSigner) {
        const r = await hotSigner.sign({ txBase64: swap.txBase64, seed: kpRes.seed });
        if (r?.ok) signed = r;
      }
      if (!signed) {
        try {
          signed = signSerializedTransaction({ txBase64: swap.txBase64, seed: kpRes.seed });
        } catch (e) {
          setIntent(intent_id, 'FAILED_PRE_SEND', { error: String(e?.message || 'sign_failed') });
          return { ok: false, error: String(e?.message || 'sign_failed') };
        }
      }
    }

    // Persist the DETERMINISTIC tx signature (the fee-payer sig we just computed = the on-chain
    // tx id) and the fill-time SOL price BEFORE broadcasting. So even an ambiguous send failure
    // (timeout / 5xx / retries-exhausted) leaves a SENT_UNCONFIRMED intent that reconcile() can
    // still resolve against the chain by signature — instead of a dead intent that is neither
    // retryable nor reconcilable (which would strand the position forever).
    setIntent(intent_id, 'SENT_PENDING', { signature: signed.signatureB58, sol_price_usd: price });
    const sent = plan ? await plan.doPost() : await submitSigned({ signedTxBase64: signed.signedTxBase64, signatureB58: signed.signatureB58, owner, seed: kpRes.seed });
    if (!sent.ok) {
      // Distinguish PROVABLY-unsent from ambiguous failures. A JSON-RPC error response
      // (`rpc_<code>`, e.g. preflight/simulation rejection) means the node refused the tx
      // before submission -> never landed -> FAILED_SEND (retryable). A timeout / HTTP 5xx /
      // retries-exhausted (`rpc_failed_*`, `rpc_http_*`, `rpc_retries_exhausted`) may have
      // been forwarded to the cluster -> SENT_UNCONFIRMED (NOT retryable; needs reconciliation,
      // so an auto-retry can't build a second tx that double-executes).
      const provablyUnsent = /^rpc_-?\d+$/.test(sent.error || '');
      const status = provablyUnsent ? 'FAILED_SEND' : 'SENT_UNCONFIRMED';
      setIntent(intent_id, status, { error: sent.error });
      safeAudit({ audit_scope: 'intent', audit_reason: 'live_send_failed', detail: { intent_id, error: sent.error, status } });
      return { ok: false, error: `send_failed_${sent.error}` };
    }
    const txSig = sent.result;
    // count notional ONCE per intent: a retried (FAILED_*) intent that re-broadcasts must not
    // double-charge the session cap (that would freeze trading after a few slipping exits).
    const alreadyCharged = getIntent(intent_id)?.notional_charged === true;
    setIntent(intent_id, 'SENT', { signature: txSig, notional_charged: true });
    if (!alreadyCharged) signer.recordSigned({ notional_usd: notionalUsd });
    // critical section (gates→claim→send→record) is done — release the serialization lock so the
    // ~60s confirmation poll below does NOT block another swap (e.g. a stop-loss exit) behind it.
    releaseLock();
    safeAudit({ audit_scope: 'intent', audit_reason: 'live_tx_sent', detail: { intent_id, signature: txSig, side, mint } });
    broadcast({ event_type: 'intent_update', intent_id, signature: txSig, side, mint });

    const conf = await confirmSignature(txSig);
    if (!conf.confirmed) {
      setIntent(intent_id, conf.error === 'tx_failed_on_chain' ? 'FAILED_ON_CHAIN' : 'SENT_UNCONFIRMED', { error: conf.error });
      return { ok: false, error: conf.error, signature: txSig };
    }

    // actual fill amounts from the confirmed tx (bounded attempts; estimate fallback)
    const { actualOutUi, fillSource } = await extractFill({
      txSig, side, mint, owner, fallbackOutUi: q.outAmount / 10 ** (side === 'buy' ? decimals : 9),
    });
    // real buy cost = the EXACT swap input. ExactIn => q.inAmount IS the SOL actually swapped, so
    // pricing it gives the true cost basis WITHOUT folding in the network fee + recoverable ATA
    // rent (which the raw native-balance delta would, asymmetric to the sell leg). undefined falls
    // back to intended sizeUsd upstream.
    const costUsd = side === 'buy' && Number.isFinite(q.inAmount) && q.inAmount > 0 && price
      ? (q.inAmount / 1e9) * price : undefined;

    setIntent(intent_id, 'CONFIRMED', { signature: txSig, actual_out_ui: actualOutUi, fill_source: fillSource });
    safeAudit({ audit_scope: 'intent', audit_reason: 'live_tx_confirmed', detail: { intent_id, signature: txSig, actual_out_ui: actualOutUi, fill_source: fillSource } });

    return {
      ok: true, signature: txSig, intent_id,
      outUi: actualOutUi, fillSource, costUsd,
      priceImpactPct: q.priceImpactPct,
      solPriceUsd: price,
      proceedsUsd: side === 'sell' ? actualOutUi * price : undefined,
    };
  }

  function intents(limit = 50) {
    return listIntents(limit);
  }

  /** Intents that were broadcast but never reached a terminal state — candidates for reconcile. */
  function pendingIntents() {
    return pendingIntentsImpl();
  }

  /**
   * Authoritatively resolve a broadcast intent against the chain (searchTransactionHistory).
   *  - confirmed  -> mark CONFIRMED, return the actual fill (so the caller can recover the
   *                  orphan position / close the phantom-open position)
   *  - on-chain err -> FAILED_ON_CHAIN (retryable; tx moved nothing)
   *  - not found    -> FAILED_SEND (retryable; never landed)
   * Read-only w.r.t. the portfolio — the engine does the position bookkeeping.
   */
  async function reconcile({ intent_id }) {
    const it = getIntent(intent_id);
    if (!it || !it.signature) return { resolved: 'unknown' };
    const st = await rpc.rpc('getSignatureStatuses', [[it.signature], { searchTransactionHistory: true }]);
    if (!st.ok) return { resolved: 'pending' }; // RPC down — leave as-is, try again next pass
    const v = st.result?.value?.[0];
    if (!v) {
      // A just-broadcast tx can be briefly ABSENT from getSignatureStatuses while it propagates.
      // Require N consecutive "not found" passes (N * markPass interval > blockhash expiry ~90s)
      // before declaring it never-landed & retryable — otherwise we could rebroadcast a tx that
      // is still in flight and double-execute.
      const misses = (it.reconcile_misses || 0) + 1;
      if (misses < 3) { setIntent(intent_id, it.status, { reconcile_misses: misses }); return { resolved: 'pending' }; }
      setIntent(intent_id, 'FAILED_SEND', { error: 'reconcile_not_found', reconcile_misses: misses });
      return { resolved: 'never_landed' };
    }
    if (v.err) { setIntent(intent_id, 'FAILED_ON_CHAIN', { error: 'reconcile_tx_failed' }); return { resolved: 'failed_on_chain' }; }
    if (v.confirmationStatus !== 'confirmed' && v.confirmationStatus !== 'finalized') return { resolved: 'pending' };
    const d = it.detail || {};
    const kp = ownerKeypair();
    const owner = kp.ok ? kp.kp.address : null;
    // price the historical fill at the SOL price captured WHEN THE INTENT WAS SENT (stored on the
    // intent), not the current price — a delayed reconcile must not drift proceeds with SOL's move.
    const price = it.sol_price_usd ?? (await solPriceUsd());
    const { actualOutUi, fillSource } = await extractFill({ txSig: it.signature, side: d.side, mint: d.mint, owner, fallbackOutUi: 0 });
    setIntent(intent_id, 'CONFIRMED', { signature: it.signature, actual_out_ui: actualOutUi, fill_source: fillSource, reconciled: true });
    return {
      resolved: 'confirmed',
      detail: d,
      fill: {
        outUi: actualOutUi,
        fillSource, // 'on_chain' only when the real fill was read; 'quote_estimate' otherwise
        proceedsUsd: d.side === 'sell' && fillSource === 'on_chain' && price ? actualOutUi * price : undefined,
        // buy cost basis is the exact ExactIn input recorded at send time (recovery.cost_usd);
        // do NOT re-derive it from the native delta here (rent/fee asymmetry + price drift).
      },
    };
  }

  // Serialize the CRITICAL section of real-money swaps (gates→claim→send→recordSigned): the
  // signer notional cap is a check-then-act across an awaited send, so two concurrent calls
  // (leader stream + TP/SL loop) could otherwise both pass canSignNow against a stale total.
  // The lock is released right after recordSigned (see releaseLock), so the long confirmation
  // poll runs UNLOCKED and never starves another swap (e.g. a stop-loss) behind it.
  let execLock = Promise.resolve();
  function executeSwap(args) {
    let release = () => {};
    const myTurn = new Promise((r) => { release = r; });
    const prev = execLock;
    execLock = myTurn;
    return (async () => {
      await prev.catch(() => {});
      try { return await executeSwapInner(args, release); }
      finally { release(); } // safety net for paths that return before recordSigned
    })();
  }

  return { executeSwap, gates, intents, pendingIntents, reconcile, solPriceUsd, _internal: { intentIdFor, claimIntent, setIntent, solPriceUsd } };
}
