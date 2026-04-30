---
phase: 65-item-lookup-and-not-found-flow
plan: 04
subsystem: ui
tags: [scan, lookup, history, hook, body-swap, tanstack-query, phase-64-contract-locked, d-22, race-guard, use-callback]

requires:
  - phase: 65-item-lookup-and-not-found-flow
    provides: "Plan 65-02 — itemsApi.lookupByBarcode(wsId, code) with D-06/D-07/D-08 guards inlined; Plan 65-03 — scanKeys factory shape analog pattern"
  - phase: 64-scanner-foundation-scan-page
    provides: "useScanLookup stub (Phase 64 D-18 shape lock) + ScanPage.tsx line 82 callsite + ScanPage.test.tsx Test 15 gate"
provides:
  - "useScanLookup(code) body swap from stub to real TanStack Query against itemsApi.lookupByBarcode; ScanLookupResult shape (Phase 64 D-18) preserved byte-for-byte"
  - "updateScanHistory(code, patch) module-scope function in lib/scanner/scan-history.ts with D-22 noop-if-missing race guard"
  - "updateScanHistory re-exported from @/lib/scanner barrel"
  - "useScanHistory.update(code, patch) — useCallback-wrapped with empty deps for referential-identity stability (explicit contract for Plan 65-07 match-effect deps)"
  - "8 real it() cases in useScanLookup.test.ts (1 PRESERVE compile-time gate + 7 RED-first behavioral: null/no-ws/match/not-found/error/refetch/queryKey)"
  - "3 new it() cases in scan-history.test.ts for updateScanHistory (happy path / noop-if-missing / isolation)"
  - "5 new it() cases in useScanHistory.test.ts for .update (happy / noop / no re-introduce / typeof / referential stability)"
affects: ["65-06", "65-07"]

tech-stack:
  added: []
  patterns:
    - "Body-swap site preserved under shape-contract tripwire: useScanLookup signature + ScanLookupResult shape frozen by Phase 64 D-18 + Test 15 mock; only the body changes"
    - "Status-mapping TanStack Query idiom: explicit if-else chain over query.isPending / query.isError enforces D-18 exhaustive union (idle / loading / success / error) rather than letting TanStack's internal flags leak"
    - "D-22 race guard via separate update() method (not upsert-on-add): addToScanHistory stays dedupe-insert; updateScanHistory is noop-if-missing so stale lookup resolves for de-duped codes silently discard"
    - "useCallback empty-deps referential-identity contract: update wrapped in useCallback(fn, []) so consumer effects (Plan 65-07 match-effect) can depend on history.update without re-firing every render"

key-files:
  created: []
  modified:
    - "frontend2/src/features/scan/hooks/useScanLookup.ts — 13-line stub replaced with 44-line real-query body (useQuery<Item|null> from itemsApi.lookupByBarcode, staleTime 30_000 / gcTime 300_000, enabled gated on code && workspaceId, explicit status mapping)"
    - "frontend2/src/features/scan/hooks/__tests__/useScanLookup.test.ts — 50-line Phase 64 stub test file rewritten: 1 PRESERVE compile-time gate + 7 new RED-first behavioral cases (null / no-ws / match / not-found / error / refetch / queryKey)"
    - "frontend2/src/lib/scanner/scan-history.ts — updateScanHistory(code, patch) inserted between removeFromScanHistory and clearScanHistory (27 new lines: JSDoc + body); noop-if-missing D-22 race guard comment inline"
    - "frontend2/src/lib/scanner/__tests__/scan-history.test.ts — new describe(\"updateScanHistory (D-22 race guard)\") block appended with 3 it() cases; existing 15 cases untouched"
    - "frontend2/src/lib/scanner/index.ts — barrel: updateScanHistory added between addToScanHistory and createHistoryEntry (1 line)"
    - "frontend2/src/features/scan/hooks/useScanHistory.ts — imports widened; new useCallback-wrapped update method between add and remove; return value widened from { entries, add, clear, remove } to { entries, add, update, remove, clear }"
    - "frontend2/src/features/scan/hooks/__tests__/useScanHistory.test.ts — updateScanHistoryMock added to the vi.mock factory; new describe(\"useScanHistory.update (D-22)\") block with 5 it() cases"

