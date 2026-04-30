---
phase: 64
plan: 08
subsystem: frontend2/features/scan
tags: [scan, history, ui, retro, confirm-dialog, SCAN-06, SCAN-07]
requires:
  - plan: 64-03
    provides: useScanHistory hook + formatScanTime + ScanHistoryEntry type
  - plan: 64-05
    provides: scan-feature hook surface (parent-owned pattern)
provides:
  - ScanHistoryList (features/scan/ScanHistoryList.tsx) — SCAN-06 + SCAN-07 view
  - scan-feature test fixtures (features/scan/__tests__/fixtures.ts) — renderWithProviders re-export + makeScanHistoryEntry factory
affects:
  - Plan 64-09 (ScanPage) will mount ScanHistoryList inside the History tab, pass entries from useScanHistory, and wire onSelect to the post-scan banner flow (D-15)
tech-stack:
  added: []
  patterns:
    - RetroConfirmDialog via useRef<RetroConfirmDialogHandle> + .open() imperative handle (PATTERNS §S4)
    - Pure props-in / callbacks-out list component (parent owns hook)
    - formatScanTime per-row timestamp rendering
key-files:
  created:
    - frontend2/src/features/scan/ScanHistoryList.tsx (97 LOC)
    - frontend2/src/features/scan/__tests__/ScanHistoryList.test.tsx (239 LOC, 9 tests)
    - frontend2/src/features/scan/__tests__/fixtures.ts (33 LOC)
  modified: []
decisions:
  - Used RetroConfirmDialog imperative-handle pattern (via useRef + .open()) instead of controlled open/onOpenChange — matches existing BorrowerArchiveDeleteFlow and PATTERNS §S4
  - Row key: `${entry.code}-${entry.timestamp}` (stable across reorders; avoids index keys)
  - CLEAR HISTORY button hidden in empty state (nothing to clear) — aligns with UI-SPEC "no CTA" directive for empty history
  - Row body is one full-width button wrapping code + format + timestamp — >=44px min-height tap target, WCAG 2.5.5 AA
metrics:
  duration_minutes: ~10
  completed: 2026-04-18
  tasks: 2
  files_touched: 3
  tests_added: 9
  tests_total: 594
---

# Phase 64 Plan 08: ScanHistoryList + Scan-Feature Test Fixtures Summary

Delivered the History tab body (SCAN-06 list + SCAN-07 clear-with-confirm) as a pure props-in / callbacks-out view, plus a shared scan-feature test-fixture module.

## What was built

- **ScanHistoryList** (`frontend2/src/features/scan/ScanHistoryList.tsx`): renders empty state (`NO SCANS YET`) or a RetroPanel containing a `SCAN HISTORY` heading, a `CLEAR HISTORY` danger button, and a `<ul role="list">` of entries. Each list item is a full-width `<button type="button">` with `min-h-[44px]` tap target wrapping a font-mono code, an uppercase mono format pill, and the formatted timestamp (via `formatScanTime`). Tap fires `onSelect(entry)`. CLEAR HISTORY opens a RetroConfirmDialog (destructive variant, affirm `YES, CLEAR`, cancel `KEEP HISTORY`); affirm calls `onClear`.
- **Scan fixtures** (`frontend2/src/features/scan/__tests__/fixtures.ts`): re-exports `TestAuthContext`, `renderWithProviders`, `setupDialogMocks` from `@/features/taxonomy/__tests__/fixtures`; adds `DEFAULT_WORKSPACE_ID`, `NOW`, and `makeScanHistoryEntry` factory.
- **Tests** (`frontend2/src/features/scan/__tests__/ScanHistoryList.test.tsx`): 9 passing cases — empty state, row rendering (code + format + timestamp), onSelect, 44px tap target, CLEAR HISTORY visibility, confirm affirm, confirm cancel, no in-component dedupe, and reorder key-stability.

## RetroConfirmDialog prop surface (confirmed)

The sketched prop names in the plan matched the actual component API exactly:

| Plan sketch | Actual | Notes |
|-------------|--------|-------|
| `variant="destructive"` | same | triggers red confirm + HazardStripe |
| `title` | same | string |
| `body` | same | ReactNode |
| `destructiveLabel` | same | label on the affirm button |
| `escapeLabel` | same | label on the cancel button |
| `onConfirm` | same | `() => void \| Promise<void>` |
| `useRef<RetroConfirmDialogHandle>` + `.open()` | same | imperative handle, no controlled prop |

No API substitutions were required.

## Exact copy strings landed

SCAN-07 destructive confirm:
- Title: `CLEAR SCAN HISTORY`
- Body: `All 10 most-recent scanned codes on this device will be removed. This cannot be undone.`
- Affirm: `YES, CLEAR`
- Cancel: `KEEP HISTORY`

Empty state:
- Heading: `NO SCANS YET`
- Body: `Scanned codes appear here. Your last 10 scans are kept on this device.`

Panel controls:
- Section heading: `SCAN HISTORY`
- Button: `CLEAR HISTORY` (danger variant)

All strings wrapped in `t\`...\`` via `useLingui()` — catalog entries will be generated when the phase-wide `bun run i18n:extract` runs as part of later plan (per the phase i18n gap-fill workflow).

## Fixture substitutions

None. `@/features/taxonomy/__tests__/fixtures` already exports `TestAuthContext`, `renderWithProviders`, and `setupDialogMocks` with the exact names the plan sketched, so the scan fixture re-export is a direct pass-through.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3/4 deviations were needed.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `2ac9dfc` | `chore(64-08): add scan feature test fixtures module` |
| 2 RED | `20d9a40` | `test(64-08): add failing test for ScanHistoryList (SCAN-06 + SCAN-07)` |
| 2 GREEN | `2d29cdf` | `feat(64-08): implement ScanHistoryList (SCAN-06 + SCAN-07)` |

## Verification

- `bun run test --run` → **594 / 594 passing** (prior baseline 585; +9 new tests)
- `bun run test -- ScanHistoryList --run` → **9 / 9 passing**
- `bunx tsc --noEmit -p tsconfig.json` → **exit 0**
- `bun run lint:imports` → **OK** (no forbidden imports introduced)
- `grep -c localStorage frontend2/src/features/scan/ScanHistoryList.tsx` → **0** (parent owns hook, D-04)
- `grep -c useScanHistory frontend2/src/features/scan/ScanHistoryList.tsx` → **0** (parent owns hook)
- `min-h-[44px]` present on each row button (>=44px tap target, WCAG 2.5.5 AA)
- All retro imports go through the `@/components/retro` barrel (Phase 54 mandate)

## Known Stubs

None. Component has no hardcoded empty states or placeholder data.

## TDD Gate Compliance

Plan frontmatter is `type: execute` (not `type: tdd`), but Task 2 was executed with `tdd="true"` per-task gating. RED → GREEN gates landed as distinct commits (`20d9a40` test-only → `2d29cdf` feat). No REFACTOR commit needed — component landed in its final form at GREEN.

## Self-Check: PASSED

- FOUND: frontend2/src/features/scan/ScanHistoryList.tsx
- FOUND: frontend2/src/features/scan/__tests__/ScanHistoryList.test.tsx
- FOUND: frontend2/src/features/scan/__tests__/fixtures.ts
- FOUND commit: 2ac9dfc
- FOUND commit: 20d9a40
- FOUND commit: 2d29cdf
