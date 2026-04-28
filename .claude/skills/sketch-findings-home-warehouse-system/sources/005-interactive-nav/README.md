---
sketch: 005
name: interactive-nav
question: "Does the locked aesthetic hold up across multiple destination pages, and does the sidebar feel right as actual navigation rather than a static panel?"
winner: "★ Variant A (Expanded sidebar) — also locks in: context-aware bottom function-key bar (replaces dashboard quick-actions tile) + user menu in sidebar footer (frontend1 pattern)"
tags: [layout, sidebar, navigation, bottombar, user-menu, interactivity, frontend2]
---

# Sketch 005: Interactive Nav Playground

Frontier follow-on to canonical sketch 001. Sketch 001 proves the dashboard at rest;
this one proves the *menu* by making it actually drive the main pane across multiple
stub destinations.

## Design Question

How does the locked premium-terminal aesthetic feel when you actually click around
the sidebar? Does the menu read as functional navigation, and do non-dashboard
surfaces (list, grid, queue) hold up under the same chrome?

## How to View

```
open .planning/sketches/005-interactive-nav/index.html
```

Then:

- **Click any sidebar item** — main pane swaps. 4 are full mock pages
  (Dashboard / Items / Locations / Approvals); the other 10 render a minimal
  "stub" panel so the active-state movement still reads.
- **Watch the bottom bar** — shortcuts re-render per page (Dashboard shows
  `[N] [S] [L] [Q]`; Items shows `[N] [F] [E] [S]`; Approvals shows
  `[A] [R] [D]`; everything carries `[F1] HELP` and `[ESC] LOGOUT`). Right
  side shows uptime + a live local clock.
- **Click any bottom-bar key** — fires the action. Works on every page.
- **Press the matching keyboard key** — same action. Try `N` on Dashboard
  vs Items vs Approvals: it does different things because the dispatch
  reads from the active page's shortcut list.
- **Click the «/» button in the sidebar header** — toggles density variant.
- **Click the variant tabs at the top** — same toggle, different entry point.
- **Press `[` or `]`** — variant A or B from the keyboard.
- **Type in the items search** — filters the table live.
- **Tick approval checkboxes** — selection count updates in the batch toolbar.

## Variants

- **A: Expanded sidebar (248px)** — full labels, group headings (`// OVERVIEW`,
  `// INVENTORY`, `// SYSTEM`), badge on Approvals. The default feel.
- **B: Collapsed rail (60px)** — icon-only. Hovering any item shows its label
  in a small floating tooltip. Tests whether the icon glow alone reads as
  functional navigation.

Both variants share the same locked theme tokens, the same nav state, and the
same content stubs. Switching A↔B preserves which page you're on.

## What to Look For

- **Bottom bar feel.** Does the always-visible function-key bar pull weight
  off the dashboard hero (no more 4-tile Quick Actions panel)? Does it read
  as TUI-authentic (mc / vim / nano) or as a clutter strip?
- **Context awareness.** Switch between Dashboard, Items, Approvals, and a
  stub page. The shortcut set should change cleanly without flicker. The
  global pair (`[F1] HELP`, `[ESC] LOGOUT`) should feel anchored on the
  right end, distinct from the page-specific ones.
- **Active-state movement** (left border + right rail glow + icon
  drop-shadow) should read clearly when you click around the sidebar.
- **Page-swap fade** (140ms ease-out) — feel right, or want to be instant?
- **Variant B icon-only rail** — do the icons alone carry meaning, or is
  the hover tooltip load-bearing?
- **Chrome generalization** — same panel/border/typography across the
  dashboard, list, grid, and queue. Anything that breaks?

## Page Inventory

| Nav item     | Stub level    | Notes |
|--------------|---------------|-------|
| Dashboard    | Full          | Quick actions + 3 stat tiles + activity table + pending + alerts |
| Items        | Full          | Filter bar, dense table with thumb / status pills, live search |
| Locations    | Full          | Card grid with code / name / count / note |
| Approvals    | Full          | Batch toolbar, alert-row queue with priority |
| Analytics    | Stub          | "wave-2 backend rollups required" |
| Containers   | Stub          | "borrows the locations grid pattern" |
| Categories   | Stub          | "already shipped to frontend2 — re-skin only" |
| Out of Stock | Stub          | "items with quantity zero or below threshold" |
| Declutter    | Stub          | "unused 12+ months — borrow / sell / discard" |
| Loans        | Stub          | "already shipped to frontend2 — re-skin only" |
| Borrowers    | Stub          | "contacts who currently hold or have held items" |
| Imports      | Stub          | "CSV / barcode batch loader" |
| My Changes   | Stub          | "edits awaiting workspace-admin review" |
| Sync History | Stub          | "background job log" |

## Anti-Patterns Observed

To be filled in after review. Working hypotheses:

- The 140ms page fade might feel sluggish in a terminal aesthetic — could
  shorten to ~80ms or drop entirely.
- Stubs use a single glyph (`◢ ▣ ⊞ ⊘ ◌ ◇ ◯ ↧ ◷ ↻`) — these are the
  monospace-glyph style that sketches 003-004 declined for nav. They might
  read fine as decorative *page-empty* indicators since they're not load-bearing,
  but worth a second look.

## Origin

Frontier follow-on to sketch 001. All theme tokens come from
`../themes/default.css`. No new locked decisions — this sketch is about
*experiencing* the existing decisions, not making new ones.
