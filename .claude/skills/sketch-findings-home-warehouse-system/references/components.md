# Components

## Panel

The workhorse container. Beveled border with inset highlights + outer subtle amber glow.

```css
.panel {
  background: var(--bg-panel);
  border: 2px solid var(--fg-dim);
  box-shadow:
    inset  1px  1px 0 rgba(255, 255, 255, 0.05),
    inset -1px -1px 0 rgba(0, 0, 0, 0.6),
    0 0 16px rgba(255, 208, 122, 0.04);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-3) var(--sp-4);
  background: var(--bg-panel-2);
  border-bottom: 1px solid var(--fg-dim);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-mid);
}

.panel-header .title {
  color: var(--fg-bright);
  text-shadow: 0 0 6px rgba(239, 255, 230, 0.5);
}

.panel-header .meta {
  color: var(--fg-mid);
  font-size: 12px;
  font-weight: 500;
}

.panel-body { padding: var(--sp-4); }
```

```html
<section class="panel">
  <header class="panel-header">
    <span class="title">Recent Activity</span>
    <span class="meta">last 10 // sse: <span class="dot dot--blink"></span> live</span>
  </header>
  <div class="panel-body">…</div>
</section>
```

## Pill

Status indicators. Border + faint matching background.

```css
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  border: 1px solid currentColor;
}
.pill--ok    { color: var(--fg-base);     background: rgba(214,255,220,0.08); }
.pill--warn  { color: var(--accent-warn); background: var(--accent-warn-bg); }
.pill--info  { color: var(--accent-info); background: var(--accent-info-bg); }
.pill--danger{ color: var(--accent-danger); background: var(--accent-danger-bg); }
```

## Live Dot

Pulsing indicator for real-time state (SSE connection, ONLINE pill).

```css
.dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 6px currentColor;
}
.dot--blink { animation: blink 1.4s step-end infinite; }
@keyframes blink { 50% { opacity: 0.3; } }
```

`step-end` instead of `ease-in-out` — sharp on/off matches the terminal-LED feel, not a smooth pulse.

## Button

```css
.btn {
  background: var(--bg-elevated);
  color: var(--fg-base);
  border: 1px solid var(--fg-dim);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 8px 14px;
  cursor: pointer;
  transition: background 80ms ease, color 80ms ease, border-color 80ms ease;
}
.btn:hover {
  background: var(--bg-hover);
  color: var(--fg-bright);
  border-color: var(--fg-mid);
}
.btn:active { background: var(--bg-active); }
.btn--ghost { background: transparent; }
```

80ms transition — brisk feedback, not a slow fade. Matches the terminal/HMI character.

## Quick-Action Tile

The command-bar tile in the dashboard quick-actions row. Has a `[KEY]` shortcut column on the left, separated by an inner border.

```css
.qa {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto auto;
  grid-template-areas:
    "key icon"
    "key label"
    "key path";
  column-gap: var(--sp-3);
  align-items: center;
  padding: var(--sp-3) var(--sp-4);
  background: var(--bg-elevated);
  border: 1px solid var(--fg-dim);
  border-left: 3px solid var(--fg-mid);
  cursor: pointer;
  transition: all 80ms ease;
}
.qa:hover {
  background: var(--bg-hover);
  border-left-color: var(--fg-bright);
  color: var(--fg-glow);
  box-shadow: 0 0 8px rgba(255, 208, 122, 0.25);
}
.qa-key {
  grid-area: key;
  font-size: 18px; font-weight: 700;
  color: var(--fg-bright);
  padding: 0 var(--sp-2);
  border-right: 1px solid var(--bg-active);
  align-self: stretch;
  display: grid; place-items: center;
}
.qa-label { grid-area: label; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; color: var(--fg-bright); }
.qa-path  { grid-area: path; font-size: 11px; color: var(--fg-mid); letter-spacing: 0.08em; }
.qa-icon  { grid-area: icon; color: var(--fg-glow); }
```

## Alert Row

For System Alerts panel — colored left border + tag + message + timestamp.

```css
.alert {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--sp-3);
  align-items: center;
  padding: var(--sp-3);
  background: var(--accent-warn-bg);
  border-left: 3px solid var(--accent-warn);
  font-size: 13px;
}
.alert.info { background: var(--accent-info-bg); border-left-color: var(--accent-info); }
.alert .tag { font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; font-size: 11px; }
.alert .when { color: var(--fg-mid); font-size: 11px; }
```

## Activity Table

Standard `<table>` with terminal styling. Row-hover highlight. `td.code` for action codes (CREATE/UPDATE/DELETE), `td.dim` for timestamps.

```css
table.act { width: 100%; border-collapse: collapse; font-size: 14px; }
table.act th, table.act td {
  padding: 10px var(--sp-3);
  text-align: left;
  border-bottom: 1px solid var(--bg-elevated);
}
table.act th {
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--fg-mid);
  background: var(--bg-panel-2);
}
table.act td { color: var(--fg-base); font-weight: 500; }
table.act td.code { color: var(--fg-bright); font-weight: 700; letter-spacing: 0.06em; }
table.act td.dim  { color: var(--fg-mid); font-weight: 500; }
table.act tr:hover td { background: var(--bg-hover); }
```

Header row uses `bg-panel-2` so it visually anchors against the body rows. No alternating-row stripes — they fight the scanline overlay.

## Capacity Gauge (SVG)

Hand-rolled — no charting lib. Two arcs (track + fill) plus three tick marks. Linear gradient on the fill arc from amber to green.

