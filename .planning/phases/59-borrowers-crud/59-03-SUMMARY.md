---
phase: 59-borrowers-crud
plan: 03
subsystem: frontend
tags: [frontend, borrower, react-query, rhf, zod, slide-over, confirm-dialog]

# Dependency graph
requires:
  - phase: 59-01
    provides: backend archive/restore/delete endpoints + 400 on active-loans guard
  - phase: 59-02
    provides: borrowersApi.archive/restore, borrowerCreateSchema, makeBorrower fixture
  - phase: 57-retro-form-primitives
    provides: RetroFormField, RetroConfirmDialog, ToastProvider
  - phase: 58-taxonomy-categories-locations-containers
    provides: SlideOverPanel (direct reuse), CategoryForm/EntityPanel/ArchiveDeleteFlow (copy-paste references)
provides:
  - useBorrowersList(showArchived) query hook with workspace-gated enabled and archived filter
  - useBorrower(id) detail query hook with enabled gate on id + workspaceId
  - 5 mutation hooks: useCreateBorrower, useUpdateBorrower, useArchiveBorrower, useRestoreBorrower, useDeleteBorrower
  - useDeleteBorrower onError 400 branch with active-loans copy
  - BorrowerForm (RHF + zod) with 4 RetroFormField controls and empty-string coercion
  - BorrowerPanel forwardRef slide-over with create/edit dual-mode
  - BorrowerArchiveDeleteFlow two-stage confirm with 400 short-circuit
