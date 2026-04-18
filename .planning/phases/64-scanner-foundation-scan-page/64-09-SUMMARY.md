---
phase: 64
plan: 09
subsystem: scan-page-orchestration
tags: [scan, orchestration, react-lazy, suspense, state-machine, tabs]
requires:
  - 64-04 (useScanLookup stub + ScanLookupStatus union)
  - 64-05 (useScanHistory + useScanFeedback hooks)
  - 64-06 (BarcodeScanner + ScanViewfinderOverlay + ScanTorchToggle)
  - 64-07 (ManualBarcodeEntry + ScanResultBanner + ScanErrorPanel)
  - 64-08 (ScanHistoryList + fixtures module)
provides:
  - "3-tab ScanPage orchestration (SCAN / MANUAL / HISTORY)"
  - "Shared post-decode path for live decode + manual submit + history tap"
  - "In-feature errorKind + scannerKey remount for D-19 polyfill retry"
  - "D-01 useScanLookup callsite lock covered by automated spy test"
  - "components/scan barrel (6 re-exports)"
  - "Route-lazy-split /scan with Suspense fallback"
affects:
  - frontend2/src/features/scan/ScanPage.tsx
  - frontend2/src/features/scan/__tests__/ScanPage.test.tsx
  - frontend2/src/components/scan/index.ts
  - frontend2/src/routes/index.tsx
tech-stack:
  added: []
  patterns:
    - "React.lazy + Suspense route split"
    - "In-feature state-machine error routing (errorKind + scannerKey bump)"
    - "Ref-guarded AudioContext prime on first pointerdown"
    - "Phase-65 callsite lock covered by spy-based test"
key-files:
  created:
    - frontend2/src/components/scan/index.ts
    - frontend2/src/features/scan/__tests__/ScanPage.test.tsx
  modified:
    - frontend2/src/features/scan/ScanPage.tsx
    - frontend2/src/routes/index.tsx
decisions:
  - "Used a local ScannerLoadingFallback helper component (owns its own useLingui) instead of threading `t` into AppRoutes — cleaner, one-touch per route change"
  - "RETRY scope narrowed to initBarcodePolyfill() only; React.lazy chunk-load failures remain the route-level ErrorBoundaryPage's responsibility (D-19 narrowed 2026-04-18)"
  - "useScanLookup is MANDATORY (D-01 Phase 65 callsite lock); Test 15 spies on the hook module and asserts both the null pre-decode call and the banner-code post-decode call — this prevents accidental removal of the callsite when Phase 65 swaps the stub"
  - "paused is a derived value (paused = banner !== null), not independent state — prevents two-source-of-truth bugs"
metrics:
  duration: ~18 min
  completed: 2026-04-18
  tasks_executed: 3
  commits: 4 (chore barrel + test RED + feat GREEN + feat routes)
  tests_added: 15 (all passing)
  full_suite: 609/609 green
---

# Phase 64 Plan 09: ScanPage 3-tab orchestration + components/scan barrel + /scan route lazy split Summary

Wires ScanPage as the 3-tab scan orchestration page composing every Wave 0-2 artifact, ships the components/scan barrel, and lazy-splits the /scan route so the ~59 kB gzip scanner chunk is fetched on demand.

## What Shipped

### 1. `frontend2/src/components/scan/index.ts` — barrel (Task 1)

Six re-export lines, one per domain component: BarcodeScanner, ManualBarcodeEntry, ScanErrorPanel, ScanResultBanner, ScanViewfinderOverlay, ScanTorchToggle. Unlocks the `@/components/scan` barrel-only import pattern per the Phase 54 convention. Zero circular imports; `tsc` clean.

### 2. `frontend2/src/features/scan/ScanPage.tsx` — rewritten from stub (Task 2)

Replaced the UNDER CONSTRUCTION stub with the full orchestration. Final state machine:

| State | Type | Source of truth | Notes |
|-------|------|-----------------|-------|
| `tab` | `"scan" \| "manual" \| "history"` | `useState("scan")` (D-05 default, D-06 no persistence) | Every `/scan` visit starts on SCAN |
| `banner` | `BannerState \| null` | `useState(null)` | Non-null while the scanner is paused |
| `errorKind` | `BarcodeScannerErrorKind \| null` | `useState(null)` | Set by `BarcodeScanner.onError`; cleared by USE MANUAL ENTRY / RETRY / tab swap |
| `scannerKey` | `number` | `useState(0)` | Bumped by RETRY to remount `<BarcodeScanner>` and re-run `initBarcodePolyfill()` (D-19 narrowed) |
| `paused` (derived) | `boolean` | `banner !== null` | Single source of truth — eliminates two-state-sync bugs |

**Post-decode handler** (`handleDecode`) is the single shared path called by:
1. `<BarcodeScanner onDecode>` — live camera decode
2. `<ManualBarcodeEntry onSubmit>` via `handleManualSubmit` — synthesizes `format="MANUAL"`
3. `<ScanHistoryList onSelect>` via `handleHistoryTap` — D-15 re-fire on current tab (D-20 no auto-switch)

All three: `feedback.trigger()` → `history.add({ code, format, entityType: "unknown" })` → `setBanner({ code, format, timestamp: Date.now() })`.

**D-08 AudioContext prime**: `primedRef`-guarded `onPointerDown` handler on the page root calls `useScanFeedback.prime()` exactly once per mount. Uses `onPointerDown` (NOT `onClick`) to satisfy iOS Safari's first-gesture resume rule.

**Error routing**: `errorKind` replaces the Scan-tab body with the correct `ScanErrorPanel` variant (permission-denied / no-camera / library-init-fail / unsupported-browser). Tab strip remains usable. `USE MANUAL ENTRY` clears errorKind + sets `tab="manual"` (D-10). `RETRY` (library-init-fail only) clears errorKind + bumps scannerKey.

### 3. `frontend2/src/routes/index.tsx` — lazy split (Task 3)

- Added `import { lazy, Suspense } from "react"`.
- Replaced the static `import { ScanPage } from "@/features/scan/ScanPage"` with:

```ts
const ScanPage = lazy(() =>
  import("@/features/scan/ScanPage").then((m) => ({ default: m.ScanPage })),
);
```

- Wrapped the `<Route path="scan" …>` element in `<Suspense fallback={<ScannerLoadingFallback />}>`.
- Added a local `ScannerLoadingFallback` helper component (owns its own `useLingui`) — heading `LOADING SCANNER…` in UPPERCASE per UI-SPEC.
- NO other route touched. NO new error boundary added — chunk-load failures fall through to the existing route-level `ErrorBoundaryPage`.

### 4. `frontend2/src/features/scan/__tests__/ScanPage.test.tsx` — integration tests

15 tests across 6 describe blocks (tab switching, AudioContext prime, post-decode flow, manual submit, history tap, error routing, banner on current tab, useScanLookup callsite lock). Uses `renderWithProviders` + `setupDialogMocks` from the Plan 08 fixtures module plus `triggerDecode` / `triggerScannerError` / `lastScannerProps` / `Scanner` from the yudiel-scanner mock.

The D-01 Test 15 spy mocks `../hooks/useScanLookup` and asserts both `toHaveBeenCalledWith(null)` (pre-decode) and `toHaveBeenCalledWith("ABC-123")` (post-decode) — removing the ScanPage callsite will fail this gate immediately.

## RetroTabs API — confirmed

Prop shape `{ tabs: { key, label }[], activeTab, onTabChange }` is what's exported from `@/components/retro/RetroTabs.tsx` (v1 contract since Phase 54). No adaptation needed.

## D-01 Callsite Lock Confirmation

ScanPage line (paraphrased):

```tsx
const lookup = useScanLookup(banner?.code ?? null);
void lookup; // intentionally unused in Phase 64
```

`grep -c "useScanLookup" frontend2/src/features/scan/ScanPage.tsx` → 2 occurrences (import + call). Test 15 asserts both null and code invocations.

## D-19 Narrowed Confirmation

RETRY scope is **exclusively** `initBarcodePolyfill()`. Mechanism: `setErrorKind(null)` + `setScannerKey((k) => k + 1)` → React unmounts+remounts `<BarcodeScanner>` (because of key change) → its mount effect calls `initBarcodePolyfill()` again. Test 13 asserts the Scanner mock is remounted (mock.calls.length increases past the initial mount).