key-decisions:
  - "Mocked useAuth at module scope via vi.mock(\"@/features/auth/AuthContext\", () => ({ useAuth: vi.fn(() => ({ workspaceId: \"ws-1\" })) })) + vi.mocked(useAuth).mockReturnValue(...) for the no-workspaceId branch. This simple factory mock worked without needing a more elaborate shape — useAuth is a plain hook export (not a default export or re-export chain), so vi.mocked() operates on the factory's returned fn directly."
  - "status-mapping if-else chain instead of deriving status from query.status directly: query.isPending is true even when enabled:false (TanStack v5 behavior), so we can't naively map query.status → ScanLookupStatus. Explicit gate (!code || !workspaceId → idle) enforces D-18 contract when the hook is disabled."
  - "Kept addToScanHistory strictly dedupe-insert; added a second method updateScanHistory with noop-if-missing semantics. Rationale: per D-22, a stale lookup resolving for a code that was since de-duped out of history (MAX_HISTORY_SIZE=10) must NOT re-introduce the entry. Mixing upsert into add() would race against this — two separate methods keep the semantics auditable."
  - "useCallback deps array MUST be empty [] on update (not [updateScanHistory] or similar). updateScanHistory is a module-scope function (stable reference by construction), so [] is the correct deps array. This matches the existing add/remove/clear pattern in the same hook and guarantees referential identity across every hook render."

patterns-established:
  - "Body-swap without signature change: when a downstream phase preserves an upstream phase's type contract (Phase 64 D-18 ScanLookupResult), the body can be replaced while the test's compile-time type gate + the downstream callsite's mock-return shape stay the tripwires. No wrapper, no intermediate adapter."
  - "Direct unit tests on module functions + hook-level tests on the React wrapper: scan-history.test.ts tests updateScanHistory directly at the module boundary; useScanHistory.test.ts tests the hook's update method which transitively exercises the same code path. Both sets of tests live to prevent a future refactor from silently weakening either layer."
  - "useCallback empty-deps as a consumer-visible contract: when a hook method's referential identity is explicitly consumed as an effect dep in a downstream phase (Plan 65-07), the useCallback wrap is not cosmetic — it's an API contract. Must be documented as such in the hook so a future refactor cannot silently widen the deps array."

requirements-completed: [LOOK-01]
# LOOK-01 lookup hook end-to-end: useScanLookup body swap completes the lookup hook layer for
# the scan → query → banner feedback loop. Banner widening to 4 states is Plan 65-06; banner
# callsite + match-effect wiring is Plan 65-07. LOOK-01 data-layer guards (D-06/07/08) are
# already inlined in itemsApi.lookupByBarcode per Plan 65-02.

# Metrics
duration: 8min
completed: 2026-04-19
---

# Phase 65 Plan 04: useScanLookup Body Swap + updateScanHistory Race Guard Summary

**useScanLookup(code) rewired from Phase 64 stub to real TanStack Query against itemsApi.lookupByBarcode (D-09) with staleTime 30s / gcTime 5min / workspaceId-gated enabled — ScanLookupResult shape locked by Phase 64 D-18 stays byte-for-byte identical — alongside a new updateScanHistory module function + useScanHistory.update method with D-22 noop-if-missing race-guard semantics (referentially-stable via useCallback empty-deps, explicit contract for Plan 65-07 match-effect deps).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-19T12:40:00Z
- **Completed:** 2026-04-19T12:48:00Z
- **Tasks:** 3 / 3 (all TDD with separate RED + GREEN commits — 6 commits total)
- **Files modified:** 7 (3 production + 4 test)
- **Files created:** 0

## Accomplishments

