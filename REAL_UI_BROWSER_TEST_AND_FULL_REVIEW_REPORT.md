# REAL UI BROWSER TEST & FULL REVIEW REPORT — Soltrade

**Role:** Senior QA Engineer + Product Reviewer + Full-Stack Auditor
**Date:** 2026-06-15 · **Branch:** `main` · **Commit:** `d0415df`
**Method:** Real headless-Chromium browser automation (Claude Preview) driving the live React app at `http://localhost:5173` → backend `http://127.0.0.1:8787`, plus direct API probes and the full test suites. Not a code-read-only review — the UI was actually exercised and on-chain calls were really made.

---

## A) Executive Verdict

| Question | Answer |
|----------|--------|
| Does the app actually run? | **YES** — backend healthy on 8787, UI renders all 10 pages, frontend↔backend connected. |
| Is it wired to REAL data or mock? | **REAL.** Live Helius RPC (core 4.0.0, slot 426585710, 430 ms). Wallet/token scans hit the chain. **No fabricated numbers anywhere** — the app shows honest "insufficient_evidence" / "no wallets found" instead of fake values. |
| Does wallet analysis work? | **YES** — real on-chain scan (150 sigs) via API and via the Wallet Workspace UI. |
| Does token search work? | **YES, but it answers a different question** — the Radar "search by contract" does **trader discovery** (who traded the token), not a token safety/price/liquidity report. Real scan, honest empty result for the test token. |
| Is there a token **analysis/safety report** (name, price, liquidity, holders, mint/freeze, honeypot)? | **NO** — that user-facing page does not exist. The safety/FDV/holders logic exists only as internal *entry gates*, never surfaced as a token report. **This is the main gap vs the request.** |
| Usable now? | **YES for the core** (wallet-copy + manual trade + paper, with real data + strong safety). **Token-report feature must be built.** Real-money live execution was deliberately **not** exercised in this QA (read-only). |

**Bottom line:** This is a genuinely functional, real-data Solana copy-trading + manual-trading terminal with strong safety engineering — **not** a mock dashboard. The headline shortfall against the brief is the absence of a standalone **token analysis** page.

---

## B) Environment

- **OS:** Windows 11 (10.0.26200)
- **Runtimes:** Node `v24.15.0`, Cargo `1.95.0`, Python `3.12.9`
- **Run commands (from `START.bat` / package.json):**
  - Backend (prod, serves built UI same-origin): `node apps/server/src/index.mjs` → **port 8787**
  - Frontend dev (used for QA instrumentation): `npm run dev --prefix apps/operator-ui` → **port 5173** (API_BASE → 8787)
  - Build: `npm run build --prefix apps/operator-ui`
  - Tests: `node --test` (backend) · `cargo test` (services/hot-executor) · `python -m unittest discover -s tests` (services/analytics)
- **No `.env` required** — secrets live in an encrypted local vault (`data/vault.enc.json`), not env files.
- **Ports:** 8787 (API + SSE + static UI), 5173 (vite dev).

---

## C) Test Inputs Used

- **Vault passphrase:** *(provided by owner; **REDACTED** from this committed file — it unlocks the real-money signer keypair + RPC key; storing it in a repo file would be a critical leak. Verified working: unlock returned `{ok:true}`.)*
- **Wallet under test:** `ETgTUJX8R6Hpnwv4r4hSTpQq6LhZymxyHfVHFJEDMrp2`
- **Token under test:** `jpqfphDxnEjSAguhGCeTZ74PU5A5ef1FBoV5u3an16b`

---

## D) Browser Test Evidence

**Pages opened (all rendered, none "offline"):** Command Center (Mission Control), Trading Workspace, Wallet Discovery (Smart-Money Radar), Wallet Workspace, Analytics & Reports, My Wallets & Funds, Settings & Safety, Alerts, Setup Wizard, Help & Glossary.

**Screenshots captured** (preview, 900px viewport): Mission Control, Wallet Workspace (with real wallet + analysis empty state), Smart-Money Radar (with token scan empty result). *(Note: the screenshot tool renders at high DPR so images appear small; structural rendering was independently verified via DOM `eval` — h1, card counts, inputs, tables per page.)*

**Console errors:** **0** (checked after navigating all 10 pages).

