# Sketch Wrap-Up Summary

**Date:** 2026-04-27
**Sketches processed:** 4
**Design areas:** Layout & Navigation, Color Palette & Contrast, Typography, Icons, Components
**Skill output:** `./.claude/skills/sketch-findings-home-warehouse-system/`

## Included Sketches

| # | Name | Winner | Design Area |
|---|------|--------|-------------|
| 001 | premium-terminal-dashboard | A — Mission Control (refreshed as canonical reference after 002-004 settled palette/icons) | Layout, all areas |
| 002 | contrast-refinement | B v2 — Amber + Green dual-channel | Palette, Typography |
| 003 | icon-style | C — Lucide strokes over monospace glyphs | Icons |
| 004 | retro-icons | A — Lucide confirmed; Pixelarticons + chunky bitmap evaluated and declined | Icons |

## Excluded Sketches

None — all four were in scope and contributed to the locked decisions.

## Design Direction

Premium Terminal — phosphor-green CRT industrial HUD with amber labels, applied to existing `frontend2/` `DashboardStats` and `RecentActivity` data shapes. Anchored to a CRT-warehouse-mockup reference (`~/Downloads/premium_terminal_retro_dashboard.png`). Sidebar borrows the grouped `Overview / Inventory / System` structure already shipped to legacy `frontend/` (commit `eacaa01`).

The aesthetic is delivered by typography (monospace, wide tracking on labels), composition (beveled panels with inset highlights, ASCII `//` separators, faint scanline overlay), and color (near-black backgrounds, amber `#ffd07a` for labels, green `#d6ffdc` for data). Icons stay clean (Lucide strokes); pixel-art alternatives were evaluated and declined — they over-indexed on retro and made the chrome read busy.

## Key Decisions

- **Layout** — top bar + collapsible grouped sidebar + quick-actions command bar above the HUD row, then activity table beside pending-approvals + system-alerts rail. Single CSS-grid swap drives the sidebar collapse (no JavaScript layout work).
- **Palette** — amber + green dual-channel, AAA contrast everywhere on `#0a0e0a` panels. `#826b2c` reserved for borders only (not text). Subtle CRT scanline overlay (2.5% alpha, 3px period).
- **Typography** — 14px monospace body. Label scale 11-13px at 0.12-0.18em letter-spacing, all uppercase. Stat values 30-32px with text-shadow glow.
- **Icons** — `lucide-react` SVG strokes, 1.75px round caps, ~22px glyph in 28px cell. Same icon family as legacy `frontend/`. `stroke: currentColor` propagates hover/active states without per-icon styling.
- **Components** — beveled panel with inset highlights, terminal-LED dot pulse (`step-end`, not ease), 80ms button transitions, hand-rolled SVG gauge + sparkline (no charting library).

## Anti-Patterns Documented

- Single-hue green at narrow luminance spread (sketch 001 original) — failed WCAG AA
- Pure monochrome wider spread (sketch 002 A) — readable but flat
- White-on-black + green accents (sketch 002 C) — clean but loses CRT character
- Monospace unicode glyphs (sketches 001-003 A/B) — outline-vs-block weight inconsistency
- Pixelarticons + chunky bitmap (sketch 004 B/C) — over-indexed on retro
- Body text on `--fg-dim` — sub-AA contrast
- Charting library for gauge/sparkline at sketch sizes — unnecessary weight, off-aesthetic
- Animated panel-border hover — glitchy in this aesthetic
- Alternating row stripes on activity table — fights scanline overlay

## Next Steps

- **Build phase** — `/gsd-plan-phase` for the frontend2 dashboard re-skin. The skill at `.claude/skills/sketch-findings-home-warehouse-system/` will auto-load and provide all locked tokens, component patterns, and anti-patterns.
- **Backend work** — `capacity_target` per workspace + activity-events-by-day rollup endpoint to feed the HUD widgets (or feature-flag them off until that lands).
- **Dependency add** — `bun add lucide-react` in `frontend2/`. Already in legacy `frontend/`.
- **Stub routes** — Approvals / My Changes / Sync History don't exist in `frontend2` yet (see `.planning/FRONTEND2-PARITY-ROADMAP.md`). Sidebar links would need stub destination pages until the parity roadmap lands them.
