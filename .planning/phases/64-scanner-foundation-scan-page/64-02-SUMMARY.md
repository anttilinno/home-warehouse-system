---
phase: 64
plan: 02
subsystem: frontend2/build-config + frontend2/test-infra
tags:
  - vite
  - manualChunks
  - rolldown
  - test-mocks
  - scanner
  - wave-0
dependency_graph:
  requires:
    - plan: 64-01
      provides: scanner runtime deps (@yudiel/react-qr-scanner, uuid) installed
  provides:
    - scanner chunk split rule in Vite build config (prevents scanner WASM deps from leaking into main bundle)
    - reusable Vitest mock for the 3rd-party Scanner component (consumed by Wave 2-3 component tests)
    - reusable Vitest mock for navigator.mediaDevices + MediaStreamTrack torch capability (consumed by Wave 1-3 hook and component tests)
  affects:
    - frontend2 production bundle layout (scanner chunk emerges once Wave 1 lands first @yudiel import)
    - frontend2 test harness conventions (new src/test/mocks/ directory convention)
tech_stack:
  added: []
  patterns:
    - manualChunks (rolldown function form — Vite 8 requires function, not record)
    - vi.mock bridge module (tests install via `vi.mock("<lib>", () => import("@/test/mocks/yudiel-scanner"))`)
    - globalThis.navigator override with restore() cleanup (installMediaDevicesMock pattern)
key_files:
  created:
    - frontend2/src/test/mocks/yudiel-scanner.ts
    - frontend2/src/test/mocks/media-devices.ts
  modified:
    - frontend2/vite.config.ts
decisions:
  - Vite 8 ships rolldown — manualChunks must be a function `(moduleId, meta) => string | undefined`, NOT a record. The plan (following research Pattern 5) assumed classic-rollup record form; adapted to function form that iterates a declared scannerChunkModules record so chunk membership stays readable and all required string literals remain greppable in the source.
  - Kept the comment-level mentions of the scanner library's real specifier out of yudiel-scanner.ts so a bare `grep` for the specifier confirms the no-import invariant.
metrics:
  duration: "4 min 44 sec"
  completed: 2026-04-18
---

# Phase 64 Plan 02: Wave 0 Vite manualChunks + Test-Infra Mocks Summary

**One-liner:** Wired the Vite `scanner` manualChunks rule (rolldown function form, Vite 8) and shipped two reusable Vitest mocks — `yudiel-scanner.ts` (fake Scanner component with triggerable onScan) and `media-devices.ts` (fake navigator.mediaDevices with togglable torch capability) — that every downstream Phase 64 test will consume.

## Objective

Complete Wave 0 scaffolding so Phase 64 Wave 1 (lib/scanner port + hook tests) and Wave 2 (component tests that mock `@yudiel/react-qr-scanner`) can start without re-litigating infra. The bundle gate (≤ 20 kB gzip main-bundle contribution from `/scan`) is non-negotiable — if the manualChunks rule is not present at Phase 64 close, the scanner chunks (~500-700 kB raw / ~120-180 kB gzip) leak into the main bundle. The test mock helpers must exist once, reused by 10+ test files downstream.

## What Was Built

### 1. Vite scanner chunk rule (frontend2/vite.config.ts)

Appended a `build.rollupOptions.output.manualChunks` function to the existing `defineConfig({ ... })` call. All pre-existing sections (`plugins`, `resolve`, `server`) are byte-for-byte unchanged.

The declaration is kept as a data structure (`scannerChunkModules: Record<string, readonly string[]>`) projected into a function. This makes chunk membership easy to read, easy to lint-assert, and easy to extend:

```ts
// frontend2/vite.config.ts (added block)
build: {
  rollupOptions: {
    output: {
      manualChunks: (moduleId: string): string | undefined => {
        const scannerChunkModules: Record<string, readonly string[]> = {
          scanner: [
            "@yudiel/react-qr-scanner",
            "barcode-detector",
            "barcode-detector/polyfill",
            "zxing-wasm",
            "webrtc-adapter",
          ],
        };
        for (const [chunkName, specifiers] of Object.entries(scannerChunkModules)) {
          for (const specifier of specifiers) {
            if (
              moduleId.includes(`/node_modules/${specifier}/`) ||
              moduleId.includes(`/node_modules/${specifier}.`)
            ) {
              return chunkName;
            }
          }
        }
        return undefined;
      },
    },
  },
},
```

**Why function form (deviation from plan):** Vite 8 ships rolldown, not classic rollup. Rolldown's `output.manualChunks` accepts only `(moduleId, meta) => string | null | undefined` — the record form that the plan (and research §Pattern 5) expected is rejected by rolldown's schema (verified via `node_modules/rolldown/dist/shared/rolldown-build-*.mjs` + `define-config-*.d.mts`). Documented as a Rule 3 auto-fix below.

