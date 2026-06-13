---
phase: 11-scan
plan: 05
subsystem: frontend2/scan-overlays
tags: [scan, result-banner, manual-entry, history, quick-actions, upc-prefill, retro]
requires: ["11-02", "11-01"]
provides:
  - "components/scan/{ScanResultBanner,ManualBarcodeEntry,ScanHistoryList,QuickActionMenu,UpcSuggestionBanner}.tsx"
  - "components/scan/index.ts (scan barrel — 11-05 components only)"
  - "features/items/hooks/useMarkReviewedItem.ts"
  - "styles/globals.css .scan-cursor--blink keyframe"
affects:
  - "11-06 ScanPage (mounts banner + manual + history + quick-action overlay)"
  - "11-06 ItemFormPage (mounts UpcSuggestionBanner)"
tech-stack:
  added: []
  patterns:
    - "Presentational result banner — status/code/item/handlers in, no owned query (11-03 owns useScanResolve)"
    - "Fail-safe Loan gate: hasActiveLoan = active.length>0 || query.isPending (pending hides LOAN)"
    - "encodeURIComponent on user-controlled code (NOT-FOUND link) and id (LOAN link) — T-11-08"
    - "UPC gate /^\\d{8,14}$/ as react-query `enabled` flag — non-UPC never hits the network"
    - ".scan-cursor--blink reuses status-blink steps(1,end); prefers-reduced-motion → animation:none"
key-files:
  created:
    - frontend2/src/components/scan/ScanResultBanner.tsx
    - frontend2/src/components/scan/ManualBarcodeEntry.tsx
    - frontend2/src/components/scan/ScanHistoryList.tsx
    - frontend2/src/components/scan/QuickActionMenu.tsx
    - frontend2/src/components/scan/UpcSuggestionBanner.tsx
    - frontend2/src/components/scan/index.ts
    - frontend2/src/features/items/hooks/useMarkReviewedItem.ts
    - frontend2/src/components/scan/ScanResultBanner.test.tsx
    - frontend2/src/components/scan/ManualBarcodeEntry.test.tsx
    - frontend2/src/components/scan/ScanHistoryList.test.tsx
    - frontend2/src/components/scan/QuickActionMenu.test.tsx
    - frontend2/src/components/scan/UpcSuggestionBanner.test.tsx
    - frontend2/src/features/items/hooks/useMarkReviewedItem.test.ts
  modified:
    - frontend2/src/styles/globals.css
decisions:
  - "Barrel exports ONLY the 5 11-05 components (camera components are a sibling worktree absent here — re-export would break tsc -b; 11-06/11-04 import camera comps directly)."
  - "UpcSuggestionBanner drops the UI-SPEC `via {source}` chip — ProductResponse has no `source` field; chip omitted rather than fabricated."
  - "ScanResultBanner is presentational (status prop), not query-owning — the 11-03 useScanResolve owns the query per UI-SPEC Surface 5."
metrics:
  duration: ~25m
  completed: 2026-06-13
---

# Phase 11 Plan 05: Scan Result Banner + Manual + History + Quick Actions Summary

The overlay surfaces that render on top of the always-mounted scanner: the
4-state result banner, manual code entry, scan history, the state-adaptive
quick-action overlay, and the UPC product-prefill banner — plus the
`useMarkReviewedItem` PATCH mutation backing the Mark-Reviewed action. All
presentational/contract-driven and disjoint from 11-04's camera components so
both ran same-wave.

## Component prop contracts (for 11-06 wiring)

### `ScanResultBanner` — `@/components/scan`
```ts
{ status: "loading" | "match" | "not-found" | "error";  // ScanBannerStatus
  code: string;
  item?: Item | null;          // MATCH only
  onOpenActions?: () => void;  // MATCH ▸ ACTIONS
  onRetry?: () => void; }       // ERROR ↻ TRY AGAIN
```
PRESENTATIONAL — 11-03's `useScanResolve` owns the `["item-by-barcode", wsId, code]`
query; pass its `status`/`data` down. NOT-FOUND CTA is a `<Link>` to
`/items/new?barcode=${encodeURIComponent(code)}`. LOADING ends in a
`.scan-cursor--blink` mono cursor (holds solid under prefers-reduced-motion).

