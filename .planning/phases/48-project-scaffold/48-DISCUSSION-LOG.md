# Phase 48: Project Scaffold - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 48-project-scaffold
**Areas discussed:** Retro design tokens, Font selection, Package manager, Directory layout

---

## Retro Design Tokens

### Aesthetic Direction

| Option | Description | Selected |
|--------|-------------|----------|
| 90s industrial game UI | C&C, SimCity 2000 -- beveled metal panels, hazard stripes, military green/amber/steel gray | :heavy_check_mark: |
| Retro terminal / DOS | Green-on-black or amber-on-black, scanline feel, blocky borders | |
| Win95 / classic OS | Light gray backgrounds, 3D beveled buttons, classic window chrome | |
| Mixed / custom | Specific vision to describe | |

**User's choice:** 90s industrial game UI
**Notes:** User provided 6 BAM (Build & Mad) reference screenshots showing exact visual targets

### Palette Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal core | 7-8 tokens -- enough for scaffold, expand in Phase 50 | |
| Full palette upfront | 15-20 tokens including all component-level colors | |
| You decide | Claude picks | |

**User's choice:** "The palette should be on the screenshots" -- user pasted 6 BAM reference images
**Notes:** Palette extracted from BAM screenshots: cream (#F5F0E1), charcoal (#2A2A2A), amber (#D4A017), orange (#E67E22), red (#CC3333), green (#4A7C4A), blue (#3366AA), hazard yellow (#FFD700), gray (#8B8B8B)

### Palette Confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Looks right, use it | Extracted palette captures the BAM aesthetic | :heavy_check_mark: |
| Adjust some colors | Some colors are off | |
| Add more colors | Need additional tokens | |

**User's choice:** Looks right, use it

### Fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| Pixel-accurate | Match BAM style as closely as possible | :heavy_check_mark: |
| Inspired by, not exact | Use palette and general vibe but adapt freely | |
| Cherry-pick elements | Pick specific elements | |

**User's choice:** Pixel-accurate

### Dark Theme Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Light only for now | Define retro-light tokens in scaffold, dark deferred | :heavy_check_mark: |
| Both themes now | Define both token sets upfront | |
| You decide | Claude picks | |

**User's choice:** Light only for now

### Reference Images

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, copy them in | Copy to .planning/references/retro-ui/ for downstream agents | :heavy_check_mark: |
| No, keep external | Just describe the style in CONTEXT.md | |

**User's choice:** Yes, copy them in
**Notes:** 6 images copied to `.planning/references/retro-ui/`

---

## Font Selection

### Font Approach

| Option | Description | Selected |
|--------|-------------|----------|
| System sans + monospace | System font for body, monospace for data -- fast loading | :heavy_check_mark: |
| Custom retro font | Specific retro font for headers, system for body | |
| All monospace | Monospace everywhere for terminal feel | |
| Specific font in mind | User has a particular font | |

**User's choice:** System sans + monospace

### Text Casing

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, uppercase headers/buttons | Match BAM: uppercase via CSS text-transform | :heavy_check_mark: |
| Mixed case | Normal casing, uppercase only for emphasis | |
| You decide | Claude picks | |

**User's choice:** Yes, uppercase headers/buttons

---

## Package Manager

| Option | Description | Selected |
|--------|-------------|----------|
| Bun | Consistent with frontend1 and .mise.toml | :heavy_check_mark: |
| npm | Universal, no extra tooling | |
| pnpm | Fast, disk-efficient | |

**User's choice:** Bun

---

## Directory Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Feature-based | src/features/, src/components/retro/, src/lib/ | :heavy_check_mark: |
| Flat by type | src/components/, src/hooks/, src/pages/ | |
| Mirror frontend1 | Adapt Next.js structure for Vite SPA | |
| You decide | Claude picks | |

**User's choice:** Feature-based

---

## Claude's Discretion

- Vite configuration details
- React Router v7 route structure specifics
- Lingui configuration
- Vite proxy setup
- ESLint/TypeScript configuration
- Specific monospace font choice

## Deferred Ideas

None -- discussion stayed within phase scope
