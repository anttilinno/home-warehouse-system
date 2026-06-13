---
phase: 11-scan
plan: 06
subsystem: frontend2/scan
tags: [scan, scan-page, routes, sidebar, item-form, persistent-scanner, upc-prefill]
requires: ["11-03", "11-04", "11-05", "11-07"]
provides:
  - "features/scan/ScanPage.tsx (export: ScanPage) — persistent-scanner orchestration"
  - "/scan (lazy) + /claim/:code routes under RequireAuth"
  - "Sidebar Scan nav enabled (to=/scan)"
  - "ItemFormPage ?name=/?brand= prefill (SCAN-10 USE ALL)"
affects: []   # Wave 3 is the terminal integration plan for Phase 11 scan
tech-stack:
  added: []
  patterns:
    - "Persistent-scanner mount: BarcodeScanner in a CSS-toggled always-mounted sibling, NEVER a RetroTabs panel child (binding override 1 / RESEARCH Pattern 2 / T-11-14)"
    - "Single funnel: live decode + manual submit + history re-tap → one resolve() wrapper → useScanResolve.handleResolveCode (binding override 7)"
    - "Funnel re-syncs useScanHistory snapshot via history.add (de-duped by code in the lib — idempotent double-write)"
    - "React.lazy + Suspense for /scan so the scanner manualChunk loads only on visit (T-11-16)"
    - "Within-file brand passthrough: ?brand= merged into a direct itemsApi.create POST (no brand form field invented — binding override 5)"
key-files:
  created:
    - frontend2/src/features/scan/ScanPage.tsx
    - frontend2/src/features/scan/ScanPage.test.tsx
  modified:
    - frontend2/src/routes/index.tsx
    - frontend2/src/components/layout/Sidebar.tsx
    - frontend2/src/features/items/ItemFormPage.tsx
    - frontend2/src/features/items/ItemFormPage.test.tsx
decisions:
  - "useScanFeedback is mocked in the ScanPage integration test (leaf hook with its own unit test) to avoid pulling ios-haptics/AudioContext side effects under jsdom (window.matchMedia is absent)."
  - "ScanPage owns a resolve() wrapper that calls handleResolveCode AND history.add — the funnel's own lib write + the hook's add collapse to one entry (addToScanHistory de-dupes by code), keeping the History tab's snapshot fresh without editing the W2 hook."
  - "?brand= USE-ALL is threaded via a direct itemsApi.create call inside ItemFormPage (the shared create mutation's body builder owns a fixed key set and is off-limits). Toast + invalidation mirror the mutation's onSuccess so behaviour is identical. Name prefill is the guaranteed contract; brand rides the POST body (Item entity owns `brand`, types.ts:120)."
  - "lint:tsc used as the typecheck gate (no `typecheck` script in package.json) — consistent with 11-02..05/07."
metrics:
  duration: ~35m
  completed: 2026-06-13
  tasks: 3
  files: 6
---

# Phase 11 Plan 06: ScanPage Assembly + Routes/Sidebar/ItemFormPage Summary

The Wave-3 integration plan that turns the scanner into a working route. ScanPage
assembles the persistent-scanner architecture (binding override 1 / RESEARCH
Pattern 2): BarcodeScanner is hoisted OUT of RetroTabs into an always-mounted
CSS-toggled sibling, with the tabs + 4-state banner + quick-action overlay
rendering on top. It wires the 11-03 hooks (funnel/feedback/torch/history) to the
11-04/05 components, then owns the three single-writer files.

## What was built

