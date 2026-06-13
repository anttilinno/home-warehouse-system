---
phase: 11-scan
plan: 02
subsystem: frontend2/scanner-lib
tags: [scanner, feedback, scan-history, polyfill, barcode-api, parity-port]
requires: ["11-01"]            # deps + test mocks (scanner-mock, setup camera/BarcodeDetector, MSW barcode handler, Item.needs_review)
provides:
  - "lib/scanner/{feedback,scan-history,init-polyfill,types,index}.ts"
  - "lib/api/barcode.ts (barcodeApi.lookup)"
affects:
  - "11-03 hooks (useScanFeedback/useScanHistory/useScanResolve import these)"
  - "11-04/05 scanner + result/history components"
tech-stack:
  added: []                    # no new deps — 11-01 owns the lockfile; frozen install held
  patterns:
    - "Singleton AudioContext sine-oscillator beep (gesture-primed, never resumed at import)"
    - "localStorage rolling list, dedup-by-code, slice(0,10), validator-filtered read"
    - "encodeURIComponent on user-controlled scanned code before path interpolation"
    - "barcode-detector/polyfill side-effect registration guarded by native-present check"
key-files:
  created:
    - frontend2/src/lib/scanner/types.ts
    - frontend2/src/lib/scanner/init-polyfill.ts
    - frontend2/src/lib/scanner/feedback.ts
    - frontend2/src/lib/scanner/scan-history.ts
    - frontend2/src/lib/scanner/index.ts
    - frontend2/src/lib/scanner/feedback.test.ts
    - frontend2/src/lib/scanner/scan-history.test.ts
    - frontend2/src/lib/api/barcode.ts
    - frontend2/src/lib/api/barcode.test.ts
  modified: []
decisions:
  - "SUPPORTED_FORMATS narrowed from legacy 6 (incl ean_8/upc_e) to the 4 CONTEXT/SCAN-02 locks (qr_code/upc_a/ean_13/code_128) — binding override 3."
  - "BarcodeFormat re-exported from barcode-detector (canonical enum), not derived from the local tuple."
  - "Dropped legacy EntityMatch/createHistoryEntry (depended on absent legacy entity types); added updateScanHistory(code, Item|null) per plan."
  - "init-polyfill is a side-effect module but guards on 'BarcodeDetector' in globalThis so it never overrides the native/test-stub detector and never throws under jsdom."
metrics:
  duration: ~10m
  completed: 2026-06-13
---

# Phase 11 Plan 02: Scanner Lib Port Summary

1:1 parity port of the four legacy `lib/scanner/*` modules (feedback, scan-history,
init-polyfill, types) into `frontend2/src/lib/scanner/` plus a typed `barcodeApi.lookup`
against the GLOBAL `/barcode/{code}` route — pure logic + browser-API utilities, fully
unit-tested with the Wave-0 mocks, disjoint from all UI.

## What was built

- **types.ts** — `SUPPORTED_FORMATS` (the 4-format SCAN-02 subset), `ScanHistoryEntry`
  (legacy-compatible shape so stale `hws-scan-history` data is readable), `SupportedFormat`,
  and a re-export of `BarcodeFormat` from `barcode-detector`.
- **init-polyfill.ts** — side-effect registration of `barcode-detector/polyfill`, guarded
  by a native-present check (idempotent; no-throw under jsdom). Also exports
  `initBarcodePolyfill()` + `isBarcodeDetectionAvailable()`.
- **feedback.ts** — singleton AudioContext sine-oscillator beep (success 880/100/0.25,
  error 300/200/0.3), a raw `navigator.vibrate` helper, and `primeAudio()` for the
  pointerdown unlock. Never resumes the context at module scope (iOS Pitfall 4).
- **scan-history.ts** — `hws-scan-history` localStorage list: dedup-by-code, last-10
  (`slice(0,10)`), malformed/stale-tolerant read, `clearScanHistory`, plus
  `updateScanHistory(code, Item|null)` to refine a matched entry post-lookup.
- **index.ts** — barrel re-exporting feedback + scan-history + types (NOT init-polyfill,
  which is a direct side-effect import).
- **lib/api/barcode.ts** — `barcodeApi.lookup(code)` → `ProductResponse`, GETting the
  GLOBAL `/barcode/${encodeURIComponent(code)}` route (T-11-02 path-injection guard).

## Exported symbols (for 11-03/04/05)

