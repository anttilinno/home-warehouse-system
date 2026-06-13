---
phase: 09-borrowers
plan: 01
subsystem: api
tags: [react, react-query, zod, msw, borrowers, vitest]

# Dependency graph
requires:
  - phase: 08-loans
    provides: "loansApi / useLoanMutations / loanHandlers parity patterns (bare {items} envelope, prefix invalidate, per-test server.use MSW)"
provides:
  - "borrowersApi (list/search/get/create/update/del) with workspace-scoped URLs + bare {items} typing"
  - "borrowerFormSchema (zod) — name-required, email-when-supplied, optional defaults ''"
  - "useBorrowersQuery — single limit=100 fetch + client paginate (25) + name/email search"
  - "useBorrowerMutations — create/update/del, prefix-invalidate, 400 active-loans map"
  - "borrowerHandlers (MSW) — bare {items} list + per-id routes + documented 400-delete override"
affects: [09-02 borrowers list/form pages, 09-03 borrower detail + delete guard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bare {items} list envelope as a TYPE (reading .total is a compile error) — mirrors loansApi"
    - "limit clamp Math.min(limit, 100) inside the api module (422-cap defense)"
    - "Fetch-once-then-client-paginate/search list hook (no /search call from list page)"
    - "PREFIX query-key invalidation [\"borrowers\", wsId] (no exact:true)"
    - "HttpError.status === 400 reactive backstop → specific active-loans toast"

key-files:
  created:
    - frontend2/src/lib/api/borrowers.ts
    - frontend2/src/lib/api/borrowers.test.ts
    - frontend2/src/features/borrowers/schema.ts
    - frontend2/src/features/borrowers/schema.test.ts
    - frontend2/src/features/borrowers/hooks/useBorrowersQuery.ts
    - frontend2/src/features/borrowers/hooks/useBorrowerMutations.ts
    - frontend2/src/test/msw/borrowerHandlers.ts
  modified: []

key-decisions:
  - "Toast copy taken from 09-UI-SPEC §Toasts (authoritative) over RESEARCH draft copy: 'Borrower created./updated./deleted.', 'Couldn't save this borrower.', 'Couldn't delete — this borrower has active loans.'"
  - "limit clamp lives inside borrowersApi (Math.min(limit,100)) so every caller is 422-safe, not just the hook"
  - "useBorrowersQuery client-searches name+email; never calls /borrowers/search (binding override #2)"

patterns-established:
  - "borrowersApi mirrors loansApi: bare {items} for list/search, decorated entity for single routes"
  - "MSW route order search → :id → bare list (specific-before-catch-all); handlers added per-test via server.use"

requirements-completed: [BORR-01, BORR-02, BORR-04, BORR-05]

# Metrics
duration: 12min
completed: 2026-06-13
---

# Phase 9 Plan 01: Borrowers Foundation Summary

**Built the Phase 9 borrower contract layer — typed workspace-scoped `borrowersApi`, the zod form schema, the fetch-once/client-paginate list hook, the create/update/delete mutation hook with 400 active-loans mapping, and the MSW handler set — so the 09-02/09-03 UI plans have a typed backend and a mock to test against.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3 of 3
- **Files created:** 7
- **Files modified:** 0

## Accomplishments

- **Task 1 (TDD):** `borrowersApi` with list/search/get/create/update/del. list/search return the BARE `{ items }` envelope (no `total` — Pitfall 1, making `.total` a type error); limit clamped to 100 inside the module (Pitfall 2 — 422 over cap). 10 unit tests assert exact URL/verb per method + the bare envelope. RED (module missing) → GREEN (10 passed).
- **Task 2 (TDD):** `borrowerFormSchema` (zod) — `name` trim/required(1)/max(255) with "Name is required."; `email` validated only-when-supplied with "Enter a valid email address."; `phone`/`notes`/`email` default `""` for omit-empty-on-submit. 10 tests covering name/email/defaults. RED → GREEN (10 passed). Messages match 09-UI-SPEC §Form validation.
- **Task 3:** Three hooks/handlers, all mirroring shipped analogs:
  - `useBorrowersQuery(search)` — single `limit=100` fetch keyed `["borrowers", wsId, {limit,page:1}]`, `enabled:!!wsId`, `retry:false`; client paginate (`BORROWERS_PER_PAGE=25`) + client name/email search; returns `{all,isLoading,isError,page,pageCount,rows}`. Out-of-scope >100 note included.
  - `useBorrowerMutations()` — create/update/del; PREFIX invalidate `["borrowers", wsId]` (no exact); del.onError maps `HttpError && status===400` → "Couldn't delete — this borrower has active loans." else generic. Toasts via lingui `t`.
  - `borrowerHandlers` (MSW) — bare `{items}` list, search→:id→list route order, 204 delete, documented per-test 400-delete override snippet for the BORR-05 guard test in 09-03.

## Deviations from Plan

### Adjustments (not auto-fixes)

1. **[Spec-precedence] Toast copy uses 09-UI-SPEC, not RESEARCH draft.** RESEARCH Code Examples drafted "Borrower saved." / "Can't delete — this borrower has active loans." / "Couldn't create this borrower." The plan's binding overrides (#3, #7) and 09-UI-SPEC §Toasts (lines 390-396) are authoritative: created/**updated**/deleted, `Couldn't save this borrower.` for both create+update failure, and `Couldn't delete — this borrower has active loans.` for the 400. Implemented the UI-SPEC copy. No functional impact — copy-only.

No bugs (Rule 1), missing-critical (Rule 2), blocking (Rule 3), or architectural (Rule 4) deviations.

## Known Stubs

None. No UI ships in this plan; every export is wired to the real api module or a typed mock.

## Threat Flags

None. All `borrowersApi` URLs are workspace-scoped `/workspaces/{wsId}/borrowers` with `wsId` from `useWorkspace` (T-09-01 mitigated); email validated client-side, backend authoritative (T-09-02); zero new packages (T-09-SC N/A).

## Verification

- `bun run test borrowers.test --run` → 10 passed (api URLs + bare envelope)
- `bun run test borrowers/schema --run` → 10 passed (validation)
- Required gate `bun run lint:tsc` → exit 0 (whole project, no borrower type errors)
- Required gate `bun run test src/lib/api/borrowers.test.ts src/features/borrowers/` → 2 files, 20 passed
- `borrowerHandlers` exported and compiles in the tsc build

## Self-Check: PASSED

All 7 created files exist on disk; all 3 task commits present on `exec/09-01`.