- **ScanPage.tsx** — `export function ScanPage()`. The orchestration:
  - **Persistent scanner mount.** `<div className={activeTab==='scan' ? '' : 'hidden'}>`
    wraps BarcodeScanner + ScanViewfinderOverlay + ScanTorchToggle + the result
    banner. This div is ALWAYS mounted; switching tabs only flips its `hidden`
    class — the `<video>` is never unmounted (iOS PWA permission persistence,
    Pitfall 1 / T-11-14). A dedicated test asserts the scanner trigger node stays
    in the DOM across scan→manual→history→scan.
  - **One funnel.** A `resolve(code, format)` wrapper is passed to BarcodeScanner
    `onDecode`, ManualBarcodeEntry `onSubmit`, ScanHistoryList `onSelect`, and the
    banner's ERROR retry. It calls `useScanResolve.handleResolveCode` AND
    `useScanHistory.add` to keep the History snapshot fresh (de-duped by code).
  - **RetroTabs holds overlays only.** The Scan tab panel is an empty spacer; the
    Manual + History tabs carry ManualBarcodeEntry / ScanHistoryList. `?tab=` URL
    sync via the LoansListPage `setTab` recipe.
  - **Banner + quick actions on top.** ScanResultBanner renders from the
    useScanResolve lookup state (`bannerStatus()` maps pending/success+data/error
    → loading/match/not-found/error). MATCH ▸ ACTIONS opens QuickActionMenu
    (RetroDialog, camera stays mounted); closing it resumes (paused=false).
  - **Audio primer.** `onPointerDown={feedback.primeAudio}` on the page wrapper
    (Window has no onPointerDown slot) — unlocks iOS AudioContext on first gesture.
  - **Camera-blocked degrade.** `onError` → RetroEmptyState CAMERA BLOCKED +
    SWITCH TO MANUAL (jumps to the Manual tab); Manual + History stay usable.
  - **Torch.** ScanTorchToggle renders only when `useTorch.supported` (iOS hides).

- **routes/index.tsx** (single-writer) — `const ScanPage = lazy(() => import(...)
  .then(m => ({ default: m.ScanPage })))` + static `ClaimPage` import. Two routes
  added inside the RequireAuth+AppShell branch, before the `*` wildcard:
  `<Route path="scan" element={<Suspense fallback={null}><ScanPage/></Suspense>} />`
  and `<Route path="claim/:code" element={<ClaimPage/>} />`. Both login-gated
  (SCAN-12 / T-11-15); /scan is lazy so the scanner chunk loads only on visit
  (T-11-16).

- **Sidebar.tsx** (single-writer) — the disabled Scan NavItem gains `to="/scan"`
  (now a live NavLink with per-route active state).

- **ItemFormPage.tsx** (single-writer, SCAN-10) — the create-only prefill block
  now reads `?name=` (folded into RHF defaultValues alongside `?barcode=`) and
  `?brand=` (threaded into the create POST body via a direct `itemsApi.create`
  call, since the shared mutation's body builder is off-limits and owns a fixed
  key set). Edit mode ignores both. FROM SCAN badge logic untouched.

## Persistent-scanner mount proof

The scanner is the single child of an always-rendered `<div>` whose ONLY
tab-driven change is the `hidden` class. It is NOT inside `RetroTabs` (which
renders `{active && <tabpanel>}` — Pitfall 1). The test
`mounts the scanner node ONCE and keeps it mounted across tab switches` clicks
through all three tabs and asserts `getByTestId("fake-scanner-decode-trigger")`
remains in the DOM throughout. Build output confirms the scanner is its own chunk
(`scanner-*.js` 146 kB) and ScanPage is a separate lazy chunk
(`ScanPage-*.js` 14.87 kB) — scanner bytes never load off /scan (T-11-16).

## Funnel wiring

| Capture path | Component prop | → |
|---|---|---|
| Live camera decode | BarcodeScanner `onDecode` | `resolve()` |
| Manual entry | ManualBarcodeEntry `onSubmit` | `resolve()` |
| History re-tap | ScanHistoryList `onSelect` | `resolve()` (source: history) |
| ERROR retry | ScanResultBanner `onRetry` | `resolve(banner.code, …)` |

All four converge on `resolve()` → `useScanResolve.handleResolveCode`, so the
banner/quick-actions behave identically regardless of how the code arrived.

## Deviations from Plan

### Auto-fixed / adjusted

**1. [Rule 3 - Blocking] `typecheck` script does not exist**
- The plan's `<verify>` blocks call `bun run typecheck`; package.json has no such
  script (it is `lint:tsc` = `tsc -b --noEmit`), as noted in every Wave-0/2 SUMMARY
  and the prompt's hard rules. Ran `lint:tsc`. No source change.

**2. [Rule 3 - Blocking] ios-haptics needs window.matchMedia at import (jsdom)**
- The ScanPage integration test imports useScanFeedback transitively, which imports
  `ios-haptics`, which reads `window.matchMedia` at module-eval — absent in jsdom.
