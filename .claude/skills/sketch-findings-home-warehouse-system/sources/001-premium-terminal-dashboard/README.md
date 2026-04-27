---
sketch: 001
name: premium-terminal-dashboard
question: "What does the full premium-terminal dashboard look like with all locked decisions applied?"
winner: "A — refreshed as canonical reference"
tags: [layout, dashboard, theme, sidebar, frontend2, reference]
---

# Sketch 001: Premium Terminal Dashboard [CANONICAL REFERENCE]

This sketch was refreshed after sketches 002-004 finalized the open palette/icon/typography decisions. It is now the **single canonical reference** for the frontend2 dashboard re-skin.

All earlier variant exploration (Mission Control vs Quiet Bridge) is captured in git history; this file is the post-decision target.

## How to View

```
open .planning/sketches/001-premium-terminal-dashboard/index.html
```

Click the `«` / `»` button in the sidebar header to toggle the collapsed icon-rail state.

## What's Locked In

| Area | Decision | Origin |
|---|---|---|
| **Layout** | Top bar + collapsible grouped sidebar + quick-actions command bar + dense HUD (capacity gauge / sparkline / counts) + activity table + pending approvals + system alerts | 001 Variant A (Mission Control) |
| **Palette** | Amber + green dual-channel: `#ffd07a` (amber labels), `#d6ffdc` (green data), `#efffe6` (green glow), AAA contrast everywhere on `#0a0e0a` panels | 002 Variant B v2 |
| **Typography** | 14px monospace body, 16px headings, 30-32px values, 11px micro labels at 0.18em letter-spacing | 002 Variant B v2 |
| **Icons** | `lucide-react` SVG strokes, 1.75px round caps, ~22px glyph in 28px cell, retro pixel-art alternatives evaluated and declined | 003 Variant C / 004 Variant A |
| **Sidebar grouping** | Three groups (Overview, Inventory, System) matching the legacy `frontend/` refactor (`eacaa01`) | 001 |
| **Quick actions** | 4 keyboard-shortcut tiles `[N] [S] [L] [Q]` (Add Item / Scan / Loans / Quick Capture) with path printed under each label | 001 Variant A revision |

## Implementation Notes

- Theme tokens live in `../themes/default.css` — translate to Tailwind v4 CSS custom properties for `frontend2/src/styles/`.
- All icon SVGs in this sketch are inlined from the `lucide` set; production should `bun add lucide-react` and import each as a component (`<LayoutDashboard />`, `<Package />`, etc.). Same icon family is already in legacy `frontend/`.
- Sidebar grouping in `frontend2/src/components/layout/Sidebar.tsx` currently flat — refactor mirrors the legacy `frontend/components/dashboard/sidebar.tsx` (post-`eacaa01`) grouped structure.
- HUD widgets (capacity gauge, 14d sparkline) need backend data:
  - **Capacity gauge** requires `capacity_target` per workspace (or app-wide constant)
  - **Activity sparkline** requires an activity-events-by-day rollup endpoint
  Both are small backend additions and could be deferred behind feature flags if needed.
- "Approvals", "My Changes", "Sync History" routes don't exist in `frontend2` yet — see `.planning/FRONTEND2-PARITY-ROADMAP.md`. Stub pages are sufficient for a dashboard re-skin phase.
- Quick-actions command bar can launch as static buttons; keyboard-shortcut wiring (`[N]/[S]/[L]/[Q]`) is a follow-on phase.
