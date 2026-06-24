---
name: sketch-findings-home-warehouse-system
description: Validated design decisions, CSS tokens, and visual direction for the frontend Retro OS Pastel aesthetic (sketches 006-008). Auto-load when implementing any frontend screen or component.
---

<context>
## Project: home-warehouse-system

**Retro OS Pastel** for `frontend/` — System 7 / Win95 window chrome
rebuilt in pastel. Cream desktop with dot dither, white window panels with
2px ink bevels and hard offset shadows, pinstriped pastel title bars,
beveled press-state buttons, sunken inputs. Silkscreen pixel display type
+ IBM Plex Sans body + IBM Plex Mono data. WCAG AA contrast bar.

Adopted 2026-06-11, replacing the Premium Terminal CRT direction
(sketches 001-005, scrapped before any code shipped). Historical sketches
live in `.planning/sketches/`; do not apply their palette.

**Canonical sources:** `.planning/sketches/MANIFEST.md` (locked decisions)
and `.planning/sketches/themes/retro-os.css` (token values + chrome CSS,
mirrored in this skill at `sources/themes/retro-os.css`).

**Sketch session wrapped:** 2026-06-11 (sketches 006-008).
</context>

<design_direction>
## Overall Direction

A warm, friendly retro operating system: every surface is a "window" with
a pinstriped pastel title bar, every button is a bevel you can feel press.
The aesthetic comes from chrome (bevels, hard shadows, pinstripes), color
(cream + white + four pastels with ink everywhere), and type (pixel
display face over a clean humanist body) — NOT from skeuomorphic clutter.

**Vibe:** Macintosh System 7 meets a tidy Scandinavian pantry. Playful
chrome, serious data.

**What this is NOT:** a dark theme, a terminal, or a pixel-art game UI.
The pixel font is seasoning (display only, ≥16px, uppercase); body copy
and data stay in Plex Sans/Mono for full legibility. Pastels are chrome,
never text — colored text always uses the `*-deep` companions.
</design_direction>

<findings_index>
## Design Areas

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Color Palette & Contrast | `references/palette.md` | Cream/white + 4 pastel chrome fills, ink text, deep companions for colored text, AA bar |
| Typography | `references/typography.md` | Silkscreen display (≥16px, uppercase only) / IBM Plex Sans body / IBM Plex Mono data |
| Components | `references/components.md` | Window + titlebar, bevel buttons, sunken inputs, badges, tables, stat cards |
| Layout & Navigation | `references/layout.md` | Menu bar + Navigator sidebar window (grouped Overview / Inventory / System) + tiled main panes |
| Icons | `references/icons.md` | OPEN — sketches used unicode glyph placeholders; needs its own sketch before hardening |

## Theme

Locked theme at `sources/themes/retro-os.css`. Defines surfaces
(`--bg-desktop/panel/panel-2/pressed`), ink scale (`--fg-ink/muted/faint`),
pastel fills (`--titlebar-blue/pink/mint/butter`), deep text companions
(`--accent-*-deep`, `--warn-deep`), status colors, the bevel system
(`--bevel-light/shade`, `--shadow-hard`, `--shadow-hard-ink`), fonts, and
the 4px spacing scale (`--sp-1..6`).

When porting to Tailwind v4: emit tokens as CSS custom properties in
`frontend/src/styles/tokens.css` (`:root`) and map them in an
`@theme inline` block (`--color-*`, `--font-*`, `--shadow-*`,
`--spacing-sp-*`) so utilities like `bg-bg-panel` / `text-fg-ink` /
`shadow-hard` resolve.

## Hard Rules (break = regression)

1. Pixel font (Silkscreen): never below 16px, never mixed case, never
   body copy.
2. Pastel fills carry ink text only. Colored text on white/cream uses
   `--accent-blue-deep / -pink-deep / -mint-deep / --warn-deep`.
3. `--fg-faint` is decorative/disabled only — never running text.
4. Radii: 0 everywhere except badges (2px).
5. Every text pair ≥ 4.5:1 (AA) — enforced by
   `frontend/src/styles/tokens.test.ts`.

## Anti-Patterns (tried/considered and declined)

- **Premium Terminal CRT** (dark green/amber, scanlines, all-monospace) —
  full direction scrapped 2026-06-11; see MANIFEST history section.
- **Colored text on pastel fills** — fails AA; ink only.
- **Pixel font for values below display size** — legibility dies; stat
  values are the floor (30px).
- **Heavy inline per-row beveled buttons** at table density are borderline;
  fallback is borderless icon buttons gaining bevel on hover.
</findings_index>

<metadata>
## Processed Sketches

- 006-retro-os-dashboard — chrome at dashboard density; semantic titlebar
  color (pink = attention, butter = warn) ★ validated
- 007-retro-os-login — sunken inputs, error treatment, press states
  ★ validated
- 008-retro-os-table-density — 34-row table scannability, badges at
  volume, selected-row treatment ★ validated

Carried over from the scrapped direction (direction-agnostic): grouped
sidebar (Overview / Inventory / System) and user identity in the sidebar
footer.
</metadata>
