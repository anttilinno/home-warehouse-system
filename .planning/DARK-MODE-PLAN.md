# Dark Mode — Implementation Plan (Retro OS Pastel, `frontend/`)

A dark variant of the **existing** Retro OS theme (not frontend1). Same chrome
(bevels, pinstripes, Silkscreen, square corners) — only the palette inverts.

## How the theme system actually resolves (constraints)

`frontend/src/styles/tokens.css` defines palette as CSS custom properties in
`:root`, then maps them via `@theme inline`. This matters:

- **Color utilities are `var()`-based** (`bg-bg-panel` → `var(--bg-panel)`).
  Overriding the `:root` token under a `[data-theme="dark"]` selector flips them
  automatically. ✅ The bulk of the app.
- **Bevel `@utility` rules** (`bevel-raised-ink`, etc.) read the `:root` vars
  (`--bevel-light/shade`, `--shadow-hard-ink`, `--border-ink`) → flip via token
  override. ✅
- **Literals baked into `@theme inline`** do NOT flip via `var()`:
  `.shadow-hard` / `.shadow-hard-ink` utility classes, `--radius-*`, and the
  font families. These need explicit `[data-theme="dark"]` CSS overrides where
  the look must change (shadows). Radius/fonts stay (square + Silkscreen in dark
  is correct). ⚠️
- **`.pinstripes`** is a literal `rgba(255,255,255,.45)` gradient → too bright on
  dark; needs a dark override. ⚠️
- **Charts** (`features/analytics/charts/retroChartTheme.ts`) use **hardcoded
  hex** (`INK=#26262e`, `GRID`, `MUTED`, SERIES fills) — recharts takes JS color
  values, so they do NOT pick up CSS vars. Charts need a theme-aware color
  source. ⚠️ (biggest single piece of work.)
- **AA contrast is a hard rule** enforced by `src/styles/tokens.test.ts`
  (8 pairs, light-only today). The dark palette must clear 4.5:1 and the test
  must gain dark-pair assertions.

## Decisions to lock before building

1. **Pref model**: `light | dark | system` (3-way), `system` resolves via
   `prefers-color-scheme`. Resolved `data-theme` on `<html>` is only `light|dark`.
2. **Persistence**: localStorage (`hws-theme`) for v1 — instant, no backend.
   (Later: a server `user.theme` field like `language`, applied on boot via the
   `["me"]` query — optional P6.)
3. **Titlebar pastels in dark**: keep the four pastel fills (brand identity);
   they carry dark ink text and read fine as accent bars on dark panels. Only
   the surfaces/ink/desktop invert. (Alternative — muted titlebars — rejected:
   loses the retro identity.)
4. **Default**: `system`.

## Phases

### P1 — Theme infrastructure (no visual change yet)
- `src/lib/theme.ts`: `type ThemePref = "light"|"dark"|"system"`; `resolve()`
  (system→matchMedia); `applyTheme()` sets `document.documentElement.dataset.theme`;
  read/write localStorage `hws-theme`.
- `index.html`: a tiny inline `<script>` that applies the stored/system theme to
  `<html data-theme>` **before** the bundle loads → zero flash (FOUC) on boot.
  (Belt: also call `applyTheme` in `main.tsx`.)
- `useTheme()` hook/context: current pref + setter (persists + applies); a
  `matchMedia("(prefers-color-scheme: dark)")` listener so `system` flips live.
- **AppearancePage**: replace the light-only card with a Light / Dark / System
  selector (3 cards, the existing 3-cue selected treatment, or a `RetroSelect`).
- Optional: quick toggle in the sidebar user menu.
- Tests: `useTheme` (persist/resolve/system-listener); AppearancePage selection.

### P2 — Dark palette + literal-utility overrides
- `tokens.css`: add a `[data-theme="dark"]` block overriding the color tokens —
  surfaces (`--bg-desktop/panel/panel-2/pressed` → dark), ink scale
  (`--fg-ink/muted/faint` → light), deep companions, status bg tints, bevel
  (`--bevel-light` → subtle light-edge, `--bevel-shade` → darker), shadows
  (`--shadow-hard*` → dark-appropriate), `--border-ink` → light, table rule/stripe.
- `globals.css`: `[data-theme="dark"]` overrides for the **literal** utilities —
  `.shadow-hard`, `.shadow-hard-ink`, `.pinstripes` (lower-alpha or dark stripe),
  and the dot-dither desktop background.
- Extend `tokens.test.ts` with dark-pair AA assertions (ink-on-panel,
  muted-on-panel, deep-on-pastel, selected-row fill). Tune the dark palette until
  every pair clears 4.5:1.

### P3 — Charts (theme-aware)
- Make `retroChartTheme` colors resolve per active theme instead of hardcoded
  hex. Cleanest: a `useChartColors()` hook that reads the resolved CSS vars
  (`getComputedStyle(documentElement)`) for INK/GRID/MUTED/SERIES, recomputed on
  theme change; pass into the chart components. (Or: export `LIGHT`/`DARK`
  constant sets and pick by `data-theme`.)
- Verify axis text, grid rules, series fills + the 2px ink stroke read correctly
  on dark in all six charts.

### P4 — Polish
- PWA `<meta name="theme-color">` — set per theme + update on toggle.
- `::selection`, scrollbar colors, focus-ring contrast on dark.
- Status dots / badges / danger surfaces spot-check.

### P5 — QA
- Run the axe a11y sweep (`e2e/`) with `data-theme="dark"` forced → zero contrast
  violations.
- Screenshot the key screens (dashboard, items, item detail, analytics, settings,
  login) in dark; eyeball vs light.
- Boot test: stored `dark` applies pre-render (no flash); `system` flips live.

### P6 — (optional) server-persisted pref
- Add `user.theme`; apply on boot via `["me"]` (mirror the locale-apply hook);
  AppearancePage PATCHes it. Gives cross-device sync.

## Risk register
- **Charts hardcoded hex** — won't auto-flip; P3 is the real work.
- **AA on dark** — pastel-on-dark + the titlebar-blue selected-row fill must
  still clear 4.5:1; expect palette tuning. Test-gated.
- **Literal `@theme` utilities** (shadows) silently stay light unless overridden.
- **FOUC** — must apply `data-theme` before first paint (inline `index.html`
  script), not in a React effect.
- **Login page** renders outside the authed shell — confirm the boot script
  covers it (it's pre-React, so yes).

## Touch list (files)
- New: `src/lib/theme.ts`, `src/lib/useTheme.ts` (+ tests).
- Edit: `index.html` (boot script + theme-color), `src/main.tsx`,
  `src/styles/tokens.css` (dark block), `src/styles/globals.css` (literal
  overrides), `src/styles/tokens.test.ts` (dark pairs),
  `src/features/settings/AppearancePage.tsx` (+ test),
  `src/features/analytics/charts/retroChartTheme.ts` (+ chart components),
  optionally `src/components/layout/SidebarUserMenu.tsx` (quick toggle).
