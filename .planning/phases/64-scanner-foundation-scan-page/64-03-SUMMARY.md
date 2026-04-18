---
phase: 64
plan: 03
subsystem: frontend2/src/lib/scanner
tags: [scanner, port, feedback, scan-history, unit-tests, wave-1]
requires:
  - 64-01 (scanner deps + HazardStripe variant prop)
provides:
  - frontend2/src/lib/scanner barrel (types, init-polyfill, feedback, scan-history)
  - resumeAudioContext() helper (iOS gesture-unlock, D-08)
  - SUPPORTED_FORMATS superset (6 formats) + BarcodeFormat type
  - hws-scan-history localStorage key + 10-entry cap + dedupe-to-top
affects:
  - future Wave 2 hooks (useScanHistory, useScanFeedback) import from this barrel
  - future Wave 2 components (BarcodeScanner) import from this barrel
  - Phase 65 lookup will replace EntityMatch inline stub with real Item/Container/Location types
tech-stack:
  added: []
  patterns:
    - "Module-scope AudioContext singleton (getAudioContext + resumeAudioContext)"
    - "vi.mock('barcode-detector/polyfill') for dynamic-import stubbing in tests"
    - "vi.resetModules() per beforeEach for module-singleton isolation"
    - "vi.stubGlobal('localStorage', fakeStorage) with Map-backed fake"
key-files:
  created:
    - frontend2/src/lib/scanner/init-polyfill.ts
    - frontend2/src/lib/scanner/types.ts
    - frontend2/src/lib/scanner/index.ts
    - frontend2/src/lib/scanner/feedback.ts
    - frontend2/src/lib/scanner/scan-history.ts
    - frontend2/src/lib/scanner/__tests__/feedback.test.ts
    - frontend2/src/lib/scanner/__tests__/scan-history.test.ts
    - frontend2/src/lib/scanner/__tests__/init-polyfill.test.ts
  modified: []
decisions:
  - "D-17 compliance: navigator.vibrate only, no ios-haptics import anywhere"
  - "SUPPORTED_FORMATS kept as 6-entry superset (SCAN-02 subset selected at Scanner prop site in Wave 2)"
  - "EntityMatch stubbed inline (id/name pairs) — Phase 65 replaces with Item/Container/Location"
  - "Barrel surface: types + init-polyfill + feedback + scan-history (no scan-lookup until Phase 65)"
  - "resumeAudioContext swallows iOS resume() rejections — retry on next gesture is a no-op"
metrics:
  duration_min: 7
  tasks_completed: 4
  commits: 6
  files_created: 8
  tests_added: 28
  completed_at: "2026-04-18T17:35:52Z"
requirements_addressed: [SCAN-03, SCAN-06]
---

# Phase 64 Plan 03: lib/scanner 5-file port + unit tests Summary

Ported the five legacy `/frontend/lib/scanner/*` modules into `/frontend2/src/lib/scanner/` with the targeted edits spec'd by RESEARCH.md/PATTERNS.md (strip `"use client"`, drop entity imports, remove `scan-lookup` export, add `resumeAudioContext()` for iOS gesture-unlock per D-08) and landed 28 Vitest unit tests across the three behavior-bearing modules to satisfy SCAN-03 (feedback) + SCAN-06 (scan-history) Nyquist coverage at the module layer.

## Exported Surface

### `init-polyfill.ts`
- `initBarcodePolyfill(): Promise<void>` — dynamic `import("barcode-detector/polyfill")` when `BarcodeDetector` is missing; idempotent via `polyfillLoaded` flag
- `isBarcodeDetectionAvailable(): boolean` — feature-detect `"BarcodeDetector" in window`

### `types.ts`
- `type EntityMatch` — inline-stub union (`item` / `container` / `location` with `{id, name}` entity + `not_found` with raw `code`); Phase 65 replaces with real types
- `interface ScanHistoryEntry` — `{ code, format, entityType, entityId?, entityName?, timestamp }`
- `const SUPPORTED_FORMATS` — 6-entry superset `["qr_code", "ean_13", "ean_8", "upc_a", "upc_e", "code_128"]`
- `type BarcodeFormat = (typeof SUPPORTED_FORMATS)[number]`

