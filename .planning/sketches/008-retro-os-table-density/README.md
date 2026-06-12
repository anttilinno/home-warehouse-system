---
sketch: 008
name: retro-os-table-density
question: "The make-or-break: does pastel window chrome stay readable and scannable on a dense 30+ row inventory table — row striping, hover, selected row, badges, mono barcodes, inline actions, pagination?"
winner: "★ Single variant — validated in browser 2026-06-11: 34-row table scans cleanly; stripes + sand rules keep place; badges stay signal at volume; selected-row blue fill unambiguous vs hover"
tags: [table, density, items, theme, retro-os, pastel, frontend2]
---

# Sketch 008: Retro OS Table Density

A full items list inside one mint-titled window: filter toolbar, 34-row
table with live search, status badges, selected-row treatment, beveled
pagination.

## Design Question

Dashboards flatter any aesthetic; dense tables expose it. Under test:

- **Row rhythm** — 13px Plex Sans at ~31px row height with 1px sand rules
  (`#e7ddca`) + even-row stripe `#fcf8f0`. Enough separation without heavy
  ink lines everywhere?
- **Selected row** — full powder-blue fill with ink bottom border. Does it
  read as selection (vs hover's pale info-blue)?
- **Badges at volume** — four pastel badge variants repeating 30+ times.
  Noise or signal?
- **Mono columns** — barcodes + qty in Plex Mono `tabular-nums` against
  Plex Sans names. Worth the mixed-face complexity?
- **Inline actions** — tiny beveled buttons per row. Too heavy with the
  2px-ink-everywhere chrome? (Candidate fallback: borderless icon buttons
  that gain bevel on hover.)

## How to View

```
open .planning/sketches/008-retro-os-table-density/index.html
```

Type in the filter box — the table filters live and the count updates.

## What to Look For

- Scan a column top to bottom at arm's length: do stripes + rules keep
  your place, or does the cream-on-cream wash out?
- Emoji thumbs are placeholders for item photos — the 1px-ink thumb frame
  is the part under test, not the glyphs.
- Toolbar and pager share the `--bg-panel-2` recessed strip treatment —
  consistent with table headers?

## Theme

`../themes/retro-os.css`.
