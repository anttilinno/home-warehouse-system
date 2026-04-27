# Sketch Manifest

## Design Direction

**Premium Terminal** — phosphor-green CRT industrial HUD applied to `frontend2/`. Dark near-black background, scanline overlay, beveled monospace panels, ASCII separators (`//`, `>>`), red accents for alerts, warm-amber for warnings. Anchored to existing frontend2 data shapes (DashboardStats, RecentActivity SSE feed). Sidebar borrows the grouped structure (Overview / Inventory / System) just landed in legacy `frontend/components/dashboard/sidebar.tsx`, with a collapsible icon-rail using monospace-glyph icons.

## Reference Points

- `~/Downloads/premium_terminal_retro_dashboard.png` — military/industrial warehouse terminal mockup
- Legacy `frontend/components/dashboard/sidebar.tsx` (post-refactor `eacaa01`) — grouped nav structure
- `frontend2/src/features/dashboard/DashboardPage.tsx` — current frontend2 dashboard data

## Theme

`themes/default.css` — phosphor-green palette, monospace stack, beveled panels with inset highlights + outer green glow, scanline overlay.

## Sketches

| #   | Name                          | Design Question                                                            | Winner | Tags                                          |
| --- | ----------------------------- | -------------------------------------------------------------------------- | ------ | --------------------------------------------- |
| 001 | premium-terminal-dashboard    | How does premium-terminal CRT chrome land on real frontend2 data with the grouped collapsible sidebar? | **A — Mission Control** (dense HUD + quick-actions command bar) | layout, dashboard, theme, sidebar, frontend2  |

## Key Decisions (Sketch 001)

- **Layout:** topbar + collapsible grouped sidebar + main pane with quick-actions command bar above stat HUD.
- **Aesthetic:** phosphor-green on near-black, monospace throughout, beveled panels with inset highlights + green outer glow, subtle scanline overlay, ASCII `//` separators in headers.
- **Sidebar nav:** three groups (Overview / Inventory / System) matching the legacy `frontend/` refactor (`eacaa01`); monospace-glyph icons, no icon library; collapse toggles to icon-rail.
- **Stat row (HUD):** capacity gauge (semicircle, items vs target), 14-day activity sparkline, inline inventory counts.
- **Activity table:** full columns (Timestamp / Action / Entity / Actor / Status pill); SSE-live indicator in panel header.
- **Side rail:** Pending Approvals (priority pills) + System Alerts (sync, photo-job).
- **Quick actions:** 4-tile command bar with keyboard shortcut hints (`[N] [S] [L] [Q]`) — Add Item, Scan Barcode, View Loans, Quick Capture. Path printed under each label.

## Implementation Notes (for the build phase)

- Translate `themes/default.css` palette + scanline overlay to Tailwind CSS variables in `frontend2/src/styles/`.
- Sidebar refactor: lift the grouped structure from legacy `frontend/components/dashboard/sidebar.tsx` into `frontend2/src/components/layout/Sidebar.tsx`, swap lucide icons for monospace glyphs.
- HUD widgets (capacity gauge, sparkline) can be hand-rolled SVG — no charting lib needed; matches sketch.
- Capacity gauge requires a `capacity_target` per workspace (or app-wide constant); sparkline requires an activity-events-by-day backend rollup. Both can land as small backend additions.
- Approvals / My Changes / Sync History routes don't exist in `frontend2` yet — see `.planning/FRONTEND2-PARITY-ROADMAP.md` Phase E (Approvals) and consider stub pages for the others.
