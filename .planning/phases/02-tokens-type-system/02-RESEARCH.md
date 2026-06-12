# Phase 2: Tokens + Type System - Research

**Researched:** 2026-06-12
**Domain:** Tailwind CSS v4 design tokens, self-hosted web fonts (@fontsource), WCAG AA contrast verification, Cyrillic/Estonian glyph coverage
**Confidence:** HIGH

## Summary

Phase 2 delivers the visual + typographic foundation (retro-os pastel) that Phases 3–17 build on: a `tokens.css` file (CSS custom properties + Tailwind v4 `@theme inline` mapping), `globals.css` body styles (self-hosted Silkscreen/IBM Plex fonts, cream dot-dither background, radius reset), a Vitest WCAG AA contrast guard, and a Cyrillic/Estonian glyph-coverage confirmation.

**Headline finding (changes how to PLAN this phase):** Phase 2 is **already substantially implemented and committed** in `19f038e` ("feat(frontend2): Phase 2 retro-os tokens + sample-screen scaffold"). The following all exist and were verified this session as *working*:
- `frontend2/src/styles/tokens.css` — full retro-os palette ported verbatim from `retro-os.css` + a complete `@theme inline` block. `[VERIFIED: file read + build]`
- `frontend2/src/styles/globals.css` — token import, Tailwind import, 7 `@fontsource` imports, dot-dither body, `prefers-contrast: more` override, bevel/pinstripe `@utility` defs, `.rtable` component layer. `[VERIFIED: file read]`
- `frontend2/src/styles/tokens.test.ts` — pure-formula WCAG AA contrast guard. **Runs green: 16/16 pass.** `[VERIFIED: bun run test]`
- `@fontsource/silkscreen` `^5.2.8`, `@fontsource/ibm-plex-sans` `^5.2.8`, `@fontsource/ibm-plex-mono` `^5.2.7` — already in `package.json` and installed. `[VERIFIED: package.json + node_modules]`
- `bun run build` succeeds; the compiled CSS emits every expected utility (`bg-bg-panel`, `text-fg-ink`, `bg-titlebar-mint`, `shadow-hard-ink`, `gap-sp-2`, `rounded-chip`). `[VERIFIED: build + grep]`

**Primary recommendation:** Plan this phase as **verification + gap-closure + requirement sign-off**, not greenfield construction. The hard implementation work is done and passing. The planner's job is: (1) confirm each TOKEN-01..05 acceptance criterion against the retro-os (not premium-terminal) definition, (2) fix the documented gaps below, (3) update the stale REQUIREMENTS.md TOKEN prose, and (4) write VALIDATION evidence. Do NOT re-port tokens or re-add fonts — they exist and pass.

## User Constraints (from CONTEXT.md)

> CONTEXT.md exists and is authoritative. Token *architecture* decisions (D-01..D-05) survive the direction swap unchanged; token *values*, fonts, and the contrast bar were revised 2026-06-11 to retro-os pastel.

### Locked Decisions

- **D-01:** `styles/tokens.css` is a **separate file** from `globals.css`, containing both the `:root {}` custom-property block AND the `@theme {}` Tailwind mapping co-located (single file, no further split).
- **D-02:** `globals.css` **imports** `tokens.css` and handles all body-level selectors. Import chain: `globals.css` → `@import './tokens.css'` then `@import 'tailwindcss'`.
- **D-03:** Body globals live in **`globals.css`**, not `tokens.css`. Token values are data; body behavior is behavior.
- **D-04:** Utility class names **mirror CSS var names verbatim** — `bg-bg-panel` → `--bg-panel`, `text-fg-ink` → `--fg-ink`, `bg-titlebar-mint` → `--titlebar-mint`. Var-indirected tokens require `@theme inline`.
- **D-05:** Spacing tokens exposed as Tailwind spacing utilities — `--spacing-sp-1: 4px` through `--spacing-sp-6: 32px`, used as `p-sp-3`, `gap-sp-2`.
- **D-06 (REVISED 2026-06-11):** WCAG **AA** audit (≥4.5:1) in a Vitest test at `src/styles/tokens.test.ts` over the revised pair list (pure WCAG formula over hex literals, no DOM). Runs in `bun run test` + CI. *(ORIGINAL was AAA ≥7:1 vs `--bg-panel` only.)*
- **D-07 (REVISED 2026-06-11):** `prefers-contrast: more` fallback is targeted — only `--fg-faint` is overridden (to `var(--fg-muted)`). `--fg-faint` is decorative/disabled only, never running text. *(ORIGINAL overrode `--fg-dim` → `--fg-mid`.)*