**Network:** **0 failures.** Every API call returned `200 OK` (or `204` for CORS preflight). Endpoints exercised live: `/api/status`, `/api/config`, `/api/stream` (SSE), `/api/engine-events`, `/api/leader-insights`, `/api/live-positions`, `/api/wallets`, `/api/orders`, `/api/latency`, `/api/intents`, `/api/secrets`, `/api/audit`, `/api/signer/wallet`, `/api/vault/unlock`, `/api/providers/test-connection`, `/api/wallets/analyze`, `/api/discover/token-traders`, `/api/token-meta`. No 404/500/CORS.

**Backend boot status (`/api/status`):** `mode=real_live`, `operating_state=WARMING_UP`, `vault: exists, locked, secret_count=2`, `signer=locked`, `live_engine=armed_real_money`, `readiness.real_live_ready=false` (blocker: `signer_not_ready` — expected while vault locked).

---

## E) Feature-by-feature result table

| Feature / Page | Expected | Actual | Data source | Status | Evidence | Severity |
|---|---|---|---|---|---|---|
| App boot / health | Backend up, UI connects | `/api/status` 200, banner "REAL-LIVE · local server connected" | real | **PASS** | status JSON | — |
| Navigation (10 pages) | All routes render | All 10 render, no offline state | real | **PASS** | DOM sweep | — |
| Command Center | Live KPIs, protections, leader recs, tape | 6 cards, chips, SSE tape | real | **PASS** | screenshot | — |
| Vault unlock | Passphrase unlocks | `{ok:true}`; topbar shows unlocked | real | **PASS** | unlock API | — |
| RPC connectivity | Real provider | Helius, slot 426585710, 430 ms, enhanced stream | real | **PASS** | test-connection | — |
| **Wallet analysis** | Win-rate/PnL/bot signals from chain | 150 sigs scanned; honest `insufficient_evidence` (29 events, 1 token, 0 closed); on-chain | **real** | **PASS** | API + UI detail pane | — |
| **Token search (Radar)** | Surface wallets trading a mint | Scanned 30 txs; 0 traders (honest empty) | **real** | **PASS (weak recall)** | API + UI | Medium |
| **Token analysis report** (price/liq/holders/safety) | Standalone token report | **Not present** — only internal entry gates | n/a | **FAIL (missing feature)** | code + UI | High (vs brief) |
| Token metadata (name/logo) | Symbol/logo for a mint | `{}` for test token (not in Jupiter/DAS) → short mint shown | real | **PASS (honest unknown)** | token-meta | Low |
| Trading Workspace | Positions, manual trade, limit/DCA | Renders; Manual + Limit/DCA panels present | real | **PASS** | DOM | — |
| Analytics & Reports | Equity curve, KPIs, CSV export | Renders; real realized-P&L driven | real | **PASS** | DOM | — |
| My Wallets & Funds | Vault/keys/holdings | Vault, provider slots, signer, holdings card | real | **PASS** | DOM | — |
| Settings & Safety | Hard-risk, EV, presets, filters, lists, notifications | 4 tabs, presets, FDV/holders filters, lists, notifications | real | **PASS** | DOM | — |
| Alerts | Kill switch, system control, audit | Emergency-stop, pause/resume, audit table | real | **PASS** | DOM | — |
| Setup Wizard | Guided stepper | 4-step stepper renders | real | **PASS** | DOM | — |
| Help & Glossary | How-to + glossary | Accordion + searchable table | real | **PASS** | DOM | — |
| Error/empty states | Honest messaging | "insufficient_evidence", "no wallets found", "server offline" | real | **PASS** | API + UI | — |

---

## F) Wallet Analysis Result

- **Input:** `ETgTUJX8R6Hpnwv4r4hSTpQq6LhZymxyHfVHFJEDMrp2`
- **What showed:** API `/api/wallets/analyze` returned `ok:true`, `fetched:150`, `signatures_scanned:150`, `stats.status: "insufficient_evidence"`, `provenance:"on_chain"`, `sample_size:29`, `distinct_tokens:1`, `trades_closed:0`, `win_rate:null`, full `outcome_distribution` + `bot_signals` (`sold_more_than_bought_tokens:1`). The UI Wallet Workspace detail pane rendered: **"Historical analysis (on-chain) — ∅ No analyzable trades in the last 150 txs."**
- **Real data?** **Yes** — on-chain, point-in-time, FIFO/directional (clearly labelled).
- **Useful?** The *engine* is correct and honest. For **this** wallet it can't judge (only 1 token, no closed round-trips in the last 150 txs), and it says so rather than inventing a score — exactly the right behaviour.
- **Where it falls short:** scan depth is fixed at 150 signatures (no pagination / deeper history), so low-activity or older wallets read as "insufficient". No Smart-Money/KOL tagging or copyability/risk score beyond win-rate + bot signals.
- **To improve:** deeper/paginated history; a composite wallet score; surface "why insufficient" guidance.