**Chunk will emerge once imports land.** `bun run build` currently produces no `scanner-*.js` chunk because no application code imports any scanner dep yet. Rolldown silently no-ops the rule when no matched module is reachable — no warnings emitted. Plan 64-03+ will begin importing `@yudiel/react-qr-scanner`, at which point the split takes effect.

### 2. yudiel-scanner mock (frontend2/src/test/mocks/yudiel-scanner.ts)

Reusable Vitest helper consumed by all downstream scanner component/hook tests.

**Public API:**

| Export | Kind | Purpose |
|--------|------|---------|
| `Scanner` | `vi.fn` wrapping a React component | Renders a click-triggerable decode button (`data-testid="fake-scanner-decode-trigger"`). Captures props into `lastScannerProps`. |
| `lastScannerProps` | `{ current: ScannerProps }` | Ref-like handle so tests can assert prop passthrough (`paused`, `formats`, etc.) |
| `triggerDecode(rawValue?, format?)` | function | Fires `onScan` from outside the DOM click path. Defaults: `"TEST-CODE-123"`, `"qr_code"`. |
| `triggerScannerError(err?)` | function | Fires `onError` with a synthetic error. |
| `resetScannerMock()` | function | Call in `beforeEach` to clear captured props and `mockClear()` the Scanner fn. |
| `IDetectedBarcode` | type | `{ rawValue: string; format: string }` — matches real library's type export for vi.mock-satisfying imports. |

**Installation pattern (downstream tests will use):**

```ts
vi.mock("@yudiel/react-qr-scanner", () => import("@/test/mocks/yudiel-scanner"));
import { triggerDecode, lastScannerProps, resetScannerMock } from "@/test/mocks/yudiel-scanner";
```

**Constraints respected:**

- File does NOT import `@yudiel/react-qr-scanner` (we ARE the mock). Verified: `grep -c "@yudiel/react-qr-scanner" yudiel-scanner.ts` outputs 0.
- Uses `React.createElement` (no JSX) so extension stays `.ts`.
- No forbidden substrings (`idb`/`serwist`/`offline`/`sync`). lint:imports clean.

### 3. media-devices mock (frontend2/src/test/mocks/media-devices.ts)

Reusable Vitest helper for stubbing `navigator.mediaDevices.getUserMedia` and the `MediaStreamTrack.getCapabilities().torch` surface.

**Public API:**

