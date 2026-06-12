---
phase: 02-tokens-type-system
plan: 01
subsystem: frontend2-design-tokens
tags: [tailwind-v4, design-tokens, retro-os, wcag-aa, fonts, radius]
requires:
  - frontend2 scaffold (Phase 1: Vite 8 + SWC + Tailwind v4)
  - commit 19f038e (tokens.css + globals.css + tokens.test.ts + @fontsource pkgs)
provides:
  - radius-0 global strategy (square corners everywhere, 2px badge exception)
  - documented font-display/FOUT decision
  - verified TOKEN-01/02/03/04 sign-off against retro-os spec
affects:
  - every Phase 3+ component consuming Tailwind utilities from tokens.css
tech-stack:
  added: []   # no packages installed; all pre-existing in 19f038e
  patterns:
    - "Tailwind v4 @theme inline radius-default override (zero --radius-sm..3xl)"
    - "global *,::before,::after border-radius:0 reset + .badge 2px exception"
    - "named font-display decision (accept swap; Silkscreen override evaluated, declined)"
key-files:
  created: []
  modified:
    - frontend2/src/styles/tokens.css
    - frontend2/src/styles/globals.css
decisions:
  - "Radius strategy (a): zero Tailwind's default --radius-* scale in @theme inline + global *,::before,::after reset; .badge keeps --radius-chip (2px) — the lone rounded element (design hard rule 4)."
  - "font-display: ACCEPT swap for IBM Plex Sans/Mono (close fallback metrics); Silkscreen override to font-display:optional EVALUATED but DECLINED (hashed asset URLs + no display-variant package CSS = brittle re-declaration); swap accepted as named outcome per plan fallback."
metrics:
  duration: ~3 min
  completed: 2026-06-12
  tasks: 3
  files_changed: 2
  commits: 2
---

# Phase 2 Plan 01: Tokens + Type System Verification + Radius/Font Gap-Closure Summary

Verified the already-committed retro-os token implementation (19f038e) satisfies TOKEN-01/02/04, then closed the TOKEN-03 radius-0 gap (global square-corners reset + Tailwind default-radius zero-out, 2px badge exception) and named the @fontsource `font-display: swap` (FOUT) behavior as an explicit, documented decision.

## What Was Done

### Task 1 — Verify TOKEN-01, TOKEN-02, TOKEN-04 (verification only, no edits)
- **TOKEN-01 (verbatim port): VERIFIED.** `tokens.css` `:root` values match `.planning/sketches/themes/retro-os.css` line-for-line. The two derived tokens `--table-rule: #e7ddca` and `--table-stripe: #fcf8f0` were confirmed to match the source's inline `.rtable` hexes exactly (`border-bottom: 1px solid #e7ddca` and `nth-child(even) td { background: #fcf8f0 }`) — these are **intentional derived tokens** promoted from inline hexes so `globals.css`'s `.rtable` layer can reference them (Pitfall 5), NOT a verbatim violation. The `--font-*` / `--shadow-*` literals are duplicated identically in both `:root` and `@theme inline` (Pitfall 4) — confirmed in sync.
- **TOKEN-02 (utilities emitted): VERIFIED.** `bun run build` exits 0; compiled `dist/assets/index-*.css` contains all six named utilities: `.bg-bg-panel`, `.text-fg-ink`, `.bg-titlebar-mint`, `.gap-sp-2`, `.rounded-chip`, `.shadow-hard-ink`. Mapping uses `@theme inline` (a single real block at line 74).
- **TOKEN-04 (WCAG AA): VERIFIED.** `bun run test src/styles/tokens.test.ts` → **16/16 passing** (15 pairs + black/white 21:1 sanity), all >=4.5:1.

### Task 2 — Close the radius-0 gap (TOKEN-03) [commit 80b8209]
- `tokens.css` `@theme inline`: added `--radius-sm/md/lg/xl/2xl/3xl: 0` to override Tailwind v4's own default radius scale → all `rounded-*` utilities collapse to square. Kept `--radius-none: 0` and `--radius-chip: 2px`.
- `globals.css`: added `*, ::before, ::after { border-radius: 0; }` global reset (belt-and-suspenders for raw `border-radius` outside Tailwind utilities) + `.badge { border-radius: var(--radius-chip); }` 2px exception, with a comment citing design hard rule 4.
- Verified: `rounded-chip` resolves to `border-radius:2px` in compiled CSS; contrast still 16/16; build green.

