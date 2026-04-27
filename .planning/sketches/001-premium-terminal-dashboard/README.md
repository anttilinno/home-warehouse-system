---
sketch: 001
name: premium-terminal-dashboard
question: "How does premium-terminal CRT chrome land on real frontend2 dashboard data with the grouped collapsible sidebar from frontend1?"
winner: "A"
tags: [layout, dashboard, theme, sidebar, frontend2]
---

# Sketch 001: Premium Terminal Dashboard

## Design Question

Reference: `~/Downloads/premium_terminal_retro_dashboard.png` — phosphor-green CRT industrial HUD.

Anchored to the data we *actually* have in `frontend2/src/features/dashboard/`:

- `DashboardStats` → `total_items`, `total_categories`, `total_locations`
- `RecentActivity[]` → SSE-streamed event log with `created_at`, `action`, `entity_type`, `entity_name`
- Pending approvals (real backend endpoint already in legacy `frontend/`)

Sidebar matches the grouped structure just landed in `frontend/components/dashboard/sidebar.tsx`:

- **Overview** — Dashboard, Analytics
- **Inventory** — Items, Locations, Containers, Categories, Out of Stock, Declutter, Loans, Borrowers
- **System** — Imports, Approvals, My Changes, Sync History

Sidebar is **collapsible** (header-row toggle button). Icons are monospace glyphs (`▣ ◊ ⊕ ▢ ▥ ⊘ ⊞ ◐ ☉ ⇡ ✓ ⏱ ⟳`) — no icon library needed; they fit the terminal aesthetic.

## How to View

```
open .planning/sketches/001-premium-terminal-dashboard/index.html
```

Bottom-right tabs flip between variants. Top-left "«" / "»" button on each variant collapses/expands the sidebar — try both states in both variants.

## Variants

- **★ A — Mission Control (dense) [WINNER]:** The full HUD per reference. Capacity gauge (semicircle SVG, 85% fill), 14-day activity sparkline, live inventory counts, full activity table with Actor and Status pills, pending approvals with priority badges, system alerts pane (sync errors, photo-job queue). **Plus a quick-actions command bar** (Add Item / Scan / Loans / Quick Capture) with keyboard-shortcut tiles `[N] [S] [L] [Q]` directly under the page header. Uses real-ish data shapes; the gauge and sparkline imply data we'd need to compute (capacity_target, activity-binning) but everything else is derivable today.
- **B — Quiet Bridge (calmer):** Same chrome (top bar, sidebar, fonts, palette) but only the data the frontend2 dashboard renders today: 3 hero stat panels (items / categories / locations), activity feed, quick action cards. No invented widgets. The closest faithful re-skin of the *current* dashboard.

## What to Look For

1. **Density vs commitment** — A is the visual target but introduces new data dependencies (capacity gauge math, activity binning, system alerts source). B re-skins what exists. Pick density level.
2. **Sidebar collapse behavior** — toggle the «» button. Does the icon-only rail read as "use me" or "decoration"? Are the monospace glyphs distinguishable enough at small sizes? The badge on Approvals disappears when collapsed — is that the right call (vs a red dot)?
3. **Color palette intensity** — phosphor-green on near-black with subtle scanlines. Eye fatigue check: spend 60s on the sketch. Does it stay readable, or do you want me to dial the green back / introduce more cream?
4. **Topbar density** — workspace + user + status pill. Reference image had more chrome (buttons, secondary status) — too sparse, or right?
5. **Monospace everywhere** — currently *all* text is monospace including stat values. Want some hierarchy where headings/values are display-style?

## Notes for Implementation Phase (post-pick)

- Theme variables live in `.planning/sketches/themes/default.css` — translate to Tailwind + CSS custom properties for `frontend2/src/styles/`.
- Sidebar in frontend2 already groups support; this is mostly a re-skin + adding the grouped structure (currently flat).
- Activity feed already SSE-driven — table layout is a render swap.
- Capacity gauge / sparkline (Variant A) need either a charting micro-lib or hand-rolled SVG — the sketch uses hand-rolled SVG which is cheaper and stays on-aesthetic.
- "Approvals" / "My Changes" / "Sync History" routes don't exist in `frontend2` yet — they're in legacy `frontend/`. Adding the nav links means stub pages until the parity roadmap (`.planning/FRONTEND2-PARITY-ROADMAP.md`) lands them.
