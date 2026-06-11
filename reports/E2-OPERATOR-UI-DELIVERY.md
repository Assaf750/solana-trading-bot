# E2 — Operator UI Delivery — Clickable 9-Page Interface (read-only, simulated)

> **A real, runnable Vite + React operator interface** at `apps/operator-ui/`, implementing the 9 pages of
> `docs/11-UI-SPEC.md` with the `docs/12-DESIGN-SYSTEM.md` tokens — **AR/EN with RTL/LTR**, density + theme
> toggles. **Strictly READ-ONLY over bundled SIMULATED fixtures** shaped like the real backend read-models:
> no real money, no real keys, no network, no execution authority.

---

## 🚀 How to launch (the owner's run commands)
```bash
cd apps/operator-ui
npm install        # first time only (66 local packages; the repo workspaces are untouched)
npm run dev        # opens the dev server at http://localhost:5173
```
Production preview:
```bash
npm run build && npm run preview
```
Build verified twice (workflow + main-loop): `vite build` ✓ in ~456–475ms; dist ≈ 230 kB js (72.5 kB gzip).

## The 9 pages
| Route | Page | Shows |
|---|---|---|
| `/command` | Command Center | operating_state · protocol constants · provider/slot health · pipeline summary · readiness checklist · alerts digest |
| `/workspace` | Trading Workspace | Decision-Trace timeline (data→…→send) · positions/intents/trades (`intent_type`/`bundle_status`/`failure_type`) · Exit Feasibility · SIMULATED paper P&L |
| `/radar` | New Coin Radar | ranked opportunities (score = **ranking only, not a buy signal** — stated; **no buy button**) · accepted/rejected reasons · per-opportunity trace |
| `/wallets` | Wallet Intelligence | tracked wallets · copyability + veto reasons · win_rate/win_loss_ratio (profit_factor = unavailable) · drift flags |
| `/analytics` | Analytics & Reports | paper aggregation · calibration divergence · net-business-P&L sections — all SIMULATED, paper ≠ live disclaimers |
| `/funds` | My Wallets & Funds | execution/settlement/funding wallet states · simulated balances · **masked `provider_key_ref`** · no transfer/sweep execution |
| `/settings` | Settings & Safety | all 9 Hard-Risk limits + completeness ("no implicit infinity") · ev_gate_mode · REAL-LIVE blockers · the **never-ready mainnet seam** + owner checklist |
| `/alerts` | Alerts | by severity/category; **security+critical always visible, non-dismissible-as-bypass** |
| `/help` | Help / Glossary | how-to (provider key by reference, rejected_reason meanings, why REAL-LIVE is blocked) · bilingual SSOT-aligned glossary |

## Read-only guarantees (verified by 3 independent review lenses + arbiter + main-loop greps)
- Global always-visible **SIMULATED + READ-ONLY** banner; SimulatedBadge on every P&L/balance surface.
- **Every command surface from the spec is preview-only and visibly disabled** ("advisory — not executable in
  this build" / «استشاري — غير قابل للتنفيذ في هذه النسخة»); the confirmation-modal pattern exists but its
  Confirm is disabled.
- Missing metrics → "unavailable" («غير متوفر»), never fabricated, never 0-as-unknown.
- **REAL-LIVE shown BLOCKED everywhere**; the mainnet activation seam rendered never-ready with the owner-input
  checklist unsatisfied.
- **No network**: zero `fetch`/`WebSocket`/RPC in src; all data from bundled fixtures; provider keys only as
  masked by-reference placeholders; no secrets anywhere.
- **Backend untouched:** changes live only under `apps/operator-ui/`; root workspaces (`packages/*`) unmodified;
  backend suite still **1854/1854**; SSOT drift EXACT; mechanism guard unchanged (`sources=119 allowlist=1
  violations=0`).

## What it is NOT (honest scope)
This UI renders simulated read-models. Wiring it to live data and enabling any command requires the owner inputs
and separate governance decisions documented in `reports/E2-FINAL-DELIVERY-REPORT.md §4` (provider keys by
reference, funded wallets, the separate send-adapter ALLOWLIST decisions, capital limit, owner go-decision).