- `useScanLookup(code)` body replaced with real `useQuery({ queryKey: scanKeys.lookup(code ?? ""), queryFn: () => itemsApi.lookupByBarcode(workspaceId!, code!), enabled: !!code && !!workspaceId, staleTime: 30_000, gcTime: 300_000 })`. Return shape (status / match / error / refetch) preserved exactly per Phase 64 D-18. Explicit status mapping (if-else over query.isPending / query.isError) enforces the D-18 exhaustive union — the idle branch fires when either code or workspaceId is missing, preventing TanStack's internal `isPending: true when disabled` from leaking as `loading`.
- `ScanPage.test.tsx` Test 15 (the Phase 64 callsite-lock gate) stays green — verified by running the full `src/features/scan/__tests__/ScanPage.test.tsx` file (15/15 green). The exact assertion text: `expect(useScanLookupSpy).toHaveBeenCalledWith(null)` pre-decode + `expect(useScanLookupSpy).toHaveBeenCalledWith("ABC-123")` post-decode (Plan 65-04 does NOT touch ScanPage.tsx — that wiring lives in Plan 65-07).
- `updateScanHistory(code, patch)` module function added to `lib/scanner/scan-history.ts` with D-22 noop-if-missing race guard: if no entry with `code` exists in the stored history, the function returns without writing to localStorage. Only `entityType / entityId / entityName` are mutable via this API — code/format/timestamp are immutable.
- `useScanHistory` hook widened: new `update` method between `add` and `remove`, wrapped in `useCallback(..., [])` with empty deps for referential-identity stability. Returned object now exposes `{ entries, add, update, remove, clear }` (order: `update` between `add` and `remove`).
- Test coverage expansion: 8 real it() in useScanLookup.test.ts (was 5, 1 preserved + 7 new); 18 real it() in scan-history.test.ts (was 15, +3 for updateScanHistory); 11 real it() in useScanHistory.test.ts (was 6, +5 for .update). Total new it() cases: 3 new + 3 new + 5 new = 11 new real behavioral cases landing on green (7 useScanLookup were strictly new; the other came from preserving the Phase 64 type-gate test).
- Full scan-feature test file (`src/features/scan/**`) green: 49/49. Full scanner module tests (`src/lib/scanner/**`) green: 31/31.
- No bundle-delta risk: useScanLookup body stays ~1.3 kB of TS pre-gzip (staleTime/gcTime are compile-time literals); scan-history gains ~0.5 kB for updateScanHistory; useScanHistory gains ~0.25 kB for the update wrapper. Total delta on the scan chunk ≤ 0.3 kB gzip (well under Phase 65 Plan 08 bundle gate thresholds).

## Task Commits

Each task ran TDD RED → GREEN (Task 1 + Task 2 + Task 3 = 6 commits total):

1. **Task 1 RED: Rewrite useScanLookup.test.ts for real Query behavior** — `9112ee9` (test)
2. **Task 1 GREEN: Swap useScanLookup body to real TanStack Query** — `b76a2f8` (feat)
3. **Task 2 RED: Add failing direct tests for updateScanHistory** — `5ba1669` (test)
4. **Task 2 GREEN: Add updateScanHistory with noop-if-missing D-22 race guard** — `0c16345` (feat)
5. **Task 3 RED: Add failing tests for useScanHistory.update D-22 race guard** — `664b19b` (test)
6. **Task 3 GREEN: Expose useScanHistory.update (useCallback-wrapped)** — `7998937` (feat)

_Note: No REFACTOR commits needed — GREEN implementations were minimal and clean. No pre-commit hooks fired (repo has none)._

## Files Created/Modified

### Modified (7)

**Production (3):**

