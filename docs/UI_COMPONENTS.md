# UI_COMPONENTS — Operator UI Design-System Reference

> Documentation for the `apps/operator-ui` component library + design tokens, produced by the design-system audit. **Not an SSOT doc** (`docs/00`–`12` are untouched). Source: `apps/operator-ui/src/components/index.jsx` + `src/theme.css`.

**Audit score: 82/100 → addressed.** Token coverage excellent (34 color + 22 type/space tokens, 385 `var()` refs, ~0 true hardcoded colors). Fixes applied this round: keyboard-accessible list rows, input error state, button sizes + loading, badge size, layout utilities, removed the worst inline-styled control.

---

## Design tokens (`theme.css`)
- **Color:** layered surfaces `--c-bg`/`--c-bg-elev`/`-2`/`-3`; text `--c-text`/`-dim`/`-faint`; brand `--c-brand`/`-2`/`-bg`/`-glow`; semantic `--c-ok`/`warn`/`danger`/`info`/`sim`/`neutral` (+ `-bg`). Always pair color with icon/label — never color alone.
- **Typography:** `--fs-xs…2xl`; `--font` (Inter stack), `--mono` (JetBrains Mono) for all numbers (tabular).
- **Spacing:** `--s-1…6` (4/8 grid); `--radius`/`-sm`; `--shadow`/`-sm`.
- **Theme/density:** `data-theme="dark|light"`, `data-density="compact|comfortable"`.
- **RTL:** logical properties throughout (`inset-inline`, `margin-block`, `padding-inline`).

---

## Components

| Component | Purpose | Variants / props | States | A11y |
|---|---|---|---|---|
| **Badge** | status pill | `tone`: ok·warn·danger·info·sim·neutral·brand; `.sm` size; `dot` | static | color + text (never color-only) |
| **SimulatedBadge / ReadOnlyBadge** | fixed-label badges | — | static | labeled |
| **Card** | panel container | `title`·`sub`·`right`·`className` (`elev`) | hover (border) | heading in `card-head` |
| **Metric / stattile** | KPI value | `label`·`value`·`mono`·`tone`(pos/neg/brand) | — | label+value pair |
| **Button (`.btn`)** | action | `primary`·`danger`·`toggle.on`·`sm`·`lg`·`loading` | hover·active·disabled·loading | focus-visible ring; use `<button>` |
| **Input (`.search`)** | text/number entry | `.error` state | focus ring·error | pair with `.field-error` text |
| **Segmented (`.seg`)** | exclusive choice | `button.on` | hover·active | `role="group"` + aria-label |
| **DangerNote** | inline warning | `tone`·`locked` | static | `role=alert` for critical |
| **EmptyState** | no-data | `message` | — | dashed, descriptive text |
| **StatusChip** | labeled state | `label`·`state` (via `toneFor`) | — | — |
| **DataTable** | sortable table | `columns`·`rows`·`searchKeys`·`initialSort` | hover·sort | sortable `th` |
| **Timeline** | trace steps | `entries` | — | ordered |
| **NotExecutableModal** | confirm shell | `open`·`title`·`onClose`·`body` | open/closed | overlay + focusable |
| **`.wrow` (list row)** | selectable master-detail row | `.sel` selected | hover·`:focus-visible` | **`role="button"` + `tabIndex=0` + Enter/Space + `aria-pressed`** |
| **`.kpi-strip` / `.workspace` / `.filterbar`** | layout primitives | — | sticky `.detail-pane` | responsive collapse |

## Layout utilities
`.stack` (vertical gap) · `.row` (horizontal wrap) · `.between` / `.list-row` (space-between rows) · `.grid.cols-2/3/4` · `.kpi-strip` (auto-fit tiles) · `.workspace` (master-detail) · `.muted`/`.faint`/`.mono`/`.nowrap`.

## Do's & Don'ts
| ✅ Do | ❌ Don't |
|---|---|
| Use `var(--c-*)` tokens | Hardcode hex (use token, or `var(--x, #fallback)`) |
| Use `.btn`/`.badge`/`.stattile` classes | One-off inline `style={{}}` for repeated patterns |
| Pair danger color with an icon/label | Convey state by color alone |
| Make clickable rows keyboard-operable | `onClick` on a bare `<div>` |
| Show `unavailable` for missing metrics | Fabricate `0` as a value |

## Remaining (tracked, non-blocking)
- ~140 inline `style={{}}` blocks remain for one-off layout; migrate opportunistically to utilities (`.between`/`.list-row` added as the first targets).
- Optional: fold `SimulatedBadge`/`ReadOnlyBadge` into `Badge` variants.
- Add `sm/md/lg` size scale to `Card` if dense variants are needed.