---

## G) Token Analysis Result

- **Input:** `jpqfphDxnEjSAguhGCeTZ74PU5A5ef1FBoV5u3an16b`
- **What showed:** Radar "search by contract" → scanned 30 on-chain txs → **"No wallets found — try a more active coin."** `/api/token-meta` → `{}` (token not in Jupiter list nor Helius DAS). `/api/discover/token-traders` → `scanned:33, traders:[], provenance:"on_chain"`.
- **Real data?** **Yes** (real RPC scan), honest empty result.
- **Is there a real safety scan / price / liquidity / holders report?** **No, not as a user feature.** The pieces exist but only **inside the entry pipeline**, never surfaced for an arbitrary token:
  - Anti-rug (mint authority / freeze authority / Token-2022 permanent delegate) — `token-safety.mjs`, runs at entry only.
  - FDV band + min-holders — `market-filters.mjs`, runs at entry only.
  - Price — Jupiter quote, internal.
- **Why the contract-search is weak:** `discoverTokenTraders` calls `getSignaturesForAddress(mint)` — it scans the **mint account's own** signatures, which are sparse for most tokens (trades happen on the AMM pool, not the mint). So it returns empty for many real tokens by design. Proper recall needs the pool address or an enhanced-tx/indexer source.
- **Fallback/Jupiter/RPC:** Jupiter pricing works internally; DAS metadata fallback works (returned nothing for this unlisted token — honest). No Birdeye/paid fallback.

---

## H) Bugs Found

> Browser + API testing surfaced **no Critical/High functional crashes** — 0 console errors, 0 network failures. The earlier `/code-review` (xhigh) found 12 issues; **all were fixed** in commit `2faac7f` (verified green). Items below are the residual gaps.

**HIGH (vs the brief, not a crash)**
1. **No standalone Token Analysis page.** Expected: name/symbol, mint info, liquidity, price, holders, safety scan (mint/freeze/Token-2022), risk/honeypot warning. Actual: none — only internal entry gates. *Fix:* add a `/token/:mint` report page + `GET /api/token/:mint` aggregating token-safety + getTokenSupply (FDV) + Jupiter price + DAS metadata + min-holders into one view.

**MEDIUM**
2. **Radar contract-search has low recall.** Scans the mint's own signatures → empty for most tokens. *Repro:* search `jpqfphD…` → "No wallets found". *Fix:* resolve the token's AMM pool(s) and scan pool signatures, or use Helius enhanced transactions / an indexer.
3. **Wallet analysis depth fixed at 150 sigs.** Low-activity/older wallets read "insufficient_evidence". *Fix:* optional deeper pagination + a clear "scanned N of more" indicator.

**LOW**
4. **High polling cadence.** UI re-polls `status`/`config`/`leader-insights`/`live-positions`/`engine-events` every few seconds (all 200, but chatty). *Fix:* lean more on the existing SSE stream; back off poll intervals.
5. **Token metadata coverage gaps.** Unlisted tokens show the short mint (honest, but bare). *Fix:* add a second metadata source for fresh mints.
6. **Process: vault passphrase in deliverables.** The brief asked to put the passphrase in the report; doing so would leak the real-money vault key. Redacted here. *Fix (process):* never place live passphrases in repo files.

---

## I) UX Gaps

- **Token-search labelling misleads.** "Search by contract" implies a token report; it actually finds *traders*. Rename/clarify (e.g. "Find wallets that traded this token"), and/or add the missing token report.
- **App is wallet-copy-centric.** A new user looking for "paste a token → see if it's safe" won't find it. Add the token report + a clear entry point.
- **Strengths:** unmistakable REAL-LIVE banner, paper/live separation, prominent kill switch, Arabic/RTL throughout, honest empty states, guided Setup stepper, strategy presets, ⌘K palette + Tweaks panel.
- **Minor:** charts are real sparklines/equity from `mark_history` + realized P&L (not placeholders), but there is **no candlestick/OHLCV token chart** (no historical price source).

---

## J) Security Findings (strong posture)

