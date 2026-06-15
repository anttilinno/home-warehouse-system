# Dark Mode — Implementation Plan (Retro OS Pastel, `frontend/`)

A dark variant of the **existing** Retro OS theme. Same chrome (bevels,
pinstripes, Silkscreen, square corners) — only the palette inverts. Verified
against live code 2026-06-15.

## How the theme system actually resolves (constraints, verified)

`frontend/src/styles/tokens.css` defines the palette as CSS custom properties in
`:root`, then maps them to Tailwind utilities via `@theme inline`. What flips and
what doesn't:

- **Color utilities are `var()`-based** (`bg-bg-panel` → `var(--color-bg-panel)`
  → `var(--bg-panel)`). Overriding the `:root` token inside a
  `[data-theme="dark"]` selector flips them automatically. ✅ Bulk of the app.
- **Bevel `@utility` rules** (`globals.css:83-105`) read `:root` vars
  (`--bevel-light/shade`, `--shadow-hard*`, `--border-ink`) → flip via token
  override. ✅
- **Literals baked into `@theme inline`** do NOT flip:
  `tokens.css:118-119` redefine `--shadow-hard`/`--shadow-hard-ink` as literal
  hex (deliberate — a same-name `var()` inside `@theme inline` resolves circular
  and drops the utility). The `.shadow-hard` / `.shadow-hard-ink` *Tailwind
  utility classes* therefore carry light shadow values regardless of
  `data-theme`. The bevel `@utility` rules above read the **`:root`** copies, so
  they DO flip — only direct `shadow-hard` utility usage stays light. Audit for
  direct `shadow-hard*` class usage; override in `globals.css` dark block if
  found. Radius/fonts stay (square + Silkscreen in dark is correct). ⚠️
- **`globals.css` literals**: `.pinstripes` is `rgba(255,255,255,.45)`
  (`:108-114`) → too bright on dark; needs a dark override. The `body`
  background dot-dither is `rgba(38,38,46,.055)` on a light desktop
  (`globals.css:52`) → invert to a light-alpha dot on dark. ⚠️
- **Charts** (`features/analytics/charts/retroChartTheme.ts`) hardcode
  `INK=#26262e`, `GRID=#e7ddca`, `MUTED=#5b5b66`, and reuse them in
  `AXIS_TICK_STYLE`/`VALUE_LABEL_STYLE`/`CATEGORY_LABEL_STYLE`/`GRID_PROPS`/
  `markProps`. recharts takes JS color values, not CSS vars → these do NOT flip.
  `SERIES[].fill` pastels can stay (same logic as titlebars). 6 consumer
  components: `CategoryValueChart`, `LocationValueChart`, `ConditionDonutChart`,
  `StatusStackChart`, `TopBorrowersChart`, `MonthlyLoanActivityChart`. ⚠️
  (biggest single piece of work.)
- **AA contrast is test-gated** (`tokens.test.ts`, 15 light pairs). The parser
  regex `--name:\s*(#hex)` is non-global → matches the FIRST (`:root`)
  occurrence, so adding a `[data-theme="dark"]` block does NOT break existing
  assertions. Dark assertions must parse the hex from **inside** the
  `[data-theme="dark"]{ … }` substring.

## ⚠️ The under-specified risk: text ON pastel chrome

Flipping `--fg-ink` globally (dark→light) is correct for body copy on dark
panels, but it **breaks every element that paints ink text on a light pastel
fill** — these stay light pastel by design (titlebars, selected table rows,
badges, the AppearancePage selected card). Light-on-light = invisible.

Sites that put `text-fg-ink` (or inherit body `--fg-ink`) on a pastel:

- TitlebarLabel / Window titlebars (titlebar-blue/pink/mint/butter).
- `.rtable tbody tr[aria-selected="true"] td` — bg `titlebar-blue`, text
  inherits body ink (`globals.css:255-258`).
- RetroBadge variants on pastel fills.
- Status / info bands using `bg-titlebar-*` + `text-fg-ink`.

**Fix:** introduce a **non-flipping** on-pastel ink token, e.g.
`--fg-on-accent: #26262e`, defined in `:root` and **left unchanged** in the dark
block (pastels stay light → their text stays dark). Route the chrome-on-pastel
sites to it (`text-fg-on-accent`, add to `@theme inline` as
`--color-fg-on-accent`). Likewise `--fg-muted`/`*-deep` used on the
selected-row blue must keep a dark-on-pastel variant. This audit is P2's real
work, not the surface tokens.

## Decisions (locked)

1. **Pref model**: `light | dark | system`; `system` resolves via
   `prefers-color-scheme`. Resolved `data-theme` on `<html>` is only `light|dark`.
2. **Persistence**: localStorage (`hws-theme`) for v1 — instant, no backend.
   Server `user.theme` is optional P6 (mirror the locale pattern).
3. **Titlebar pastels in dark**: keep the four pastel fills (brand identity);
   they carry fixed dark ink (`--fg-on-accent`) and read as accent bars on dark
   panels. Only surfaces/ink/desktop invert.
4. **Default**: `system`.

## Phases

### P1 — Theme infrastructure (no visual change yet)
- `src/lib/theme.ts`: `type ThemePref = "light"|"dark"|"system"`;
  `resolveTheme(pref)` (system→`matchMedia`); `applyTheme(pref)` sets
  `document.documentElement.dataset.theme` to the resolved `light|dark`;
  `readStoredPref()`/`writeStoredPref()` for localStorage `hws-theme`.
- `index.html`: tiny inline `<script>` in `<head>` that reads `hws-theme` (or
  `matchMedia`) and sets `<html data-theme>` **before** the bundle loads → zero
  FOUC. Runs pre-React so it covers the login page too.