React.lazy chunk-load failures — e.g. the `import("@/features/scan/ScanPage")` in routes/index.tsx throws because the chunk 404s or the network drops — are **explicitly out of scope** for this plan's RETRY. Those errors propagate above the Suspense boundary and are handled by the existing route-level `ErrorBoundaryPage`. Recording this here so Phase 64 close and any later retrospective find it without re-deriving it.

## Scanner Chunk Size (Plan 10 bundle-gate preview)

From `bun run build` output:

| File | Size | Gzip |
|------|------|------|
| `dist/assets/scanner-CLRWiLFx.js` | 147.10 kB | **58.88 kB** |
| `dist/assets/ScanPage-BL729yxO.js` | 14.06 kB | 4.78 kB |
| `dist/assets/index-CTOI_inA.js` (main) | 497.19 kB | 136.88 kB |

Scanner chunk is isolated at ~59 kB gzip — users who never visit `/scan` don't pay for it. Well under Plan 10's ~500–700 kB ceiling. Plan 10 will formalize the bundle gate; this is a preview showing the split worked.

## Test Counts

- New in this plan: **15 ScanPage integration tests** (all green).
- Full suite: **609 passed (609)** across 92 files — was 594/594 before Plan 09.
- `bunx tsc --noEmit` — 0 errors
- `bun run lint:imports` — OK

## Requirements Addressed

All seven SCAN-0N requirements now have a rendered, user-visible path in ScanPage:

- **SCAN-01** — Live rear-camera preview with scanner controls on `/scan` (single-page route; scanner paused-not-stopped on decode)
- **SCAN-02** — QR + UPC-A + EAN-13 + Code128 via BarcodeScanner's 4-format subset
- **SCAN-03** — Audio beep + haptic (Android) + visual flash on decode via useScanFeedback.trigger wired to handleDecode
- **SCAN-04** — Torch toggle capability-gated in BarcodeScanner; rendered only when getCapabilities().torch===true
- **SCAN-05** — Manual tab form submits through shared handleDecode with format="MANUAL"
- **SCAN-06** — History tab shows last 10 scans (localStorage via useScanHistory); empty state when none
- **SCAN-07** — CLEAR HISTORY button + RetroConfirmDialog (wired through to useScanHistory.clear)

## Deviations from Plan

None — plan executed exactly as written. The one discretionary choice (inline Suspense fallback vs helper component) was explicitly delegated in the plan; picked the helper component for the cleaner AppRoutes surface.

## Commits

| # | Hash | Type | Description |
|---|------|------|-------------|
| 1 | 89620ed | feat | components/scan barrel (6 re-exports) |
| 2 | 4653b3a | test | RED — 15 failing ScanPage integration tests |
| 3 | 08a6de7 | feat | GREEN — ScanPage 3-tab orchestration implementation |
| 4 | 5d503da | feat | routes/index.tsx React.lazy + Suspense for /scan |

## TDD Gate Compliance

- **RED gate (test commit):** `test(64-09): add failing test for ScanPage 3-tab orchestration` (4653b3a) — all 15 tests failed against the stub.
- **GREEN gate (feat commit):** `feat(64-09): implement ScanPage 3-tab orchestration` (08a6de7) — all 15 tests pass.
- **REFACTOR gate:** not needed — implementation landed clean on first GREEN.

## Self-Check: PASSED

**Created files present:**
- FOUND: frontend2/src/components/scan/index.ts
- FOUND: frontend2/src/features/scan/__tests__/ScanPage.test.tsx

**Modified files present:**
- FOUND: frontend2/src/features/scan/ScanPage.tsx (UNDER CONSTRUCTION stub replaced)
- FOUND: frontend2/src/routes/index.tsx (React.lazy + Suspense wired)

**Commits in git log:**
- FOUND: 89620ed (barrel)
- FOUND: 4653b3a (RED test)
- FOUND: 08a6de7 (GREEN ScanPage)
- FOUND: 5d503da (routes lazy)