### `feedback.ts`
- `initAudioContext(): void` — idempotent AudioContext creation
- `resumeAudioContext(): void` — **NEW in Phase 64** — see implementation below
- `playBeep(frequency?, duration?, volume?): void` — Web Audio oscillator at given freq/dur
- `playSuccessBeep(): void` — 880 Hz × 100 ms × 0.25 vol
- `playErrorBeep(): void` — 300 Hz × 200 ms × 0.3 vol
- `triggerHaptic(pattern?): void` — `navigator.vibrate` wrapper (no-op on iOS; D-17)
- `triggerScanFeedback(): void` — composes `playSuccessBeep + triggerHaptic(50)`

### `scan-history.ts`
- `getScanHistory(): ScanHistoryEntry[]` — read + type-guard + corrupt-JSON fallback
- `addToScanHistory(entry): void` — dedupe-to-top + 10-cap
- `createHistoryEntry(code, format, match): Omit<ScanHistoryEntry, "timestamp">` — shape builder
- `removeFromScanHistory(code): void`
- `clearScanHistory(): void`
- `getLastScan(): ScanHistoryEntry | undefined`
- `formatScanTime(ts): string` — "Just now" / "N min ago" / "N hr ago" / locale date

### `index.ts` (barrel)
Re-exports all of the above; **no `scan-lookup` export** (deferred to Phase 65).

## The One Addition Beyond Verbatim Port: `resumeAudioContext()`

```ts
export function resumeAudioContext(): void {
  if (!audioContext) {
    initAudioContext();
  }
  if (audioContext?.state === "suspended") {
    audioContext.resume().catch(() => {
      /* swallow — iOS rejects when not in a user gesture; retry is a no-op */
    });
  }
}
```

Purpose: called from the page-level `pointerdown` handler (D-08) so the module-singleton `AudioContext` is in the `running` state before the first scan decodes. Swallowed rejection is intentional — iOS rejects `resume()` when not inside a user gesture, and the retry on the next gesture is free.

## Test Count Per File

| Test File | Tests | Behaviors |
|-----------|-------|-----------|
| `__tests__/init-polyfill.test.ts` | 5 | feature-detect true/false, native short-circuit, idempotency, dynamic-import path |
| `__tests__/feedback.test.ts` | 8 | init idempotency + SSR-safe, resume when suspended / no-op when running, 880 Hz × 100 ms beep, haptic present / absent (D-17), composition |
| `__tests__/scan-history.test.ts` | 15 | empty / corrupt-object / corrupt-JSON / type-guarded reads, timestamp write, dedupe-to-top (D-03), 10-cap, remove, clear, not_found vs found entry shape, 4 branches of `formatScanTime` |
| **Total** | **28** | |

## Commits

| Task | Gate | Hash | Message |
|------|------|------|---------|
| 1 | — | `4699721` | `feat(64-03): port lib/scanner init-polyfill, types, index (pure trio)` |
| 2 | RED | `4964d50` | `test(64-03): add failing test for feedback module (RED)` |
| 2 | GREEN | `666a7a4` | `feat(64-03): implement feedback module + resumeAudioContext (GREEN)` |
| 3 | RED | `381263f` | `test(64-03): add failing test for scan-history module (RED)` |
| 3 | GREEN | `70e7743` | `feat(64-03): implement scan-history module (GREEN)` |
| 4 | — | `89768a7` | `test(64-03): add init-polyfill tests + finalize barrel` |

## Verification Results

| Check | Result |
|-------|--------|
| `bun run test -- lib/scanner --run` | **28 passed** (5 + 8 + 15) |
| `bun run test --run` (full regression) | **514/514 passed** (up from 486 baseline) |
| `bunx tsc --noEmit -p tsconfig.json` | clean |
| `bun run lint:imports` | clean (no `idb`/`serwist`/`offline`/`sync`) |
| `grep -c "ios-haptics" src/lib/scanner/*.ts` | 0 (D-17 compliance) |
| `grep -c "scan-lookup" src/lib/scanner/index.ts` | 0 |
| `grep -c '"use client"' src/lib/scanner/*.ts` | 0 |

## Decisions Made