- `src/main.tsx`: belt — call `applyTheme(readStoredPref())` before
  `root.render` (alongside the existing catalog await).
- `src/lib/useTheme.ts`: hook/context returning `{ pref, resolved, setPref }`;
  `setPref` persists + applies; a `matchMedia("(prefers-color-scheme: dark)")`
  listener re-applies live while pref is `system`.
- **AppearancePage** (`src/features/settings/AppearancePage.tsx`): rewrite the
  current locked light-only card into a Light / Dark / System 3-card selector,
  keeping the 3-cue selected treatment (glyph + filled `bevel-pressed` +
  CURRENT badge). Drop the "dark on the backlog" butter band. Wire to
  `useTheme`. Update `AppearancePage.test.tsx`.
- Optional: quick toggle in the sidebar user menu.
- Tests: `theme.ts` (resolve/persist), `useTheme` (system-listener), Appearance
  selection.

### P2 — Dark palette + on-pastel token + literal overrides
- `tokens.css`: add `--fg-on-accent: #26262e` to `:root` + `--color-fg-on-accent`
  to `@theme inline`. Then append a `[data-theme="dark"]` block overriding:
  surfaces (`--bg-desktop/panel/panel-2/pressed` → dark scale), ink
  (`--fg-ink/muted/faint` → light scale; **leave `--fg-on-accent` dark**),
  bevel (`--bevel-light` → subtle light edge, `--bevel-shade` → darker),
  shadows (`--shadow-hard*` → dark-appropriate — the `:root` copies the bevel
  utilities read), `--border-ink` → light, `--table-rule/stripe`, status bg
  tints (`--danger-bg/warn-bg/ok-bg/info-bg` → dark tints), keep pastel
  `--titlebar-*` and `*-deep` (verify deep-on-dark-panel still AA).
- Route the on-pastel chrome sites (see risk section) to `--fg-on-accent`,
  incl. `.rtable [aria-selected]` text and titlebars.
- `globals.css`: `[data-theme="dark"]` overrides for the literal utilities —
  `.pinstripes` (lower-alpha or dark stripe), the `body` dot-dither
  (light-alpha dot), and any direct `.shadow-hard*` utility usage found.
- `tokens.test.ts`: add a dark-block parser (scope the regex to the
  `[data-theme="dark"]{…}` substring) and dark-pair assertions: ink-on-panel,
  muted-on-panel, ink-on-desktop, on-accent-on-each-pastel, deep-on-panel,
  selected-row text on titlebar-blue. Tune dark palette until every pair ≥4.5:1.

### P3 — Charts (theme-aware)
- Add `--chart-ink`, `--chart-grid`, `--chart-muted` tokens (flip in dark);
  `useChartColors()` hook reads them via
  `getComputedStyle(document.documentElement)`, recomputed on `data-theme`
  change (subscribe to the same theme signal as `useTheme`).
- Refactor `retroChartTheme.ts`: keep `SERIES` fills + `seriesAt`; turn `INK`/
  `GRID`/`MUTED` and the style objects (`AXIS_TICK_STYLE` etc., `markProps`,
  `GRID_PROPS`) into either functions of the hook's colors or builders the 6
  components call. Thread colors through each chart.
- Verify axis text, grid rules, series fills + the 2px stroke read on dark in
  all six charts (donut slice strokes especially).

### P4 — Polish
- PWA `<meta name="theme-color">` — set per theme + update on toggle.
- `::selection`, scrollbar colors, `*:focus-visible` ring contrast
  (`globals.css:377`, uses `--border-ink` → flips, verify visible on dark).
- Status dots / badges / danger surfaces spot-check on dark.

### P5 — QA
- axe a11y sweep (`e2e/`) with `data-theme="dark"` forced → zero contrast
  violations.
- Screenshot dashboard, items, item detail, analytics, settings, login in dark;
  eyeball vs light.
- Boot test: stored `dark` applies pre-render (no flash); `system` flips live.

### P6 — (optional) server-persisted pref
- Add `user.theme`; apply on boot via a `useApplyTheme()` hook mirroring
  `useApplyLocale.ts` (read shared `["me"]` query, idempotent early-out);
  AppearancePage PATCHes it. Cross-device sync.

## Risk register
- **On-pastel ink flip** (text on light pastel chrome) — biggest correctness
  trap; needs the fixed `--fg-on-accent` token + a usage audit. Test-gated.
- **Charts hardcoded hex** — won't auto-flip; P3 is real work.
- **AA on dark** — pastel-on-dark-panel + `*-deep` + selected-row text must
  clear 4.5:1; expect tuning. Test-gated.
- **`@theme inline` shadow literals** — `.shadow-hard*` utility classes stay
  light; bevel `@utility` rules flip. Audit direct utility usage.
- **FOUC** — apply `data-theme` in the `index.html` inline script before first
  paint, not a React effect.
- **Login page** — pre-shell but post-boot-script, so covered.

## Touch list (files)
- New: `src/lib/theme.ts`, `src/lib/useTheme.ts`, `src/lib/useChartColors.ts`
  (+ tests); optional `src/lib/useApplyTheme.ts` (P6).
- Edit: `index.html` (boot script + theme-color), `src/main.tsx`,
  `src/styles/tokens.css` (on-accent token + dark block),
  `src/styles/globals.css` (literal overrides),
  `src/styles/tokens.test.ts` (dark parser + pairs),
  `src/features/settings/AppearancePage.tsx` (+ `.test.tsx`),
  `src/features/analytics/charts/retroChartTheme.ts` + the 6 chart components,
  optional `src/components/layout/SidebarUserMenu.tsx` (quick toggle).
</content>
</invoke>