| Check | Result |
|---|---|
| Passphrase in logs / data / source | **CLEAN** — not found anywhere; vault ops bodies never logged. |
| RPC key / Helius URL in frontend bundle | **CLEAN** — only the input *placeholder* `…helius-rpc.com/?api-key=…` (ellipsis); no real key. |
| Secrets in localStorage/sessionStorage | **CLEAN** — `localStorage` used only for UI design prefs (`designPrefs.jsx`), no risk/exec/signer state. |
| Private keys / seed phrases in tracked source | **CLEAN** — none; signer key lives only in the encrypted vault. |
| `.env` exposure | **N/A** — no `.env`; secrets are vault-only. |
| Vault / runtime state in git | **CLEAN** — `.gitignore` excludes `data/`, `**/data/`, `*.vault`, `vault.enc`, `secrets/`; `git ls-files data/` is empty. |
| Config holds raw keys? | **No** — only `vault:` references. |
| Vault crypto | scrypt + AES-256-GCM (per `vault.mjs`); 2 secrets stored (`helius_rpc_url`, `signer_keypair`). |
| Execution safety | Kill switch (hierarchical, persisted), pause/EXITS_ONLY, daily-loss breaker, fail-closed gates, intent-ledger idempotency, signer session bounds, owner-typed `ACTIVATE-REAL-LIVE`. |
| **Note** | `mode=real_live` is **persisted** (engine armed for real money), but the signer is locked on boot so nothing trades until the owner unlocks + opens a session. Confirm this is intended. |

---

## K) Readiness Score (/100)

| Dimension | Score | Notes |
|---|---|---|
| UI readiness | 90 | All pages render, no errors, polished, RTL. |
| Backend readiness | 92 | Real RPC, fail-safe, 1975 tests green. |
| Data integration | 80 | Real Helius for wallet + discovery; token metadata gaps; no token report. |
| Wallet analysis | 85 | Real + honest; depth-limited; no composite score. |
| Token analysis | 40 | No standalone report; safety/price/holders internal-only; weak Radar recall. |
| Trading safety | 92 | Anti-rug, gates, kill switch, vault, intent ledger. |
| Live readiness | 78 | Armed + encrypted + owner-gated; **live execution not exercised in this QA**. |
| **Overall** | **80** | Strong, real, safe core; token-report gap is the main shortfall. |

---

## L) Final Decision

### `READY_FOR_REAL_USER_TESTING`

Justification: the app is **real, connected, and functional** with live on-chain data and strong safety — clearly **not** mock and **not** blocked (backend + keys present and working). It is ready for real **user testing of the core** (wallet copy-trading, wallet analysis, manual trade, limit/DCA, paper-first) **with two explicit caveats**: (1) the **token analysis report** the brief describes is **not built** (build it before claiming token-safety parity), and (2) **real-money live execution was intentionally not exercised** in this QA — validate it in a controlled paper → tiny-live step before unattended live use.

---

## M) Next Fix Plan

**Phase 1 — Close the headline gap (token analysis)**
- Add `GET /api/token/:mint` aggregating: token-safety (mint/freeze/Token-2022) + getTokenSupply→FDV + Jupiter price + DAS metadata (name/logo/socials) + min-holders → one payload.
- Add a `/token/:mint` report page (verdict + each signal + risk reasons). Wire the Radar "search by contract" to it.

**Phase 2 — Real-data depth & recall**
- Radar: resolve AMM pool(s) for a mint and scan pool signatures (or Helius enhanced-tx) for real trader recall.
- Wallet analysis: optional deeper/paginated history + "scanned N of more" indicator + composite wallet/copyability score.

**Phase 3 — UX & charts**
- Rename/clarify the token search; add an explicit "analyze a token" entry point.
- Add an OHLCV/candlestick token chart (requires a price-history source).
- Reduce polling cadence; lean on SSE.

**Phase 4 — Safety / live gates validation**
- Controlled paper → tiny-live execution test (one real micro-trade) with full audit-trail verification; confirm `mode=real_live` persistence is intended; document the unlock→session→activate flow.

**Phase 5 — Regression / e2e**
- Add a Playwright/Chrome e2e suite (vault unlock, page renders, wallet analyze, token search, manual buy paper) to CI alongside `node --test` / `cargo test` / `unittest`.

---

### Appendix — Test suite results (this run)
- **Backend:** `node --test` → **1975 passed / 0 failed**.
- **Rust:** `cargo test` (services/hot-executor) → **8 passed / 0 failed**.
- **Python:** `unittest` (services/analytics) → **12 passed / 0 failed (OK)**.
- **UI build:** `vite build` → **clean** (≈352 kB JS / 112 kB gzip).
- **Console errors:** 0 · **Network failures:** 0 · **Pages rendered:** 10/10.