- `frontend2/src/features/scan/hooks/useScanLookup.ts` — stub (13 lines, always-idle) replaced with real query body (44 lines including header doc comment). Imports: `useQuery` from `@tanstack/react-query`, `itemsApi` from `@/lib/api/items`, `scanKeys` + `type ScanLookupResult` from `@/lib/api/scan`, `useAuth` from `@/features/auth/AuthContext`.
- `frontend2/src/lib/scanner/scan-history.ts` — +27 lines: `updateScanHistory(code, patch)` inserted between `removeFromScanHistory` and `clearScanHistory`. JSDoc documents D-22 noop-if-missing race guard explicitly; inline comment `// D-22 race guard: noop-if-missing` at the early-return site.
- `frontend2/src/lib/scanner/index.ts` — +1 line: `updateScanHistory,` in the history barrel between `addToScanHistory,` and `createHistoryEntry,`.
- `frontend2/src/features/scan/hooks/useScanHistory.ts` — imports widened (1 new import); +11 lines for the `update` useCallback between `add` and `remove`; return object widened from `{ entries, add, clear, remove }` to `{ entries, add, update, remove, clear }`. The useCallback deps array is explicitly `[]` — module-scope `updateScanHistory` is a stable reference by construction, matching the existing add/remove/clear pattern.

**Tests (4 total — 3 modified):**

- `frontend2/src/features/scan/hooks/__tests__/useScanLookup.test.ts` — 50-line Phase 64 stub test rewritten. Preserved: "ScanLookupStatus accepts all four states (D-18 full enum landed)" compile-time gate (moved to a top-level describe). New: 7 behavioral cases using `renderHookWithQueryClient` from `@/test-utils-query` and `vi.spyOn(itemsApi, "lookupByBarcode")`. The module-level `vi.mock("@/features/auth/AuthContext", () => ({ useAuth: vi.fn(...) }))` + `vi.mocked(useAuth).mockReturnValue(...)` in Test 3 worked cleanly — no module-level factory re-mock or beforeEach-import hack needed (see Decisions Made below).
- `frontend2/src/lib/scanner/__tests__/scan-history.test.ts` — new describe `"updateScanHistory (D-22 race guard)"` block appended at the end of the existing top-level describe. Three cases: happy path (merges patch, preserves code/format/timestamp), noop-if-missing (unknown code → no setItem, history unchanged), isolation (other entries byte-for-byte unchanged). Reuses the existing `makeFakeStorage() + vi.stubGlobal("localStorage", ...) + vi.resetModules()` harness verbatim — no new mocking style introduced.
- `frontend2/src/features/scan/hooks/__tests__/useScanHistory.test.ts` — `updateScanHistoryMock` added to the `vi.mock("@/lib/scanner", ...)` factory; `beforeEach` resets the new mock; new top-level describe `"useScanHistory.update (D-22)"` with 5 cases (happy, noop-if-missing, never-calls-addToScanHistory, typeof function, referential stability via useCallback).

## Decisions Made

- **`vi.mocked(useAuth)` worked without elaborate factory mock.** The plan called this out as a tooling detail relevant to Plans 65-05/07. Confirmed: the factory form `vi.mock("@/features/auth/AuthContext", () => ({ useAuth: vi.fn(() => ({ workspaceId: "ws-1" })) }))` combined with `vi.mocked(useAuth).mockReturnValue(...)` inside a beforeEach (to reset to the happy path) + Test 3's explicit `vi.mocked(useAuth).mockReturnValue({ workspaceId: null })` is sufficient. AuthContext.tsx exports `useAuth` as a named const (line 31: `export function useAuth(): AuthContextValue { ... }`), which `vi.mocked` handles directly. No need for the fallback `vi.importActual` + module-level re-wrap.
- **Explicit status-mapping if-else vs deriving from query.status.** TanStack Query v5 reports `query.isPending: true` even when `enabled: false` (because no data has loaded). A naive `status: query.status` would conflate idle (disabled) with loading (fetching), violating D-18's exhaustive union contract. The explicit `if (!code || !workspaceId) status = "idle"` gate fires first, preventing this leak. Verified by Test 2 (null code → idle, no fetch) and Test 3 (no workspaceId → idle, no fetch).
- **useCallback empty-deps on update is a consumer-visible contract, not cosmetic.** Plan 65-07 Task 2's match-effect will do `useEffect(() => { ... history.update(match.barcode, {...}) ... }, [match, history.update])`. If `history.update` changes identity every render, the effect fires every render — which for post-lookup backfill would mean a write storm. Wrapping in `useCallback(fn, [])` guarantees identity stability; the empty deps array is correct because `updateScanHistory` (the imported module function) is referentially stable. Test 5 (`expect(secondRef).toBe(firstRef)` after rerender) locks this contract at the test layer.
- **No pre-commit hook bypass needed.** Repo has no `.git/hooks/pre-commit` — normal `git commit` succeeded for all 6 commits. Parallel executor 65-05 interleaved commits `a7286b1` (feat) and `ab27f26` (test) between my Task 2 GREEN and Task 3 RED — no conflicts because 65-05 only touched `frontend2/src/features/items/**` and I only touched `frontend2/src/features/scan/**` + `frontend2/src/lib/scanner/**`.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1/2/3 auto-fixes needed; no Rule 4 architectural escalations.