### `ManualBarcodeEntry` — `@/components/scan`
```ts
{ onSubmit: (code: string, source: "manual") => void; }
```
`<form>` + mono RetroInput (label ENTER CODE) + LOOK UP CODE primary button.
Trims; button disabled while blank; clears on submit. Funnel source = `"manual"`.

### `ScanHistoryList` — `@/components/scan`
```ts
{ entries: ScanHistoryEntry[];                        // from getScanHistory()
  onSelect: (code: string, source: "history") => void; // re-fire the funnel
  onClear: () => void; }                                // after confirm
```
PRESENTATIONAL — the page reads `localStorage` via `getScanHistory()` and passes
entries down. Rows are `<button>`s (RetroTable hover/stripe idiom). CLEAR HISTORY
opens a pink RetroConfirmDialog before `onClear`; empty → RetroEmptyState
(◇ NO SCANS YET). Relative time is computed in-component from `entry.timestamp`.

### `QuickActionMenu` — `@/components/scan`
```ts
{ item: Item; onClose: () => void; }
```
Renders as a `RetroDialog` (titlebar MATCHED ITEM, blue) so the camera stays
mounted. Fires `["loans", wsId, "by-item", item.id]` → `loansApi.byItem` on open.
Gating:
- VIEW ITEM — always → `/items/${item.id}` (blue)
- LOAN — only when `!is_archived && !hasActiveLoan` → `/loans/new?itemId=${encodeURIComponent(item.id)}` (mint).
  `hasActiveLoan = active.length>0 || query.isPending` → hidden while loading (fail-safe).
- UNARCHIVE — only `is_archived` → `itemsApi.restore` + toast + close (neutral)
- MARK REVIEWED — only `needs_review` → `useMarkReviewedItem` + close (neutral)
- BACK TO SCAN — always → `onClose` (neutral)

### `UpcSuggestionBanner` — `@/components/scan`
```ts
{ code: string;
  onUse: (s: { name: string; brand?: string }) => void;  // UpcSuggestion
  onDismiss: () => void; }
```
Lives on the item-CREATE form (11-06 mounts in ItemFormPage), NOT /scan. Gates on
`/^\d{8,14}$/` as the react-query `enabled` flag; fires `["barcode", wsId, code]`
→ `barcodeApi.lookup`. Renders nothing for non-UPC codes or `found:false`. USE
NAME → `{name}`; USE ALL → `{name, brand}` (11-06 reads `&name=&brand=` into the
form); DISMISS → `onDismiss`.

### `useMarkReviewedItem` — `@/features/items/hooks/useMarkReviewedItem`
```ts
function useMarkReviewedItem(): UseMutationResult<Item, unknown, string>
// mutate(itemId) → itemsApi.update(wsId, id, { needs_review: false })
```
Invalidates `["items", wsId]` (prefix) AND `["item-by-barcode", wsId]` on success;
success/error retroToast. Backend PATCH accepts `needs_review` (handler.go:419/765
— T-11-10, NOT a dead button).

## Scan barrel (`components/scan/index.ts`) exports

`ScanResultBanner` (+ `ScanResultBannerProps`, `ScanBannerStatus`),
`ManualBarcodeEntry` (+ `ManualBarcodeEntryProps`), `ScanHistoryList`
(+ `ScanHistoryListProps`), `QuickActionMenu` (+ `QuickActionMenuProps`),
`UpcSuggestionBanner` (+ `UpcSuggestionBannerProps`, `UpcSuggestion`).

