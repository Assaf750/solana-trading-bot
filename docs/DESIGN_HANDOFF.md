# DESIGN_HANDOFF — Soltrade Operator UI

> Developer handoff spec for `apps/operator-ui` — generated from the real implementation (`src/theme.css` + `src/components/index.jsx` + pages). Stack: **React + Vite, plain CSS (tokens + utility/component classes), HashRouter**. Not an SSOT doc (`docs/00`–`12` untouched). Companion: [UI_COMPONENTS.md](UI_COMPONENTS.md).

## Overview
A dense, dark, RTL-aware operator console for a Solana copy-trading engine. Nine pages behind a fixed left sidebar + sticky top bar with a live status strip. Read-model driven (all data from the local server's `/api/*`); honest empty/offline/unavailable states throughout. Bilingual AR/EN with full RTL.

## Layout
- **Shell:** fixed sidebar `--nav-w: 236px` + fluid `.main`; content max-width **1560px**, padding `--s-5`.
- **Top bar:** sticky, blurred (`backdrop-filter: blur(10px)`), holds the SIMULATED/mode banner + live status strip (engine/vault/signer/kill/blockers LED pills) + language/density/theme toggles.
- **Signature pattern — `.workspace`:** two-column master–detail grid `minmax(0,1.6fr) minmax(320px,1fr)`; detail pane is `position: sticky; top: 96px`. Collapses to one column ≤1100px.
- **`.kpi-strip`:** `repeat(auto-fit, minmax(150px, 1fr))` stat tiles.

## Design Tokens Used (`:root` in theme.css; `[data-theme="light"]` overrides)
| Token | Value (dark) | Usage |
|---|---|---|
| `--c-bg` / `--c-bg-elev` / `-2` / `-3` | `#0a0b0d` / `#121316` / `#1a1c20` / `#22252b` | page → card → raised → input surfaces |
| `--c-border` / `--c-border-strong` | `#23262c` / `#343943` | dividers / focusable edges |
| `--c-text` / `--c-text-dim` / `--c-text-faint` | `#f4f6f8` / `#98a0ab` / `#5f6873` | primary / secondary / tertiary |
| `--c-brand` / `--c-brand-2` / `--c-brand-bg` / `--c-brand-glow` | `#3ddc97` / `#21c2a8` / rgba 0.12 / rgba 0.25 | brand accent, active nav, primary CTA, glow |
| `--c-ok` / `--c-warn` / `--c-danger` / `--c-info` / `--c-sim` / `--c-neutral` (+ `-bg`) | `#46c97d` / `#f5b14a` / `#f0545b` / `#5aa9ff` / `#b08bff` / `#8b95a1` | semantic — **always paired with icon/label, never color-only** |
| `--fs-xs…2xl` | 11 / 12 / 13 / 15 / 19 / 26 px | type scale |
| `--font` / `--mono` | Inter stack / JetBrains Mono | text / **all numbers (tabular-nums)** |
| `--s-1…6` | 4 / 8 / 12 / 16 / 22 / 32 px | spacing (4/8 grid) |
| `--radius` / `--radius-sm` | 10 / 7 px | cards / controls |
| `--shadow` / `--shadow-sm` | `0 6px 24px /.45` / `0 2px 8px /.35` | elevation |

## Components (see UI_COMPONENTS.md for full API)
| Component | Variants | Key props | Notes |
|---|---|---|---|
| `Badge` | `tone` ok·warn·danger·info·sim·neutral·brand; `.sm` | `dot` | pill; semantic + text |
| `Card` | `elev` | `title`·`sub`·`right` | header divider + hover border |
| Button `.btn` | `primary`·`danger`·`toggle.on`·`sm`·`lg`·`loading` | — | use real `<button>` |
| Input `.search` | `.error` | — | pair with `.field-error` |
| `.seg` | `button.on` | — | `role="group"` + aria-label |
| `DataTable` | sort/search | `columns`·`rows`·`searchKeys`·`initialSort` | sticky header |
| `Metric`/`.stattile`, `StatusChip`, `Timeline`, `DangerNote`, `EmptyState`, `NotExecutableModal` | — | — | — |
| `.wrow` (master row) | `.sel` | — | `role="button"` tabIndex 0, Enter/Space, `aria-pressed` |

## States and Interactions
| Element | State | Behavior |
|---|---|---|
| `.btn` | hover / active / disabled / loading | border→brand + elev bg / `translateY(1px)` / opacity .45 + not-allowed / transparent text + spinner, pointer-events none |
| `.btn.primary` | hover | `filter: brightness(1.08)`, brand gradient + glow |
| `.search` | focus / error | brand border + 3px brand-bg ring / danger border + danger ring |
| `.wrow` | hover / selected / focus | elev bg / brand-bg + inset 3px brand bar (`aria-pressed`) / 2px brand focus ring |
| nav link | hover / active | elev bg / brand-bg + glowing inset accent bar |
| Kill switch | engaged | `.btn.danger.lg`; on click → KILLED + signer locked; disengage needs typed `DISENGAGE` |
| Stat value | pos / neg | `--c-ok` / `--c-danger`, tabular mono |

## Responsive Behavior
| Breakpoint | Changes |
|---|---|
| Desktop > 1100px | full `.workspace` 2-col master–detail; `.grid.cols-3/4` full |
| ≤ 1100px | `.workspace` → 1 col (detail stacks under list); `.grid.cols-3/4` → 2 col |
| ≤ 720px | all grids → 1 col |
| Density toggle | `[data-density]` compact (`--row-pad 4px 9px`) vs comfortable (`8px 12px`) |

## Edge Cases
- **Offline:** server unreachable → status strip shows red "server offline"; each page renders an `EmptyState` ("run START.bat"), never fabricated data.
- **Empty:** dashed `EmptyState` with a clear next action (e.g. "follow a wallet").
- **Unavailable metric:** literal "unavailable / غير متوفّر" — never `0` as unknown.
- **Long values:** addresses/mints shortened `xxxx…xxxx` (mono, `dir="ltr"`); full value in `word-break: break-all` detail rows.
- **Simulated vs real:** `SimulatedBadge` on every paper P&L/balance; real/simulated never mixed.

## Animation / Motion
| Element | Trigger | Animation | Duration | Easing |
|---|---|---|---|---|
| `.btn`/`.card`/`.wrow` | hover | border/bg/transform | 0.12–0.15s | default |
| `.btn.loading::after` | loading | `spin` rotate 360° | 0.7s | linear (infinite) |
| nav active bar / pill LEDs | state | glow (box-shadow) | — | — |
| status-strip pill `.led` | health | colored glow ok/warn/danger | — | — |
| all | `prefers-reduced-motion` | transitions disabled | — | — |

## Accessibility Notes
- **Focus:** global `:focus-visible` 2px brand ring; clickable list rows are real buttons (role, tabIndex, Enter/Space, `aria-pressed`, `aria-label`).
- **RTL:** logical properties throughout (`inset-inline`, `margin-block`, `padding-inline`); `dir`/`lang` set on `<html>` per locale; segmented groups use `role="group"` + `aria-label`.
- **Color:** semantic state always carries an icon/word, never color alone; contrast tuned on the dark palette.
- **Scrollbars / selection:** themed; selection uses brand glow.
- **Security/critical alerts:** non-dismissible-as-bypass; `role=alert` where critical.

## Implementation notes (stack-specific)
- Plain CSS with CSS variables — no Tailwind/CSS-in-JS. Reuse tokens (`var(--*)`) and the utility/component classes; avoid one-off hardcoded hex (use `var(--x, #fallback)` if a literal is unavoidable).
- Numbers: always `--mono` + `font-variant-numeric: tabular-nums`.
- Data via `src/api/client.js` + `useBackend()` (status polling + SSE); pages must handle `connected===false`.