- Fix: mocked `./useScanFeedback` in the integration test (it is a leaf hook with
  its own dedicated unit test in 11-03). No source change to ScanPage.

### Intentional design choices (not bugs)

- **Funnel re-syncs the history snapshot.** `useScanResolve` writes the lib history
  internally; `useScanHistory` is a state snapshot seeded once at mount. To make
  the History tab reflect a just-scanned code, ScanPage's `resolve()` also calls
  `history.add()`. `addToScanHistory` de-dupes by code, so the two writes collapse
  to a single entry — no duplicate rows, no W2 hook edit.
- **brand USE-ALL via direct itemsApi.create.** Binding override 5 forbids inventing
  a brand form field AND any non-ItemFormPage edit; the shared create mutation's
  `buildCreateBody` owns a fixed key set (no brand). So a brand-bearing create is
  issued inline with brand merged into the POST body, mirroring the mutation's
  toast + invalidation. Name prefill is the guaranteed contract; brand rides the
  payload (Item entity owns `brand`).
- **Audio primer on the wrapper div**, not the Window (Window exposes no
  onPointerDown prop) — primeAudio is idempotent so wrapper-level wiring is safe.

## Threat mitigations applied

- **T-11-13 (?name=/?brand= tampering):** name flows into the React-controlled RHF
  Name input (auto-escaped); zod length bounds apply on submit. brand never renders
  to the DOM — it goes straight into the JSON POST body.
- **T-11-14 (iOS camera re-prompt):** scanner is a CSS-toggled persistent sibling,
  never a RetroTabs panel child; the single-mount test guards this.
- **T-11-15 (unauth /scan or /claim):** both routes live inside the RequireAuth
  branch; unauth → /login?next= via the existing contract. No bypass added.
- **T-11-16 (scanner bytes on every page):** ScanPage is React.lazy → the scanner
  manualChunk + the ScanPage chunk emit separately and load only on /scan
  (confirmed in build output).

## Verification

- `bun install --frozen-lockfile` — clean (325 packages; lockfile owned by 11-01).
- `bun run lint:tsc` — green (exit 0).
- `bun run lint:imports` — OK.
- `bun run test src/features/scan/ src/features/items/ src/components/scan/` —
  **26 files / 173 tests passed.**
  - ScanPage.test.tsx: 6 (single-mount across tab switches; live decode →
    LOADING→MATCH→QuickActionMenu; manual submit funnel; history re-tap; camera
    blocked → CAMERA BLOCKED + SWITCH TO MANUAL; torch hidden when unsupported).
  - ItemFormPage.test.tsx: 14 (11 prior + 3 new: ?name= prefill, ?brand= in POST,
    edit ignores params, no-brand no spurious key).
- `bun run build` — succeeds. Scanner emitted as `scanner-*.js` (146 kB) +
  `ScanPage-*.js` (14.87 kB) lazy chunk. The 500 kB warning is the pre-existing
  main `index` chunk (not introduced by this plan).

## Known Stubs

None. ScanPage is wired to the real 11-03 hooks + 11-04/05 components; the routes
import real pages; ItemFormPage threads real query params into real RHF state /
create payload. No placeholder data, no empty-return stubs.

## TDD Gate Compliance

Tasks 1 + 3 are `tdd="true"`. Both were driven RED→GREEN: ScanPage.test.tsx
failed (module-missing) before ScanPage.tsx landed; the new ItemFormPage tests
failed (name not prefilled / no brand in POST) before the prefill code landed.
Per the orchestrator's single-commit-per-task convention, RED + GREEN are squashed
into each task's `feat(...)` commit rather than split test/feat commits — flagged
for transparency. All tests are present and green.

## Self-Check: PASSED

- FOUND: frontend2/src/features/scan/ScanPage.tsx
- FOUND: frontend2/src/features/scan/ScanPage.test.tsx
- FOUND (modified): routes/index.tsx, Sidebar.tsx, ItemFormPage.tsx, ItemFormPage.test.tsx
- Commits 6e2b… (Task 1), 6d55… (Task 2), 4519… (Task 3) present on exec/11-06.
- tsc + import-lint + the 173-test scoped suite + build are all green.
