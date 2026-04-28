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
| 002 | contrast-refinement           | How do we keep the aesthetic while making text actually readable? Sketch 001's palette failed WCAG (timestamps ~2.1:1). | **B — Amber + Green Dual-Channel** (with v2 contrast bump + 14px base font) | theme, contrast, palette, accessibility, frontend2 |
| 003 | icon-style                    | Keep monospace glyphs (32px or 40px frame) or move to lucide-style SVG strokes? | **C — Lucide Strokes** | icons, sidebar, polish, frontend2 |
| 004 | retro-icons                   | Does a retro pixel-art family fit better than Lucide? | **A — Lucide [confirmed]** (Pixelarticons + chunky bitmap evaluated and declined; Lucide reads cleaner against the rest of the chrome) | icons, retro, sidebar, frontend2 |
| 005 | interactive-nav               | Does the locked aesthetic hold up across multiple destination pages, and does the sidebar feel right as actual navigation? | **A — Expanded sidebar** + **context-aware bottom function-key bar** (supersedes dashboard quick-actions tile) + **user menu in sidebar footer** (frontend1 pattern) | layout, sidebar, navigation, bottombar, user-menu, interactivity, frontend2 |

## Locked Decisions (rolled up across 001-005)

### Added in Sketch 005

- **Bottom function-key bar (context-aware).** Replaces the dashboard's
  Quick Actions tile. Always visible under the main pane (does NOT span the
  sidebar). Each route declares its own `shortcuts: [{key, label, action}]`
  array; the same array drives both the bar render and the keyboard
  dispatcher. Globals (`[F1] HELP`, `[ESC] LOGOUT`) append on every route.
  Right side shows `UPTIME` + a live local clock. Amber `[KEY]` chips
  (`#ffd07a` on near-black text) for the per-route keys; `[ESC]` flagged
  red.
- **User menu in sidebar footer (frontend1 pattern).** Avatar (initials
  fallback) + name + email at the bottom of the sidebar, separated from
  nav by a thin border. Click → dropdown opens *upward* with `Settings`
  + `Log out` (destructive). In collapsed-rail mode (variant B), only the
  avatar shows; dropdown opens to the right instead.
- **Layout grid.** Sidebar runs full height (topbar to viewport bottom);
  bottom bar only spans the main column.

### Earlier (sketches 001-004)


- **Layout:** Sketch 001 Variant A (Mission Control) — top bar, collapsible grouped sidebar, quick-actions command bar, full HUD (capacity gauge, sparkline, activity table, pending approvals, system alerts).
- **Palette:** Sketch 002 Variant B v2 — amber + green dual-channel, AAA contrast everywhere, near-black bg with subtle scanline overlay. Amber `#ffd07a` for labels/headers/timestamps, green `#d6ffdc` for data/status, white-amber `#fff8df` for max-glow.
- **Typography:** 14px body, monospace stack throughout. Larger nav (14px), larger table cells (14px), 36px stat values.
- **Icons:** Sketch 003 Variant C, **confirmed in Sketch 004** after evaluating retro pixel-art alternatives (Pixelarticons, chunky 12×12 bitmap). `lucide-react` SVG strokes, 1.75px stroke weight, ~22px glyph in 28px cell. Drop the monospace glyph approach. `lucide-react` is already a dep in legacy `frontend/`; add to `frontend2/` for parity. Retro pixel-art was evaluated and declined — read busier against the rest of the chrome (scanlines + monospace already do the retro work).

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