```html
<svg viewBox="0 0 200 110" width="200" height="110">
  <defs>
    <linearGradient id="ggrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffd07a"/>
      <stop offset="100%" stop-color="#efffe6"/>
    </linearGradient>
  </defs>
  <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#1c241c" stroke-width="14"/>
  <path d="M 20 100 A 80 80 0 0 1 156 38" fill="none" stroke="url(#ggrad)" stroke-width="14"/>
</svg>
```

Fill arc length = function of percentage. To compute the arc end-point for a percent value: `theta = π * (1 - pct)`, then `x = 100 + 80*cos(theta)`, `y = 100 - 80*sin(theta)`. Replace `156 38` with computed `x y`.

## Activity Sparkline (SVG)

14 hand-positioned `<rect>` bars. Today's bar uses `--fg-bright` for emphasis; rest use `--fg-base`. Hand-roll until backend rollup endpoint exists.

## User Menu (sidebar footer)

Frontend1 pattern, ported into the premium-terminal aesthetic. Lives at the
bottom of the sidebar, separated from nav by a `border-top: var(--border-thin)`.
Click → dropdown opens *upward* (so it doesn't get clipped by the bottombar).

```html
<div class="user-menu">
  <button class="user-trigger">
    <span class="user-avatar">AL</span>
    <span class="user-text">
      <span class="user-name">Antti Linno</span>
      <span class="user-email">antti@begin.ee</span>
    </span>
    <span class="user-caret">▾</span>
  </button>
  <div class="user-dropdown">
    <button class="user-dropdown-item">
      <svg>...</svg> Settings
    </button>
    <div class="user-dropdown-sep"></div>
    <button class="user-dropdown-item danger">
      <svg>...</svg> Log out
    </button>
  </div>
</div>
```

```css
.user-avatar {
  width: 32px; height: 32px;
  display: grid; place-items: center;
  background: var(--bg-elevated);
  border: 1px solid var(--fg-mid);
  color: var(--fg-bright);
  font-size: 12px; font-weight: 700;
  letter-spacing: 0.06em;
  box-shadow:
    inset  1px  1px 0 rgba(255,255,255,0.05),
    inset -1px -1px 0 rgba(0,0,0,0.6),
    0 0 8px rgba(255, 208, 122, 0.18);
}

.user-trigger:hover { background: var(--bg-hover); border-color: var(--fg-dim); }
.user-trigger.open  { background: var(--bg-active); border-color: var(--fg-mid); }
.user-trigger.open .user-caret { transform: rotate(180deg); color: var(--fg-bright); }

.user-dropdown {
  position: absolute;
  bottom: calc(100% - 1px);
  left: var(--sp-2); right: var(--sp-2);
  background: var(--bg-panel);
  border: var(--border-thick);
  box-shadow:
    inset  1px  1px 0 rgba(255,255,255,0.05),
    inset -1px -1px 0 rgba(0,0,0,0.6),
    0 -4px 16px rgba(0, 0, 0, 0.6),
    0 0 12px rgba(255, 208, 122, 0.08);
  display: none; flex-direction: column;
}
.user-dropdown.open { display: flex; animation: dd-in 120ms ease-out; }

.user-dropdown-item {
  display: flex; align-items: center; gap: var(--sp-3);
  padding: 10px var(--sp-3);
  border-left: 2px solid transparent;
  color: var(--fg-base);
  background: transparent;
  border: 0;
}
.user-dropdown-item:hover {
  background: var(--bg-hover);
  color: var(--fg-bright);
  border-left-color: var(--fg-bright);
}
.user-dropdown-item.danger        { color: var(--accent-danger); }
.user-dropdown-item.danger:hover  {
  background: var(--accent-danger-bg);
  border-left-color: var(--accent-danger);
  color: var(--accent-danger);
}
```

### Collapsed-rail behavior (sidebar variant B / 60px width)

- `.user-text` and `.user-caret` hide
- `.user-trigger` centers the avatar
- `.user-dropdown` opens to the **right** of the avatar (not above), with
  `min-width: 200px`, so it isn't clipped by the 60px sidebar

```css
body[data-collapsed="true"] .user-trigger { justify-content: center; padding: 6px; gap: 0; }
body[data-collapsed="true"] .user-text,
body[data-collapsed="true"] .user-caret { display: none; }
body[data-collapsed="true"] .user-dropdown {
  left: 100%; right: auto; bottom: var(--sp-2);
  min-width: 200px; margin-left: 4px;
}
```

### Lucide icons

`Settings` and `LogOut`, 16px in 1.75px stroke. Same family as nav.

### Anti-patterns

- ❌ **Don't open the dropdown downward** — would collide with the bottombar.
- ❌ **Don't use a circular avatar** — the rest of the chrome is square; the
  avatar should be a beveled square too. Initials fallback when no image.
- ❌ **Don't drop the inset bevel on the avatar** — it loses cohesion with the
  topbar `brand-mark`, which uses the same treatment.

## Anti-Patterns

- ❌ **Don't add motion to the panel borders** — animating the inset shadow at hover looks fancy but reads as glitchy in this aesthetic. Hover state belongs on the *content* (color shift), not on the chrome.
- ❌ **Don't use a charting library** for the gauge or sparkline at this size. Hand-rolled SVG is cheaper, on-aesthetic, and 0 KB.
- ❌ **Don't drop the table-header background** (`--bg-panel-2`). Without it the headers float and lose row anchoring.
- ❌ **Don't reach for the deprecated `.qa` Quick-Actions tile** on new pages — its role moved to the bottom function-key bar (see `layout.md`). Tile pattern remains in the theme for legacy reference only.

## Origin

Sketches: 001 (canonical reference)
Source: `sources/001-premium-terminal-dashboard/index.html`, `sources/themes/default.css`
