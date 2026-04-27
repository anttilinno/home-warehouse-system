# Palette & Contrast

## Decision

**Amber + green dual-channel.** Two hues do the work that a single-hue luminance gradient struggled with. Amber for labels, headers, timestamps, panel meta. Green for body text, data values, status pills (when OK). Hue separation gives an extra grouping signal beyond lightness.

Locked tokens (origin: sketch 002 Variant B v2):

```css
--bg-base:     #040505;
--bg-panel:    #0a0e0a;
--bg-panel-2:  #10160f;
--bg-elevated: #1c241c;
--bg-hover:    #2e3d2c;
--bg-active:   #3f5c3d;

--fg-dim:    #826b2c;   /* borders / inactive only — not text */
--fg-mid:    #ffd07a;   /* AMBER — labels, headers, timestamps     · 11.8:1 */
--fg-base:   #d6ffdc;   /* GREEN — body text, data                 · 14.2:1 */
--fg-bright: #efffe6;   /* GREEN — values, glow                    · 16.0:1 */
--fg-glow:   #fff8df;   /* warm white — top-emphasis surfaces */

--amber:        #ffd07a;
--amber-bright: #ffe0a0;

--accent-warn:   #ffb84a; /* warnings, MED priority badges */
--accent-danger: #ff6a6a; /* errors, blocked actions */
--accent-info:   #4ad6ff; /* informational pills (PENDING) */
```

Every text token passes **WCAG AAA** (≥7:1) against `--bg-panel`.

## Why It Won

| Alternative tried | Outcome |
|---|---|
| **Single-hue green, narrow spread** (sketch 001 original) | Timestamps at 2.1:1 — failed WCAG AA. Critical text unreadable. |
| **Single-hue green, wider luminance spread** (sketch 002 A) | Passes AAA. Readable but flat — no hue cue separates labels from data. Eye fatigue after sustained reading. |
| **White-on-black + green accents** (sketch 002 C) | Cleanest readability. But reads as "modern monitoring console", not "premium terminal". Loses CRT character. |
| **Amber + green dual-channel** (sketch 002 B v2 — winner) | Passes AAA. Hue separation gives label-vs-data grouping. Preserves CRT warmth via amber. Reads as Bloomberg/mainframe TUI. |

## Scanline Overlay

```css
body {
  background-image:
    repeating-linear-gradient(
      0deg,
      rgba(214, 255, 220, 0.025) 0,
      rgba(214, 255, 220, 0.025) 1px,
      transparent 1px,
      transparent 3px
    ),
    radial-gradient(ellipse at center, #0a140c 0%, var(--bg-base) 80%);
  background-attachment: fixed;
}
```

Subtle (2.5% opacity, 3px period) — adds CRT character without hurting legibility. Drop if implementing on small mobile screens where the period would alias.

## Status Colors Usage

- **OK pill** — `--fg-base` green. Default for successful operations.
- **PENDING pill** — `--accent-info` cyan. Async operations awaiting state.
- **REVIEW / WARN pill** — `--accent-warn` amber. Needs human attention.
- **DANGER pill** — `--accent-danger` red. Errors, conflicts, blocked actions.

Each gets a `1px solid currentColor` border + a faint same-color background (rgba 0.08-0.14).

## Borders & Bevel

Beveled panel effect uses inset highlights + outer subtle shadow:

```css
.panel {
  background: var(--bg-panel);
  border: 2px solid var(--fg-dim);
  box-shadow:
    inset  1px  1px 0 rgba(255,255,255,0.05),
    inset -1px -1px 0 rgba(0,0,0,0.6),
    0 0 16px rgba(255,208,122,0.04);
}
```

Inset highlight on top-left, inset shadow on bottom-right, outer faint amber glow. Reads as a physical recessed control panel.

## Anti-Patterns

- ❌ **Don't put text on `--fg-dim`** — `#826b2c` is below 7:1 against panel bg. Reserved for borders and disabled-state strokes only.
- ❌ **Don't use amber for body text** — amber is the *label* hue. Mixing roles defeats the dual-channel scheme.
- ❌ **Don't skip the scanlines on dense data screens** — they're load-bearing for the aesthetic. (Drop only on mobile / iframes / print.)

## Origin

Synthesized from sketches: 001, 002, 003, 004
Source files in: `sources/themes/default.css`, `sources/002-contrast-refinement/`