### Claude's Discretion

- Exact `@theme` structure for shadow/bevel tokens (`--shadow-hard`, `--shadow-hard-ink` in the `--shadow-*` namespace).
- Font import location within `globals.css`.
- Radius strategy: `--radius-none: 0` + `--radius-chip: 2px` in `@theme`, OR a global reset + badge exception. Claude's call.

### Deferred Ideas (OUT OF SCOPE)

- Icon style for retro-os is OPEN — old Lucide lock was against the scrapped CRT chrome; needs sketch 009 before the component library hardens icons. **Do not touch icons in Phase 2.**

## Phase Requirements

| ID | Description (retro-os, authoritative) | Research Support / Status |
|----|----------------------------------------|---------------------------|
| TOKEN-01 | `tokens.css` ports the **retro-os** palette from `retro-os.css` verbatim (surfaces, ink, pastel fills, deep companions, status, bevel system, spacing). | **MET (verify):** `tokens.css` exists; values match `retro-os.css` line-for-line + two derived tokens (`--table-rule`, `--table-stripe`) extracted from inline hexes in the source `.rtable` rules. `[VERIFIED: diff of both files]` |
| TOKEN-02 | Tailwind v4 `@theme` block exposes all tokens as utility classes (`bg-bg-panel`, `text-fg-ink`, `p-sp-3`, etc.). | **MET (verify):** `@theme inline` block present; compiled CSS contains the utilities. `[VERIFIED: build + grep]` |
| TOKEN-03 | Body globals: cream desktop + dot-dither background, `font-family: var(--font-body)` anchor, radius 0 except 2px badges, Silkscreen + IBM Plex Sans + IBM Plex Mono self-hosted via `@fontsource/*`. | **MET (verify):** `globals.css` has all of these. **Gap:** radius-0 global reset is NOT present (see Pitfall 1). |
| TOKEN-04 | WCAG **AA** (≥4.5:1) verified for the revised pair list (audit in repo); `prefers-contrast: more` fallback provided. | **MET:** `tokens.test.ts` green 16/16; `prefers-contrast: more` block present. `[VERIFIED: bun run test]` |
| TOKEN-05 | Cyrillic + Estonian glyph metrics verified in IBM Plex Mono (no column drift in mono tables). | **PARTIALLY MET:** glyph *coverage* confirmed (Plex Mono ships cyrillic + latin-ext subsets); a repo-resident *drift* check does not exist (see Open Question 1). |

> **Direction conflict resolved:** REQUIREMENTS.md TOKEN-01..05 prose (lines 27–31) still describes the SUPERSEDED premium-terminal aesthetic (default.css, JetBrains Mono Variable, scanlines + radial-vignette, `--font-sans: var(--font-mono)` monospace anchor, WCAG AAA). The table above uses the **retro-os** definitions from CONTEXT.md + ROADMAP (authoritative). The planner MUST include a task to rewrite REQUIREMENTS.md TOKEN-01..05 prose to retro-os, or the requirement sign-off will reference the wrong acceptance criteria. `[VERIFIED: REQUIREMENTS.md lines 27-31 read]`

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Design token values (palette, spacing, type, bevel) | Browser / Client (CSS `:root`) | — | Pure CSS custom properties; no server involvement |
| Tailwind utility generation | Build (Vite `@tailwindcss/vite` plugin) | — | `@theme inline` compiled at build time into static CSS |
| Font delivery | CDN / Static (self-hosted woff2 from `@fontsource`, bundled by Vite) | — | Subsets emitted as hashed static assets; no Google Fonts runtime call |
| Contrast verification | Build/CI (Vitest, Node) | — | Pure-formula test over hex literals; no browser, no DOM |
| Glyph-coverage / drift verification | Build/CI (offline) or manual visual | — | `unicode-range` coverage is static; visual drift is a render-time concern |

