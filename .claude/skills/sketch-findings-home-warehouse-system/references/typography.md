# Typography

## Stack

```css
--font-mono: ui-monospace, "JetBrains Mono", "Fira Code", "SF Mono",
  Consolas, "Courier New", monospace;
```

**Monospace everywhere.** No proportional fonts in headings, values, body, or labels. The aesthetic is industrial-control-software where every glyph is on a fixed grid.

## Scale

Base size: **14px** (bumped from 13px after sketch 002 — the original cramped feel was 30% of the readability complaint).

| Role | Size | Weight | Letter-spacing | Use |
|---|---|---|---|---|
| Tiny label | 11px | 700 | 0.18em | nav-group labels (`// OVERVIEW`), stat labels, alert tags |
| Micro meta | 11-12px | 500-700 | 0.08em | breadcrumb meta, panel meta, timestamps in pending list |
| Panel header | 13px | 700 | 0.14em | panel titles (uppercase) |
| Body | 14px | 500 | 0.04em | nav items, table cells, alert body |
| Button / pill | 12-13px | 700 | 0.12em | uppercase, all CTAs |
| Page title | 16px | 700 | 0.18em | `DASHBOARD // OVERVIEW` |
| Quick-action key | 18px | 700 | 0.04em | `[N] [S] [L] [Q]` shortcut pill |
| Stat value | 30-32px | 700 | normal | inventory counts, pending count |
| Hero gauge readout | 32px | 700 | normal | capacity gauge num |

## Letter-spacing Bands

The aesthetic depends on **wide tracking on small uppercase labels** to read as industrial signage:

- 0.18em — micro labels (`// OVERVIEW`, `ITEMS`, `LAST SYNC`)
- 0.14em — panel headers, table headers
- 0.12em — button text, pill text
- 0.08em — meta lines, timestamps in pending list
- 0.04em — nav items, body text (body stays nearly normal)
- 0.06em — `td.code` action codes (`CREATE` `UPDATE`) read between meta and body

**Don't track body text** — only labels and uppercase elements. Tracking lowercase body kills readability.

## Glow Treatment

Brand and high-emphasis elements get a soft text-shadow glow:

```css
.glow,
.page-header h1,
.panel-header .title,
.stat-value,
.gauge-readout .num {
  color: var(--fg-bright);
  text-shadow: 0 0 8px rgba(239, 255, 230, 0.5);
}
```

Subtle — 8px radius, 0.5 alpha. Reads as phosphor bleed without being a "glow effect".

## Casing

- **Uppercase** for everything that's a *label* or *control* (nav group labels, panel headers, table headers, buttons, pills, page titles, quick-action labels).
- **Lowercase / sentence case** for body content (entity names in activity table, alert prose, pending-approvals descriptions).

This is the same separation amber/green does on the color axis: hierarchy via casing, content via sentence case.

## Anti-Patterns

- ❌ **Don't reach for a proportional font** for headings or counts. Breaks the grid feel.
- ❌ **Don't track body text** — only uppercase labels.
- ❌ **Don't go below 11px** at this letter-spacing — the wide tracking + small size + monospace falls apart fast.
- ❌ **Don't glow body text** — only headings, brand, values. Glowing too much defeats the depth signal.

## Origin

Sketches: 002 (font bump), 001 (canonical reference)
Source: `sources/themes/default.css`, `sources/001-premium-terminal-dashboard/index.html`