### Task 3 — Name the font-display/FOUT decision (TOKEN-03 polish) [commit ccdbc6b]
- Took the **documented-acceptance** path (plan's sanctioned fallback). Added a comment block to `globals.css` naming the decision: ACCEPT `swap` for IBM Plex Sans/Mono (close fallback metrics, avoids invisible text); the Silkscreen override to `font-display: optional` was **evaluated and declined**.
- **Why the override was declined:** this `@fontsource/silkscreen` version (5.2.8) ships no display-variant CSS, and a hand-rolled `@font-face` re-declaration would have to re-point `src` at the package's `./files/*.woff2` across 4 subset blocks (latin + latin-ext × 400/700) whose URLs Vite content-hashes at build time — brittle and prone to desync. Silkscreen is display-only chrome seasoning (titlebars/headings), not running text, so a first-paint fallback flash on those few strings is tolerable. Decision is named, not silent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed frontend dependencies from frozen lockfile**
- **Found during:** Task 1 (first `bun run test` failed: `vitest: command not found`)
- **Issue:** The git worktree had no `node_modules/` (deps are gitignored; worktrees don't inherit them). `bun run build`/`test` could not run.
- **Fix:** `bun install --frozen-lockfile` — restores the EXISTING pinned dependency set from `bun.lock` (317 packages). No new package added, so the package-legitimacy checkpoint gate does not apply (this is dependency restoration, not `bun add`).
- **Files modified:** none tracked (node_modules is gitignored)
- **Commit:** n/a (no tracked change)

### Notes (not deviations)

- **`@theme inline` count nuance:** Task 1's acceptance criteria text says `grep -c '@theme inline' tokens.css` returns 1, but it returns **2** — the second match is a prose mention inside the comment on line 107 (`a same-name var(--font-display) inside @theme inline is...`), not a second block. There is exactly ONE real `@theme inline` block (line 74). The substantive requirement (single mapping block) is met; the grep heuristic is a documentation nuance. The plan's actual automated `<verify>` for Task 1 does not include this count check, and it passed (VERIFY_OK).

## Decisions Made

1. **Radius strategy (a)** — zero Tailwind's default `--radius-*` scale in `@theme inline` + a global `*,::before,::after` reset; `.badge` keeps 2px via `--radius-chip`. Satisfies design hard rule 4 ("Radii 0 everywhere except badges 2px") at both the Tailwind-utility and raw-CSS levels.
2. **font-display: accept `swap`** for body+data Plex faces; Silkscreen `optional` override evaluated and declined as brittle in this Vite/@fontsource setup. Outcome documented in `globals.css`.

## Verification Evidence

- `cd frontend2 && bun run test src/styles/tokens.test.ts` → 16/16 green (TOKEN-04)
- `cd frontend2 && bun run build` → exits 0; `dist/assets/index-*.css` emits `.bg-bg-panel`, `.text-fg-ink`, `.bg-titlebar-mint`, `.gap-sp-2`, `.rounded-chip` (=2px), `.shadow-hard-ink` (TOKEN-02)
- `grep -Eq 'border-radius:\s*0' globals.css` ✓ + `.badge { border-radius: var(--radius-chip) }` ✓ + `grep -Ec 'radius-(sm|md|lg|xl|2xl|3xl):\s*0' tokens.css` = 6 (TOKEN-03 gap closed)
- `grep -Eqi 'font-display|FOUT' globals.css` ✓ (TOKEN-03 polish)
- TOKEN-01 verbatim port + 2 derived tokens (`--table-rule`/`--table-stripe`) confirmed against source hexes

## Requirements Satisfied

- TOKEN-01 — verified (verbatim port + 2 documented derived tokens)
- TOKEN-02 — verified (6 named utilities emitted via `@theme inline`)
- TOKEN-03 — gap closed (radius-0 strategy) + polish (font-display decision named)
- TOKEN-04 — verified (16/16 WCAG AA)

## Known Stubs

None — Phase 2 ships token CSS + body globals only; no atoms or data-bound components.

## Threat Flags

None — no new security-relevant surface. Phase 2 is static design tokens + build-time CSS + a pure-formula contrast test; no input, auth, data flow, or network at runtime (matches the plan's threat_model: all STRIDE dispositions = accept).

## Self-Check: PASSED

- FOUND: .planning/phases/02-tokens-type-system/02-01-SUMMARY.md
- FOUND: frontend2/src/styles/tokens.css
- FOUND: frontend2/src/styles/globals.css
- FOUND commit 80b8209 (Task 2)
- FOUND commit ccdbc6b (Task 3)
