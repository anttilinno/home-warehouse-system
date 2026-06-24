# Components — Retro OS Pastel

Reference CSS in `sources/themes/retro-os.css`; production components land
in `frontend/src/components/retro/` (barrel export).

## Window (the workhorse)

```css
.window {
  background: var(--bg-panel);
  border: 2px solid var(--border-ink);
  box-shadow:
    inset 1px 1px 0 var(--bevel-light),
    inset -2px -2px 0 var(--bevel-shade),
    var(--shadow-hard);
}
```

Title bar: pastel fill + System 7 pinstripes
(`repeating-linear-gradient(0deg, rgba(255,255,255,.45) 0 1px, transparent
1px 4px)`), 2px ink bottom border, centered Silkscreen 16px title,
decorative 14px square close/zoom boxes (`.wbox`). Variants: blue (default)
/ mint / pink / butter / plain (`--bg-panel-2`).

## BevelButton

Raised bevel + 2px ink hard shadow; uppercase Plex Sans 600 13px.
Press (`:active`): swap inset pair (shade top-left), `translate(1px,1px)`,
shadow collapses to 1px, fill `--bg-pressed`. Variants: default (white),
primary (blue), mint, pink, danger (`--danger-bg` + `--danger` text).

## Input (sunken)

Inverted bevel: `inset 2px 2px 0 var(--bevel-shade), inset -1px -1px 0
var(--bevel-light)`. Focus = `outline: 3px solid var(--titlebar-blue)`.
Error = `--danger` border + `--danger-bg` fill. `input--mono` modifier for
codes/emails.

## Badge

Pastel fill + 1px ink border + **2px radius (the only radius in the
system)**, 11px uppercase ink text. Variants ok / warn / danger / info.

## Table

- Header: `--bg-panel-2` strip, 11px uppercase muted labels, 2px ink rule
- Rows: ~31px height, 1px `#e7ddca` rules, even stripe `#fcf8f0`
- Hover `--info-bg`; selected = full `--titlebar-blue` + ink rule
- Mono cells (`tabular-nums`) for barcodes/qty

## StatCard

Small Window: pastel titlebar carries the metric name (semantic color),
body has Silkscreen 30px value + 12px muted sub-line. Danger values use
`--accent-pink-deep`, warn `--warn-deep`.

## Alert row

1px ink border, `--warn-bg`/`--danger-bg` fill, 13px ink text, mono meta
right-aligned.

## Open items

- Inline per-row beveled buttons borderline heavy at table density;
  fallback = borderless icon button gaining bevel on hover.
- Scrollbars: pastel-blue beveled thumb on `--bg-panel-2` track (webkit
  only in sketches; needs `scrollbar-*` props for Firefox in production).