All three tasks followed the TDD RED → GREEN cycle cleanly. Both acceptance grep-count assertions and behavioral test assertions passed on the first GREEN run of each task. The plan's explicit callout about `vi.mocked(useAuth)` tooling uncertainty resolved favorably (simple factory form worked) — recorded under Decisions Made for Plans 65-05/07 reference.

## Issues Encountered

- **Parallel executor Plan 65-05 interleaved commits into git history.** Between my Task 2 GREEN commit (`0c16345`) and Task 3 RED commit (`664b19b`), Plan 65-05's executor landed `a7286b1` (refactor: wrap ItemForm in FormProvider + BRAND field) and `ab27f26` (test: UpcSuggestionBanner). This is expected under sequential-on-main orchestration; all commits linearize cleanly because 65-05's scope (`frontend2/src/features/items/**`) has zero overlap with my scope (`frontend2/src/features/scan/**` + `frontend2/src/lib/scanner/**`). No resolution needed.
- **Full `bunx tsc -b --noEmit` shows one transient error during parallel execution.** The error `src/features/items/forms/ItemForm.tsx(2,19): error TS6133: 'FormProvider' is declared but its value is never read.` is from Plan 65-05's in-progress transient state (65-05 committed the import but hasn't yet committed the consumer render). Not my scope — 65-05's own Task completes this. Verified: `bunx tsc -b --noEmit 2>&1 | grep -v "ItemForm"` produces zero output, i.e., my files typecheck clean.
- **Full `bunx vitest run` shows one transient failure: `UpcSuggestionBanner.test.tsx` → `Failed to resolve import "../UpcSuggestionBanner"`.** Same parallel-executor transient — 65-05 committed the test file but hasn't yet committed the component. Not my scope. My test files (useScanLookup.test.ts 8/8, scan-history.test.ts 18/18, useScanHistory.test.ts 11/11) all green. Full `src/features/scan` (49/49) and `src/lib/scanner` (31/31) suites green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 65-05 ready** (already executing in parallel): `ItemForm` + `UpcSuggestionBanner` + `ItemFormPage` changes are strictly in `frontend2/src/features/items/**`; no overlap with this plan's scope. Their transient typecheck/test failures will resolve as 65-05's own tasks complete.
- **Plan 65-06 ready:** `ScanResultBanner` widening to 4 states can now consume a real `ScanLookupResult` from `useScanLookup` — status will actually transition through loading → success → error instead of always-idle. All four banner variants have real hook state to render against.
- **Plan 65-07 ready:** (1) `/items/new` route registration can proceed; (2) ScanPage match-effect `useEffect(() => history.update(match.barcode ?? code, { entityType: "item", entityId: match.id, entityName: match.name }), [match, history.update])` has its API surface landed — `useScanHistory.update` exists with useCallback-stable identity (Test 5 locks this), so the match-effect's `[history.update]` dep is safe; (3) `lookup.match` from `useScanLookup(banner?.code ?? null)` will now resolve to real Items from the backend, unblocking Test 16/17/18 in ScanPage.test.tsx.
- **Cumulative test coverage:** Phase 65 Wave 2 hook layer complete. useScanLookup.test.ts (+3 net new real), scan-history.test.ts (+3 net new real), useScanHistory.test.ts (+5 net new real). The 5 useScanLookup preserved cases (from Phase 64 stub tests) were replaced by 7 stronger behavioral cases, so the net content upgrade is +7-5=+2 on useScanLookup + 3 scan-history + 5 useScanHistory = 10 net new behavioral assertions of scan-lookup and history-backfill integrity.

