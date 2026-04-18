---
phase: 64
phase_slug: scanner-foundation-scan-page
date: 2026-04-18
source: 64-RESEARCH.md §Validation Architecture
---

# Phase 64 Validation Strategy (Nyquist)

This is the canonical validation contract for Phase 64 plans. Every plan MUST cite
the test file(s) it touches and every SCAN-0N requirement MUST have at least one
automated test in the table below OR a signed-off manual UAT entry in VERIFICATION.md.

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.3 + `@testing-library/react` 16.3.2 + `@testing-library/user-event` 14.6.1 + `@testing-library/jest-dom` 6.9.1 + `jsdom` 29.0.2 |
| Quick run | `cd frontend2 && bun run test` |
| Full suite | `cd frontend2 && bun run test && bun run lint:imports && bun run build` |
| Watch | `cd frontend2 && bun run test:watch` |

## Requirement → Test Map

| REQ-ID | Behavior | Test Type | Location |
|--------|----------|-----------|----------|
| SCAN-01 | `/scan` mounts, renders viewfinder container | component | `frontend2/src/features/scan/__tests__/ScanPage.test.tsx` |
| SCAN-01 | Scanner stays mounted on `paused=true` toggle | component (mocked) | `frontend2/src/components/scan/__tests__/BarcodeScanner.test.tsx` |
| SCAN-01 | iOS PWA: two consecutive decodes, no perm re-prompt | **manual UAT** | VERIFICATION.md checklist |
| SCAN-02 | `formats` prop passes 4-format subset `[qr_code, upc_a, ean_13, code_128]` | component | `BarcodeScanner.test.tsx` |
| SCAN-02 | Real QR / UPC-A / EAN-13 / Code128 decode within 1s | **manual UAT** | VERIFICATION.md checklist |
| SCAN-03 | `useScanFeedback.trigger()` fires beep + flash on decode; `navigator.vibrate` called on Android UA | unit (mocked AudioContext + stubbed `navigator.vibrate`) | `frontend2/src/features/scan/hooks/__tests__/useScanFeedback.test.ts` |
| SCAN-03 | AudioContext `resume()` fires in page-level pointerdown | unit | `useScanFeedback.test.ts` |
| SCAN-03 | First beep after cold load audible on iOS | **manual UAT** | VERIFICATION.md checklist |
| SCAN-04 | Torch toggle absent when `capabilities.torch !== true` | component (mocked MediaStream) | `frontend2/src/components/scan/__tests__/ScanTorchToggle.test.tsx` |
| SCAN-04 | Torch toggle `aria-pressed` reflects `torchOn` prop (visual state only; hardware wiring is manual UAT) | component | `ScanTorchToggle.test.tsx` |
| SCAN-04 | Real Android torch hardware: `applyConstraints({ advanced: [{ torch: true/false }] })` turns flashlight on/off | **manual UAT** | VERIFICATION.md checklist |
| D-18 | `ScanLookupStatus` union has all four states (`'idle' \| 'loading' \| 'success' \| 'error'`) in Phase 64 type definition | unit (type-only) | `useScanLookup.test.ts` |
| D-01 | `ScanPage` calls `useScanLookup(banner?.code ?? null)` after decode so Phase 65 swap has a live callsite | component | `ScanPage.test.tsx` |
| SCAN-05 | Manual input accepts trimmed 1–256 chars, fires onSubmit | component | `frontend2/src/components/scan/__tests__/ManualBarcodeEntry.test.tsx` |
| SCAN-05 | Manual input rejects empty / whitespace-only / >256 chars | component | `ManualBarcodeEntry.test.tsx` |
| SCAN-06 | `useScanHistory.add()` writes to `localStorage['hws-scan-history']` | unit | `frontend2/src/features/scan/hooks/__tests__/useScanHistory.test.ts` |
| SCAN-06 | Duplicate code dedupes-to-top | unit | `useScanHistory.test.ts` |
| SCAN-06 | History capped at 10 entries | unit | `useScanHistory.test.ts` |
| SCAN-06 | History-tap re-fires post-scan flow (D-15) | component/integration | `ScanPage.test.tsx` |
| SCAN-07 | `useScanHistory.clear()` empties storage after confirm | component | `ScanHistoryList.test.tsx` |
| Bundle gate | `/scan` main-bundle contribution ≤ 20 kB gzip | build-artifact | `bun run build` + `du -b dist/assets/scanner-*.js` |
| Guardrail | No `idb`/`serwist`/`offline`/`sync` imports in new scan code | CI lint | `bun run lint:imports` (uses existing `scripts/check-forbidden-imports.mjs`) |
| i18n | EN + ET catalogs contain every new msgid | compile | `bun run i18n:compile` (zero orphan warnings) |

## Sampling Cadence

- **Per task commit:** `cd frontend2 && bun run test -- --changed` (only affected tests green)
- **Per wave merge:** `cd frontend2 && bun run test && bun run lint:imports`
- **Phase gate:** full suite green + bundle gate verified + all `manual UAT` rows signed off in VERIFICATION.md

## Manual UAT Checklist (transferred to VERIFICATION.md on phase close)

- [ ] iOS Safari real device: `/scan` → decode → post-scan banner → SCAN AGAIN → decode again **without** re-prompting for camera permission
- [ ] iOS Safari real device: first decode after cold load plays audible beep (AudioContext unlocked by prior pointerdown)
- [ ] Android Chrome real device: `navigator.vibrate` pulse felt on decode
- [ ] ~~iOS haptic via `ios-haptics`~~ — **DEFERRED (D-17); not signed off in Phase 64**
- [ ] Android Chrome real device with torch-capable rear camera: torch button visible, tap turns flashlight ON, tap again turns OFF (verifies `applyConstraints({ advanced: [{ torch: true/false }] })` path end-to-end — automated tests cover only `aria-pressed` state)
- [ ] Android / iOS: deny camera permission → permission-denied panel shows platform-specific instructions + USE MANUAL ENTRY button navigates to Manual tab
- [ ] Manual tab: submit arbitrary trimmed string → banner shows the value + format label ("MANUAL") → history entry added
- [ ] History tab: tap entry → banner renders on History tab (NO auto-switch); dedupe-to-top respected
- [ ] Clear History → RetroConfirmDialog → confirm → list empty + localStorage key cleared
- [ ] Desktop (no torch, no haptic): scanner works, torch button absent, `navigator.vibrate` no-op
- [ ] Offline: library-init-fail panel renders with RETRY + USE MANUAL ENTRY
- [ ] Bundle report: scanner chunks isolated; `/scan` main-bundle contribution ≤ 20 kB gzip

## Wave 0 Gap

All eleven test files listed above are **new** — none exist pre-phase. Plans MUST create
the test files in Wave 0 (or inline with the code they cover) before declaring a wave
complete. `vitest.config.*` presence must be verified during Wave 0; scaffold if absent.
