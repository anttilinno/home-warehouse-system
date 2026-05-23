# Phase 2: Tokens + Type System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 02-tokens-type-system
**Areas discussed:** Token file structure, Tailwind utility naming, Contrast audit format

---

## Token File Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Separate tokens.css | `styles/tokens.css` holds `:root` vars and `@theme` block. `globals.css` imports it. Matches REQUIREMENTS file name. | ✓ |
| All in globals.css | Tokens go directly in `globals.css` alongside Tailwind import and body resets. One file. | |
| Three-file split | `tokens.css` (custom properties), `theme.css` (@theme block), `globals.css` (imports + resets). | |

**User's choice:** Separate `tokens.css`

| Option | Description | Selected |
|--------|-------------|----------|
| Same file — tokens.css contains both | `:root` + `@theme` co-located in single `tokens.css` | ✓ |
| Separate — tokens.css has :root, theme.css has @theme | Split concerns into two files | |

**User's choice:** Co-locate `:root` and `@theme` in `tokens.css`

| Option | Description | Selected |
|--------|-------------|----------|
| globals.css handles body globals | Scanline, font import, radius override live in `globals.css` | ✓ |
| tokens.css handles everything | tokens.css owns all design primitives including body selectors | |

**User's choice:** `globals.css` handles body globals (scanline overlay, monospace anchor, sharp corners)

**Notes:** Clear split — tokens.css is design data; globals.css is behavior.

---

## Tailwind Utility Naming

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror CSS var names — bg-fg-mid, text-fg-base | 1:1 mapping; REQUIREMENTS TOKEN-02 lists this approach explicitly | ✓ |
| Semantic retro prefix — bg-retro-panel, text-retro-amber | `retro-` namespace; matches v2.0 `bg-retro-cream` convention | |

**User's choice:** Mirror CSS var names (`bg-fg-mid`, `text-fg-base`, `bg-bg-panel`, `border-fg-dim`)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — expose spacing tokens as utilities | `--spacing-sp-1: 4px` ... `--spacing-sp-6: 32px`; usage: `p-sp-3`, `gap-sp-2` | ✓ |
| No — use Tailwind's built-in spacing only | Skip spacing token exposure; use standard `p-1`, `gap-3` etc. | |
| You decide | Claude picks | |

**User's choice:** Expose spacing tokens as Tailwind utilities

**Notes:** Naming is now locked as the convention that all Phases 3–17 will follow.

---

## Contrast Audit Format

| Option | Description | Selected |
|--------|-------------|----------|
| Vitest test in src/ | `src/styles/tokens.test.ts`; asserts ≥7:1; runs in CI | ✓ |
| Standalone script in scripts/ | `scripts/check-contrast.mjs`; dev utility, not CI-enforced | |
| Comment in tokens.css only | Pre-verified ratios annotated as comments; no regression guard | |

**User's choice:** Vitest test (CI-enforced regression guard)

| Option | Description | Selected |
|--------|-------------|----------|
| Bump fg-dim to fg-mid | `@media (prefers-contrast: more) { :root { --fg-dim: var(--fg-mid); } }` — targeted | ✓ |
| Full high-contrast override set | Complete block bumping all fg tokens and darkening bg tokens | |

**User's choice:** Targeted override — only `--fg-dim` promoted under `prefers-contrast: more`

**Notes:** `--fg-dim` (#826b2c) is used for borders/inactive only, not readable text. All three readable fg tokens are already AAA without override.

---

## Claude's Discretion

- Cyrillic + Estonian glyph metrics check format (TOKEN-05) — a comment block in `tokens.css` noting glyph coverage observation; no runtime test
- `@theme` structure for border tokens
- Font import location within `globals.css`
- `rounded-*` zero-override strategy in Tailwind v4

## Deferred Ideas

None — discussion stayed within phase scope.
