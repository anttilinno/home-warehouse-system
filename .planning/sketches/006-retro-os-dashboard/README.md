---
sketch: 006
name: retro-os-dashboard
question: "Does System 7 / Win95 window chrome in pastel carry a data-dense warehouse dashboard — bevel system, pinstriped pastel title bars, and the Silkscreen + IBM Plex pairing — without falling apart at real data density?"
winner: "★ Single variant — validated in browser 2026-06-11: bevel system + pinstriped pastel title bars + Silkscreen/Plex pairing all hold at dashboard density; semantic title-bar color (pink=attention, butter=warn) reads instantly"
tags: [layout, dashboard, theme, retro-os, pastel, frontend2]
---

# Sketch 006: Retro OS Pastel Dashboard

First sketch of the new **Retro OS pastel** direction (replaces the scrapped
Premium Terminal direction, sketches 001-005). Cream desktop with dot dither,
white window panels with 2px ink bevels and hard offset shadows, pinstriped
pastel title bars (System 7 style), beveled buttons.

## Design Question

Does window-chrome-as-component scale to a real dashboard? Specifically:

- **Bevel system** — `inset 1px 1px bevel-light / inset -2px -2px bevel-shade
  / 3px 3px hard shadow` on every window; does it read as chrome or noise
  when 8+ windows tile the screen?
- **Pastel title bars** — blue/mint/pink/butter rotation as semantic color
  (pink = needs attention). Does the pinstripe texture hold at 1×?
- **Type pairing** — Silkscreen (display, ≥16px, uppercase only) for
  titles/stat values; IBM Plex Sans body; IBM Plex Mono for timestamps and
  counts. Hard rule: pixel font never below 16px, never body copy.

## Data Binding

All numbers map to the real backend shapes (`GET
/api/workspaces/{wsId}/analytics/dashboard` + `/activity?limit=10`):

- Stat cards: `total_items`, `total_inventory`, `active_loans`,
  `overdue_loans`, `low_stock_items`
- Substat strip: `total_locations`, `total_containers`, `total_categories`,
  `total_borrowers`
- Activity table columns: `created_at` / `action` / `entity_type` /
  `entity_name`

## How to View

```
open .planning/sketches/006-retro-os-dashboard/index.html
```

## What to Look For

- Stat value legibility in Silkscreen at 30px — charming or hard to scan?
- Pastel fills carry **ink text only**; colored text appears only as the
  `*-deep` companions on white. Any spot that breaks this?
- Sidebar keeps the grouped Overview / Inventory / System structure (locked
  pre-direction decision, direction-agnostic).
- Menu-bar metaphor (File / Edit / View / Special) — delightful or dead
  weight for a web app?

## Theme

`../themes/retro-os.css` — new shared theme for sketches 006+.
