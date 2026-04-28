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

CSS grid with named areas. Sidebar runs full height (top to bottom);
the bottom function-key bar only spans the main column:

```css
.app {
  display: grid;
  grid-template-columns: var(--sidebar-w, 248px) 1fr;
  grid-template-rows: 48px 1fr 36px; /* topbar / main / bottombar */
  grid-template-areas:
    "topbar    topbar"
    "sidebar   main"
    "sidebar   bottombar";
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

## Bottom Function-Key Bar (context-aware)

**Supersedes the dashboard Quick-Actions tile** as of sketch 005. Always-visible
TUI-style status bar (mc / nano / vim) under the main pane. Each route declares
its own shortcut set; globals (`[F1] HELP`, `[ESC] LOGOUT`) append on every
route. Right side carries `UPTIME` + a live local clock.

```html
<footer class="bottombar">
  <div class="bb-shortcuts">
    <button class="bb-shortcut">
      <span class="bb-key">N</span>
      <span class="bb-label">Add Item</span>
    </button>
    <!-- ... per-route shortcuts ... -->
    <button class="bb-shortcut"><span class="bb-key">F1</span><span class="bb-label">Help</span></button>
    <button class="bb-shortcut danger"><span class="bb-key">ESC</span><span class="bb-label">Logout</span></button>
  </div>
  <div class="bb-status">
    <span>UPTIME <b>442:12:05</b></span>
    <span class="sep">|</span>
    <span>LOCAL <b>14:25:34</b></span>
  </div>
</footer>
```

Key visual: `[KEY]` chips are **amber-on-near-black** (`background: var(--amber)`,
`color: #1a0e00`) so they read as physical key caps rather than green-on-green.
`.danger` variant swaps amber for `--accent-danger`. Hover lifts the cap with a
faint amber glow.

```css
.bb-shortcut .bb-key {
  background: var(--amber);
  color: #1a0e00;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 2px 7px;
  font-size: 11px;
  transition: all 80ms ease;
}
.bb-shortcut:hover .bb-key {
  background: var(--amber-bright);
  box-shadow: 0 0 8px rgba(255, 224, 160, 0.5);
}
.bb-shortcut.danger .bb-key { background: var(--accent-danger); color: #2a0000; }
```

### One source of truth for shortcuts

Each route declares `shortcuts: [{key, label, action, danger?}]`. The same
array drives the bar render AND the keyboard dispatcher — no duplication. In
React this becomes `useShortcuts(page)` + `<Bottombar />`. Globals are spread
in by the bar component itself.

```js
const PAGES = {
  dashboard: { shortcuts: [
    { key: 'N', label: 'Add Item',      action: () => navTo('/items/new') },
    { key: 'S', label: 'Scan',          action: () => navTo('/scan') },
    { key: 'L', label: 'Loans',         action: () => navTo('/loans') },
    { key: 'Q', label: 'Quick Capture', action: () => openQuickCapture() },
  ] },
  approvals: { shortcuts: [
    { key: 'A', label: 'Approve', action: approveSelected },
    { key: 'R', label: 'Reject',  action: rejectSelected, danger: true },
    { key: 'D', label: 'Defer',   action: deferSelected },
  ] },
};
```

### Why this won (over the dashboard tile)

- **Always available** — every route gets shortcuts, not just the dashboard
- **Less hero space wasted** — dashboard reclaims the 4-tile band for stats / activity
- **Genre-correct** — TUI status bar fits the premium-terminal aesthetic better than a card grid
- **Doesn't collapse** — sidebar can shrink to 60px without losing the shortcut surface

The old Quick-Actions tile pattern (`.qa` / `qa-grid`) is **deprecated** but
left intact in the theme for legacy reference. Don't reach for it on new pages.

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

Sketches: 001 Variant A (Mission Control), 005 Variant A (interactive nav + bottombar + user menu)
Sources: `sources/001-premium-terminal-dashboard/index.html`, `sources/005-interactive-nav/index.html`
