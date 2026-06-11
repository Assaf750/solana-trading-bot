# E2 Stage-18 — Operator Dashboard (read-only) — EVIDENCE

> **IMPLEMENTATION-FIRST stage (code + tests; this report is the evidence, written after).** Creates the new
> **`@soltrade/operator-dashboard-foundations`** package — the read-only Operator Dashboard layer: **pure,
> import-free HTML render functions** over the backend read-models (decision trace · pipeline health · paper P&L ·
> profitability advisory · stream health/readiness · security notices) + a static document assembler. AR/EN with
> RTL/LTR; **SIMULATED always badged; `unavailable` never fabricated; security/critical notices cannot be hidden;
> the renderer computes no money (backend numbers verbatim); the assembled page is inert (no form/button/script/
> fetch)** — exactly Phase-C precondition #5. The full 9-page operational UI of `docs/11-UI-SPEC.md` includes
> command flows that require the future API layer; this stage delivers the read-only viewer over everything that
> exists today.
>
> **State:** built on `main` @ `5cc6f1f` (branch `pr-s18-operator-dashboard`, `main + 1`, parent == main) ·
> mechanism guard `sources=115 fixtures=27 allowlist=1 violations=0` · SSOT drift EXACT · full suite
> **1799/1799** · package **40/40** · build arbiter GREEN 0 blockers (52-assertion probe battery) ·
> my independent spot-check **12/12**.

---

## 1. The eight surfaces (14 exports)
| Render | Behavior |
|---|---|
| `renderDecisionTracePanel` | ordered 6-stage table; unrecognized → `unavailable` panel |
| `renderPipelineHealthPanel` | state chip + reasons |
| `renderPaperPnlPanel` | **SIMULATED badge (EN `SIMULATED` / AR `محاكاة`) mandatory** — an unbadged model is REFUSED; totals verbatim (proven with an inconsistent 123.456 total rendered as-is — no renderer arithmetic); null unrealized → `unavailable`, never 0 (cell-level; a legitimate backend 0 still renders) |
| `renderProfitabilityAdvisoryPanel` | advisory chips + "advisory only — not a command" caption; `profit_factor` → `unavailable` |
| `renderStreamHealthPanel` | gap chip; **EXITS_ONLY-shaped advisory = visible `role=alert` warning that hide cannot suppress**; unknown checklist items "not verified" |
| `renderSecurityNoticesPanel` | **critical/security always visible — `hide:true` smuggles ignored at wrapper and notice level; unknown severity escalates to critical**; only info may collapse (pure `<details>`) |
| `assembleOperatorDashboard` | one self-contained inert document; `dir=rtl` (ar) / `ltr` (en); bilingual fixed "READ-ONLY OPERATOR VIEW — no commands" footer; refuses non-frozen/unrecognized panels and any panel html containing form/button/input/script/img/anchor/external-src/javascript:/fetch markup |
| + `describe*Contract` × 7 | contract descriptors |

## 2. Security spine (verified three ways: build tests 40/40 · arbiter 52-probe battery · my 12/12 spot-check)
- **XSS-safe:** `<script>`, `" onerror=`, `' onmouseover=`, `]]>` plants in refs/labels/title appear **escaped**
  and never raw/executable in any output.
- **Secrets:** forbidden surface NAMEs (incl. nested) and credential/endpoint-shaped VALUEs (scheme://, PEM,
  base58 blobs) anywhere in a consumed model → `DASH_RENDER_REFUSED`, values absent from html AND
  `JSON.stringify`.
- **Truth discipline:** SIMULATED badge both languages; `unavailable` over fabrication; no renderer money math;
  strict `lang ∈ {ar,en}` (7 invalid variants → INVALID).
- **Standard invariants:** frozen results + safe-flags spread (24 false) on every render result; hostile
  proxies/null → frozen error panels, never throw; TOCTOU bounded deep-clone-once (counting-getter verified);
  import-free src; no network/clock/RNG/env/fs; no module-level mutable state; zero `candidate_*` minted (only
  the 9 consumed G22 field names read as data); drift EXACT; ALLOWLIST unchanged; docs/tools/ssot-types untouched.

## 3. Verification
| Layer | Result |
|---|---|
| Build workflow (impl + XSS-secrets/data-truth/governance-behavioral lenses + arbiter) | GREEN, 0 blockers |
| Package / full suite | 40/40 · 1799/1799 |
| My independent spot-check | 12/12 |
| SSOT drift / mechanism guard | EXACT · `sources=115 allowlist=1 violations=0` |
| Adversarial pre-merge review | PENDING — merge gated |

---

**Confirmations:** UI strictly read-only over backend read-models · no UI-owned P&L · no Opportunity/Radar P&L ·
SIMULATED always labeled · `unavailable` never fabricated · security warnings never hidden · inert document ·
XSS-escaped · secrets refused + redacted · AR/EN with RTL/LTR · all 24 flags false · fail-closed · drift EXACT ·
suite 1799/1799 · `docs/00`–`12` untouched · **merge gated on the pending adversarial pre-merge review.**
