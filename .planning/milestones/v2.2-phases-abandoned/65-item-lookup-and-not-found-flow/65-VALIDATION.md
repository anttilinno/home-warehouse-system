---
phase: 65
slug: item-lookup-and-not-found-flow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 65 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x + React Testing Library 16.x |
| **Config file** | `frontend2/vitest.config.ts` |
| **Quick run command** | `cd frontend2 && pnpm test:run -- <pattern>` |
| **Full suite command** | `cd frontend2 && pnpm test:run` |
| **Estimated runtime** | ~60–90 seconds (full `/frontend2` suite) |

---

## Sampling Rate

- **After every task commit:** Run targeted `pnpm test:run -- <file>` for files touched by the task
- **After every plan wave:** Run `pnpm test:run` (full /frontend2 suite) + `pnpm lint` + `pnpm typecheck`
- **Before `/gsd-verify-work`:** Full suite green + `pnpm build` bundle gate + Lingui compile gate
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

> Populated by the planner once `PLAN.md` tasks are issued. Each row links a task to its automated test or Wave 0 dependency. See `65-RESEARCH.md` "## Validation Architecture" for the mapping rationale.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | LOOK-01..03 | TBD | TBD | unit/integration/e2e | TBD | ⬜ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend2/src/lib/api/__tests__/items-lookupByBarcode.test.ts` — exact-barcode guard + workspace-id mismatch (D-07, D-08)
- [ ] `frontend2/src/lib/api/__tests__/barcode.test.ts` — `barcodeApi.lookup` + `barcodeKeys` factory
- [ ] `frontend2/src/features/items/hooks/__tests__/useBarcodeEnrichment.test.ts` — regex gate `/^\d{8,14}$/` matrix (D-12)
- [ ] `frontend2/src/features/items/__tests__/ItemFormPage.test.tsx` — `?barcode=` prefill, generateSku-once, dirty-guard, create→invalidate (D-01..D-05)
- [ ] `frontend2/src/features/items/__tests__/UpcSuggestionBanner.test.tsx` — per-field [USE] + USE ALL + DISMISS + helper-text-only category (D-13..D-16)
- [ ] `frontend2/src/features/items/forms/__tests__/schemas.test.ts` — optional brand field (D-23) + loosened barcode regex (D-24)
- [ ] `frontend2/src/components/scan/__tests__/ScanResultBanner.states.test.tsx` — LOADING / MATCH / NOT-FOUND / ERROR render contract (D-17..D-21)

*Existing test files extended (NOT rewritten except useScanLookup):*
- `frontend2/src/features/scan/hooks/useScanLookup.test.ts` — body replaced (stub → real)
- `frontend2/src/features/scan/hooks/useScanHistory.test.ts` — add `update()` coverage (D-22)
- `frontend2/src/features/scan/ScanPage.test.tsx` — keep Test 15 gate; add match-effect history-backfill assertion
- `frontend2/src/lib/scanner/__tests__/scan-history.test.ts` — add `updateScanHistory` coverage (D-22 happy / noop / isolation — 3 direct unit tests)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iOS PWA camera permission resume after `/scan → /items/new → back` | LOOK-02 | Real device + Safari PWA install — Pitfall #1 | Install PWA on iOS device, scan → tap NOT-FOUND CTA → CANCEL → verify scanner resumes without re-prompting permission |
| Enrichment banner visual under live `api.upcitemdb.com` data | LOOK-03 | Depends on live public endpoint | Scan real UPC (e.g. consumer product barcode) → navigate to `/items/new` → verify banner renders with name/brand; tap [USE] per field; verify category rendered as helper text |
| Bundle gzip baseline capture | — | Must record Phase 64 post-merge baseline before Phase 65 code lands | `pnpm build && ls -la frontend2/dist/assets/*.js.gz` → record `/scan` chunk byte size as regression gate |
| `prefers-reduced-motion: reduce` opts out of the LOADING cursor blink | LOOK-01 (D-20 accessibility) | Requires browser with OS-level motion-reduction toggle; CSS @media rule effect cannot be asserted in JSDOM | Open ScanPage in Chrome/Firefox/Safari → open DevTools → Rendering panel → set `prefers-reduced-motion` to `reduce` → trigger a loading state (or manually inject the `.retro-cursor-blink` class on any element) → verify cursor glyph is STATIC (no opacity oscillation). The automated gate in Plan 65-06 Task 2 asserts the CSS rule exists with `animation: none` inside the `@media (prefers-reduced-motion: reduce)` block — this manual check confirms the rule takes effect at runtime. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`--watch`) in task commands
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
