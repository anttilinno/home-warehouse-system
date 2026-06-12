# Phase 2: Tokens + Type System - Context

**Gathered:** 2026-05-01
**Revised:** 2026-06-11 — design direction swapped from Premium Terminal
(dark CRT) to **Retro OS Pastel** (sketches 006-008). Token *architecture*
decisions (D-01..D-05) survive unchanged; token *values*, fonts, and the
contrast bar are revised below. Each revised item keeps its ORIGINAL for
history.
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers the visual and typographic foundation that every subsequent phase (3–17) builds on:

1. **`styles/tokens.css`** — CSS custom properties ported verbatim from the locked sketch theme, plus a Tailwind v4 `@theme` block exposing all tokens as utility classes.
   - ORIGINAL (2026-05-01): premium-terminal vars (`--bg-*`, `--fg-*`, `--amber`, `--accent-*`).
   - REVISED (2026-06-11): retro-os vars from `.planning/sketches/themes/retro-os.css` — surfaces (`--bg-desktop/panel/panel-2/pressed`), ink (`--fg-ink/muted/faint`), pastel fills (`--titlebar-*`), deep companions (`--accent-*-deep`, `--warn-deep`), status colors, bevel system (`--bevel-*`, `--shadow-hard*`), spacing (`--sp-*`).
2. **`styles/globals.css`** updates — body globals.
   - ORIGINAL: JetBrains Mono Variable import, scanline + radial-vignette background, monospace anchor, sharp-corners override.
   - REVISED: `@fontsource/silkscreen` + `@fontsource/ibm-plex-sans` + `@fontsource/ibm-plex-mono` imports, cream desktop + dot-dither background, `font-family: var(--font-body)` anchor, radius 0 except badges (2px).
3. **Verification** — Vitest contrast test.
   - ORIGINAL: WCAG AAA (≥7:1) for three fg tokens vs `--bg-panel`.
   - REVISED: WCAG **AA (≥4.5:1)** for the pair list: ink/panel, ink/desktop, muted/panel, ink/each-titlebar fill, each `*-deep`/panel, danger/danger-bg.

Phase 2 does NOT include layout primitives, atoms, or any feature UI — those are Phases 3+. The output of Phase 2 is a token contract file + body styles; no visible route changes.

</domain>

<decisions>
## Implementation Decisions

### Token File Architecture (UNCHANGED — survives direction swap)

- **D-01:** `styles/tokens.css` is a **separate file** from `globals.css`. It contains both the `:root { ... }` custom property block AND the `@theme { ... }` Tailwind mapping block co-located (single file; no further split).
- **D-02:** `globals.css` **imports** `tokens.css` and handles all body-level selectors (background, font import, radius override). Import chain: `globals.css` → `@import './tokens.css'` then `@import 'tailwindcss'`.
- **D-03:** Body globals live in **`globals.css`**, not in `tokens.css`. Design token values are data; body behavior is behavior.

### Tailwind Utility Naming (UNCHANGED pattern, new names)

- **D-04:** Utility class names **mirror CSS var names verbatim** — `bg-bg-panel` applies `--bg-panel`, `text-fg-ink` applies `--fg-ink`, `bg-titlebar-mint` applies `--titlebar-mint`. The `@theme` block maps `--color-fg-ink: var(--fg-ink)` etc. Predictable: knowing the token name means knowing the class. (Tailwind 4 note: var-indirected tokens require `@theme inline`.)
- **D-05:** Spacing tokens are **exposed as Tailwind spacing utilities** — `@theme` includes `--spacing-sp-1: 4px` through `--spacing-sp-6: 32px`. Retro atoms use `p-sp-3`, `gap-sp-2`, etc.

### Contrast Audit

- **D-06 (REVISED 2026-06-11):** WCAG **AA** audit lives in a Vitest test at `src/styles/tokens.test.ts`, asserting ≥4.5:1 for the revised pair list (see Phase Boundary item 3). Pure WCAG formula over hex literals — no DOM. Runs in `bun run test` and CI.
  - ORIGINAL: AAA ≥7:1 for `--fg-mid/base/bright` vs `--bg-panel`.
