---
phase: 64
plan: 07
subsystem: frontend2/src/components/scan
tags: [manual-entry, scan-result-banner, scan-error-panel, retro-components, wave-2, tdd]
requires:
  - 64-01 (retro barrel: RetroPanel + RetroButton + RetroInput + HazardStripe variant="yellow"|"red")
  - 64-03 (lib/scanner barrel: formatScanTime re-export)
provides:
  - frontend2/src/components/scan/ManualBarcodeEntry (SCAN-05 — trim + 1..256 manual entry form)
  - frontend2/src/components/scan/ScanResultBanner (D-02 — post-decode banner placeholder for Phase 66 QuickActionMenu swap)
  - frontend2/src/components/scan/ScanErrorPanel (D-09/10/11/12 — four-variant error panel with structured telemetry on mount)
  - frontend2/src/components/scan/ScanErrorKind (union type consumed by ScanPage onError route)
affects:
  - Plan 64-09 (ScanPage — composes ManualBarcodeEntry into MANUAL tab; mounts ScanResultBanner after BarcodeScanner decode; routes BarcodeScanner onError(kind) → ScanErrorPanel variant)
  - Plan 64-10 (i18n extract — 16 new Lingui message IDs introduced here need ET gap-fill)
tech-stack:
  added: []
  patterns:
    - "Plain useState validation (no form library): ManualBarcodeEntry trims + length-checks a single field in render; react-hook-form / zod would be over-engineering per PATTERNS.md §13"
    - "useId() for stable label↔input binding: avoids hand-rolled id strings and works correctly in SSR / StrictMode double-mount"
    - "Defensive length guard + maxLength attribute: input has maxLength={256} for clamping and a runtime trimmed.length > 256 check for paste paths that bypass maxLength in some environments"
    - "Telemetry-on-mount pattern (D-12): useEffect with kind dep logs one structured console.error({ kind, errorName, userAgent, timestamp }); client-only, no backend analytics"
    - "Variant-gated action buttons: library-init-fail renders RETRY only when onRetry prop supplied; no-camera renders RELOAD PAGE only when onReload supplied — defensive against partial wiring from ScanPage"
    - "data-testid='scan-format-pill' for deterministic pill query in ScanResultBanner (typography classes like bg-retro-amber can change; test-id is stable)"
    - "formatScanTime mock via vi.mock('@/lib/scanner', () => ({ formatScanTime: vi.fn(() => 'Just now') })): ScanResultBanner test stabilizes the relative timestamp without freezing Date.now"
    - "describe.each parameterized telemetry test: runs the D-12 console.error assertion for all four ScanErrorKind values without copy-paste"
key-files:
  created:
    - frontend2/src/components/scan/ManualBarcodeEntry.tsx
    - frontend2/src/components/scan/ScanResultBanner.tsx
    - frontend2/src/components/scan/ScanErrorPanel.tsx
    - frontend2/src/components/scan/__tests__/ManualBarcodeEntry.test.tsx
    - frontend2/src/components/scan/__tests__/ScanResultBanner.test.tsx
    - frontend2/src/components/scan/__tests__/ScanErrorPanel.test.tsx
  modified: []
decisions:
  - "useId() instead of a hand-rolled id string for the ManualBarcodeEntry label↔input htmlFor binding. React 18+ useId is the canonical a11y pattern and sidesteps StrictMode double-mount / SSR duplicate-id concerns. Test 10 asserts the htmlFor↔id linkage without caring about the specific string."
  - "ScanErrorPanel telemetry uses kind as errorName. The real DOMException.name (NotAllowedError / NotFoundError / etc.) is captured upstream in BarcodeScanner.mapScannerErrorToKind (Plan 06) and not propagated here because Phase 64 has no backend telemetry pipeline. If a future phase ships analytics, expand the prop surface with optional errorName?: string and thread it through BarcodeScanner."
  - "ScanResultBanner does NOT expose an onDismiss prop in addition to onScanAgain. Phase 66 replaces the entire banner with QuickActionMenu (View / Loan / Back to Scan); over-designing this banner with dismiss affordances is throwaway work. Kept minimal per CONTEXT.md <specifics>."
  - "ScanErrorPanel renders <p> body copy with font-sans, not font-mono. UI-SPEC typography contract allows sans for long-form error prose (readability exception). Labels + buttons remain monospace uppercase."
  - "No components/scan/index.ts barrel introduced in this plan — continuing the Plan 06 decision to land the barrel once in Plan 64-09 when all domain components exist (ScanHistoryList lands in Plan 64-08). Avoids churning the barrel once per plan."
deviations:
  - "Rule 3 (auto-fix blocking): An early comment in ManualBarcodeEntry.tsx contained the literal string 'react-hook-form' in a justification sentence. Acceptance criterion required grep -c 'react-hook-form' = 0. Reworded the comment to 'form library / schema validator' with no runtime diff; tests re-verified (11/11 green). Landed as separate chore commit 5b59099 rather than amending the prior feat commit."