- **Conservative barrel staging** — Task 1 wrote `index.ts` with only types + init-polyfill re-exports, then Tasks 2/3/4 appended feedback / scan-history / (finalization). This kept every intermediate commit's TypeScript clean (no re-exports from not-yet-existing files).
- **Inline EntityMatch stub in `types.ts`** — preserves the legacy discriminated-union shape (`item` / `container` / `location` / `not_found`) with `{id, name}` placeholders so Phase 65 can drop in `Item` / `Container` / `Location` types without touching callsites.
- **Documentation strings** — replaced "ios-haptics" and "scan-lookup" mentions in doc comments with descriptive equivalents ("native-haptic dependency", "entity-lookup exports") to satisfy strict `grep -c` acceptance while preserving intent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Test harness bug] `vi.fn()` with arrow factory not `new`-callable**
- **Found during:** Task 2 GREEN run (Tests 1, 3, 5, 7 failing).
- **Issue:** `vi.fn(() => ctxHarness.ctx)` produces a mock whose arrow factory cannot be invoked with `new`; Vitest logs "The vi.fn() mock did not use 'function' or 'class' in its implementation" and throws `is not a constructor`. `feedback.ts` calls `new AudioContextClass()`, so the module-scope `audioContext` stayed null and tests observed zero oscillators.
- **Fix:** Replaced arrow factories with `vi.fn(function (this: unknown) { return ctxHarness.ctx; })` in `beforeEach` and Test 3's override.
- **Files modified:** `frontend2/src/lib/scanner/__tests__/feedback.test.ts`
- **Commit:** `666a7a4` (rolled into Task 2 GREEN)

**2. [Rule 1 — Acceptance-criterion regression] "scan-lookup" in doc comment**
- **Found during:** Task 4 barrel-acceptance grep.
- **Issue:** `index.ts` JSDoc said "no `scan-lookup` export" — this triggered `grep -c "scan-lookup"` = 1 despite zero imports/exports.
- **Fix:** Rephrased to "entity-lookup exports deferred to Phase 65" (same meaning, no forbidden substring).
- **Files modified:** `frontend2/src/lib/scanner/index.ts`
- **Commit:** `89768a7` (rolled into Task 4)

**3. [Rule 1 — Acceptance-criterion regression] "ios-haptics" in feedback doc comment**
- **Found during:** Task 2 verify step.
- **Issue:** `feedback.ts` JSDoc mentioned "no `ios-haptics` dependency" for D-17 documentation; `grep -c "ios-haptics"` returned 1.
- **Fix:** Rephrased to "no native-haptic dependency".
- **Files modified:** `frontend2/src/lib/scanner/feedback.ts`
- **Commit:** `666a7a4` (rolled into Task 2 GREEN)

No architectural changes, no authentication gates.

## TDD Gate Compliance

Task 2 and Task 3 are `tdd="true"` sub-plans. Both show RED → GREEN gate commits in git log:

| Task | RED commit | GREEN commit |
|------|------------|--------------|
| 2 (feedback) | `4964d50` `test(64-03): add failing test for feedback module (RED)` | `666a7a4` `feat(64-03): implement feedback module + resumeAudioContext (GREEN)` |
| 3 (scan-history) | `381263f` `test(64-03): add failing test for scan-history module (RED)` | `70e7743` `feat(64-03): implement scan-history module (GREEN)` |

Task 4 is `tdd="true"` but the underlying module (`init-polyfill.ts`) was already landed in Task 1 as part of the pure-trio port; the Task 4 test additions exercise a pre-existing correct implementation, so there is no separate RED-commit gate for init-polyfill. This is consistent with the plan's `<read_first>` noting init-polyfill.ts is sourced from Task 1.

## Threat Flags

None. Files introduced map directly onto the Phase 64 `<threat_model>` dispositions (T-64-08 tampering / T-64-09 DoS / T-64-11 dependency integrity are all mitigated in the ported code via type-guards, 10-cap, and npm integrity respectively). No new network endpoints, auth paths, or trust boundaries introduced beyond what the threat register already covers.

## Self-Check: PASSED

Files verified present:
- `frontend2/src/lib/scanner/init-polyfill.ts`
- `frontend2/src/lib/scanner/types.ts`
- `frontend2/src/lib/scanner/index.ts`
- `frontend2/src/lib/scanner/feedback.ts`
- `frontend2/src/lib/scanner/scan-history.ts`
- `frontend2/src/lib/scanner/__tests__/feedback.test.ts`
- `frontend2/src/lib/scanner/__tests__/scan-history.test.ts`
- `frontend2/src/lib/scanner/__tests__/init-polyfill.test.ts`

Commits verified in `git log`:
- `4699721`, `4964d50`, `666a7a4`, `381263f`, `70e7743`, `89768a7`