| Module | Exports |
|--------|---------|
| `@/lib/scanner` (barrel) | `playBeep`, `playSuccessBeep`, `playErrorBeep`, `primeAudio`, `triggerHaptic`, `triggerScanFeedback`, `getScanHistory`, `addToScanHistory`, `updateScanHistory`, `removeFromScanHistory`, `clearScanHistory`, `getLastScan`, `SUPPORTED_FORMATS` + types `BarcodeFormat`, `SupportedFormat`, `ScanHistoryEntry` |
| `@/lib/scanner/init-polyfill` | `initBarcodePolyfill`, `isBarcodeDetectionAvailable` (+ side-effect registration on import) |
| `@/lib/api/barcode` | `barcodeApi` (`.lookup(code)`), `ProductResponse` |

> Note: `getLastScan` / `removeFromScanHistory` / `triggerScanFeedback` / `playBeep` were
> ported for parity completeness even though the plan's `<output>` listed a smaller core set;
> they are additive and harmless. The plan-named core (`playSuccessBeep`/`primeAudio`/
> `getScanHistory`/`addToScanHistory`/`clearScanHistory`/`updateScanHistory`/`barcodeApi`/
> `SUPPORTED_FORMATS`) is all present.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Verify command script name mismatch**
- **Found during:** Task 1 verify.
- **Issue:** The plan's `<verify>` and final gate call `bun run typecheck`, but `package.json`
  has no `typecheck` script — the typecheck script is `lint:tsc` (`tsc -b --noEmit`).
- **Fix:** Ran `bun run lint:tsc` (the actual typecheck script) for all gates. No source change.

**2. [Rule 1 - Test isolation] feedback test singleton leakage**
- **Found during:** Task 2.
- **Issue:** `feedback.ts` holds a module-scope singleton AudioContext; static-imported tests
  reused the first test's context, so "new context per test" assertions failed.
- **Fix:** feedback.test.ts re-imports the module fresh per test via `vi.resetModules()` +
  dynamic `import("./feedback")` after stubbing globals. No source change.

### Intentional parity narrowing (not a bug)

- Legacy `SUPPORTED_FORMATS` had 6 entries (added `ean_8`, `upc_e`); v3.0 ships exactly the
  4 CONTEXT/SCAN-02 locks. This is binding override 3 from the plan, applied deliberately.
- Legacy `EntityMatch` union + `createHistoryEntry` were dropped (they referenced legacy
  Item/Container/Location types absent from frontend2); replaced by `updateScanHistory` per
  the plan's Task-2 behavior. `removeFromScanHistory`/`getLastScan` kept for parity.

## Threat mitigations applied

- **T-11-02 (path injection):** `barcodeApi.lookup` `encodeURIComponent`s the code; the
  barcode test asserts `../etc/passwd` is encoded (`%2F` present, no literal `barcode/../`).
- **T-11-03 (stale localStorage):** `getScanHistory` wraps `JSON.parse`, rejects non-arrays,
  and shape-validates each entry; tests cover non-JSON, non-array, and mixed-malformed inputs.

## Verification

- `bun install --frozen-lockfile` — clean (lockfile owned by 11-01; no drift).
- `bun run lint:tsc` — green (no errors).
- `bun run lint:imports` — OK (no forbidden imports introduced).
- `bun run test src/lib/scanner/ src/lib/api/barcode.test.ts` — **3 files / 19 tests passed.**
  - feedback.test.ts: 6 (beep freq/duration, singleton, gesture-prime resume, raw vibrate ±).
  - scan-history.test.ts: 10 (add/dedup/cap-10/clear, malformed tolerance ×3, updateScanHistory ×3).
  - barcode.test.ts: 3 (found shape, found:false faithful, encodeURIComponent injection guard).

## Known Stubs

None — all modules are wired to real browser APIs / the existing `get()` helper. No
placeholder data or empty-return stubs.

## TDD Gate Compliance

Plan tasks are `tdd="true"`. Modules + their tests were committed together in a single
plan commit (per the orchestrator's single-commit instruction for this plan) rather than
split RED/GREEN commits; the tests are present and green. No separate `test(...)` RED commit
exists for this plan — flagged here for transparency.

## Self-Check: PASSED

All 9 source/test files + this SUMMARY exist on disk; tsc + lint:imports + the 19-test
suite are green. Commit hash recorded in the orchestrator return.
