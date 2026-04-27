---
sketch: 002
name: contrast-refinement
question: "How do we keep the premium-terminal aesthetic while making text actually readable? Sketch 001's palette failed WCAG (timestamps at ~2.1:1)."
winner: null
tags: [theme, contrast, palette, accessibility, frontend2]
---

# Sketch 002: Contrast Refinement

## Why This Sketch

Sketch 001's palette compressed body text into a narrow luminance band. Worst offender: `--fg-dim: #2a4d33` on `--bg-base: #050a06` → **~2.1:1 contrast** (WCAG AA needs 4.5:1, AAA needs 7:1). Timestamps and secondary labels were unreadable.

Three different fixes, side by side, applied to the activity table + nav rail + stats row.

## How to View

```
open .planning/sketches/002-contrast-refinement/index.html
```

Bottom-right tabs flip variants. Each variant has a swatch row at the top showing measured contrast ratios against `--bg-panel`.

## Variants

- **A — Tightened Monochrome:** Same green-only direction, but luminance spread is widened. Body text bumped two stops (`#7fc991` → `#c0f5cc`, 8.6:1 → 13.2:1). Old `--fg-dim` is now reserved for borders only — never text. Lowest-contrast text element is `--fg-mid` at 8.5:1 (passes AAA).
- **B — Amber + Green Dual-Channel:** Two hues do the lifting. **Green** for primary data (entity names, values, status OK). **Amber** (`#ffb84a`) for labels, timestamps, panel headers, stat labels. Hue separation gives the eye an extra grouping signal that pure lightness gradients couldn't. Classic terminal trick (think Bloomberg, mainframe TUIs). Both hues comfortably above 8:1 against panel bg.
- **C — White-on-Black + Green Accents:** Maximum contrast. Body text near-white (`#e6e6e6`, 14.6:1). Green (`#5fff8a`) reserved for status indicators, brand glow, active nav. Drops scanlines for max read clarity. Loses some of the CRT character; gains office-screen legibility.

## What to Look For

1. **Timestamp column** — was the worst offender in sketch 001. All three should now be readable; rate which feels right *aesthetically* (not just legible).
2. **Secondary labels** ("last 10", panel header meta, "+12 this week") — A keeps them green-mid, B switches to amber, C uses neutral grey.
3. **Status pills** — OK pill changes character per variant (green-on-green vs green-on-amber-bg vs green-on-near-black).
4. **Nav-rail group labels** ("// Overview", "// Inventory") — most affected by the palette switch since they're tiny + dim.
5. **Stat values** (847, 24, 12) — all variants keep them as the brightest element. C's white feels different from A/B's green-glow values.

## Open Questions

- **Scanlines:** A and B keep them; C drops them. Wanted?
- **Chrome elements** (panel borders, beveled insets): currently still using `--fg-dim` as border color in all variants. Variant C's #555 borders read more "modern terminal", less "vintage CRT" — desirable or not?
- **Should a single variant win, or hybrid?** E.g. B's amber labels + A's green data could combine; or C's white body + A's scanlines.

## Decision Path

If a variant wins outright → update `themes/default.css` and re-issue sketch 001 with new palette.
If hybrid → cherry-pick rules and rerun a synthesis variant (D).
