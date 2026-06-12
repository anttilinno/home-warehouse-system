# Typography — Retro OS Pastel

## Stack

```css
--font-display: "Silkscreen", monospace;             /* pixel display */
--font-body: "IBM Plex Sans", system-ui, sans-serif; /* body & UI */
--font-mono: "IBM Plex Mono", ui-monospace, monospace; /* data */
```

Ship via `@fontsource/silkscreen`, `@fontsource/ibm-plex-sans`,
`@fontsource/ibm-plex-mono` (sketches used Google Fonts CDN). Plex covers
Estonian + Cyrillic for the Phase 15 locales.

## Roles

| Role | Font | Size | Rules |
|------|------|------|-------|
| Window titles | Silkscreen | 16px | uppercase, centered, ellipsis overflow |
| Stat values | Silkscreen | 30px | `tabular-nums` via mono-grid of the face |
| Brand mark | Silkscreen | 16-20px | accent half in `--accent-pink-deep` |
| Body | Plex Sans 400 | 14px | line-height 1.5 |
| Field/table labels | Plex Sans 700 | 11-12px | uppercase, 0.08-0.14em tracking, `--fg-muted` |
| Buttons | Plex Sans 600 | 13px | uppercase, 0.04em tracking |
| Data (barcodes, qty, timestamps, counts) | Plex Mono | 12-13px | `font-variant-numeric: tabular-nums` |

## Hard rules

1. **Silkscreen never below 16px.** Pixel hinting collapses; AA dies.
2. **Silkscreen never mixed case, never body copy.** Display seasoning only.
3. Mono is for *data*, not chrome — timestamps, codes, quantities, counts.
4. Email inputs may use `input--mono` (terminal nod, validated in 007).
