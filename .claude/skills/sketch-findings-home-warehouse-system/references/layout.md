# Layout & Navigation

## Page Structure

```
┌────────────────────────────────────────────────────────────────┐
│ TOPBAR  brand-mark + brand-text · spacer · ws/user/status pill │
├──────────┬─────────────────────────────────────────────────────┤
│ SIDEBAR  │ MAIN                                                │
│          │  page-header (title + breadcrumb)                   │
│ Overview │  ┌─────────────────────────────────────────────┐   │
│  Dash    │  │ Quick Actions (4-tile command bar)         │   │
│  Anal    │  └─────────────────────────────────────────────┘   │
│          │  ┌──gauge──┐ ┌──spark──┐ ┌──counts──┐               │
│ Inventry │  │  85%    │ │ ▁▂▄▆▇█  │ │ 847·24·12│               │
│  Items   │  └─────────┘ └─────────┘ └──────────┘               │
│  Loc     │  ┌──Recent Activity──────────────┐ ┌──Pending──┐   │
│  Cont    │  │ table                         │ │ list      │   │
│  ...     │  │                               │ ├──Alerts───┤   │
│          │  └───────────────────────────────┘ │ rows      │   │
│ System   │                                     └───────────┘   │
│  ...     │                                                     │
└──────────┴─────────────────────────────────────────────────────┘
```

CSS grid with named areas:

```css
.app {
  display: grid;
  grid-template-columns: var(--sidebar-w, 248px) 1fr;
  grid-template-rows: 48px 1fr;
  grid-template-areas:
    "topbar topbar"
    "sidebar main";
  min-height: 100vh;
  transition: grid-template-columns 200ms ease;
}
.app[data-collapsed="true"] { --sidebar-w: 60px; }
```

Sidebar collapse is a single CSS custom-property swap on the root grid. No JavaScript layout work, no measure phase.

## Sidebar Grouping

Three groups, matching the legacy `frontend/components/dashboard/sidebar.tsx` post-refactor (`eacaa01`):

- **// Overview** — Dashboard, Analytics
- **// Inventory** — Items, Locations, Containers, Categories, Out of Stock, Declutter, Loans, Borrowers
- **// System** — Imports, Approvals (badge: pending count), My Changes, Sync History

Group label format: `// {NAME}` uppercase, `0.18em` letter-spacing, `--fg-mid` (amber).

```html
<div class="nav-group">
  <div class="nav-group-label">// Overview</div>
  <a class="nav-item active">
    <span class="nav-icon"><svg>...</svg></span>
    <span class="label">Dashboard</span>
  </a>
  ...
</div>
```

## Active Indicator

```css
.nav-item.active {
  background: var(--bg-active);
  color: var(--fg-glow);
  border-left: 2px solid var(--fg-bright);
}
.nav-item.active::after {
  content: "";
  position: absolute; right: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--fg-bright);
  box-shadow: 0 0 8px var(--fg-bright);
}
.nav-item.active .nav-icon {
  color: var(--fg-glow);
  filter: drop-shadow(0 0 6px var(--fg-bright));
}
```

Two-rail emphasis — left border (2px solid) + right rail (3px glowing). Active item icon also glows. Generates a "selected channel" feel without being noisy.

## Collapsed State

When `data-collapsed="true"`:
- Sidebar width 248px → 60px
- Group labels hidden (`display: none`)
- Item labels hidden, badges hidden
- Items center-align (`justify-content: center`, `padding: 9px 0`)
- Group spacing tightens (`margin-bottom: 8px` instead of 16px)

The icon-rail-only state is part of the design — at 60px wide, the icons + active glow alone read as functional navigation.

## Quick-Actions Command Bar

Four tiles in a horizontal grid, placed directly below the page header. Each tile shows:
- `[KEY]` keyboard shortcut (large, glowing)
- icon (16px lucide stroke)
- label (uppercase, 13px)
- path (lowercase, 11px, dim)

```html
<button class="qa">
  <span class="qa-key">[N]</span>
  <span class="qa-icon"><svg>...</svg></span>
  <span class="qa-label">Add Item</span>
  <span class="qa-path">/items/new</span>
</button>
```

Reads as "operator's command surface" rather than "buttons". The `[KEY]` column has its own border-right separator inside the tile so it functions visually as a hardware key cap.

## HUD Row (3 panels, 1.2 / 1.2 / 1 ratio)

Capacity gauge (semicircle SVG) — Activity sparkline (14d bars) — Inventory counts (3 stat tiles).

The sparkline uses hand-rolled SVG `<rect>` bars — no charting library required. The gauge uses an SVG `<path>` arc for the track and a second arc for the fill, with a linear gradient stop from `--amber` to `--fg-bright`.

## Activity + Side Rail (2/1 ratio)

Activity table is the dominant element — full-width rows, columns: Timestamp / Action / Entity / Actor / Status. The right rail stacks Pending Approvals + System Alerts.

## Anti-Patterns

- ❌ **Don't use a flat nav** — three-group structure is now load-bearing for findability and matches the legacy app.
- ❌ **Don't put body content into the topbar** — topbar is brand + workspace/user identity + connection status only. No actions, no toolbars.
- ❌ **Don't make the sidebar non-collapsible** — collapse is the mobile/tablet escape hatch and the operator-density toggle.
- ❌ **Don't drop the page-header breadcrumb meta** — `SESSION 0:42:18 // LAST SYNC 14:02:11` reads as system-status in a way that matches the rest of the chrome.

## Origin

Sketches: 001 Variant A (Mission Control)
Source: `sources/001-premium-terminal-dashboard/index.html`