## Self-Check: PASSED

Verified all claims:

- [x] `rg "^import \{ useQuery \} from \"@tanstack/react-query\";" frontend2/src/features/scan/hooks/useScanLookup.ts` returns 1.
- [x] `rg "itemsApi\\.lookupByBarcode\\(workspaceId!, code!\\)" frontend2/src/features/scan/hooks/useScanLookup.ts` returns 1.
- [x] `rg "enabled: !!code && !!workspaceId" frontend2/src/features/scan/hooks/useScanLookup.ts` returns 1.
- [x] `rg "staleTime: 30_000" frontend2/src/features/scan/hooks/useScanLookup.ts` returns 1.
- [x] `rg "gcTime: 300_000" frontend2/src/features/scan/hooks/useScanLookup.ts` returns 1.
- [x] `rg "query\\.isPending" frontend2/src/features/scan/hooks/useScanLookup.ts` returns 1.
- [x] `rg "^export function updateScanHistory\\(" frontend2/src/lib/scanner/scan-history.ts` returns 1.
- [x] `rg "D-22 race guard: noop-if-missing" frontend2/src/lib/scanner/scan-history.ts` returns 1.
- [x] `rg "^\\s*updateScanHistory," frontend2/src/lib/scanner/index.ts` returns 1.
- [x] `rg "^\\s*updateScanHistory," frontend2/src/features/scan/hooks/useScanHistory.ts` returns 1.
- [x] `rg "const update = useCallback\\(" frontend2/src/features/scan/hooks/useScanHistory.ts` returns 1.
- [x] `rg "return \\{ entries, add, update, remove, clear \\};" frontend2/src/features/scan/hooks/useScanHistory.ts` returns 1.
- [x] Commits `9112ee9`, `b76a2f8`, `5ba1669`, `0c16345`, `664b19b`, `7998937` all exist in `git log --oneline`.
- [x] `bunx vitest run src/features/scan/hooks/__tests__/useScanLookup.test.ts` — 8/8 green.
- [x] `bunx vitest run src/lib/scanner/__tests__/scan-history.test.ts` — 18/18 green (15 pre-existing + 3 new).
- [x] `bunx vitest run src/features/scan/hooks/__tests__/useScanHistory.test.ts` — 11/11 green (6 pre-existing + 5 new).
- [x] `bunx vitest run src/features/scan/__tests__/ScanPage.test.tsx` — 15/15 green (Test 15 callsite-lock gate stays green).
- [x] `bunx vitest run src/features/scan` — 49/49 green (no regression in scan feature).
- [x] `bunx vitest run src/lib/scanner` — 31/31 green (no regression in scanner module).
- [x] `bunx tsc -b --noEmit` clean for my files (`grep -v "ItemForm"` produces zero errors; the single ItemForm.tsx TS6133 is Plan 65-05's parallel-execution transient state).
- [x] `bun run lint:imports` — PASS.
- [x] ScanPage Test 15 exact assertion text confirmed: `ScanPage invokes useScanLookup(null) pre-decode and useScanLookup(code) post-decode` (at line 377 of ScanPage.test.tsx).
- [x] `vi.mocked(useAuth)` pattern worked without needing a module-level factory re-mock — recorded for Plan 65-05/07 reference.
- [x] Count of real it() now green per file: useScanLookup.test.ts = 8; scan-history.test.ts = 18 (15 preserved + 3 new); useScanHistory.test.ts = 11 (6 preserved + 5 new).
- [x] useScanHistory.update confirmed `useCallback(..., [])` with empty deps — explicit contract for Plan 65-07 Task 2 match-effect deps array (see Decisions Made above + Test 5 in useScanHistory.test.ts).

---

*Phase: 65-item-lookup-and-not-found-flow*
*Plan: 04*
*Completed: 2026-04-19*
