# Phase 2: Tokens + Type System - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers the visual and typographic foundation that every subsequent phase (3–17) builds on:

1. **`styles/tokens.css`** — CSS custom properties ported verbatim from the locked sketch theme (`--bg-*`, `--fg-*`, `--amber`, `--accent-*`, `--border-*`, `--sp-*`), plus a Tailwind v4 `@theme` block exposing all tokens as utility classes.
2. **`styles/globals.css`** updates — body globals: JetBrains Mono Variable self-hosted font import, scanline + radial-vignette `background-image`, `--font-sans: var(--font-mono)` monospace anchor, sharp-corners radius override.
3. **Verification** — Vitest test asserting WCAG AAA contrast (≥7:1) for the three readable fg tokens against `--bg-panel`; `prefers-contrast: more` fallback; Cyrillic + Estonian glyph metrics note for JetBrains Mono.

Phase 2 does NOT include layout primitives, atoms, or any feature UI — those are Phases 3+. The output of Phase 2 is a token contract file + body styles; no visible route changes.

</domain>

<decisions>
## Implementation Decisions

### Token File Architecture

- **D-01:** `styles/tokens.css` is a **separate file** from `globals.css`. It contains both the `:root { ... }` custom property block AND the `@theme { ... }` Tailwind mapping block co-located (single file; no further split).
- **D-02:** `globals.css` **imports** `tokens.css` and handles all body-level selectors (scanline overlay, font import, radius override). Import chain: `globals.css` → `@import './tokens.css'` then `@import 'tailwindcss'`.
- **D-03:** Body globals (scanline `background-image`, `--font-sans: var(--font-mono)`, `--radius: 0` override) live in **`globals.css`**, not in `tokens.css`. Design token values are data; body behavior is behavior.

### Tailwind Utility Naming

- **D-04:** Utility class names **mirror CSS var names verbatim** — `bg-fg-mid` applies `--fg-mid`, `text-fg-base` applies `--fg-base`, `bg-bg-panel` applies `--bg-panel`, `border-fg-dim` applies `--fg-dim`. The `@theme` block maps `--color-fg-mid: var(--fg-mid)`, `--color-bg-panel: var(--bg-panel)`, etc. Predictable: knowing the token name means knowing the class.
- **D-05:** Spacing tokens are **exposed as Tailwind spacing utilities** — `@theme` includes `--spacing-sp-1: 4px` through `--spacing-sp-6: 32px`. Retro atoms can use `p-sp-3`, `gap-sp-2`, etc. to stay on the design token grid.

### Contrast Audit

- **D-06:** WCAG AAA audit lives in a **Vitest test** at `src/styles/tokens.test.ts`. It asserts contrast ratio ≥7:1 for `--fg-mid`, `--fg-base`, and `--fg-bright` against `--bg-panel`. Runs in `bun run test` and CI — regression guard (a token value change that breaks AAA fails the build).
- **D-07:** `prefers-contrast: more` fallback is **targeted**: only `--fg-dim` is overridden to `var(--fg-mid)`. `--fg-dim` is used for borders and inactive chrome only, not readable text — the other three readable fg tokens are already AAA without intervention.

### Claude's Discretion

- Cyrillic + Estonian glyph metrics check (TOKEN-05): format is a comment block in `tokens.css` noting the JetBrains Mono Variable glyph coverage observation, plus IBM Plex Mono fallback recorded if monospace column drift is observed. No runtime test needed (one-time font selection verification).
- Exact `@theme` structure for `--border-*` tokens (Tailwind v4 doesn't have a native "border" color namespace — expose as color utilities or custom property references; Claude's call).
- Font import location within `globals.css` (after `@import 'tailwindcss'` or before).
- `rounded-*` override strategy in `@theme` (set `--radius-sm`, `--radius-md` etc. to `0` or use a global `* { border-radius: 0 }` reset).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Token Source (MANDATORY — tokens ported verbatim from here)
- `.claude/skills/sketch-findings-home-warehouse-system/sources/themes/default.css` — Locked premium-terminal color palette, typography vars, spacing scale, border definitions. Port verbatim — do NOT modify token values.
- `.claude/skills/sketch-findings-home-warehouse-system/SKILL.md` — Design direction, anti-patterns, and context for the premium-terminal aesthetic

### Phase Scope + Requirements
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, TOKEN-01..05 descriptions, dependencies
- `.planning/REQUIREMENTS.md` — Full TOKEN-01..05 requirements with acceptance criteria

### Predecessor Phase
- `.planning/phases/01-foundation-conflict-spikes/01-CONTEXT.md` — Scaffold decisions (locked palette, Bun, Vite 8 + SWC, Tailwind v4 confirmed); existing `globals.css` structure

### Existing Code
- `frontend2/src/styles/globals.css` — Current entry point; has `@import 'tailwindcss'` and body resets; comment says "DO NOT add tokens or scanlines yet (Phase 2 territory)"
- `frontend2/package.json` — Current dependencies (no font packages yet; `@fontsource-variable/jetbrains-mono` to be added)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend2/src/styles/globals.css` — Existing Tailwind entry; Phase 2 updates this file (adds import of tokens.css + body globals)
- `.claude/skills/sketch-findings-home-warehouse-system/sources/themes/default.css` — Complete token source; port verbatim

### Established Patterns
- **Bun** — package manager for font install (`bun add @fontsource-variable/jetbrains-mono`)
- **Tailwind v4 `@theme` block** — CSS-first configuration; no `tailwind.config.js` needed for token exposure
- **`@fontsource-variable`** — self-hosted font packages; import as `@import '@fontsource-variable/jetbrains-mono'`

### Integration Points
- Every phase from 3 onward imports classes from `tokens.css` via Tailwind utilities (`bg-bg-panel`, `text-fg-base`, etc.)
- Vitest is already configured in the scaffold (Phase 1); new `tokens.test.ts` integrates into existing `bun run test`

</code_context>

<specifics>
## Specific Ideas

- User confirmed the exact @theme naming pattern from REQUIREMENTS: `bg-fg-mid`, `text-fg-base`, `bg-bg-panel` — class names mirror CSS var names (not semantic prefix)
- Spacing utilities use the `sp-` prefix from the token names: `p-sp-3` maps to `--sp-3` (12px)
- Contrast Vitest test should compute ratios from the literal hex values in tokens.css (not from the DOM — no browser context needed; use a pure WCAG formula)
- `prefers-contrast: more` is a narrow override: only `--fg-dim: var(--fg-mid)` in a `@media` block inside `globals.css`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-tokens-type-system*
*Context gathered: 2026-05-01*
