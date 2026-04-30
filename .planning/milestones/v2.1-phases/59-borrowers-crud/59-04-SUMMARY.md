---
phase: 59-borrowers-crud
plan: 04
subsystem: frontend
tags: [frontend, borrower, pages, routes, i18n, ui-checkpoint]

# Dependency graph
requires:
  - phase: 59-01
    provides: backend archive/restore/delete endpoints + 400 on active-loans guard
  - phase: 59-02
    provides: borrowersApi, icons (Plus/Pencil/Archive/Undo2/Trash2/ArrowLeft), makeBorrower fixture
  - phase: 59-03
    provides: useBorrowersList, useBorrower, 5 mutation hooks, BorrowerPanel, BorrowerArchiveDeleteFlow
  - phase: 57-retro-form-primitives
    provides: RetroPanel, RetroButton, RetroEmptyState, RetroCheckbox, RetroBadge, RetroTable, HazardStripe
  - phase: 58-taxonomy
    provides: ContainersTab reference for list-page shape, taxonomy fixtures re-export
provides:
  - BorrowersListPage route component for /borrowers
  - BorrowerDetailPage route component for /borrowers/:id
  - Two new Route declarations under AppShell
  - ~24 new Lingui msgids extracted in en + et catalogs
affects: [62-loans (real loan data replaces empty-state sections on detail page), 63-navigation-polish (Borrowers sidebar link)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route-level page component consuming hooks + slide-over panel + archive/delete flow refs (mirrors ContainersTab but page-level instead of tab)"
    - "Em-dash for absent contact fields via conditional render in both table cell and detail <dl>"
    - "Font-sans override on Link name cell inside RetroTable (table cells default font-mono)"

key-files:
  created:
    - frontend2/src/features/borrowers/BorrowersListPage.tsx
    - frontend2/src/features/borrowers/BorrowerDetailPage.tsx
    - frontend2/src/features/borrowers/__tests__/BorrowersListPage.test.tsx
    - frontend2/src/features/borrowers/__tests__/BorrowerDetailPage.test.tsx
  modified:
    - frontend2/src/routes/index.tsx
    - frontend2/locales/en/messages.po
    - frontend2/locales/et/messages.po

key-decisions:
  - "Delete button on archived row opens the SAME archive-first flow (per UI-SPEC: user navigates to 'delete permanently' link); no second ref/flow introduced"
  - "Link uses plain inline style instead of a RetroButton — avoids button-inside-button semantics; styled as a table cell with amber focus on Tab"
  - "RetroEmptyState for both NO ACTIVE LOANS and NO LOAN HISTORY sections — no loansApi import (D-04 defers to Phase 62)"
  - "Detail not-found state uses inline RetroPanel with HazardStripe (no showHazardStripe prop) — matches the prior taxonomy 'not-found' pattern"
  - "Tests use vi.mock('@/features/auth/AuthContext') top-level (mirrors BorrowerPanel.test.tsx) so hooks see a workspaceId without needing TestAuthContext plumbing"

patterns-established:
  - "Route-level CRUD page with table + slide-over panel + archive-delete flow, three refs (panelRef, archiveFlowRef) + two state fields (showArchived, archiveTarget) — reusable template for items/loans route pages"
  - "Detail page with dl > dt/dd grid + em-dash for missing values — reusable for items/containers detail pages"

requirements-completed: [BORR-01, BORR-02, BORR-03, BORR-04, BORR-05]

# Metrics
duration: ~8 min
completed: 2026-04-16
---

# Phase 59 Plan 04: Borrower List + Detail Pages + Routing + i18n Summary

**Route-level borrower UX shipped: /borrowers list page with archived toggle + row actions, /borrowers/:id detail page with contact block + empty loan sections, 10 new integration tests, 2 new routes under AppShell, Lingui en + et catalogs extended with ~24 phase-59 msgids. Awaiting human verification for Task 4.**

## Performance

- **Started:** 2026-04-16T12:49:00Z (approx)
- **Task 3 completed:** 2026-04-16T12:52:36Z
- **Tasks:** 3 / 4 complete (Task 4 human-verify checkpoint pending)
- **Files created:** 4
- **Files modified:** 3

## Accomplishments

**Task 1 — BorrowersListPage (commit `330ee52`)**
- Page layout: header with `BORROWERS` + `+ NEW BORROWER` button; `Show archived (N)` checkbox; RetroTable with NAME/EMAIL/PHONE/ACTIONS columns
- Name cell is `<Link to={`/borrowers/${b.id}`}>` with `font-sans` override (RetroTable cells default font-mono)
- Absent email/phone render `—` in `text-retro-gray`
- Archived rows (visible only with toggle on): `line-through text-retro-gray` styling + ARCHIVED badge; RESTORE + DELETE action buttons (RESTORE fires mutation immediately, DELETE opens archive-first dialog)
- Active rows: EDIT + ARCHIVE action buttons
- Loading / error / empty states: RetroPanel with Loading…, RetroPanel with HazardStripe + Retry, RetroEmptyState "NO BORROWERS YET" with primary action
- Panel + flow refs wired: `+ NEW BORROWER` → `panelRef.current?.open("create")`; EDIT → `open("edit", b)`; ARCHIVE → `setArchiveTarget(b) + archiveFlowRef.current?.open()`
- 7 integration tests: populated, empty, error+Retry, new-panel-open, archived-toggle+RESTORE+DELETE actions, edit-panel-prefill, archive-dialog-open

**Task 2 — BorrowerDetailPage (commit `0406651`)**
- useParams `:id` → useBorrower(id); loading state with RetroPanel; not-found state with HazardStripe + BACK TO BORROWERS link
- Populated: back link `← BORROWERS`, amber left-rail heading with name + ARCHIVED badge, RetroPanel with CONTACT dl (EMAIL/PHONE/NOTES rows; em-dash for missing), two sections (ACTIVE LOANS + LOAN HISTORY) each with RetroEmptyState
- No imports from `@/lib/api/loans` — D-04 honoured (loan data deferred to Phase 62)
- 3 integration tests: populated-with-em-dash, not-found-404, loading

**Task 3 — Routes + Lingui extract (commit `8614429`)**
- `routes/index.tsx`: imports for both pages; two `<Route>` children immediately after `<Route index>` (borrowers, borrowers/:id)
- Lingui extract: 304 total en msgids (+ ~24 phase-59 keys like BORROWERS, NEW BORROWER, EDIT BORROWER, ARCHIVE BORROWER, DELETE BORROWER, CONFIRM ARCHIVE, CONFIRM DELETE, HIDES FROM LOAN PICKERS, NO BORROWERS YET, NO ACTIVE LOANS, NO LOAN HISTORY, BORROWER NOT FOUND, BACK TO BORROWERS, CONTACT, ACTIVE LOANS, LOAN HISTORY, Show archived, Loan data will be available soon., Loan history will appear here once loans are wired., Cannot delete: this borrower has active loans., etc.)
- 304 et msgids with empty `msgstr ""` for Phase 63 or user-driven translation
- Full test suite: 305/305 pass (was 295); lint:imports OK; i18n:compile OK; build OK

## Test Counts

| File | it() blocks | Status |
|------|-------------|--------|
| BorrowersListPage.test.tsx | 7 | all pass |
| BorrowerDetailPage.test.tsx | 3 | all pass |
| **Total new** | **10** | **10/10 pass** |
| Full frontend2 suite | — | **305/305 pass (was 295)** |

## Decisions Made

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Delete on archived row opens the archive-first flow | UI-SPEC explicitly routes "delete" through the secondary "delete permanently" link in the archive dialog; avoids a second ref/flow | Single `BorrowerArchiveDeleteFlow` ref covers both archive and archived-row delete |
| Plain `<button>` with retro classes for row actions (not RetroButton) | Matches `ContainersTab` pattern exactly; avoids button-inside-button a11y issues when stacked in cells | Tab navigation + 44x44 min-size targets preserved |
| Name cell as `<Link>` with `font-sans` override | RetroTable cells default to `font-mono`; the name is proper-case text, not mono data — sans-serif matches the taxonomy TreeNode pattern | Visually consistent across CRUD pages |
| Not-found state uses inline RetroPanel | RetroPanel has `showHazardStripe` prop but the legacy "not-found" pattern uses a manual `<HazardStripe />` inside — matches existing NotFoundPage | Consistency with route-level 404 treatment |
| Test auth mock top-level (vi.mock) | BorrowerPanel and mutation hooks call real `useAuth` not `useContext(TestAuthContext)` | Tests exercise the real hook wiring path; no false positives |
| No loansApi imports on detail page | D-04 explicitly defers loan data to Phase 62; empty-state sections advertise "Loan data will be available soon." | Clean phase boundary; Phase 62 can inject `<ActiveLoansSection borrowerId={id} />` in a single diff |
| Em-dash for missing values | Matches category/location detail patterns and the UI-SPEC "Contact metadata" acceptance clause | Consistent visual language for absent fields |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tightened NEW BORROWER assertion to role=heading**
- **Found during:** Task 1 test run (first GREEN iteration)
- **Issue:** `screen.findByText(/NEW BORROWER/i)` matched BOTH the `+ NEW BORROWER` button AND the slide-over panel heading `NEW BORROWER` — TestingLibraryElementError "multiple elements found"
- **Fix:** Changed the assertion to `screen.findByRole("heading", { name: /NEW BORROWER/i })` to specifically target the slide-over `<h2>` title
- **Files modified:** `BorrowersListPage.test.tsx`
- **Commit:** rolled into Task 1 commit `330ee52`

### Deferred Issues

None. Single test assertion adjustment was fixed inline before committing.

## Verification Summary

- `cd frontend2 && bun run test -- --run src/features/borrowers/__tests__/BorrowersListPage.test.tsx` → **7/7 pass**
- `cd frontend2 && bun run test -- --run src/features/borrowers/__tests__/BorrowerDetailPage.test.tsx` → **3/3 pass**
- `cd frontend2 && bun run test` → **305/305 pass** (52 test files, no regressions — was 295/295 before this plan)
- `cd frontend2 && bun run build` → passes (`tsc -b` + `vite build` clean, 550.22 kB bundle)
- `cd frontend2 && bun run lint:imports` → passes (no forbidden idb/serwist/offline/sync imports)
- `cd frontend2 && bun run i18n:compile` → passes (304 en msgids compiled)

## Acceptance Criteria Results

**Task 1** — all grep checks pass:
- `BorrowersListPage.tsx` exists; exports `BorrowersListPage` ✓
- Contains `<RetroTable columns={columns} data={rows} />` ✓
- Contains `to={`/borrowers/${b.id}`}` ✓
- Contains `useBorrowersList(showArchived)` ✓
- Contains `aria-label={t`Edit ${b.name}`}`, `Archive`, `Restore`, `Delete` forms ✓
- Contains `t`NO BORROWERS YET`` ✓
- Contains `t`+ NEW BORROWER`` ✓
- Contains `font-sans` on name cell ✓
- `BorrowersListPage.test.tsx` has 7 `it(` blocks (≥7) ✓
- Tests pass, build exits 0 ✓

**Task 2** — all grep checks pass:
- `BorrowerDetailPage.tsx` exists; exports `BorrowerDetailPage` ✓
- Contains `useParams<{ id: string }>` ✓
- Contains `useBorrower(id)` ✓
- Contains `t`ACTIVE LOANS`` and `t`LOAN HISTORY`` ✓
- Contains `t`Loan data will be available soon.`` ✓
- NO import from `@/lib/api/loans` (grep exit 1) ✓
- NO `loansApi` or `loanKeys` references ✓
- Contains back-link path `to="/borrowers"` ✓
- `BorrowerDetailPage.test.tsx` has 3 `it(` blocks (≥3) ✓
- Tests pass, build exits 0 ✓

**Task 3** — all grep checks pass:
- `routes/index.tsx` contains `import { BorrowersListPage }` ✓
- `routes/index.tsx` contains `import { BorrowerDetailPage }` ✓
- `routes/index.tsx` contains `<Route path="borrowers" element={<BorrowersListPage />} />` ✓
- `routes/index.tsx` contains `<Route path="borrowers/:id" element={<BorrowerDetailPage />} />` ✓
- `locales/en/messages.po` contains `msgid "BORROWERS"` ✓
- Contains `NEW BORROWER`, `ARCHIVE BORROWER`, `DELETE BORROWER`, `NO BORROWERS YET`, `HIDES FROM LOAN PICKERS`, `BORROWER NOT FOUND`, `BACK TO BORROWERS`, `ACTIVE LOANS`, `LOAN HISTORY` ✓
- `locales/et/messages.po` contains all same msgids (304 total paired) ✓
- `bun run build` exits 0 ✓
- `bun run test` exits 0 (305/305) ✓
- `bun run lint:imports` exits 0 ✓

**Task 4** — pending human-verify checkpoint

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | `330ee52` | feat(59-04): add BorrowersListPage with table, archived toggle, row actions |
| 2 | `0406651` | feat(59-04): add BorrowerDetailPage with contact block and empty loan sections |
| 3 | `8614429` | feat(59-04): wire /borrowers + /borrowers/:id routes and extract Lingui catalogs |

## TDD Gate Compliance

Plan frontmatter declares `type: execute`, so plan-level RED/GREEN gating does not apply. Task-level TDD applied to Tasks 1 and 2 (both marked `tdd="true"`):
- **Task 1:** Test file written first; run → RED (module resolution failure); component created → GREEN (7/7 pass after one assertion tightening)
- **Task 2:** Test file written first; run → RED (module resolution failure); component created → GREEN (3/3 pass on first run)
- **Task 3:** Grep + build based verification; no separate test file required (existing suite exercises route composition transitively)

## Threat Flags

None. All new surface was covered by the plan's `<threat_model>`:
- T-59-20 (XSS on borrower name in list/detail) — React default escape; no `dangerouslySetInnerHTML`
- T-59-21 (UUID in URL) — accepted per plan, workspace scoping on backend
- T-59-22 (cross-workspace authorization) — useBorrower query returns 404 for cross-workspace IDs → BORROWER NOT FOUND state
- T-59-23 (CSRF on archive/restore/delete) — existing HttpOnly + SameSite cookies; auth middleware on backend
- T-59-24 (DoS via rapid toggle) — TanStack Query dedupes; at most 2 inflight queries per toggle flip
- T-59-25 (missing i18n keys) — extracted + compiled; all msgids present in both en and et
- T-59-26 (click-jacking on dialogs) — RetroDialog uses native `<dialog>` with `showModal()` pinning to top layer

No additional threat surface introduced.

## Known Stubs

None. All data flows use real hooks / API methods. The two empty-state loan sections on the detail page are intentional placeholders per D-04 — Phase 62 will replace them with real loan queries.

## User Setup Required

None. No new runtime dependencies. Standard `bun install` + `bun run i18n:compile` flow. User can run `bun run dev` to exercise the new routes.

## Next Phase Readiness

- **Phase 62 (Loans):** can replace the two `RetroEmptyState` sections on `BorrowerDetailPage.tsx` with real `useLoansForBorrower(id)` queries + row rendering. No other changes needed to this plan's files.
- **Phase 63 (Navigation & Polish):** can add `<SidebarLink to="/borrowers" icon={Users}>BORROWERS</SidebarLink>` inside AppShell's sidebar; all route wiring is in place.

## Self-Check: PASSED

**Files verified present:**
- `frontend2/src/features/borrowers/BorrowersListPage.tsx` FOUND
- `frontend2/src/features/borrowers/BorrowerDetailPage.tsx` FOUND
- `frontend2/src/features/borrowers/__tests__/BorrowersListPage.test.tsx` FOUND
- `frontend2/src/features/borrowers/__tests__/BorrowerDetailPage.test.tsx` FOUND
- `frontend2/src/routes/index.tsx` contains both new Route children
- `frontend2/locales/en/messages.po` + `frontend2/locales/et/messages.po` contain all phase-59 msgids

**Commits verified in git log:**
- `330ee52` FOUND — feat(59-04): add BorrowersListPage with table, archived toggle, row actions
- `0406651` FOUND — feat(59-04): add BorrowerDetailPage with contact block and empty loan sections
- `8614429` FOUND — feat(59-04): wire /borrowers + /borrowers/:id routes and extract Lingui catalogs

---
*Phase: 59-borrowers-crud*
*Plan: 04*
*Tasks 1-3 complete; Task 4 pending human verification*
*Partial summary written: 2026-04-16*
