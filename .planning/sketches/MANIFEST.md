# Sketch Manifest

## Design Direction

**Retro OS Pastel** — System 7 / Win95 window chrome rebuilt in pastel,
applied to `frontend2/`. Cream desktop with dot dither, white window panels
with 2px ink bevels and hard offset shadows, pinstriped pastel title bars
(powder blue / pink / mint / butter), beveled press-state buttons, sunken
inputs. Display type is Silkscreen (pixel, ≥16px, uppercase only); body is
IBM Plex Sans; data/barcodes are IBM Plex Mono with tabular numerals.
WCAG AA (≥4.5:1) contrast bar on all text pairs.

Adopted 2026-06-11, replacing the **Premium Terminal** direction (sketches
001-005) which was scrapped before any code shipped. Old sketches and
`themes/default.css` are kept below for history — do not apply them.

## Reference Points

- `frontend/lib/api/analytics.ts` — canonical `DashboardStats` /
  `RecentActivity` shapes the dashboard sketches bind to
- `frontend2/src/lib/api.ts` — auth client (`POST /api/auth/login`,
  refresh-token flow) the login sketch binds to
- Grouped sidebar structure (Overview / Inventory / System) carried over
  from legacy `frontend/components/dashboard/sidebar.tsx` — this decision
  is direction-agnostic and survives the palette swap

## Theme

`themes/retro-os.css` — canonical palette, bevel system, window/titlebar/
button/input/badge/table chrome, spacing scale. This is the production
token source for `frontend2/src/styles/tokens.css`.

## Sketches

| #   | Name                     | Design Question | Winner | Tags |
| --- | ------------------------ | ---------------- | ------ | ---- |
| 006 | retro-os-dashboard       | Does pastel window chrome carry a data-dense dashboard — bevels, pinstriped title bars, Silkscreen + Plex pairing? | **★ validated** — chrome holds at density; semantic title-bar color (pink = attention) reads instantly | layout, dashboard, theme, retro-os, pastel, frontend2 |
| 007 | retro-os-login           | Do sunken inputs, press-state bevels, and in-window error treatment work for forms? | **★ validated** — form chrome clean; primary vs OAuth hierarchy clear | login, forms, theme, retro-os, pastel, frontend2 |
| 008 | retro-os-table-density   | Make-or-break: does pastel chrome stay scannable on a 30+ row inventory table? | **★ validated** — stripes + sand rules keep place; badges stay signal at volume | table, density, items, theme, retro-os, pastel, frontend2 |

## Locked Decisions (rolled up across 006-008)

- **Palette**: cream desktop `#fdf6ec` (dot-dithered), white panels,
  `--bg-panel-2 #f7f0e2` for recessed strips (table headers, toolbars,
  pagers). Ink `#26262e`, muted `#5b5b66`, faint `#8e8e99` (decorative
  only). Pastel fills (`--titlebar-blue/pink/mint/butter`) carry **ink text
  only**; colored text on white/cream uses the deep companions
  (`--accent-blue-deep #19526f`, `--accent-pink-deep #a8334f`,
  `--accent-mint-deep #1e6b43`, `--warn-deep #7a5a12`). All pairs ≥4.5:1.
- **Bevel system**: windows = `2px solid ink` border +
  `inset 1px 1px bevel-light, inset -2px -2px bevel-shade, 3px 3px hard
  sand shadow`. Buttons use the 2px ink hard shadow instead. Pressed state
  swaps the inset pair + 1px translate. Sunken inputs invert the bevel
  (shade top-left).
- **Title bars**: System 7 pinstripes (1px white 45% lines every 4px) over
  the pastel fill; 2px ink bottom border; centered Silkscreen title;
  decorative square close/zoom boxes. Color is semantic: blue = default,
  mint = inventory/positive, pink = attention/danger, butter = warning,
  plain = chromeless utility.
- **Typography**: Silkscreen for display only — title bars, stat values,
  brand — never below 16px, never mixed case, never body copy. IBM Plex
  Sans 14px body / 11-12px uppercase letterspaced labels. IBM Plex Mono
  with `tabular-nums` for timestamps, barcodes, counts, quantities.
- **Tables**: `--bg-panel-2` header strip with 2px ink rule, 1px sand row
  rules `#e7ddca`, even-row stripe `#fcf8f0`, hover = pale info blue,
  selected = full `--titlebar-blue` fill with ink rule.
- **Badges**: pastel fill + 1px ink border + 2px radius, 11px uppercase
  ink text; variants ok / warn / danger / info.
- **Status colors**: `--danger #b73348` on `--danger-bg #fbe3e8`; warn /
  ok / info as pastel bg fills with ink or deep text.
- **Radii**: 0 everywhere except badges (2px). No rounded windows or
  buttons.
- **Sidebar**: grouped Overview / Inventory / System inside a "Navigator"
  window; active item gets pastel-blue fill + ink border + hard shadow;
  user identity in window footer (carried over from frontend1 pattern).

## Anti-Patterns / Open Questions (carry into build phase)

- Emoji item thumbnails in 008 are placeholders — only the 1px ink thumb
  frame is locked; real item photos land later.
- Inline per-row beveled buttons are at the heavy end; fallback candidate
  is borderless icon buttons that gain bevel on hover.
- Menu bar (File / Edit / View / Special) in 006 is atmosphere — decide
  during build whether it becomes a real command surface (command palette
  entry point) or gets dropped.
- Old Premium Terminal decisions about Lucide icons were never re-tested
  under this direction; 006-008 use unicode glyph placeholders. Icon style
  needs its own sketch before the component library hardens icons.

---

## Superseded: Premium Terminal (sketches 001-005, scrapped 2026-06-11)

Direction: phosphor-green CRT industrial HUD, amber + green dual-channel,
scanlines, monospace throughout. Scrapped before any code shipped; replaced
by Retro OS Pastel above. Theme: `themes/default.css` (do not use).

| #   | Name                       | Winner (historical) |
| --- | -------------------------- | ------------------- |
| 001 | premium-terminal-dashboard | A — Mission Control dense HUD |
| 002 | contrast-refinement        | B — amber + green dual-channel, AAA |
| 003 | icon-style                 | C — Lucide strokes |
| 004 | retro-icons                | A — Lucide confirmed; pixel-art declined |
| 005 | interactive-nav            | A — expanded sidebar + bottom function-key bar + user menu in sidebar footer |

Decisions that survive the direction swap: grouped sidebar structure
(Overview / Inventory / System) and the user-menu-in-sidebar-footer
pattern. Everything palette/type/chrome-specific is void.