**Why this matters:** Phase 2 is entirely a client/build-tier concern. No backend, no API, no runtime service. This bounds the verification surface to: does the CSS compile, do the utilities exist, does the contrast test pass, are the right font subsets bundled.

## Standard Stack

> All packages below are **already installed**. No `bun add` is required in Phase 2.

### Core
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------------------|---------|--------------|
| `tailwindcss` | `^4.2.4` | CSS-first design system; `@theme inline` token→utility compiler | Already the project's styling engine (CSS-first, no `tailwind.config.js`) `[VERIFIED: package.json]` |
| `@tailwindcss/vite` | `^4.2.4` | Vite plugin that runs the Tailwind v4 compiler | Wired in `vite.config.ts` `[VERIFIED: vite.config.ts read]` |
| `@fontsource/silkscreen` | `^5.2.8` | Self-hosted pixel display face (≥16px, uppercase, Latin-only) | Display seasoning per design rules `[VERIFIED: node_modules]` |
| `@fontsource/ibm-plex-sans` | `^5.2.8` | Self-hosted humanist body face; latin-ext + cyrillic subsets | Body copy + Estonian/Russian coverage `[VERIFIED: node_modules]` |
| `@fontsource/ibm-plex-mono` | `^5.2.7` | Self-hosted mono data face; tabular-nums, cyrillic subset | Data columns, mono table cells `[VERIFIED: node_modules]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | `^4.1.5` | Test runner for the contrast guard | Already runs `tokens.test.ts` `[VERIFIED: bun run test]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@fontsource/*` per-weight CSS imports | `@fontsource-variable/*` | Variable fonts ship one file but Silkscreen has no variable build; static per-weight is correct here. The premium-terminal direction used `@fontsource-variable/jetbrains-mono` — that package is NOT in scope for retro-os. |
| `@theme inline` | plain `@theme` | Plain `@theme` breaks for var-indirected tokens (`--color-fg-ink: var(--fg-ink)`) — utility emits an indirection that resolves against the theme scope, not `:root`. `inline` inlines the *value*. (D-04, confirmed against official docs.) |

**Installation:** None required. (Phase 1 scaffold + commit 19f038e already added all packages.)

**Version verification:**
```
$ grep fontsource frontend2/package.json
"@fontsource/ibm-plex-mono": "^5.2.7",
"@fontsource/ibm-plex-sans": "^5.2.8",
"@fontsource/silkscreen": "^5.2.8",
```
`[VERIFIED: package.json read 2026-06-12]`

## Package Legitimacy Audit

> No new packages are installed in Phase 2 — all four were added in prior commits and are present in `node_modules`. Audit is informational (verifying the existing set), not gating.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `tailwindcss` | npm | 7+ yrs | ~20M/wk | github.com/tailwindlabs/tailwindcss | not run (already installed) | Approved (in use) |
| `@fontsource/silkscreen` | npm | est. 3+ yrs | high (fontsource org) | github.com/fontsource/font-files | not run (already installed) | Approved (in use, verified subsets present) |
| `@fontsource/ibm-plex-sans` | npm | est. 3+ yrs | high | github.com/fontsource/font-files | not run (already installed) | Approved (in use, cyrillic subset present) |
| `@fontsource/ibm-plex-mono` | npm | est. 3+ yrs | high | github.com/fontsource/font-files | not run (already installed) | Approved (in use, cyrillic subset present) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was not executed because Phase 2 installs nothing — the packages are pre-existing, imported in committed code, and their on-disk subset files were directly inspected this session (a stronger signal than registry metadata).*

## Architecture Patterns

### System Architecture Diagram (token resolution flow)

```
                         BUILD TIME (Vite + @tailwindcss/vite)
  globals.css ──@import──> tokens.css
       │                     │
       │                     ├── :root { --bg-panel:#fff; --fg-ink:#26262e; ... }   (raw token values)
       │                     └── @theme inline { --color-bg-panel: var(--bg-panel); ... }
       │                                  │
       ├── @import 'tailwindcss'          └──> Tailwind compiler scans source for
       │        │                              class usage, emits .bg-bg-panel{background:var(--bg-panel)}
       │        ▼                                              │
       └── 7× @fontsource @import ───────────────────────────┤
                │                                              ▼
                ▼                                    dist/assets/index-*.css
       woff2 subsets (latin/latin-ext/cyrillic)     (static utilities + :root vars + @font-face)
       emitted as hashed static assets

                         RUNTIME (browser)
  index.css loaded ──> :root vars resolve ──> utilities reference var(--bg-panel)
                       browser matches glyph unicode-range ──> downloads ONLY needed font subset
                       prefers-contrast:more ──> overrides --fg-faint to --fg-muted
```

The Component Responsibilities below map this to files.

### Component Responsibilities
| File | Owns | D-ref |
|------|------|-------|
| `src/styles/tokens.css` | Raw `:root` token values + `@theme inline` utility mapping | D-01, D-04, D-05 |
| `src/styles/globals.css` | `@import` chain, body background/dot-dither, fonts, `prefers-contrast`, bevel `@utility`, `.rtable` component layer | D-02, D-03, D-07 |
| `src/styles/tokens.test.ts` | WCAG AA contrast regression guard (parses hex from `tokens.css`) | D-06 |

### Pattern 1: `@theme inline` for var-indirected tokens
**What:** Map `:root` custom properties to Tailwind theme variables so utilities resolve the *value*, not an indirection.
**When to use:** Whenever a theme variable references another CSS var (`--color-fg-ink: var(--fg-ink)`).
**Example:**
```css
/* Source: tailwindcss.com/docs/theme (verified 2026-06-12) + frontend2/src/styles/tokens.css */
@theme inline {
  --color-bg-panel: var(--bg-panel);   /* emits .bg-bg-panel { background: var(--bg-panel) } */
  --spacing-sp-3:   12px;              /* emits p-sp-3, gap-sp-3, m-sp-3, w-sp-3, ... */
  --radius-chip:    2px;              /* emits rounded-chip */
  --shadow-hard:    3px 3px 0 0 #d9cdb6;  /* emits shadow-hard */
}
```

### Pattern 2: font/shadow literals inside `@theme inline` (subtle, already handled)
**What:** Inside `@theme inline`, a theme var that shares a name with a `:root` var must NOT reference itself via `var()` — it resolves against the theme scope (circular) and the utility silently drops.
**The existing code handles this correctly** by duplicating literals for `--font-*` and `--shadow-*` rather than `var()`-referencing the `:root` copies (see tokens.css lines 106–115 comment). **Pitfall for the planner:** if a font or shadow value is edited, BOTH copies (`:root` and `@theme inline`) must change in lockstep. `[VERIFIED: tokens.css read]`

### Anti-Patterns to Avoid
- **Re-adding premium-terminal tokens** (`--amber`, `--bg-base`, scanlines, JetBrains Mono): scrapped 2026-06-11. The REQUIREMENTS.md prose still names these — it is stale, not a spec.
- **Colored text on pastel fills:** fails AA. Pastel fills carry ink text only; colored text uses `*-deep` companions. (Design hard rule 2.)
- **Silkscreen below 16px / mixed case / body copy:** legibility dies; it is display-only Latin. (Design hard rule 1.)
- **Plain `@theme`** for var-indirected tokens: utilities silently break.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Self-hosting + subsetting fonts | Manual `@font-face` + woff2 conversion + `unicode-range` math | `@fontsource/*` per-weight CSS imports | Fontsource ships pre-subset woff2 with correct `unicode-range` per script; the browser downloads only the subset a glyph needs. `[VERIFIED: 400.css inspected]` |
| Token→utility generation | Hand-written utility CSS classes | Tailwind v4 `@theme inline` | One declaration emits the full utility family (`p-`, `m-`, `gap-`, `w-`, `bg-`, `text-`, `border-`). `[VERIFIED: docs]` |
| WCAG contrast math | A custom luminance script with hand-tuned constants | The canonical WCAG 2.x relative-luminance formula (already in `tokens.test.ts`) | The existing test reproduces the black/white 21:1 sanity ratio exactly. `[VERIFIED: test passes]` |

**Key insight:** Everything Phase 2 needs is already a solved, installed, and passing artifact. The risk in this phase is *redundant rework* (re-porting tokens, re-adding fonts) and *spec drift* (validating against the stale premium-terminal prose), not missing tooling.

## Common Pitfalls

### Pitfall 1: Radius-0 global reset is NOT in globals.css (TOKEN-03 gap)
**What goes wrong:** TOKEN-03 (retro-os) and design hard rule 4 require "radii 0 everywhere except badges (2px)". The current `globals.css` defines `--radius-chip`/`--radius-none` in `tokens.css` `@theme` and a `.badge { border-radius: 2px }` exists in the *sketch* CSS, but there is **no global `border-radius: 0` reset** in `globals.css` and no `* { border-radius: 0 }` or Tailwind default-radius override. Tailwind v4's own `--radius-*` defaults (`rounded-sm`..`rounded-3xl`) are still present unless overridden.
**Why it happens:** D-06 (discretion) left radius strategy open; the committed code added the `@theme` radius tokens but not the reset half of the strategy.
**How to avoid:** Planner task — decide and implement the radius strategy explicitly. Options: (a) zero out Tailwind's `--radius-*` defaults in `@theme` so `rounded-*` utilities collapse to 0, plus `rounded-chip` for badges; or (b) a body-level `border-radius: 0` reset + badge exception. Either satisfies the rule; pick one and verify with a grep/build assertion.
**Warning signs:** any `rounded-sm`/`rounded-md` utility renders a curved corner; badge is not 2px.
`[VERIFIED: globals.css + tokens.css read — no global radius reset present]`

### Pitfall 2: `font-display: swap` is FOUT, not "no flash" (CONTEXT priority-2 nuance)
**What goes wrong:** CONTEXT asks to "avoid flash-of-fallback." The `@fontsource` CSS ships `font-display: swap`, which renders fallback text immediately then swaps to the web font (FOUT — flash of *unstyled* text), the opposite of hiding text. For Silkscreen (a pixel display face wildly different from any system fallback) the swap is visually jarring on headings.
**Why it happens:** `swap` is the fontsource default; it optimizes for content visibility, not visual stability.
**How to avoid:** If flash matters for the Silkscreen display headings, override `font-display` to `optional` or `block` for Silkscreen via a custom `@font-face` re-declaration, or accept `swap` (recommended for body Plex — FOUT on body is fine, the metrics are close). Document the decision; do not silently leave it. This is a *polish* call, arguably deferrable, but the planner should name it rather than let CONTEXT's "avoid flash" claim go unaddressed.
**Warning signs:** Silkscreen titles flash in a system font on first paint.
`[VERIFIED: @fontsource/silkscreen/400.css shows font-display: swap]`

### Pitfall 3: Validating TOKEN-01..05 against the wrong (stale) spec
**What goes wrong:** REQUIREMENTS.md TOKEN prose names default.css, JetBrains Mono, AAA, scanlines. A verifier reading only REQUIREMENTS.md would mark the (correct, retro-os) implementation as non-compliant.
**How to avoid:** Rewrite REQUIREMENTS.md TOKEN-01..05 prose to retro-os BEFORE sign-off (a planner task), or pin the verifier to CONTEXT.md/ROADMAP definitions. The traceability table (REQUIREMENTS.md lines 215–219) marks all five "Pending" — flip to satisfied only after the prose is corrected.
**Warning signs:** A verification doc cites `--amber` or `JetBrains Mono`.
`[VERIFIED: REQUIREMENTS.md lines 27-31, 215-219 read]`

### Pitfall 4: Editing a token hex in only one of the two copies
**What goes wrong:** `--font-*` and `--shadow-*` are deliberately duplicated as literals in both `:root` and `@theme inline` (to avoid the circular-var trap). Editing one copy desyncs them.
**How to avoid:** Treat the tokens.css lines 106–115 comment as load-bearing; any font/shadow edit touches both blocks. A future test could assert equality, but that's optional.
`[VERIFIED: tokens.css read]`

### Pitfall 5: `--table-rule` / `--table-stripe` are derived tokens, not in the canonical source as named vars
**What goes wrong:** The sketch `retro-os.css` uses raw hexes inline in `.rtable` rules (`#e7ddca`, `#fcf8f0`). The committed `tokens.css` promoted these to named tokens (`--table-rule`, `--table-stripe`) so `globals.css`'s `.rtable` layer can reference them. This is a *reasonable* extraction, not a verbatim port — a strict "ported verbatim" verifier might flag it.
**How to avoid:** Document these two as intentional derived tokens (values match the source hexes exactly). Not a defect; just call it out so "verbatim" isn't read too literally.
`[VERIFIED: diff of retro-os.css inline hexes vs tokens.css named tokens — values identical]`

## Runtime State Inventory

> Phase 2 is a greenfield CSS/build phase touching only `frontend2/src/styles/*`. There is no stored data, no live service config, no OS-registered state, no secrets, and no installed-package artifact that carries forward a renamed string.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 2 is CSS tokens + fonts only; no DB, no localStorage keys introduced. | none |
| Live service config | None — no external service touches design tokens. | none |
| OS-registered state | None — verified by scope (browser/build tier only). | none |
| Secrets/env vars | None — no env vars referenced by tokens or fonts. | none |
| Build artifacts | `frontend2/dist/` is regenerated by `bun run build`; no stale-name artifacts. Font woff2 are content-hashed, regenerate cleanly. | none (rebuild is idempotent) |

## Code Examples

### Self-hosted font import (already in globals.css)
```css
/* Source: frontend2/src/styles/globals.css (verified) */
@import "@fontsource/silkscreen/400.css";
@import "@fontsource/silkscreen/700.css";
@import "@fontsource/ibm-plex-sans/400.css";
@import "@fontsource/ibm-plex-sans/600.css";
@import "@fontsource/ibm-plex-sans/700.css";
@import "@fontsource/ibm-plex-mono/400.css";
@import "@fontsource/ibm-plex-mono/600.css";
```
Each aggregate weight file pulls *all* subsets it ships (latin, latin-ext, cyrillic, cyrillic-ext, vietnamese) as separate `@font-face` blocks with `unicode-range` — the browser downloads only what a glyph needs. Silkscreen ships latin + latin-ext **only** (no Cyrillic — correct, it is display-only). `[VERIFIED: 400.css files inspected]`

### Pure-formula WCAG contrast guard (already in tokens.test.ts)
```ts
// Source: frontend2/src/styles/tokens.test.ts (verified green 16/16)
function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg), l2 = relativeLuminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
// AA = 4.5; sanity asserts black/white === 21:1
```
The pair list covers: ink/panel, ink/desktop, muted/panel, muted/desktop, ink/each-of-4-titlebars, each-of-4 `*-deep`/panel, two `*-deep`/desktop, danger/danger-bg. `[VERIFIED: test read + run]`

## State of the Art

| Old Approach (premium-terminal, scrapped) | Current Approach (retro-os) | When Changed | Impact |
|-------------------------------------------|------------------------------|--------------|--------|
| `default.css` dark CRT palette (`--amber`, `--bg-base`, `--fg-glow`) | `retro-os.css` pastel palette (surfaces/ink/pastel-fills/deep) | 2026-06-11 | All TOKEN-01 value claims change |
| JetBrains Mono Variable (`@fontsource-variable/jetbrains-mono`) | Silkscreen + IBM Plex Sans + IBM Plex Mono (3× `@fontsource/*`) | 2026-06-11 | TOKEN-03/05 font stack changes |
| Monospace anchor (`--font-sans: var(--font-mono)`) | Body anchored to Plex Sans (`--font-body`) | 2026-06-11 | body font is humanist sans, not mono |
| Scanlines + radial-vignette background | Cream desktop + barely-there dot-dither | 2026-06-11 | TOKEN-03 background changes |
| WCAG AAA (≥7:1) vs `--bg-panel` only | WCAG AA (≥4.5:1) over an expanded pair list | 2026-06-11 | TOKEN-04 bar + pair list change |

**Deprecated/outdated:**
- REQUIREMENTS.md TOKEN-01..05 prose (lines 27–31): describes the scrapped premium-terminal direction. **Treat as stale; planner should rewrite.**
- `@fontsource-variable/jetbrains-mono`: not in scope; do not install.
- `sources/themes/default.css`: history only.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `font-display: swap`'s FOUT on Silkscreen headings is undesirable enough to warrant an override. | Pitfall 2 | LOW — purely a polish call; `swap` is a safe default and may be acceptable as-is. Planner should confirm with user/CONTEXT whether "avoid flash" applies to display headings. |
| A2 | No repo-resident automated Cyrillic column-drift test currently exists, and one would be the canonical way to satisfy TOKEN-05's "no column drift" beyond coverage. | Open Q1, TOKEN-05 row | MEDIUM — if the planner believes coverage alone satisfies TOKEN-05, a drift test is unnecessary; if "metrics verified" demands measurement, a test/visual check is needed. |
| A3 | `@fontsource/*` package ages are 3+ years (not freshly published). | Package Audit | LOW — fontsource is a long-established org; not verified via `npm view` this session because nothing is being installed. |

## Open Questions (RESOLVED)

<!-- RESOLVED in planning (2026-06-12): Q1 (column-drift) → Plan 02-02 T1 subset-presence check + 02-VALIDATION manual row; Q2 (radius-0 reset scope) → Plan 02-01 T2 implements it. -->

1. **How to satisfy TOKEN-05 "no column drift" in a repo-resident way?**
   - What we know: Plex Mono ships cyrillic + latin-ext subsets (coverage confirmed); it is a true monospace face, so all glyphs share one advance width by design; `font-variant-numeric: tabular-nums` is already applied in `.rtable .mono`. The tokens.css comment asserts "no column drift expected."
   - What's unclear: whether the requirement wants *measured* proof (a test rendering Cyrillic/Estonian rows and asserting equal column widths) or whether design-level coverage + the monospace guarantee suffices. A pure-Node test cannot measure rendered glyph advances without a browser; a Playwright snapshot or a manual `/demo` visual check would be needed for true measurement.
   - Recommendation: Treat coverage + the monospace property as the *baseline* claim (verifiable offline now), and add a lightweight visual confirmation (a short paragraph of et/ru text in a mono table on a sample/demo route, eyeballed once and noted in VALIDATION) rather than a brittle pixel test. If the verifier insists on automation, a Playwright `toHaveScreenshot` on a mono-table fixture is the cheapest real measurement — but that pulls Phase 17's a11y/visual sweep forward; likely out of Phase 2 scope.

2. **Is the radius-0 global reset in or out of Phase 2 scope?**
   - What we know: D-06 left radius strategy to discretion; the `@theme` radius tokens exist but the global reset does not (Pitfall 1).
   - What's unclear: whether badges are the *only* place radius appears in Phase 2 (no atoms ship until Phase 4), making the global reset arguably premature.
   - Recommendation: Add the global reset now (it is a one-line body/`@theme` change and locks hard rule 4 before any atom renders a curved corner). Cheap insurance; do it in Phase 2.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Bun | font install + `bun run test`/`build` | ✓ (project uses it) | — | npm/pnpm |
| Vite + `@tailwindcss/vite` | utility compilation | ✓ | vite `^8.0.10`, tailwind `^4.2.4` | — |
| Vitest | contrast guard | ✓ | `^4.1.5` | — |
| `@fontsource/*` (3 pkgs) | TOKEN-03/05 fonts | ✓ installed | silkscreen/sans `5.2.8`, mono `5.2.7` | — |

**Missing dependencies with no fallback:** none — all tooling present and exercised this session (`bun run test` and `bun run build` both succeeded).
**Missing dependencies with fallback:** none.

## Validation Architecture

> `workflow.nyquist_validation` is absent from `.planning/config.json` → treated as **enabled**. `[VERIFIED: config.json read]`

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.5` |
| Config file | `frontend2/vitest.config.ts` (jsdom env, `setupFiles: ./src/test-utils.tsx`, e2e excluded) |
| Quick run command | `cd frontend2 && bun run test src/styles/tokens.test.ts` |
| Full suite command | `cd frontend2 && bun run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOKEN-01 | Tokens present + values match retro-os.css | static/diff | `bun run build` (compiles) + manual diff vs `retro-os.css` | ✅ build green; diff is a one-time check |
| TOKEN-02 | Utility classes generated | build assertion | `bun run build && grep -E 'bg-bg-panel\|text-fg-ink\|gap-sp-2\|rounded-chip' dist/assets/index-*.css` | ✅ verified this session |
| TOKEN-03 | Body globals (bg, fonts, radius) | manual/visual + build | `bun run build`; radius-reset assertion ❌ Wave 0 (Pitfall 1) | ⚠️ radius reset missing |
| TOKEN-04 | WCAG AA over pair list | unit | `bun run test src/styles/tokens.test.ts` | ✅ green 16/16 |
| TOKEN-05 | Cyrillic/Estonian coverage; no column drift | coverage (offline) + visual | subset check: `ls node_modules/@fontsource/ibm-plex-mono/files \| grep cyrillic`; drift = visual/Playwright | ⚠️ coverage ✅, drift check ❌ Wave 0 (Open Q1) |

### Sampling Rate
- **Per task commit:** `bun run test src/styles/tokens.test.ts` (sub-second) + `bun run build` for utility/font changes.
- **Per wave merge:** `bun run test` (full Vitest suite).
- **Phase gate:** full Vitest suite green + `bun run build` clean before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] Radius-0 strategy decision + implementation in `globals.css`/`tokens.css` — closes TOKEN-03 / Pitfall 1.
- [ ] (Optional, see Open Q1) A mono-column drift confirmation for et/ru text — closes the "no column drift" half of TOKEN-05 beyond coverage. Lightweight visual note preferred over a brittle pixel test.
- [ ] REQUIREMENTS.md TOKEN-01..05 prose rewrite to retro-os — prevents verifying against the stale spec (Pitfall 3). Doc task, not a test.

*(The contrast test, font install, token port, and `@theme` mapping are NOT gaps — they exist and pass.)*

## Security Domain

> `security_enforcement` not set in `.planning/config.json` (absent = enabled). Phase 2 is pure design tokens + self-hosted fonts with **no input, no auth, no data, no network at runtime**. ASVS surface is near-empty.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth in Phase 2) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | No user input; tokens are static literals |
| V6 Cryptography | no | — |
| V14 Configuration | marginal | Self-hosting fonts (vs Google Fonts CDN) removes a third-party runtime origin — a privacy/supply-chain positive already in place via `@fontsource`. No external font CDN call ships. `[VERIFIED: fonts bundled as local assets in dist]` |

### Known Threat Patterns for CSS/font phase
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Third-party font CDN tracking / SPOF | Info disclosure | Self-host via `@fontsource` (already done — no Google Fonts request) |
| Dependency supply chain (font/css pkg) | Tampering | Pinned versions in `package.json` + lockfile; subsets inspected on disk this session |

## Sources

### Primary (HIGH confidence)
- `frontend2/src/styles/tokens.css`, `globals.css`, `tokens.test.ts` — read in full this session.
- `frontend2/package.json`, `vite.config.ts`, `vitest.config.ts` — read.
- `.planning/sketches/themes/retro-os.css` — canonical token source, read in full.
- `.claude/skills/sketch-findings-home-warehouse-system/SKILL.md` — design hard rules + anti-patterns.
- `.planning/phases/02-tokens-type-system/02-CONTEXT.md` — authoritative decisions D-01..D-07.
- `node_modules/@fontsource/{silkscreen,ibm-plex-sans,ibm-plex-mono}/*.css` + `files/` — subset inspection.
- Live commands: `bun run test` (16/16 green), `bun run build` (success, utilities + cyrillic subsets emitted).
- tailwindcss.com/docs/theme — `@theme` vs `@theme inline` mechanics + namespace→utility mapping (fetched 2026-06-12).

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` Phase 2 entry (retro-os, authoritative) + direction-swap note.
- `.planning/REQUIREMENTS.md` TOKEN-01..05 (STALE prose, flagged) + traceability table.

### Tertiary (LOW confidence)
- None — all claims grounded in files read or commands run this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages installed, inspected on disk, build + test green.
- Architecture (`@theme inline`, font subsetting): HIGH — verified against official docs AND the compiled output.
- Pitfalls: HIGH — radius gap and stale-spec gap confirmed by direct file reads; FOUT confirmed in the fontsource CSS.
- Glyph drift (TOKEN-05): MEDIUM — coverage is HIGH-confidence (subsets on disk), but "no column drift" measurement is unaddressed (Open Q1).

**Research date:** 2026-06-12
**Valid until:** ~2026-07-12 (stable; Tailwind v4 and fontsource are slow-moving). The committed implementation is the source of truth — re-verify only if `tokens.css`/`globals.css` change.
