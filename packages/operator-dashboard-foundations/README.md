# @soltrade/operator-dashboard-foundations

Stage-18 (Phase C) — **operator dashboard foundations**: pure render functions
that turn the existing backend read-models into **read-only, inert HTML
views**, plus a static shell assembler. Testable with `node:test` alone — no
DOM, no server, no network, no dependency, no module-level mutable state,
import-free `src`.

## What this is

- `renderDecisionTracePanel` — ordered 6-stage table over the Stage-13
  pipeline decision-trace read-model (stage / state / decisive reason /
  advanced / blocked, as text).
- `renderPipelineHealthPanel` — Stage-13 pipeline-health state chip + reasons.
- `renderPaperPnlPanel` — Stage-14 paper P&L read-model with a mandatory
  **SIMULATED** badge (AR: «محاكاة»). Renders backend numbers **verbatim**
  (formatting only — never sums, never derives money). Unrealized P&L renders
  only when the model value is a number (mark-valid upstream); missing metrics
  render `unavailable`, never 0.
- `renderProfitabilityAdvisoryPanel` — Stage-16 advisory tokens as text chips
  with a permanent “advisory only — not a command” caption in both languages;
  `profitability_profit_factor` is always null upstream and always renders
  `unavailable` — never faked.
- `renderStreamHealthPanel` — Stage-17 stream-health gap chip + readiness
  checklist; an exits-only-shaped advisory renders as a **visible** warning
  that no hide/collapse flag can suppress; unknown checklist items render
  `not verified`.
- `renderSecurityNoticesPanel` — security/critical notices are **always**
  rendered visible (hide/collapse smuggles ignored); only `info` may collapse
  via a pure `<details>` toggle.
- `assembleOperatorDashboard` — one static, self-contained, inert HTML
  document (inline token-named CSS, `dir=rtl` for `ar` / `ltr` for `en`,
  fixed bilingual footer “READ-ONLY OPERATOR VIEW — no commands”). Refuses
  anything that is not a recognized frozen render result, and any panel html
  carrying interactive/external markup.

## What this is NOT

- NOT the full 9-page operational UI (`docs/11-UI-SPEC.md`) — command flows
  require the future API layer; this stage is the read-only viewer layer only.
- NOT a P&L computer — the UI never owns money math; it renders backend
  read-model numbers verbatim.
- NOT execution authority — every result keeps `read_only:true` and all 24
  readiness/execution flags `false`; the generated HTML contains no form, no
  button, no input, no script, no external resource, no fetch.

## Safety spine

- XSS-safe: every interpolated string is HTML-escaped (`& < > " '`).
- No secrets ever rendered: a consumed read-model carrying a forbidden surface
  NAME (`private_key` / `api_key` / `endpoint` / …) or a credential /
  endpoint-shaped VALUE is refused with a fail-closed error panel — the value
  is never echoed anywhere.
- Hostile / throwing / uninspectable input returns a frozen error-panel result
  and never throws; TOCTOU defense via a bounded deep clone read exactly once.
- Every identifier is a LOCAL `dash_*` / `DASH_*` contract identifier — this
  package adds **no** name to `docs/01-SSOT.md` and mints **zero**
  `candidate_*` names (registered G22 P&L field names are consumed-only and
  displayed as data labels).
