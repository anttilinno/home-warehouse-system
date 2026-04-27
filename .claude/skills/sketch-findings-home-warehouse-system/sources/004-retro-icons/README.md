---
sketch: 004
name: retro-icons
question: "Lucide reads too modern for the premium-terminal aesthetic. What retro icon family fits?"
winner: "A"
tags: [icons, retro, sidebar, frontend2]
---

# Sketch 004: Retro Icon Style Side-by-Side

## How to View

```
open .planning/sketches/004-retro-icons/index.html
```

⚠ **Internet required** — variant B loads real Pixelarticons SVGs from jsdelivr CDN.

## Why This Sketch

After locking the lucide direction in sketch 003, the look came back as "too modern". This sketch surveys retro icon families found via web search and presents a 3-way comparison.

## Variants

- **A — Lucide [reference baseline]:** Sketch 003 winner. 1.75px round-cap stroke icons. Crisp, modern, uniform. The thing the user said reads as too modern.
- **B — Pixelarticons:** 800 hand-crafted pixel icons drawn on a strict 24×24 grid. MIT-licensed, npm-published as `pixelarticons`, available as raw SVGs / React components / webfont. Loaded in this sketch from `cdn.jsdelivr.net/npm/pixelarticons@1.8.1/svg/<name>.svg` as CSS masks so we can color them with `currentColor` like any text. **Real production icons** — what the implementation would actually use.
- **C — Chunky 12×12 bitmap:** Coarser pixel grid (~12×12), hand-drawn for the sketch. Reads as Atari 800 / early Mac toolbar / Norton Commander. Most retro of the three. No library exists at this exact density — every icon would have to be commissioned or hand-crafted.

## Other Retro Libraries Worth Knowing

Surfaced in the web search but not embedded in this sketch:

- **[Pxlkit](https://github.com/joangeldelarosa/pxlkit)** — 226+ pixel art SVG icons across 10 themed npm packages, plus 40+ React components and a visual icon builder. More elaborate than Pixelarticons, less standardized.
- **[Pixel Icon Library (HackerNoon)](https://pixeliconlibrary.com/)** — open-source pixelated icons, larger but more general-purpose.
- **[Vivcybericons](https://vivcybericons.vercel.app/)** — 84+ 8-bit cyberpunk icons. Smaller set, more niche styling.
- **HMIcons / SVGHMI.pro / AggreGate** — true SCADA/industrial-control symbols (valves, pumps, tanks). Mostly paid, oriented to plant/process visualization. Wrong fit for warehouse inventory despite the name match.

## What to Look For

1. **Aesthetic match to the rest of the dashboard chrome** — does the icon language read as part of the same era as the scanlines + monospace?
2. **Active state under the locked palette** — does the green-glow drop-shadow flatter pixel art the same way it flatters strokes?
3. **Specific icon recognizability** — `dashboard`, `archive` (Items), `coin` (Loans), `shield` (Approvals): pixelarticons has all of these as named icons; chunky 12×12 are hand-drawn approximations.
4. **Production cost** — A and B are essentially free. C requires a custom icon set per nav item (and any future addition).

## Recommendation Path

If **B** wins: add `pixelarticons` to `frontend2/package.json`, render via the CSS-mask pattern shown here (or as a React component if SSR matters — it doesn't here, frontend2 is SPA).

If **C** wins: budget for a small icon-set commission or accept the hand-crafted maintenance overhead. Could start with the 14 nav icons + 5-6 utility icons (~20 total) and grow as needed.

If user wants to **try Pxlkit / HackerNoon** before deciding, that's another sketch (005).
