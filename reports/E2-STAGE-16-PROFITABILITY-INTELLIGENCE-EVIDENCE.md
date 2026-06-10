# E2 Stage-16 — Strategy & Wallet Profitability Intelligence — EVIDENCE

> **IMPLEMENTATION-FIRST stage (code + tests; this report is the evidence, written after).** Creates the new
> **`@soltrade/profitability-intelligence-foundations`** package — Strategy & Wallet Profitability Intelligence:
> a per-wallet **profitability read-model** over the simulated paper/backtest outputs + **heuristic risk flags**
> (thin-evidence / loss-dominance / one-hit concentration) + a **copyability ADVISORY composer** with veto-style
> fail-safe ordering, plus the standard suppression/forbidden-surface/health spine. **All advisory/simulated — no
> auto-apply, no config change, no execution authority, no auto-ban; an advisory never closes positions or changes
> follow state. Apparent profit is NOT copyable edge until risk is cleared.**
>
> **Build-process note (transparency):** the build workflow's implementation + all 4 review lenses completed —
> **every lens clear with 0 blockers** — but the build's internal arbiter was killed by a session usage limit
> (resets 8:50pm). Per the Stage-15 precedent, the binding independent gate remains the **separate adversarial
> pre-merge review**, which runs when the limit resets; **this branch is NOT merged until it returns
> CLEAR_TO_MERGE.** My own main-loop verification + independent spot-check (below) cover the interim.
>
> **State:** built on `main` @ `e56f5a6` (branch `pr-s16-profitability-intel`, `main + 1`, parent == main) ·
> `ALLOWLIST` unchanged · mechanism guard `sources=111 fixtures=27 allowlist=1 violations=0` · SSOT drift EXACT
> baseline (included=30/deferred=83 unchanged) · full suite **1699/1699** · package **29/29** · independent
> main-loop spot-check **33/33**.

---

## 1. New package
`packages/profitability-intelligence-foundations/` (v0.0.0, type module, no dependencies). **Import-free src**;
tests build a REAL Stage-14+15 chain (real fills → paper P&L; real dataset+fills → backtest replay). 14 exports
across 7 foundations (A–G). **TOCTOU snapshot discipline inherited from Stage-15:** every consumed result, map,
bucket, and entry is snapshotted exactly once; counting-getter regressions prove read-exactly-once.

## 2. The seven foundations
| Part | Foundation | Key behavior |
|---|---|---|
| A | Profitability Input Boundary | eligible ONLY off real Stage-14 `PAPER_PNL_READ_MODEL` + Stage-15 `BACKTEST_REPLAY_READ_MODEL`; raw refused |
| B | Wallet Profitability Read-Model | per-wallet `profitability_net/gross/fees/slippage/wins/losses/flats/open/closed_count/win_rate/win_loss_ratio`; **`profitability_profit_factor` ALWAYS null** (count buckets cannot yield a money-weighted profit factor — never faked); `profitability_evidence` gated by caller-supplied `min_sample_size` (**never defaulted** — missing → INSUFFICIENT for every wallet) |
| C | Heuristic Risk Flags | diagnostic-only: thin-evidence / loss-dominant / one-hit concentration; **missing thresholds → `unevaluated` posture (can never CLEAR a wallet)**; malformed thresholds refused |
| D | Copyability Advisory Composer | LOCAL tokens; veto ordering: unevaluated/insufficient → `INSUFFICIENT_EVIDENCE`; any risk flag → `NOT_COPY_SUITABLE` (**vetoes regardless of positive net**); clean+sufficient+net>0 → `KEEP_EVALUATING` (**the ceiling — never a copy-allowed promotion**); else `PREFER_WATCH_ONLY`. `advisory_only:true`, zero instruction-shaped fields |
| E | Suppression | always-suppressed (three `not_*_authorized` on every path) |
| F | Forbidden Surface Guard | NAME-only redaction |
| G | Health | clean path → SUPPRESSED |

## 3. Naming discipline (verified)
The ONLY `candidate_*` token in the entire src is **`candidate_pnl_by_wallet`** (registered G22, consumed-only).
ALL deferred intelligence enums (`candidate_wallet_type`, `candidate_fake_profit_reason`,
`candidate_adverse_selection_*`, `candidate_copyability_veto_reason`, `candidate_pump_classification`,
`candidate_wallet_drift_*`) and their value strings are **absent** — everything else is LOCAL
`profitability_*`/`PROFITABILITY_*`. `ssot-types` untouched; drift baseline EXACT.

## 4. Verified math + the crucial veto (my independent 33/33 spot-check, own scenario)
Over a REAL Stage-14+15 chain: w-X (P +1, +2, −1) → closed 3, **win_rate exactly 2/3, win_loss_ratio exactly 2,
net 2** → `KEEP_EVALUATING`; **w-Y net +2.5 POSITIVE but 1W2L loss-dominant → `NOT_COPY_SUITABLE` (the veto holds
against apparent profit)**; w-Z one-hit → `NOT_COPY_SUITABLE`; missing `min_sample_size` → INSUFFICIENT for all;
`profit_factor` null everywhere; counting-getter proof `candidate_pnl_by_wallet` read exactly once; planted
`private_key` in a bucket → whole input INVALID with the VALUE absent from JSON; guard NAME-only on
endpoint/serialized_tx/signature; suppression three tokens; hostile proxies never throw; recursive output-key scan
finds zero instruction-shaped fields. The build's 4 lenses independently verified the same invariants (their own
scenarios: w-A/B/C/D incl. positive-net-but-flagged veto) — all clear.

## 5. Verification (merge still gated)
| Layer | Result |
|---|---|
| Build workflow lenses (math/TOCTOU-security/governance/behavioral) | 4× clear, 0 blockers |
| Build arbiter | killed by session limit (not a finding) |
| Package tests | 29/29 |
| Full workspace suite | 1699/1699 |
| My independent main-loop spot-check (own scenario) | 33/33 |
| SSOT drift / mechanism guard | EXACT · `sources=111 allowlist=1 violations=0` |
| Adversarial pre-merge review | **PENDING — required before any merge** (runs at limit reset) |

---

**Confirmations:** profitability intelligence is SIMULATED/ADVISORY only (`simulated:true` + `advisory_only:true`)
· a risk flag VETOES positive net · `KEEP_EVALUATING` is the ceiling (promotion is a different governed system) ·
evidence/thresholds never defaulted · profit factor never faked · TOCTOU snapshot-once everywhere · no instruction
fields · no live path · all 24 flags false · fail-closed · drift EXACT · ALLOWLIST unchanged · suite 1699/1699 ·
`docs/00`–`12` untouched · **merge gated on the pending adversarial pre-merge review.**