**The camera components (BarcodeScanner / ScanViewfinderOverlay / ScanTorchToggle)
are NOT re-exported** — see Deviations. 11-06/11-04 import them directly from
their own paths.

## Deviations from Plan

### 1. [Scope — barrel] Barrel exports only the 11-05 components
- **Found during:** Task 3 (barrel creation).
- **Issue:** The plan's preferred-path note + executor hard rule said: if the
  in-worktree `tsc` cannot resolve the 11-04 camera components (they live in a
  PARALLEL same-wave worktree and are absent here), the barrel must NOT re-export
  them (that breaks `tsc -b`). Confirmed absent: only the 5 11-05 components exist
  in `src/components/scan/`.
- **Resolution:** Barrel exports ONLY the 5 11-05 components, per the plan's
  explicit "Prefer:" fallback. 11-06/11-04 import camera components directly from
  `./BarcodeScanner` etc. NOT a 1:1 of the Task-3 `<action>` 8-component list — it
  is the plan's own sanctioned fallback for the parallel-worktree case.

### 2. [Data — UI-SPEC] UPC `via {source}` chip omitted
- **Found during:** Task 3.
- **Issue:** UI-SPEC SCAN-10 mock shows a `via OpenFoodFacts` source chip, but
  `ProductResponse` (11-02, barcode.ts) has no `source` field — only `name`,
  `brand`, `category`, `image_url`, `found`.
- **Resolution:** Omitted the chip rather than fabricating a source string. The
  banner still carries the PRODUCT FOUND badge + `{name} — {brand}`. Documented
  inline. If the backend later adds `source`, the chip slot is marked in the JSX.

## Threat mitigations applied

- **T-11-08 (nav tampering):** NOT-FOUND link `encodeURIComponent`s the code;
  LOAN link `encodeURIComponent`s the id. Banner test asserts a `../`-bearing code
  is escaped (no raw `abc/../x` in the href).
- **T-11-09 (product XSS):** product `name`/`brand` rendered as React text
  (auto-escaped); no `dangerouslySetInnerHTML`.
- **T-11-10 (dead Mark-Reviewed):** mutation hits the real PATCH; gated on
  `needs_review` so it never shows when inapplicable.

## Verification

- `bun install --frozen-lockfile` — clean (lockfile owned by 11-01).
- `bun run lint:tsc` — green (note: the plan/verify says `bun run typecheck`, but
  the actual typecheck script is `lint:tsc` — same as 11-02's deviation 1).
- `bun run lint:imports` — OK.
- `bun run test src/components/scan/ src/features/items/hooks/useMarkReviewedItem.test.ts`
  — **6 files / 25 tests passed.**
  - ScanResultBanner: 5 (each of 4 states + cursor presence/absence + encoded link).
  - ManualBarcodeEntry: 4 (blank-disabled, trim+funnel+clear, Enter-submit, whitespace no-op).
  - ScanHistoryList: 3 (row re-fire, confirm-then-clear, empty state).
  - QuickActionMenu: 5 (plain/pending-hidden/active-loan-hidden/archived/needs-review PATCH+close).
  - UpcSuggestionBanner: 6 (non-UPC null, found banner+3 buttons, found:false null,
    USE NAME {name}, USE ALL {name,brand}, DISMISS).
  - useMarkReviewedItem: 2 (PATCH body {needs_review:false}, invalidates both families).

## Known Stubs

None — every component is wired to its real atom / api / hook. UpcSuggestionBanner
and the result banner are presentational by design (the page owns the query state),
not stubs.

## TDD Gate Compliance

Tasks are `tdd="true"`. Components + tests were committed together per task (3 task
commits) rather than split RED/GREEN commits — the tests are present and green.
Flagged for transparency, consistent with 11-02's approach.

## Self-Check: PASSED

All 14 source/test files + this SUMMARY exist on disk; tsc + import-lint + the
25-test scan suite are green.