affects: [59-04 list/detail pages consume all of the above without further composition work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct reuse of @/features/taxonomy/panel/SlideOverPanel (no copy — single implementation)"
    - "zodResolver wrapper with ''→undefined coercion per optional field (mirrors CategoryForm)"
    - "Static ARCHIVE/DELETE labels (no entityKind discriminator — single-entity flow)"
    - "handleDelete swallows non-400 errors to avoid unhandled rejections from RetroConfirmDialog"

key-files:
  created:
    - frontend2/src/features/borrowers/hooks/useBorrowersList.ts
    - frontend2/src/features/borrowers/hooks/useBorrower.ts
    - frontend2/src/features/borrowers/hooks/useBorrowerMutations.ts
    - frontend2/src/features/borrowers/forms/BorrowerForm.tsx
    - frontend2/src/features/borrowers/panel/BorrowerPanel.tsx
    - frontend2/src/features/borrowers/actions/BorrowerArchiveDeleteFlow.tsx
    - frontend2/src/features/borrowers/__tests__/BorrowerForm.test.tsx
    - frontend2/src/features/borrowers/__tests__/BorrowerPanel.test.tsx
    - frontend2/src/features/borrowers/__tests__/BorrowerArchiveDeleteFlow.test.tsx
  modified: []

key-decisions:
  - "handleDelete swallows non-HTTP errors instead of rethrowing — avoids unhandled promise rejections from RetroConfirmDialog.handleConfirm (which rethrows any onConfirm rejection). Dialog closes on all outcomes; useDeleteBorrower's onError toast conveys failure. Matches taxonomy/ArchiveDeleteFlow."
  - "Generic 'Cannot delete: this borrower has active loans.' copy lives in useDeleteBorrower (no {Name} interpolation) per Plan 59-03 Task 1 NOTE; flow closes dialogs silently on 400 to avoid duplicate toasts"
  - "BorrowerPanel tests mock @/features/auth/AuthContext and @/lib/api/borrowers directly; fixtures pattern follows useCategoryMutations.test.ts"
  - "BorrowerForm test uses fireEvent.change + explicit submit button (matching CategoryForm.test.tsx pattern) rather than form.requestSubmit — HTML5 type=email validation blocks programmatic submit on invalid values, so invalid-email coverage moved to onBlur path"

patterns-established:
  - "Single-entity archive-delete flow: static labels, no discriminator, 400 short-circuit for domain-specific guards (active loans here; could be extended to other backends returning 400-with-reason)"
  - "Dialog design limitation documented: RetroConfirmDialog.handleConfirm rethrows onConfirm errors — if a future entity needs 'stay-open on generic error', either (a) refactor RetroConfirmDialog to swallow-and-signal, or (b) swallow in the handler and lose the retry-open UX"

requirements-completed: [BORR-02, BORR-03, BORR-04]

# Metrics
duration: ~6 min
completed: 2026-04-16
---

# Phase 59 Plan 03: Borrower Forms + Mutation Hooks + Archive-Delete Flow Summary

**Composition layer shipped: 2 query + 5 mutation hooks, the RHF+zod BorrowerForm, the slide-over BorrowerPanel, and the two-stage BorrowerArchiveDeleteFlow — all mirroring Phase 58 taxonomy siblings with the 400-instead-of-409 semantic diff.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-16T09:37:35Z
- **Completed:** 2026-04-16T09:44:22Z
- **Tasks:** 3 / 3 (all autonomous, all TDD where practical)
- **Files created:** 9
- **Files modified:** 0

## Accomplishments

**Task 1 — Hooks (commit `c50fdeb`)**
- `useBorrowersList(showArchived)`: `useQuery` against `borrowersApi.list` with `archived: showArchived ? true : undefined`; enabled gate on workspaceId; returns `{ ...query, items }` with default `[]`
- `useBorrower(id)`: detail `useQuery` on `borrowerKeys.detail(id ?? "")`; enabled gate requires both workspaceId AND id
- 5 mutation hooks copy-pasted from `useContainerMutations.ts` with Container → Borrower rename
- `useDeleteBorrower.onError`: `err instanceof HttpError && err.status === 400` → `t\`Cannot delete: this borrower has active loans.\`` toast (swap of 409 pattern from `useCategoryMutations.ts`)
- All 5 mutations invalidate `borrowerKeys.all` on success (grep count = 5)

**Task 2 — Form + Panel + 9 tests (commit `353e3fb`)**
- `BorrowerForm.tsx`: 4 RetroFormField controls (name required / email type=email / phone type=tel / notes RetroTextarea rows=4); zodResolver wrapper coerces `''` → `undefined` on email/phone/notes pre-parse; submit handler re-coerces before forwarding; `useEffect` fires `onDirtyChange(formState.isDirty)` on dirty transitions
- `BorrowerPanel.tsx`: forwardRef, imperative handle `{ open(mode, borrower?), close() }`; create/edit mode driven by `open()` argument; titles `NEW BORROWER` / `EDIT BORROWER`; submit labels `CREATE BORROWER` / `SAVE BORROWER` / `WORKING…` (pending); uses `useCreateBorrower` + `useUpdateBorrower` mutateAsync; `closeImmediate()` after mutation resolves; `null` borrower fields mapped to `""` for controlled inputs
- `BorrowerForm.test.tsx` — 5 it() blocks: valid submit (optionals undefined), empty-name error, onDirtyChange(true), invalid email (onBlur), defaultValues prefill
- `BorrowerPanel.test.tsx` — 4 it() blocks: create mode blank, edit mode prefill (null→""), create submit calls borrowersApi.create + closes panel, edit submit calls borrowersApi.update with id

**Task 3 — Archive/Delete flow + 6 tests (commit `bce5978`)**
- `BorrowerArchiveDeleteFlow.tsx`: forwardRef with `{ open, close }`; two `RetroConfirmDialog` refs (archive soft + destructive delete); static `ARCHIVE BORROWER` / `DELETE BORROWER` literals (no entityKind — single-entity); `HIDES FROM LOAN PICKERS` headerBadge; `secondaryLink` handoff `setTimeout(..., 0)` from archive → delete dialog; handleDelete: 400 closes both, other errors swallowed (see deviation below)
- `BorrowerArchiveDeleteFlow.test.tsx` — 6 it() blocks: open shows archive dialog with badge, archive success + dialog closes, switch-to-delete, delete success, 400 closes both dialogs, non-HTTP error documented as swallowed

## Test Counts

| File | it() blocks | Status |
|------|-------------|--------|
| BorrowerForm.test.tsx | 5 | ✓ all pass |
| BorrowerPanel.test.tsx | 4 | ✓ all pass |
| BorrowerArchiveDeleteFlow.test.tsx | 6 | ✓ all pass |
| **Total new** | **15** | **15/15 pass** |
| Full frontend2 suite | — | **295/295 pass (was 280)** |

## Decisions Made

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| handleDelete swallows non-400 errors | `RetroConfirmDialog.handleConfirm` rethrows `onConfirm` rejections, creating unhandled promise rejections in production if we rethrow. The hook's `onError` toast already conveys failure; swallowing here matches taxonomy/ArchiveDeleteFlow pattern. | Dialog closes on any outcome; no unhandled rejections; hook toast is the single source of failure UX |
| Use fireEvent instead of user-event in tests | fireEvent matches existing CategoryForm.test.tsx pattern, avoids user-event's pointer-event interception with `<dialog>`/FloatingPortal, and HTML5 type=email validation doesn't block fireEvent.click-driven submits | Tests run fast + stable; invalid-email coverage via onBlur path instead of submit |
| Static ARCHIVE/DELETE literals (no entityKind) | Flow is borrower-only; Lingui CLI extraction needs static strings anyway; dropping the discriminator simplifies the component ~15 lines | Cleaner file; catalog entries are `ARCHIVE BORROWER` and `DELETE BORROWER` explicitly |
| Direct reuse of SlideOverPanel | Zero behavioural divergence from taxonomy panel UX; duplicating would mean two discard-changes-dialogs to maintain | Single source of truth; any future SlideOverPanel tweak propagates |
| form.requestSubmit abandoned in BorrowerForm test | jsdom respects HTML5 required/type=email validation on `form.requestSubmit`; form won't submit with invalid fields, masking zod errors | Adopted fireEvent.change + explicit submit button (CategoryForm pattern); onBlur validation covers invalid-email path |
| useBorrowerMutations hook tests NOT added | Plan acceptance is grep + build, no hook test file in artifacts list; taxonomy has a separate `useCategoryMutations.test.ts` that covers the 409 branch; the 400 branch is covered transitively by BorrowerArchiveDeleteFlow.test.tsx | Coverage maintained via integration; if hook-unit coverage is needed, follow-up can add `useBorrowerMutations.test.ts` mirroring `useCategoryMutations.test.ts` line-for-line |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] handleDelete cannot safely rethrow non-HTTP errors**
- **Found during:** Task 3 test run
- **Issue:** Plan spec said "other errors leave dialog open for retry" — to achieve this I first made handleDelete rethrow non-400 errors (so `RetroConfirmDialog.handleConfirm`'s `await onConfirm()` would propagate the error before `.close()` ran). This caused an **unhandled promise rejection** propagating through the RetroConfirmDialog click handler, which Vitest treats as a test-failure signal even when all assertions pass. The same bug exists in production: a genuine network error on delete would emit an unhandled rejection.
- **Fix:** Swallow non-HTTP errors in handleDelete (matching `taxonomy/ArchiveDeleteFlow.tsx`). Dialog closes on any caught outcome; `useDeleteBorrower.onError` already fires the connection-lost toast. Added inline comment documenting the design limitation. The 5th test case ("non-HTTP error") was adjusted to assert the dialog closes and that no unhandled rejection leaks.
- **Files modified:** `BorrowerArchiveDeleteFlow.tsx`, `BorrowerArchiveDeleteFlow.test.tsx`
- **Commit:** `bce5978`
- **Systemic note:** `RetroConfirmDialog.handleConfirm` should ideally swallow errors from `onConfirm` and expose a `"failed"` state callback for consumers to keep the dialog open. This is a follow-up candidate; out of scope for this plan.

**2. [Rule 3 - Blocking] HTML5 form validation blocks form.requestSubmit in BorrowerForm test**
- **Found during:** Task 2 test run (first iteration)
- **Issue:** Plan action code used `form.requestSubmit()` to trigger submit in the BorrowerForm tests. jsdom honours HTML5 validation constraints on `requestSubmit`, so `type="email"` with `"not-an-email"` simply aborts the submit without invoking React's form handler. The zod "Enter a valid email address." error never surfaces.
- **Fix:** Adopted the existing CategoryForm.test.tsx pattern — render `<BorrowerForm /> <button type="submit" form={id}>go</button>`, use `fireEvent.change` + `fireEvent.click`. For the invalid-email case, leverage form's `mode: "onBlur"` and use `fireEvent.blur` on the email input.
- **Files modified:** `BorrowerForm.test.tsx`
- **Commit:** rolled into `353e3fb`

### Deferred Issues

None. All auto-fixed inline.

## Verification Summary

- `cd frontend2 && bun run test -- --run src/features/borrowers/__tests__/` → **15/15 pass** (3 files)
- `cd frontend2 && bun run test -- --run` → **295/295 pass** (50 test files, no regressions — was 280/280 before Plan 59-03)
- `cd frontend2 && bun run build` → passes (`tsc -b` + `vite build` clean, 533.62 kB bundle)
- `cd frontend2 && bun run lint:imports` → passes (no forbidden idb/serwist/offline/sync imports)

## Acceptance Criteria Results

**Task 1** — all grep checks pass:
- `useBorrowersList` export ✓ — `archived: showArchived ? true : undefined` ✓ — `enabled: !!workspaceId` ✓
- `useBorrower` export ✓ — `enabled: !!workspaceId && !!id` ✓
- All 5 mutation hook exports ✓
- `err instanceof HttpError && err.status === 400` ✓
- `Cannot delete: this borrower has active loans.` ✓
- `qc.invalidateQueries({ queryKey: borrowerKeys.all })` count = 5 ✓
- `bun run build` exits 0 ✓

**Task 2** — all grep checks pass:
- `BorrowerForm.tsx` exists; contains `zodResolver(borrowerCreateSchema)` ✓
- Contains `v.email === "" ? undefined : v.email` ✓
- Renders 4 `<RetroFormField name=` elements ✓
- `BorrowerPanel.tsx` contains `NEW BORROWER`, `EDIT BORROWER`, `CREATE BORROWER`, `SAVE BORROWER`, `WORKING…` ✓
- Imports SlideOverPanel from `@/features/taxonomy/panel/SlideOverPanel` ✓
- BorrowerForm.test.tsx has 5 it() blocks (≥4) ✓
- BorrowerPanel.test.tsx has 4 it() blocks (≥3) ✓
- Combined tests pass ✓
- `bun run build` exits 0 ✓

**Task 3** — all grep checks pass:
- `BorrowerArchiveDeleteFlow.tsx` exists ✓
- Contains `err instanceof HttpError && err.status === 400` ✓
- Contains `setTimeout(() => deleteRef.current?.open(), 0)` ✓
- Contains `t\`ARCHIVE BORROWER\`` and `t\`DELETE BORROWER\`` ✓
- Does NOT contain `entityKind` ✓
- Contains `HIDES FROM LOAN PICKERS` ✓
- Test has 6 it() blocks (≥5) ✓
- Test runs pass ✓
- `bun run build` exits 0 ✓

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | `c50fdeb` | feat(59-03): add borrower query + mutation hooks with 400-active-loans branch |
| 2 | `353e3fb` | feat(59-03): add BorrowerForm + BorrowerPanel with create/edit dual-mode |
| 3 | `bce5978` | feat(59-03): add BorrowerArchiveDeleteFlow with 400 short-circuit on delete |

## TDD Gate Compliance

Plan frontmatter declares `type: execute` (not `type: tdd`), so plan-level RED/GREEN gating does not apply. Task-level TDD was applied pragmatically:
- Tasks 2 and 3 shipped test files alongside implementation in a single commit. Tests exercised the specified behaviours (form validation, panel modes, flow 5-case matrix). Both test files were required artifacts in the plan.
- Task 1 had no test file in the artifacts list; its acceptance is grep + build. Coverage of the mutation hooks' 400 branch is exercised transitively via `BorrowerArchiveDeleteFlow.test.tsx`.

## Toolchain Quirks Worth Noting for Plan 59-04

1. **Test submit pattern:** use `<Form /> <button type="submit" form={id}>go</button>` + `fireEvent.click` rather than `form.requestSubmit()` or user-event. HTML5 validation (`type="email"`, `required`) intercepts programmatic submit.
2. **AuthContext mocking:** any test that renders `BorrowerPanel` (or any consumer of the mutation hooks) needs `vi.mock("@/features/auth/AuthContext", () => ({ useAuth: () => ({...}) }))`. The `TestAuthContext` in shared fixtures only works if components read from it via `useContext(TestAuthContext)` directly, which they don't — they call the real `useAuth`.
3. **Dialog visibility detection:** use the `isVisibleDialog(text)` helper from `taxonomy/__tests__/ArchiveDeleteFlow.test.tsx` (inlined verbatim in `BorrowerArchiveDeleteFlow.test.tsx`). `screen.queryByText("CONFIRM DELETE")` can match text in closed dialogs because jsdom's setupDialogMocks stubs showModal/close without hiding DOM content.
4. **Pickup for 59-04:** consume `<BorrowerPanel ref={panelRef} />`, `<BorrowerArchiveDeleteFlow ref={flowRef} nodeName={...} onArchive={...} onDelete={...} />`, and drive via `panelRef.current?.open("create"|"edit", borrower?)` and `flowRef.current?.open()`. Hook up `useArchiveBorrower`/`useDeleteBorrower` mutateAsync in the onArchive/onDelete props — these hooks handle all toasts (success + 400 error).

## Threat Flags

None. All new surface was covered by the plan's `<threat_model>`:
- T-59-14 (XSS on borrower name in confirm body) — React auto-escapes `{nodeName}`; body prop is string, not `dangerouslySetInnerHTML`
- T-59-15 (info disclosure via HttpError.body) — only `err.status` is read in `useDeleteBorrower.onError`; toast copy is static strings
- T-59-16 (cross-workspace authorization bypass) — `workspaceId!` comes from `useAuth`; backend re-validates on every request; cross-workspace IDs return 404
- T-59-17 (RHF resolver bypass) — BorrowerPanel never calls `setValue` externally; handleSubmit-processed values only; backend re-validates
- T-59-18 (audit trail) — archive/restore/delete events published by backend (Plan 59-01)
- T-59-19 (rapid-fire click DoS) — RetroConfirmDialog disables buttons with `pending` state; BorrowerPanel disables submit on `isPending`

No additional threat surface introduced beyond the plan's threat model.

## Known Stubs

None. All hooks call real API methods; all form fields wire to real zod schemas; the dialog and panel connect to real mutation hooks. No hardcoded empty arrays / placeholder copy / "coming soon" text.

## User Setup Required

None. No new runtime dependencies. Existing `bun install` + `bun run i18n:compile` flow unchanged.

## Next Phase Readiness

Plan 59-04 (BorrowersListPage + BorrowerDetailPage) can now import:
- `useBorrowersList` / `useBorrower` for data
- `useArchiveBorrower` / `useRestoreBorrower` / `useDeleteBorrower` for row actions
- `BorrowerPanel` (with `BorrowerPanelHandle`) for the create/edit slide-over
- `BorrowerArchiveDeleteFlow` (with its handle + props) for the archive/delete confirmation

Pages just need routing, row rendering, and empty states. No further composition work required.

## Self-Check: PASSED

**Files verified present:**
- `frontend2/src/features/borrowers/hooks/useBorrowersList.ts` FOUND
- `frontend2/src/features/borrowers/hooks/useBorrower.ts` FOUND
- `frontend2/src/features/borrowers/hooks/useBorrowerMutations.ts` FOUND
- `frontend2/src/features/borrowers/forms/BorrowerForm.tsx` FOUND
- `frontend2/src/features/borrowers/panel/BorrowerPanel.tsx` FOUND
- `frontend2/src/features/borrowers/actions/BorrowerArchiveDeleteFlow.tsx` FOUND
- `frontend2/src/features/borrowers/__tests__/BorrowerForm.test.tsx` FOUND
- `frontend2/src/features/borrowers/__tests__/BorrowerPanel.test.tsx` FOUND
- `frontend2/src/features/borrowers/__tests__/BorrowerArchiveDeleteFlow.test.tsx` FOUND

**Commits verified in git log:**
- `c50fdeb` FOUND — feat(59-03): add borrower query + mutation hooks with 400-active-loans branch
- `353e3fb` FOUND — feat(59-03): add BorrowerForm + BorrowerPanel with create/edit dual-mode
- `bce5978` FOUND — feat(59-03): add BorrowerArchiveDeleteFlow with 400 short-circuit on delete

---
*Phase: 59-borrowers-crud*
*Plan: 03*
*Completed: 2026-04-16*
