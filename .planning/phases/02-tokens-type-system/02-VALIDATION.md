---
phase: 2
slug: tokens-type-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-12
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> NOTE: Phase 2 implementation already landed in commit `19f038e`. This phase
> is planned as **verification + gap-closure**, so most rows assert against
> already-committed code; the gaps (radius reset, glyph-drift, stale prose)
> are the only net-new work.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (frontend2) |
| **Config file** | `frontend2/vitest.config.ts` (from Phase 1 scaffold) |
| **Quick run command** | `cd frontend2 && bun run test src/styles/tokens.test.ts` |
| **Full suite command** | `cd frontend2 && bun run test && bun run build` |
| **Estimated runtime** | ~5s (unit) · ~15s (with build) |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend2 && bun run test src/styles/tokens.test.ts`
- **After every plan wave:** Run `cd frontend2 && bun run test && bun run build`
- **Before `/gsd:verify-work`:** Full suite + build must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | TOKEN-01/02 | — / — | N/A | unit | `bun run build` (compiled CSS emits `bg-bg-panel`, `text-fg-ink`, `bg-titlebar-mint`, `gap-sp-2`) | ✅ | ⬜ pending |
| 2-01-02 | 01 | 1 | TOKEN-04 | — / — | N/A | unit | `bun run test src/styles/tokens.test.ts` (16/16 AA pairs ≥4.5:1) | ✅ | ⬜ pending |
| 2-01-03 | 01 | 1 | TOKEN-03 | — / — | N/A | unit | grep `globals.css` for radius-0 global reset | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | TOKEN-03 | — / — | N/A | unit | `bun run build` (3 `@fontsource` faces self-hosted, `font-display` strategy named) | ✅ | ⬜ pending |
| 2-02-01 | 02 | 2 | TOKEN-05 | — / — | N/A | unit | repo-resident glyph-coverage/drift check for IBM Plex Mono cyrillic + latin-ext | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 2 | TOKEN-01..05 | — / — | N/A | manual | REQUIREMENTS.md TOKEN-01..05 prose rewritten to retro-os direction | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Radius-0 global reset added to `frontend2/src/styles/globals.css` (TOKEN-03 gap)
- [ ] Glyph-drift / coverage check for IBM Plex Mono cyrillic + latin-ext (TOKEN-05 gap) — lightweight repo-resident assertion, not a brittle pixel test
- [ ] No framework install needed — Vitest from Phase 1 scaffold covers contrast test

*Existing infrastructure (Vitest + Vite build) covers the already-implemented token/contrast surface.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No flash-of-fallback-font on first paint | TOKEN-03 | `@fontsource` ships `font-display: swap`; FOUT is visual, not unit-testable | Hard-reload dev server, observe Silkscreen headings — confirm no fallback flash (or accept swap as a named polish decision) |
| Cyrillic/Estonian renders without column drift in mono tables | TOKEN-05 | Visual metric — coverage is automatable, perceived drift is not | Render a mono data column with cyrillic + estonian glyphs, confirm column alignment holds |
| Stale REQUIREMENTS.md prose corrected | TOKEN-01..05 | Doc edit, verified by review | Confirm TOKEN-01..05 describe retro-os (retro-os.css, Silkscreen/Plex, dot-dither, AA), not premium-terminal |

*Glyph-coverage (subset presence) IS automated; perceived drift is the manual residue.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (radius reset, glyph-drift check)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