| Export | Kind | Purpose |
|--------|------|---------|
| `installMediaDevicesMock(opts?)` | function | Installs a fake `navigator` on `globalThis` with a `getUserMedia` that resolves to a `FakeMediaStream`. Returns `{ track, stream, getUserMedia, restore }`. |
| `setTorchCapability(track, supported)` | function | Flips torch capability on an already-installed fake track (so tests can toggle support mid-test). |
| `makeFakeTrack(opts?)` | function | Constructs a standalone `FakeMediaStreamTrack` (useful for unit tests that don't need the full navigator override). |
| `makeFakeStream(track)` | function | Wraps a `FakeMediaStreamTrack` in a `FakeMediaStream` (matching `getTracks()` / `getVideoTracks()` shape). |
| `FakeMediaStreamTrack`, `FakeMediaStream` | interfaces | Exported for callers that need explicit typing on test-local state. |

**Track state inspection (escape hatch):**

`FakeMediaStreamTrack.__state` is a `readonly` field in the interface but mutable in the implementation. Tests inspect `__state.stopped`, `__state.torch`, `__state.appliedConstraints` to assert that BarcodeScanner cleanly stops streams, toggles torch, and calls `applyConstraints({ advanced: [{ torch: true }] })`.

**Torch behavior matching real browsers:**

`applyConstraints({ advanced: [{ torch: true }] })` on a track with `torchSupported: false` throws `DOMException("NotSupported", "NotSupportedError")` — matching Chromium's real behavior so the BarcodeScanner "no torch" error branch can be exercised from tests.

**Example usage:**

```ts
import { installMediaDevicesMock, setTorchCapability } from "@/test/mocks/media-devices";
const { track, restore, getUserMedia } = installMediaDevicesMock({ torchSupported: true });
afterEach(() => restore());
// later — flip support mid-test
setTorchCapability(track, false);
```

## Verification (all green)

| Check | Result |
|-------|--------|
| `grep -c "manualChunks" frontend2/vite.config.ts` | 2 (function annotation + declaration) |
| `grep -c '"@yudiel/react-qr-scanner"' frontend2/vite.config.ts` | 1 |
| `grep -c '"barcode-detector/polyfill"' frontend2/vite.config.ts` | 1 |
| `grep -c '"zxing-wasm"' frontend2/vite.config.ts` | 1 |
| `grep -c '"webrtc-adapter"' frontend2/vite.config.ts` | 1 |
| `grep -c 'scanner:' frontend2/vite.config.ts` | 1 |
| `cd frontend2 && bun run build` | exit 0 (615 kB main, no scanner chunk yet — expected) |
| `cd frontend2 && bunx tsc --noEmit -p tsconfig.app.json` | clean |
| `cd frontend2 && bun run test` | 78 files / 486 tests PASS |
| `cd frontend2 && bun run lint:imports` | OK (no `idb`/`serwist`/`offline`/`sync`) |
| `grep -c "export const Scanner" yudiel-scanner.ts` | 1 |
| `grep -c "export function triggerDecode" yudiel-scanner.ts` | 1 |
| `grep -c "export function triggerScannerError" yudiel-scanner.ts` | 1 |
| `grep -c "export function resetScannerMock" yudiel-scanner.ts` | 1 |
| `grep -c "export type IDetectedBarcode" yudiel-scanner.ts` | 1 |
| `grep -c "export const lastScannerProps" yudiel-scanner.ts` | 1 |
| `grep -c "@yudiel/react-qr-scanner" yudiel-scanner.ts` (must be 0) | 0 |
| `grep -c "export function installMediaDevicesMock" media-devices.ts` | 1 |
| `grep -c "export function setTorchCapability" media-devices.ts` | 1 |
| `grep -c "export function makeFakeTrack" media-devices.ts` | 1 |
| `grep -c "export function makeFakeStream" media-devices.ts` | 1 |
| `grep -c "torchSupported" media-devices.ts` (≥3) | 9 |
| `grep -c "appliedConstraints" media-devices.ts` (≥2) | 3 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Vite 8 rolldown requires function-form manualChunks, not record**

- **Found during:** Task 1 (first `bun run build` after the record-form edit).
- **Issue:** The plan's action block and research §Pattern 5 both prescribe the classic-rollup record form:

  ```ts
  manualChunks: { scanner: ["@yudiel/react-qr-scanner", ...] }
  ```

  Vite 8 ships rolldown as the bundler. Rolldown's `ManualChunksOption` schema is strictly a function: `(moduleId: string, meta: { getModuleInfo }) => string | null | undefined`. The record form produces TS2769 (`"scanner" does not exist in type 'ManualChunksFunction'`) and `tsc -b && vite build` fails.

- **Evidence:**
  - `frontend2/node_modules/rolldown/dist/shared/define-config-*.d.mts` defines `manualChunks?: ManualChunksFunction` only.
  - `frontend2/node_modules/rolldown/dist/shared/rolldown-build-*.mjs` validates with `ManualChunksFunctionSchema = vFunction()`.
- **Fix:** Converted to function form. Kept the group declaration as an inline `scannerChunkModules: Record<string, readonly string[]>` so:
  - Each scanner-dep specifier remains a string literal in source (satisfies the plan's grep assertions);
  - The `scanner:` chunk-name key remains present (load-bearing for Phase 64 bundle-gate task Plan 10);
  - Chunk membership stays easy to read and diff.
- **Files modified:** frontend2/vite.config.ts
- **Commit:** 5646d3e

**2. [Rule 2 — Completeness] Removed comment mentions of the scanner-lib specifier in yudiel-scanner.ts**

- **Found during:** Task 2 acceptance verification.
- **Issue:** The plan's acceptance criterion `grep -c "@yudiel/react-qr-scanner" yudiel-scanner.ts` must output `0`. The initial draft included the specifier in doc comments (usage example + IDetectedBarcode annotation). A literal grep flagged those.
- **Fix:** Rephrased the doc comments to describe the library without spelling the bare specifier (e.g. "the 3rd-party QR scanner library"). The specifier is only ever typed in the downstream test's own `vi.mock(...)` call — which is where it belongs.
- **Files modified:** frontend2/src/test/mocks/yudiel-scanner.ts
- **Commit:** bb5402a (single commit covers both the file creation and the comment rephrasing).

## Commits (this plan)

| # | Hash | Message |
|---|------|---------|
| 1 | 5646d3e | `chore(64-02): add scanner manualChunks rule in vite.config` |
| 2 | bb5402a | `test(64-02): add shared Vitest mock for the scanner component` |
| 3 | 1028eb7 | `test(64-02): add shared Vitest mock for navigator.mediaDevices and torch` |

## Known Stubs

None. Both mock files expose concrete (non-stub) behavior. `Scanner` renders a real DOM element and wires a click handler; `installMediaDevicesMock` actually mutates `globalThis.navigator`; `applyConstraints` genuinely pushes into `__state.appliedConstraints` and throws on unsupported torch. No TODO/FIXME/placeholder markers.

## Threat Flags

None. This plan:

- Only adds build-time config (production bundle layout) — no new trust boundary.
- Only adds Vitest-scoped helpers under `src/test/mocks/` — not reachable from production code paths.

Threat IDs T-64-05..07 from the plan's threat register are addressed as documented (mitigate/accept).

## Self-Check: PASSED

- `frontend2/vite.config.ts` — FOUND (modified)
- `frontend2/src/test/mocks/yudiel-scanner.ts` — FOUND (created)
- `frontend2/src/test/mocks/media-devices.ts` — FOUND (created)
- commit `5646d3e` — FOUND in `git log`
- commit `bb5402a` — FOUND in `git log`
- commit `1028eb7` — FOUND in `git log`
