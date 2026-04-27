---
name: sketch-findings-home-warehouse-system
description: Validated design decisions, CSS tokens, and visual direction from sketch experiments 001–004. Auto-load when implementing the frontend2 dashboard re-skin or any new screen in the premium-terminal aesthetic.
---

<context>
## Project: home-warehouse-system

**Premium Terminal** for `frontend2/` — a phosphor-green CRT industrial HUD applied to existing `DashboardStats` + `RecentActivity` data. Dual-hue: amber (`#ffd07a`) for labels and headers, green (`#d6ffdc`) for data and status. Monospace throughout. Subtle CRT scanline overlay. AAA contrast. Sidebar borrows the grouped Overview / Inventory / System structure already shipped to legacy `frontend/`.

**Reference:** `~/Downloads/premium_terminal_retro_dashboard.png` (CRT-green warehouse terminal mockup) anchored to `frontend2/src/features/dashboard/DashboardPage.tsx` data shapes.

**Sketch sessions wrapped:** 2026-04-27
</context>

<design_direction>
## Overall Direction

Dark CRT-green industrial HUD with amber accents. The aesthetic comes from typography (monospace), composition (beveled panels, ASCII `//` separators, subtle scanlines), and color (near-black backgrounds, green primaries, amber labels) — not from icon style. Lucide stroke icons stay clean against the rest of the chrome; pixel-art icons over-indexed on retro and were declined.

**Vibe:** Bloomberg / mainframe TUI / 90s industrial control software, not vintage gaming UI.

**What this is NOT:** A reskin where everything goes green-on-black. The dual-hue is load-bearing — amber labels separate hierarchy from data without relying on lightness alone, and provide a hue cue that pure monochrome failed to deliver (sketch 002).
</design_direction>

<findings_index>
## Design Areas

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Layout & Navigation | `references/layout.md` | Top bar + collapsible grouped sidebar + quick-actions command bar + dense HUD |
| Color Palette & Contrast | `references/palette.md` | Amber + green dual-channel, AAA contrast, scanline overlay |
| Typography | `references/typography.md` | 14px monospace body, 11-16px labels at wide letter-spacing, 30-32px values |
| Icons | `references/icons.md` | Lucide stroke icons, 1.75px round caps. Pixel-art declined |
| Components | `references/components.md` | Panels, pills, buttons, status indicators, alert rows |

## Theme

The locked theme is at `sources/themes/default.css`. It defines:
- Background scale (`--bg-base` through `--bg-active`)
- Text scale (`--fg-dim` through `--fg-glow`) — all text passes WCAG AAA against `--bg-panel`
- Amber accent (`--amber`, `--amber-bright`)
- Status colors (`--accent-warn`, `--accent-danger`, `--accent-info`)
- Spacing scale (`--sp-1` through `--sp-6`)

When porting to Tailwind v4: emit these as CSS custom properties in `frontend2/src/styles/globals.css` and reference via `bg-[var(--bg-panel)]` or define utility classes (`bg-retro-panel`, `text-retro-amber`, etc.) following the existing `bg-retro-cream` convention.

## Source Files

Original sketch HTML files preserved in `sources/` for visual reference. Sketch 001 is the canonical "this is the target" mockup; 002-004 document the decision path for palette / icons.

## Anti-Patterns (What Was Tried and Declined)

- **Sketch 001 original palette** — single-hue green at narrow luminance spread. Timestamps at 2.1:1 contrast. Failed WCAG AA.
- **Pure monochrome wider spread (sketch 002 A)** — readable but flatter than dual-hue.
- **Monospace glyph icons (sketches 001-003 A/B)** — `▣ ◊ ⊕ ▢ ▥ ⊘ ⊞ ◐ ☉` weighted inconsistently; outline glyphs read thinner than block glyphs at the same size. Decline.
- **Pixel-art icons (sketch 004 B/C)** — Pixelarticons and chunky 12×12 alternatives. Read busy against scanlines + monospace; over-indexed on retro. Decline.
- **HUD widgets without supporting data** — capacity gauge and activity sparkline imply `capacity_target` and per-day rollup data that doesn't exist yet. Either add backend endpoints or feature-flag the widgets.
</findings_index>

<metadata>
## Processed Sketches

- 001-premium-terminal-dashboard (refreshed as canonical reference after 002-004 decisions)
- 002-contrast-refinement (B v2 — amber + green dual-channel, AAA contrast)
- 003-icon-style (C — Lucide strokes over monospace glyphs)
- 004-retro-icons (A — Lucide confirmed; pixel-art alternatives declined)
</metadata>