metrics:
  duration_min: 9
  tasks_completed: 3
  commits: 7
  files_created: 6
  files_modified: 0
  tests_added: 29
  completed_at: "2026-04-18T21:06:00Z"
requirements_addressed: [SCAN-05]
---

# Phase 64 Plan 07: ManualBarcodeEntry + ScanResultBanner + ScanErrorPanel Summary

Delivered the three non-viewfinder retro components for Phase 64 via TDD — `ManualBarcodeEntry` (SCAN-05 trim + 1..256 validation via plain useState), `ScanResultBanner` (D-02 post-decode placeholder for Phase 66's QuickActionMenu), and `ScanErrorPanel` (D-09 four-variant error panel with D-12 structured console.error telemetry on mount and D-11 red hazard stripe for library-init-fail). 29 new tests land under `components/scan/__tests__/`; full Vitest suite goes 556 → 585 green.

## What Landed

### ManualBarcodeEntry (SCAN-05)

- **Surface:** `export function ManualBarcodeEntry({ onSubmit: (code: string) => void })`
- **Validation:** trimmed-input length check; submit disabled when `trim() === ""`; runtime guard rejects > 256 char pastes that bypass `maxLength={256}`
- **Keyboard-first:** `Enter` submits the form natively via `<form onSubmit>`
- **Input contract:** `autoComplete="off"`, `autoCapitalize="off"`, `autoCorrect="off"`, `spellCheck={false}`, `maxLength={256}`
- **Label accessibility:** `<label htmlFor={useId()}>` + `<RetroInput id={...}>` — tested directly in Test 10
- **Clears on success:** `setValue("")` after `onSubmit(trimmed)`
- **Implementation:** plain `useState` + `useId` — 80 LOC, no form library / schema validator (PATTERNS.md §13)

### ScanResultBanner (D-02)

- **Surface:** `export function ScanResultBanner({ code, format, timestamp, onScanAgain })`
- **Layout:** `RetroPanel` container → yellow `HazardStripe` header → `SCANNED` h2 → `CODE` label + 24px monospace bold display → `FORMAT` label + amber pill → `formatScanTime(timestamp)` relative time → `SCAN AGAIN` primary button bottom-right
- **Format pill:** `data-testid="scan-format-pill"` for stable test queries; `bg-retro-amber` + ink border per UI-SPEC
- **MANUAL path:** synthetic `format="MANUAL"` renders unchanged in the same pill (Test 7)
- **Minimalism:** no dismiss / no extra actions — Phase 66 replaces the whole banner

### ScanErrorPanel (D-09 / D-10 / D-11 / D-12)

- **Surface:**
  - `export type ScanErrorKind = "permission-denied" | "no-camera" | "library-init-fail" | "unsupported-browser"`
  - `export function ScanErrorPanel({ kind, onUseManualEntry, onRetry?, onReload? })`
- **Variant copy table** (exact strings landed — Lingui extract input):

  | Kind | Heading | Stripe | Actions |
  |------|---------|--------|---------|
  | permission-denied | CAMERA ACCESS DENIED | yellow | USE MANUAL ENTRY (+ 3 platform hints) |
  | no-camera | NO CAMERA FOUND | yellow | USE MANUAL ENTRY, RELOAD PAGE (gated on onReload) |
  | library-init-fail | SCANNER FAILED TO LOAD | **red** | RETRY (primary, gated on onRetry), USE MANUAL ENTRY |
  | unsupported-browser | SCANNING UNSUPPORTED | yellow | USE MANUAL ENTRY |

- **Platform hints (permission-denied):** 3 distinct bullets — iOS Safari path, Android Chrome path, generic site-settings fallback
- **Telemetry (D-12):** `useEffect(() => console.error({ kind, errorName: kind, userAgent: navigator.userAgent, timestamp: Date.now() }), [kind])` — fires once per mounted variant
- **Body copy font:** `font-sans` (long-form prose exception from UI-SPEC monospace default); headings + buttons remain monospace uppercase

## Exact Copy Strings Landed (Lingui Extract Input)

Plan 64-10 will run `bun run i18n:extract` and gap-fill ET. The new EN message IDs introduced in this plan:

1. `BARCODE OR CODE` (label)
2. `Enter code manually` (placeholder)
3. `Any code supported — QR text, UPC, EAN, Code128 alphanumeric.` (helper)
4. `Enter a code before submitting.` (validation error — unreachable from UI since button is disabled, but defensive for Enter-in-whitespace case)
5. `Code must be 256 characters or fewer.` (validation error)
6. `LOOK UP CODE` (submit)
7. `SCANNED` (banner heading)
8. `CODE` (banner label)
9. `FORMAT` (banner label)
10. `SCAN AGAIN` (banner primary)
11. `CAMERA ACCESS DENIED` (error heading)
12. `Barcode scanning needs camera permission. You can enable it in your browser settings, or enter codes manually.` (error body)
13. `On iPhone / iPad: Settings → Safari → Camera → Allow.` (iOS hint)
14. `On Android Chrome: tap the lock icon in the address bar → Permissions → Camera → Allow.` (Android hint)
15. `Open your browser's site settings and allow Camera for this page.` (generic hint)
16. `NO CAMERA FOUND` (error heading)
17. `This device does not report a working camera. If one is attached, make sure no other app is using it, then reload.` (error body)
18. `SCANNER FAILED TO LOAD` (error heading)
19. `The barcode engine could not initialize. Check your connection and retry, or enter codes manually.` (error body)
20. `SCANNING UNSUPPORTED` (error heading)
21. `This browser does not support camera scanning. Try the latest Safari, Chrome, Firefox, or Edge — or enter codes manually.` (error body)
22. `RETRY` (action)
23. `USE MANUAL ENTRY` (action)
24. `RELOAD PAGE` (action)

All strings match the UI-SPEC copy tables verbatim.

## Test Counts Per File

| File | Tests | Coverage |
|------|-------|----------|
| ManualBarcodeEntry.test.tsx | 11 | Renders + disabled states + trim/submit + clear + maxLength guard + HTML attrs + Enter-submit + label-htmlFor binding + whitespace-Enter defensive |
| ScanResultBanner.test.tsx | 7 | SCANNED heading + CODE 24px mono + amber FORMAT pill + formatScanTime + SCAN AGAIN primary/click + RetroPanel+yellow stripe + MANUAL path |
| ScanErrorPanel.test.tsx | 11 | 4 variant tests + 4 parameterized telemetry tests + 2 defensive prop-gate tests + 1 body-copy sanity |
| **Total** | **29** | |

Full Vitest suite: **585/585 passing** (was 556 before this plan).
`bunx tsc --noEmit -p tsconfig.json`: clean.
`bun run lint:imports`: clean (no forbidden `idb`/`serwist`/`offline`/`sync` substrings).

## Deviations from Plan

### [Rule 3 - Blocking] Comment-only grep gate fix

- **Found during:** Task 1 acceptance verification
- **Issue:** ManualBarcodeEntry.tsx header comment originally read "Plain useState — no react-hook-form / zod". Acceptance criterion requires `grep -c "react-hook-form" … = 0`.
- **Fix:** Reworded comment to "Plain useState — no form library / schema validator". Zero runtime diff; 11/11 tests still green post-edit.
- **Files modified:** frontend2/src/components/scan/ManualBarcodeEntry.tsx (comment only)
- **Commit:** 5b59099

No other deviations from PATTERNS.md implementation sketches.

## Commits (chronological)

| # | Hash | Type | Description |
|---|------|------|-------------|
| 1 | 1e47924 | test | RED gate — 11 failing tests for ManualBarcodeEntry |
| 2 | e2c210e | feat | GREEN — ManualBarcodeEntry implementation (SCAN-05) |
| 3 | c6d90ac | test | RED gate — 7 failing tests for ScanResultBanner |
| 4 | 636e8a8 | feat | GREEN — ScanResultBanner implementation (D-02) |
| 5 | 48d22cb | test | RED gate — 11 failing tests for ScanErrorPanel |
| 6 | eed74e9 | feat | GREEN — ScanErrorPanel implementation (D-09/10/11/12) |
| 7 | 5b59099 | chore | Grep-gate fix (comment-only, no runtime diff) |

## Downstream Unblocks

- **Plan 64-08** (ScanHistoryList + scan-feature test fixtures): independent — can start immediately
- **Plan 64-09** (ScanPage 3-tab orchestration): can now compose all three components:
  - `<ManualBarcodeEntry onSubmit={handleManualSubmit}>` in the MANUAL tab
  - `<ScanResultBanner>` rendered below paused `<BarcodeScanner>` after decode
  - `<ScanErrorPanel kind={errorKind} onUseManualEntry={() => setActiveTab('manual')} onRetry={handleRetry} onReload={() => location.reload()}>` routed from `BarcodeScanner` `onError(kind)`
- **Plan 64-10** (i18n extract + ET gap-fill): 24 new EN message IDs need ET translations

## Self-Check: PASSED

All created artifacts verified to exist on disk:
- `frontend2/src/components/scan/ManualBarcodeEntry.tsx` — FOUND
- `frontend2/src/components/scan/ScanResultBanner.tsx` — FOUND
- `frontend2/src/components/scan/ScanErrorPanel.tsx` — FOUND
- `frontend2/src/components/scan/__tests__/ManualBarcodeEntry.test.tsx` — FOUND
- `frontend2/src/components/scan/__tests__/ScanResultBanner.test.tsx` — FOUND
- `frontend2/src/components/scan/__tests__/ScanErrorPanel.test.tsx` — FOUND

All commits verified in `git log`:
- 1e47924, e2c210e, c6d90ac, 636e8a8, 48d22cb, eed74e9, 5b59099 — all present on master.