- **D-07 (REVISED 2026-06-11):** `prefers-contrast: more` fallback is targeted: only `--fg-faint` is overridden (to `var(--fg-muted)`). `--fg-faint` is decorative/disabled only, never running text.
  - ORIGINAL: `--fg-dim` → `var(--fg-mid)`.

### Claude's Discretion

- Exact `@theme` structure for shadow/bevel tokens (`--shadow-hard`, `--shadow-hard-ink` in the `--shadow-*` namespace).
- Font import location within `globals.css`.
- Radius strategy: `--radius-none: 0` + `--radius-chip: 2px` in `@theme`, or a global reset + badge exception; Claude's call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Token Source (MANDATORY — tokens ported verbatim from here)
- `.planning/sketches/themes/retro-os.css` — Locked retro-os pastel palette, bevel system, typography vars, spacing scale. Port verbatim — do NOT modify token values. (Mirrored at `.claude/skills/sketch-findings-home-warehouse-system/sources/themes/retro-os.css`.)
- `.claude/skills/sketch-findings-home-warehouse-system/SKILL.md` — Design direction, hard rules, and anti-patterns for the retro-os pastel aesthetic
- SUPERSEDED: `sources/themes/default.css` (premium-terminal) — history only, do not use.

### Phase Scope + Requirements
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, TOKEN-01..05 descriptions, dependencies
- `.planning/REQUIREMENTS.md` — Full TOKEN-01..05 requirements with acceptance criteria

### Predecessor Phase
- `.planning/phases/01-foundation-conflict-spikes/01-CONTEXT.md` — Scaffold decisions (Bun, Vite 8 + SWC, Tailwind v4 confirmed); existing `globals.css` structure

### Existing Code
- `frontend2/src/styles/globals.css` — Current entry point; has `@import 'tailwindcss'` and body resets
- `frontend2/package.json` — Current dependencies (no font packages yet; `@fontsource/silkscreen`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` to be added)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend2/src/styles/globals.css` — Existing Tailwind entry; Phase 2 updates this file (adds import of tokens.css + body globals)
- `.planning/sketches/themes/retro-os.css` — Complete token source; port verbatim

### Established Patterns
- **Bun** — package manager for font install (`bun add @fontsource/silkscreen @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono`)
- **Tailwind v4 `@theme` block** — CSS-first configuration; no `tailwind.config.js`. Use `@theme inline` for var-indirected tokens.
- **`@fontsource`** — self-hosted font packages

### Integration Points
- Every phase from 3 onward imports classes from `tokens.css` via Tailwind utilities (`bg-bg-panel`, `text-fg-ink`, etc.)
- Vitest is already configured in the scaffold (Phase 1); new `tokens.test.ts` integrates into existing `bun run test`

</code_context>

<specifics>
## Specific Ideas

- @theme naming pattern: class names mirror CSS var names (not semantic prefix) — `bg-bg-panel`, `text-fg-ink`, `bg-titlebar-pink`
- Spacing utilities use the `sp-` prefix from the token names: `p-sp-3` maps to `--sp-3` (12px)
- Contrast Vitest test computes ratios from the literal hex values (pure WCAG formula, no browser context)
- `prefers-contrast: more` is a narrow override: only `--fg-faint: var(--fg-muted)` in a `@media` block inside `globals.css`
- Plex Sans/Mono cover Estonian + Cyrillic (Phase 15 locales) — glyph coverage note goes in tokens.css comment

</specifics>

<deferred>
## Deferred Ideas

- Icon style for retro-os direction is OPEN (old Lucide lock was evaluated against the scrapped CRT chrome) — needs sketch 009 before the component library hardens icons.

</deferred>

---

*Phase: 02-tokens-type-system*
*Context gathered: 2026-05-01 · Revised for retro-os pastel: 2026-06-11*
