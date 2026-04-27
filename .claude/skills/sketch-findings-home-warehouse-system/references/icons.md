# Icons

## Decision

**`lucide-react` SVG strokes.** Already a dependency in legacy `frontend/`; add to `frontend2/` for parity. Uniform 1.75px stroke weight, rounded caps, ~22px glyph in a 28px cell.

## Why It Won

The aesthetic is delivered by *typography + composition + color* — scanlines, monospace, beveled panels, amber-on-near-black. Adding pixel-art icons over-indexed on retro and made the chrome read busy.

| Alternative tried | Outcome |
|---|---|
| **Monospace unicode glyphs** (`▣ ◊ ⊕ ▢ ▥ ⊘ ⊞ ◐ ☉`) — sketches 001-003 A/B | Outline glyphs (`◐ ☉`) read visibly thinner than block glyphs (`▣ ▤`). Terminal-authentic but visually inconsistent. |
| **Pixelarticons** (24×24 pixel art, MIT npm) — sketch 004 B | Real production icons; clean. But the pixel grid added a third visual texture on top of scanlines + monospace. Felt over-styled. |
| **Chunky 12×12 hand-drawn bitmap** — sketch 004 C | Strongest "retro" read. But every icon would need hand-crafting; no library. Maintenance overhead too high for marginal aesthetic gain. |
| **Lucide strokes** — sketches 003 C / 004 A (winner) | Uniform at any size. Fixes the glyph-weight inconsistency. Already a dep in legacy frontend. Reads clean against the rest of the chrome. |

## Application

```tsx
import { LayoutDashboard, BarChart3, Package, MapPin, Box, FolderTree,
  PackageX, Trash2, HandCoins, Users, FileUp, ShieldCheck, Clock, History
} from "lucide-react";

const navGroups = [
  {
    label: t("groups.overview"),
    items: [
      { icon: LayoutDashboard, label: t("dashboard"), href: "/dashboard" },
      { icon: BarChart3,       label: t("analytics"), href: "/analytics" },
    ],
  },
  // ... etc
];
```

In sketch HTML, icons are inlined SVG (sources/001/index.html). For production use lucide-react components.

### Render in nav-item

```css
.nav-icon {
  flex: 0 0 28px;
  height: 28px;
  display: grid;
  place-items: center;
  color: var(--fg-base);
}
.nav-icon svg {
  width: 22px;
  height: 22px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.nav-item.active .nav-icon {
  color: var(--fg-glow);
  filter: drop-shadow(0 0 6px var(--fg-bright));
}
```

`stroke: currentColor` lets the icon inherit the row's text color naturally — hover state and active state propagate without per-icon styling. The active-state glow uses a SVG `drop-shadow` filter (faster than re-stroking).

## Icon Mapping (nav)

| Nav item | lucide icon |
|---|---|
| Dashboard | `LayoutDashboard` |
| Analytics | `BarChart3` |
| Items | `Package` |
| Locations | `MapPin` |
| Containers | `Box` |
| Categories | `FolderTree` |
| Out of Stock | `PackageX` |
| Declutter | `Trash2` |
| Loans | `HandCoins` |
| Borrowers | `Users` |
| Imports | `FileUp` |
| Approvals | `ShieldCheck` |
| My Changes | `Clock` |
| Sync History | `History` |

## Quick-Action Tile Icons

Used at 16px — same lucide stroke set, just smaller cell.

| Action | lucide icon |
|---|---|
| Add Item `[N]` | `Plus` |
| Scan Barcode `[S]` | `ScanLine` (or `QrCode`) |
| View Loans `[L]` | `HandCoins` (matches nav) |
| Quick Capture `[Q]` | `Zap` |

## Anti-Patterns

- ❌ **Don't mix icon sets** — staying inside lucide keeps stroke weight + corner radius consistent across the app. Don't pull in heroicons or fontawesome alongside.
- ❌ **Don't use filled icons** — stroke is the choice; filled would clash with the beveled-panel aesthetic.
- ❌ **Don't shrink below 18px** — at 16px the stroke detail starts to disappear against the dark background. Use a larger glyph in a smaller cell instead of a smaller cell with a tight glyph.
- ❌ **Don't reach for pixel art** — even though it sounds on-brand for a "retro" theme. The CRT character is already delivered by typography + scanlines + color. Pixel icons stack a fourth retro signal that pushes past playful into kitsch.

## Origin

Sketches: 003 C (lucide chosen over monospace glyphs), 004 A (lucide confirmed over pixel-art alternatives)
Source files: `sources/003-icon-style/index.html`, `sources/004-retro-icons/index.html`
