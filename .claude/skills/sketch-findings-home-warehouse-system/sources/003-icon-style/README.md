---
sketch: 003
name: icon-style
question: "How big should icons be, and should we keep monospace glyphs or move to lucide-style strokes?"
winner: "C"
tags: [icons, sidebar, polish, frontend2]
---

# Sketch 003: Icon Style Side-by-Side

## How to View

```
open .planning/sketches/003-icon-style/index.html
```

Three nav strips visible at once — A, B, C — same content, only the icon treatment differs. Locked palette: variant B from sketch 002 (amber + green dual-channel, AAA contrast).

## Variants

- **A — Glyph 32px (baseline):** Current sketch state. Monospace unicode glyph at 16px inside a 32px panel-frame. Faithful to the terminal aesthetic. Some glyphs read at different weights (block characters like `▣` vs outline characters like `◐`).
- **B — Padded 40px (control surface):** Same glyphs, but in a 40px beveled frame. The bigger frame turns each item into a discrete physical-feeling control. Inset highlight + outer shadow on selected. The glyph-weight inconsistency mostly hides behind the frame.
- **C — Lucide strokes (production-ready):** Drops monospace glyphs for inline SVG strokes matching the `lucide-react` aesthetic — the same icon family the legacy `frontend/` sidebar already uses. Uniform 1.75px stroke weight, rounded caps. Loses some CRT character but reads cleanest at any size, especially small.

## Decision Inputs

| | A — Glyph 32px | B — Padded 40px | C — Lucide |
|---|---|---|---|
| Vertical density | tight | most generous | medium |
| Production cost | zero (just text) | zero | small (`lucide-react` already in `frontend/` deps; would add to `frontend2/`) |
| Mobile (small viewport) | weakest | medium | strongest |
| Aesthetic preservation | high | highest (control panel) | medium (less CRT) |
| Icon vocabulary | limited to monospace glyph slots | same | full lucide library (1000+ icons) |

## What to Look For

1. **Selected state** ("Dashboard"): does the active glow read as different control vs different graphic between A/B/C?
2. **Approvals row** with the amber `3` badge: does it crowd the icon? B's bigger frame gives it room.
3. **The `◐` Loans glyph**: visibly thinner than `▣ ▤ ▢ ▥` — most exposed in A. B's frame and C's strokes both fix it.
4. **"Out of Stock" / "My Changes"**: longest labels — does the bigger icon cell crowd them in B?
5. **Eye sweep speed**: which strip is fastest to scan top-to-bottom?

## Recommendation Path

If you want the **terminal feel preserved**, B is the strongest of the glyph options.
If you'd rather the icons just **work and stop being a design problem**, C is the production answer — and `frontend2/` would inherit lucide naturally from the existing legacy frontend lookup.
