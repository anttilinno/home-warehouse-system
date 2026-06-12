# Icons — Retro OS Pastel

## Status: OPEN — not yet locked for this direction

Sketches 006-008 used unicode glyph placeholders (`▦ ▣ ⌗ ⚙ ↧`) for speed.
These are NOT a locked decision.

The old Premium Terminal direction locked Lucide strokes (and declined
pixel-art) — but that evaluation was made against scanlines + monospace
chrome that no longer exists. Under pastel window chrome the trade-offs
differ: a chunky pixel icon family might now harmonize with Silkscreen
title bars instead of fighting the chrome.

## Before hardening icons in the component library

Run a dedicated sketch (009 candidate) comparing in situ:

1. **Lucide strokes** (1.75px, round caps) — clean, already a dep in
   legacy `frontend/`
2. **Pixel icon family** (e.g. Pixelarticons) — matches Silkscreen weight
3. **Unicode glyphs** — zero-dep, but weight inconsistency was a known
   failure in old sketches 003-004

Judge against: Navigator nav rows, bevel buttons, badge interiors, table
inline actions.
