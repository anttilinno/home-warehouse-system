# Palette & Contrast — Retro OS Pastel

Canonical values: `sources/themes/retro-os.css`. Contrast bar is WCAG AA
(≥4.5:1) for all text pairs.

## Surfaces

| Token | Hex | Use |
|-------|-----|-----|
| `--bg-desktop` | `#fdf6ec` | App background (cream), dot-dithered: `radial-gradient(rgba(38,38,46,.055) 1px, transparent 1px)` on a 6px tile |
| `--bg-panel` | `#ffffff` | Window bodies |
| `--bg-panel-2` | `#f7f0e2` | Recessed strips: table headers, toolbars, pagers, plain title bars |
| `--bg-pressed` | `#efe6d3` | Pressed button fill |

## Ink

| Token | Hex | Contrast | Use |
|-------|-----|----------|-----|
| `--fg-ink` | `#26262e` | 15.7:1 on panel · 14.4:1 on desktop | Body text; ALL text on pastel fills |
| `--fg-muted` | `#5b5b66` | 6.6:1 on panel | Labels, secondary text |
| `--fg-faint` | `#8e8e99` | ~3.4:1 | Decorative/disabled ONLY — never running text |

## Pastel chrome fills (ink text only)

| Token | Hex | Semantic |
|-------|-----|----------|
| `--titlebar-blue` | `#b8d8e8` | Default chrome, selection, primary button |
| `--titlebar-mint` | `#b8e0c8` | Inventory / positive / success |
| `--titlebar-pink` | `#f4b8c4` | Attention / danger framing |
| `--titlebar-butter` | `#f6e3a8` | Warning framing |

Ink on all four ≥ 9.9:1. **Never put colored text on these fills.**

## Deep companions (colored text on white/cream)

| Token | Hex | Contrast on panel |
|-------|-----|-------------------|
| `--accent-blue-deep` | `#19526f` | 8.6:1 |
| `--accent-pink-deep` | `#a8334f` | 7.0:1 |
| `--accent-mint-deep` | `#1e6b43` | 6.9:1 |
| `--warn-deep` | `#7a5a12` | 6.8:1 |

## Status

- `--danger #b73348` on `--danger-bg #fbe3e8` ≈ 4.8:1
- Badge/alert fills (ink text): `--ok-bg #ddf0e4`, `--warn-bg #f9eccb`,
  `--info-bg #ddeaf3`, `--danger-bg #fbe3e8`

## Bevels & shadows

- `--border-ink #26262e` · `--bevel-light #ffffff` · `--bevel-shade #c9bda8`
- `--shadow-hard: 3px 3px 0 0 #d9cdb6` (windows/panels)
- `--shadow-hard-ink: 2px 2px 0 0 #26262e` (buttons, small chrome)
- Table rules 1px `#e7ddca`; even-row stripe `#fcf8f0`; hover `--info-bg`;
  selected row full `--titlebar-blue`.

## Regression guard

`frontend/src/styles/tokens.test.ts` asserts ≥4.5:1 for: ink/panel,
ink/desktop, muted/panel, ink on each titlebar fill, each `*-deep` on
panel, danger on danger-bg.
