---
phase: 62-loans
plan: 04
subsystem: frontend-ui
tags: [frontend, loans, detail, i18n, routes, ui-checkpoint]

# Dependency graph
requires:
  - phase: 62-03
    provides: LoansListPage, LoanReturnFlow, LoanPanel, LoansPage re-export shim
  - phase: 62-02
    provides: useLoansForItem, useLoansForBorrower, useReturnLoan (with embedded item/borrower on Loan)
  - phase: 62-01
    provides: LoanResponse decoration (embedded item + borrower)
  - phase: 61-item-photos
    provides: ItemThumbnailCell (extended here with a `size` prop)
  - phase: 60-items-crud
    provides: ItemDetailPage LOANS section seam
  - phase: 59-borrowers-crud
    provides: BorrowerDetailPage ACTIVE LOANS + LOAN HISTORY section seams
provides:
  - /items/:id ACTIVE LOAN + LOAN HISTORY panels (LOAN-05)
  - /borrowers/:id ACTIVE LOANS + LOAN HISTORY panels (LOAN-06)
  - /loans route now mounts LoansListPage directly (no re-export hop)
  - Lingui EN + ET catalogs updated with every Phase 62 msgid (+52 msgids each)
  - ItemThumbnailCell supports optional `size` prop (default 40, loan rows use 24)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Detail-page panel composition: each panel owns its LoanReturnFlow ref so the parent detail page stays ignorant of the return dialog machinery"
    - "Shared useLoansForItem hook across ACTIVE LOAN + LOAN HISTORY panels — TanStack Query dedups so only one network request fires per item detail mount (T-62-34 mitigation)"
    - "Inline-style sizing on ItemThumbnailCell (width/height via style prop) — enables a single component to serve both 40px list thumbnails and 24px loan-row thumbnails without utility-class branching"
    - "Test stubs for wiring: where a parent page composes multiple feature panels, the parent's test stubs the child panels to avoid n-deep mock scaffolding (ItemPhotoGallery pattern extended to loan panels)"

key-files:
  created:
    - frontend2/src/features/loans/panels/ItemActiveLoanPanel.tsx
    - frontend2/src/features/loans/panels/ItemLoanHistoryPanel.tsx
    - frontend2/src/features/loans/panels/BorrowerActiveLoansPanel.tsx
    - frontend2/src/features/loans/panels/BorrowerLoanHistoryPanel.tsx
    - frontend2/src/features/loans/__tests__/ItemActiveLoanPanel.test.tsx
    - frontend2/src/features/loans/__tests__/ItemLoanHistoryPanel.test.tsx
    - frontend2/src/features/loans/__tests__/BorrowerActiveLoansPanel.test.tsx
    - frontend2/src/features/loans/__tests__/BorrowerLoanHistoryPanel.test.tsx
  modified:
    - frontend2/src/features/items/ItemDetailPage.tsx
    - frontend2/src/features/borrowers/BorrowerDetailPage.tsx
    - frontend2/src/routes/index.tsx
    - frontend2/src/features/items/photos/ItemThumbnailCell.tsx
    - frontend2/src/features/items/__tests__/ItemDetailPage.test.tsx
    - frontend2/src/features/borrowers/__tests__/BorrowerDetailPage.test.tsx
    - frontend2/src/features/items/photos/ItemThumbnailCell.test.tsx
    - frontend2/locales/en/messages.po
    - frontend2/locales/et/messages.po

key-decisions:
  - "Each item/borrower panel mounts its OWN LoanReturnFlow ref — the parent detail pages stay dialog-ignorant and no prop drilling is needed for the return handle"
  - "useLoansForItem is called from BOTH panels on /items/:id; TanStack Query dedups by queryKey so exactly one network request fires per item mount — T-62-34 mitigation confirmed by the shared loanKeys.forItem(inventoryId) key from Plan 62-02"
  - "Extended ItemThumbnailCell with a `size` prop rather than introducing a second component — plan asked for `size={24}` but the existing cell only supported a fixed 40×40; adding the prop is additive, keeps one component, and preserves all existing 40×40 call sites via the default"
  - "Router swap retires the LoansPage import entirely (replaced with a direct LoansListPage import + route element); the LoansPage.tsx re-export file remains on disk as a transitional export in case any downstream consumer imports it, but nothing in frontend2/src references it anymore"
  - "ItemDetailPage + BorrowerDetailPage tests stub the Phase 62 loan panels (vi.mock) rather than plumbing useLoansForItem/useLoansForBorrower mocks through — matches the existing ItemPhotoGallery stub pattern and keeps each detail-page suite focused on its own wiring contract"

patterns-established:
  - "Detail-page panel composition: parent page renders <FeaturePanel entityId={…}> and the panel owns its own hook subscription + imperative-handle refs for any dialogs it opens"
  - "Test stub pattern for composed feature panels: vi.mock the panel module to render a testid div; avoids deep mock scaffolding when the parent page is under test"
  - "TanStack Query dedup on shared keys is the canonical mitigation for 'two panels, one fetch' scenarios"
  - "ItemThumbnailCell `size` prop convention: numeric px (default 40); glyph placeholder scales to 40% of box"

requirements-completed: [LOAN-05, LOAN-06]

# Metrics
duration: ~8min (automated tasks; human verify pending)
completed: 2026-04-17
---

# Phase 62 Plan 04: Detail Pages + Router Swap + i18n Summary

**Ship the last piece of Phase 62 — real loan data on /items/:id and /borrowers/:id via four new detail-page panels, direct LoansListPage router wiring, and a Lingui extraction pass that lands 52 new Phase 62 msgids in both EN + ET catalogs. Backed by 12 new panel tests (6 item + 6 borrower), all 483 frontend tests green.**

## Performance

- **Duration:** ~8 min (Tasks 1-3 automated; Task 4 awaiting human verification)
- **Started:** 2026-04-17T12:20:00Z (approx — worktree start)
- **Automated work completed:** 2026-04-17T12:28:00Z
- **Tasks:** 4 (3 auto + 1 human-verify checkpoint)
- **Files created:** 8 (4 panels + 4 test files)
- **Files modified:** 9 (detail pages, router, ItemThumbnailCell, 3 test files, 2 catalogs)
- **Tests added:** 12 (ItemActiveLoanPanel 3, ItemLoanHistoryPanel 3, BorrowerActiveLoansPanel 3, BorrowerLoanHistoryPanel 3)
- **Full suite:** 483/483 passing (up from 470 pre-plan, +13 incl. one adjusted ItemThumbnailCell test)

## Catalog Statistics

- `frontend2/locales/en/messages.po`: 393 → 445 msgids (**+52 new Phase 62 strings**)
- `frontend2/locales/et/messages.po`: 393 → 445 msgids (**+52 new Phase 62 strings**, msgstr values empty — Phase 63 deferred)
- Combined diff: `638 insertions, 96 deletions` across both catalogs

**Critical new msgids verified present in EN catalog:**
- LOANS, NEW LOAN, CONFIRM RETURN, MARK RETURNED
- NO ACTIVE LOAN (singular — item-detail), NO ACTIVE LOANS (plural — list + borrower-detail)
- NO OVERDUE LOANS, NO LOAN HISTORY
- LOAN DETAILS (LOCKED)
- Loan created., Loan updated., Loan returned.

**ET catalog parity verified** — same msgids present with empty msgstr (translation deferred).

## Accomplishments

### Item detail page (LOAN-05)
- `ItemActiveLoanPanel` — renders the single active loan if any: borrower name link (`/borrowers/:id`), quantity (`×N`), loaned date, due date (red + `AlertTriangle` if overdue, `—` if null), optional notes (truncated at 200 chars with full text in `title`), and a `MARK RETURNED` button with descriptive `aria-label`. Empty state: `NO ACTIVE LOAN` / `This item isn't currently out on loan.`
- `ItemLoanHistoryPanel` — stacked rows of historical loans, most-recent-first per hook partition. Each row shows borrower link, quantity, loaned timestamp, returned timestamp. Empty state: `NO LOAN HISTORY` / `Past loans will appear here once anything is returned.`
- Both panels share `useLoansForItem(itemId)` — TanStack Query dedups.
- `MARK RETURNED` opens a locally-mounted `<LoanReturnFlow ref={returnFlowRef} />` so the detail page stays dialog-ignorant.
- ItemDetailPage LOANS section now contains two sub-sections with `ACTIVE LOAN` / `LOAN HISTORY` sub-headings; the Phase 60 `NO LOANS` / `Loan history will appear here once loans are wired.` placeholder is retired.

### Borrower detail page (LOAN-06)
- `BorrowerActiveLoansPanel` — multi-row list of all open loans for the borrower. Each row: 24px item thumbnail (`ItemThumbnailCell size={24}`), item name link (`/items/:id`), quantity, loaned date, due date (with overdue emphasis), and `MARK RETURNED`. Empty state: `NO ACTIVE LOANS` / `This borrower isn't holding anything right now.`
- `BorrowerLoanHistoryPanel` — stacked rows with dimmed 24px thumbnails, item link, qty, loaned/returned timestamps, gray row text. Empty state: `NO LOAN HISTORY` / `Past loans will appear here once anything is returned.`
- BorrowerDetailPage ACTIVE LOANS + LOAN HISTORY `<section>` blocks now render the real panels; the Phase 59 `Loan data will be available soon.` + `Loan history will appear here once loans are wired.` placeholders are retired.

### Router swap
- `frontend2/src/routes/index.tsx` line 11: `import { LoansPage } from "@/features/loans/LoansPage"` → `import { LoansListPage } from "@/features/loans/LoansListPage"`
- `frontend2/src/routes/index.tsx` line 84: `<Route path="loans" element={<LoansPage />} />` → `<Route path="loans" element={<LoansListPage />} />`
- `frontend2/src/features/loans/LoansPage.tsx` remains on disk as a transitional re-export (`export { LoansListPage as LoansPage }`) but is no longer referenced from anywhere in `frontend2/src`.

### Lingui extraction
- `bun run i18n:extract` ran cleanly, producing the +52 new msgids in both EN + ET.
- `bun run i18n:compile` regenerated the message bundles (gitignored — not committed).

## Task Commits

1. **Task 1 RED — failing tests for Item panels** — `5d895f0` (test)
2. **Task 1 GREEN — ItemActiveLoanPanel + ItemLoanHistoryPanel** — `f3fea15` (feat)
3. **Task 2 RED — failing tests for Borrower panels** — `e094249` (test)
4. **Task 2 GREEN — BorrowerActiveLoansPanel + BorrowerLoanHistoryPanel + ItemThumbnailCell size prop** — `e396281` (feat)
5. **Task 3 — detail-page seam swaps + router swap + i18n extract + test adjustments** — `2d4e83c` (feat)

## Files Created/Modified

### Created (8)
- `frontend2/src/features/loans/panels/ItemActiveLoanPanel.tsx` — 122 lines
- `frontend2/src/features/loans/panels/ItemLoanHistoryPanel.tsx` — 93 lines
- `frontend2/src/features/loans/panels/BorrowerActiveLoansPanel.tsx` — 125 lines
- `frontend2/src/features/loans/panels/BorrowerLoanHistoryPanel.tsx` — 99 lines
- `frontend2/src/features/loans/__tests__/ItemActiveLoanPanel.test.tsx` — 104 lines, 3 tests
- `frontend2/src/features/loans/__tests__/ItemLoanHistoryPanel.test.tsx` — 98 lines, 3 tests
- `frontend2/src/features/loans/__tests__/BorrowerActiveLoansPanel.test.tsx` — 115 lines, 3 tests
- `frontend2/src/features/loans/__tests__/BorrowerLoanHistoryPanel.test.tsx` — 110 lines, 3 tests

### Modified (9)
- `frontend2/src/features/items/ItemDetailPage.tsx` — swap LOANS placeholder for `ItemActiveLoanPanel` + `ItemLoanHistoryPanel`; drop unused `RetroEmptyState` import
- `frontend2/src/features/borrowers/BorrowerDetailPage.tsx` — swap both placeholders for real panels; drop unused `RetroEmptyState` import
- `frontend2/src/routes/index.tsx` — retire `LoansPage` import + element, replace with `LoansListPage`
- `frontend2/src/features/items/photos/ItemThumbnailCell.tsx` — added optional `size` prop (default 40) implemented via inline `style={{ width, height }}`; `ImageOff` glyph auto-scales to 40% of the box
- `frontend2/src/features/items/__tests__/ItemDetailPage.test.tsx` — stub the two item loan panels; adjust placeholder assertion to new section structure
- `frontend2/src/features/borrowers/__tests__/BorrowerDetailPage.test.tsx` — stub the two borrower loan panels so the detail-page suite stays isolated
- `frontend2/src/features/items/photos/ItemThumbnailCell.test.tsx` — adjust the 40×40 assertion to check inline `style.width`/`style.height`; add a size-prop test
- `frontend2/locales/en/messages.po` — +52 msgids
- `frontend2/locales/et/messages.po` — +52 msgids (msgstr empty)

## Decisions Made

See `key-decisions` frontmatter. Highlights:

1. **Per-panel LoanReturnFlow ownership.** Instead of hoisting one `LoanReturnFlow` to each detail page and prop-drilling the handle, each active-loan panel mounts its own `<LoanReturnFlow ref={…}>`. This keeps `ItemDetailPage` and `BorrowerDetailPage` dialog-ignorant and avoids a parent-level state machine.
2. **Shared hook + TanStack dedup.** On `/items/:id`, `ItemActiveLoanPanel` and `ItemLoanHistoryPanel` both call `useLoansForItem(itemId)`. They share the same query key from Plan 62-02, so exactly one network request fires — T-62-34 mitigation confirmed.
3. **ItemThumbnailCell `size` prop.** The plan mandated `size={24}` on the loan-row thumbnails but the existing component only supported a fixed `w-10 h-10` (40px) box. Rather than create a second component or hack with arbitrary classes, I added an optional `size` prop that drives inline width/height styles. Default 40 preserves all existing call sites; the glyph placeholder scales to 40% of the box.
4. **Test stubs for composed panels.** The parent detail-page tests now vi.mock the four new panel modules (matching the existing `ItemPhotoGallery` stub pattern) so each detail-page suite stays focused on its own wiring contract. The panels' own test suites exercise their loan data behaviour directly.
5. **Router swap retires LoansPage entirely.** No `LoansPage` reference remains in `frontend2/src` after this plan. The transitional re-export file is kept on disk but is effectively dead code — safe to delete in a future cleanup if needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `ItemThumbnailCell` missing a `size` prop**
- **Found during:** Task 2 action (the plan spec required `<ItemThumbnailCell size={24}>` — acceptance criterion explicitly greps for it).
- **Issue:** The Phase 61 component only accepted `{ thumbnailUrl, dimmed }`; there was no way to render a 24px variant.
- **Fix:** Added an optional `size: number` prop (default 40) and switched the box from `w-10 h-10` utility classes to inline `style={{ width: size, height: size }}`. The inner `ImageOff` glyph scales to 40% of the box. All existing 40×40 call sites remain unchanged at runtime.
- **Files modified:** `frontend2/src/features/items/photos/ItemThumbnailCell.tsx`
- **Commit:** `e396281`

**2. [Rule 1 - Bug] Pre-existing ItemThumbnailCell test asserted `.w-10.h-10` classes**
- **Found during:** full-suite test run after Task 2 GREEN.
- **Issue:** `applies the 40x40 sizing (w-10 h-10) on the outer box` failed because the component no longer emits those utility classes (they were swapped for inline styles — see Deviation 1).
- **Fix:** Adjusted the test to assert `box.style.width === "40px"` / `box.style.height === "40px"` (observable contract preserved). Added a second test asserting the new `size={24}` prop produces `24px` styles.
- **Files modified:** `frontend2/src/features/items/photos/ItemThumbnailCell.test.tsx`
- **Commit:** `2d4e83c`

**3. [Rule 1 - Bug] Pre-existing ItemDetailPage test asserted the retired `NO LOANS` placeholder**
- **Found during:** full-suite test run after Task 3 seam swap.
- **Issue:** `renders LOANS placeholder` expected `NO LOANS` text which is no longer rendered; the plan explicitly retires that placeholder.
- **Fix:** Stubbed the two item loan panels via `vi.mock` (matching the existing `ItemPhotoGallery` stub pattern) and rewrote the assertion to check the new section structure (`LOANS` heading, `ACTIVE LOAN` + `LOAN HISTORY` sub-headings).
- **Files modified:** `frontend2/src/features/items/__tests__/ItemDetailPage.test.tsx`
- **Commit:** `2d4e83c`

**4. [Rule 1 - Bug] Pre-existing BorrowerDetailPage test rendered real loan panels**
- **Found during:** full-suite test run after Task 3 seam swap.
- **Issue:** `renders borrower name, contact fields, and two empty loan sections` broke because `BorrowerActiveLoansPanel` / `BorrowerLoanHistoryPanel` now try to call `useLoansForBorrower` which has no mock in that suite, and the empty states' copy changed from `Loan data will be available soon.` to the new UI-SPEC copy.
- **Fix:** Added `vi.mock` stubs for the two borrower loan panels that render `NO ACTIVE LOANS` / `NO LOAN HISTORY` testid divs — keeps the original assertion intact while preventing the real hook from firing.
- **Files modified:** `frontend2/src/features/borrowers/__tests__/BorrowerDetailPage.test.tsx`
- **Commit:** `2d4e83c`

### Style Alignments (not deviations)

None.

## Issues Encountered

- **Worktree fresh install.** The worktree arrived without `node_modules` or compiled Lingui catalogs. Ran `bun install` (371 packages in 238ms) + `bun run i18n:compile` before the first `bun run test`. Standard fresh-worktree bootstrap — not a plan issue.
- **`makeLoan` fixture ignores nested `borrower.id` unless `borrower_id` is also overridden.** The factory spreads `...overrides` last, but the top-level `borrower_id` field defaults to `DEFAULT_BORROWER.id` which sits before the spread. My first ItemLoanHistoryPanel test asserting `/borrowers/bor-xyz` failed because I only overrode `borrower`, not `borrower_id`. Fix: pass both fields. Noted for future fixture users; not a plan fault.

## User Setup Required

None for Tasks 1-3 (fully automated frontend + catalog changes).

**For Task 4 (human verification) the user needs:**
1. Backend running on `:8000` with a populated workspace (≥2 items, ≥2 borrowers, preferably one item with a primary photo and one overdue loan).
2. Frontend dev server running on `:5173` (`cd frontend2 && bun run dev`).
3. Logged in; on `http://localhost:5173/loans`.

See the plan's `how-to-verify` block for the 29 verification steps.

## Next Phase Readiness

**Unblocked:**
- Phase 62 is functionally complete pending human verification. On approval, the milestone requirements LOAN-01 through LOAN-06 are all end-to-end verified.
- Phase 63 (polish / Estonian translations) inherits 52 empty ET msgstr values seeded by this plan's extraction sweep — that's the anchor set for whatever translation pass happens next.

**API surface changes consumers must mirror:**
- `ItemThumbnailCell` gains optional `size` prop (default 40) — additive, no breaking change. Loan rows use `size={24}`; all prior 40×40 call sites stay pixel-identical.
- `LoansPage` re-export is no longer imported anywhere in `frontend2/src`. Kept on disk as a transitional export.

## Known Stubs

None. All four new panels are wired to real data via Plan 62-02 hooks; the only "stubs" are the test-only `vi.mock` substitutions in `ItemDetailPage.test.tsx` and `BorrowerDetailPage.test.tsx` which substitute the panels for testid divs so the parent-page suites stay isolated — these are expected and documented.

## Threat Flags

None. No new network endpoints introduced; all new rendering goes through React auto-escape (no `dangerouslySetInnerHTML`). Workspace scoping flows through Plan 62-02 hooks which read `workspaceId` from `useAuth()`. T-62-30..T-62-35 from the plan's threat model all remain mitigated as designed.

## Deferred to Phase 63

- Estonian translations (52 empty msgstr values in `et/messages.po` — the plan explicitly accepts this as expected for Phase 62).
- UX polish items (if any surface during human verification).

## Checkpoint Status (Task 4)

**Type:** checkpoint:human-verify
**Status:** awaiting user approval
**Gate:** blocking — user must confirm all 29 verification steps pass before Phase 62 is marked complete.

The automated portion of this plan (Tasks 1-3) is fully green:
- All 483 frontend tests pass (12 new panel tests + 1 adjusted thumbnail test)
- `bun run build` exits 0
- `bun run lint:imports` exits 0
- `bun run i18n:extract` has been run; both catalogs updated; `bun run i18n:compile` regenerated the bundles
- Every acceptance-criterion grep verified

## Self-Check: PASSED

Verified via grep + tests + build:

- [x] `frontend2/src/features/loans/panels/ItemActiveLoanPanel.tsx` exists and exports `ItemActiveLoanPanel` — FOUND
- [x] File calls `useLoansForItem(itemId)` — FOUND
- [x] File renders `<LoanReturnFlow ref={returnFlowRef} />` — FOUND
- [x] File contains `t\`NO ACTIVE LOAN\`` (singular) — FOUND
- [x] File contains `t\`This item isn't currently out on loan.\`` — FOUND
- [x] File contains `t\`MARK RETURNED\`` — FOUND
- [x] File links to `/borrowers/${loan.borrower_id}` — FOUND
- [x] File renders `AlertTriangle` for overdue rows — FOUND
- [x] `frontend2/src/features/loans/panels/ItemLoanHistoryPanel.tsx` exists and exports `ItemLoanHistoryPanel` — FOUND
- [x] File contains `t\`NO LOAN HISTORY\`` — FOUND
- [x] File contains `t\`Past loans will appear here once anything is returned.\`` — FOUND
- [x] File contains `t\`LOANED\`` and `t\`RETURNED\`` — FOUND
- [x] `ItemActiveLoanPanel.test.tsx` has 3 `it(` blocks — FOUND
- [x] `ItemLoanHistoryPanel.test.tsx` has 3 `it(` blocks — FOUND
- [x] `frontend2/src/features/loans/panels/BorrowerActiveLoansPanel.tsx` exists and exports `BorrowerActiveLoansPanel` — FOUND
- [x] File calls `useLoansForBorrower(borrowerId)` — FOUND
- [x] File contains `t\`NO ACTIVE LOANS\`` (plural) — FOUND
- [x] File contains `t\`This borrower isn't holding anything right now.\`` — FOUND
- [x] File renders `<ItemThumbnailCell` with `size={24}` — FOUND
- [x] File uses `to={\`/items/${loan.inventory_id}\`}` — FOUND
- [x] `frontend2/src/features/loans/panels/BorrowerLoanHistoryPanel.tsx` exists and exports `BorrowerLoanHistoryPanel` — FOUND
- [x] File contains `t\`NO LOAN HISTORY\`` — FOUND
- [x] `BorrowerActiveLoansPanel.test.tsx` has 3 `it(` blocks — FOUND
- [x] `BorrowerLoanHistoryPanel.test.tsx` has 3 `it(` blocks — FOUND
- [x] `ItemDetailPage.tsx` imports `ItemActiveLoanPanel` and `ItemLoanHistoryPanel` from `@/features/loans/panels/*` — FOUND
- [x] `ItemDetailPage.tsx` renders `<ItemActiveLoanPanel itemId={item.id} />` and `<ItemLoanHistoryPanel itemId={item.id} />` — FOUND
- [x] `ItemDetailPage.tsx` no longer contains `Loan history will appear here once loans are wired.` — VERIFIED (empty grep)
- [x] `BorrowerDetailPage.tsx` renders `<BorrowerActiveLoansPanel borrowerId={…}>` + `<BorrowerLoanHistoryPanel borrowerId={…}>` — FOUND
- [x] `BorrowerDetailPage.tsx` no longer contains `Loan data will be available soon.` — VERIFIED (empty grep)
- [x] `routes/index.tsx` contains `import { LoansListPage } from "@/features/loans/LoansListPage"` — FOUND
- [x] `routes/index.tsx` contains `<Route path="loans" element={<LoansListPage />} />` — FOUND
- [x] `routes/index.tsx` does NOT contain `<LoansPage` — VERIFIED (empty grep)
- [x] `locales/en/messages.po` contains `msgid "LOANS"` — FOUND
- [x] `locales/en/messages.po` contains `msgid "NEW LOAN"` — FOUND
- [x] `locales/en/messages.po` contains `msgid "CONFIRM RETURN"` — FOUND
- [x] `locales/en/messages.po` contains `msgid "MARK RETURNED"` — FOUND
- [x] `locales/en/messages.po` contains `msgid "NO ACTIVE LOAN"` — FOUND (singular)
- [x] `locales/en/messages.po` contains `msgid "NO ACTIVE LOANS"` — FOUND (plural)
- [x] `locales/en/messages.po` contains `msgid "NO OVERDUE LOANS"` — FOUND
- [x] `locales/en/messages.po` contains `msgid "NO LOAN HISTORY"` — FOUND
- [x] `locales/en/messages.po` contains `msgid "LOAN DETAILS (LOCKED)"` — FOUND
- [x] `locales/en/messages.po` contains `msgid "Loan created."` — FOUND
- [x] `locales/en/messages.po` contains `msgid "Loan returned."` — FOUND
- [x] `locales/en/messages.po` contains `msgid "Loan updated."` — FOUND
- [x] `locales/et/messages.po` contains `msgid "LOANS"` — FOUND
- [x] `locales/et/messages.po` contains `msgid "CONFIRM RETURN"` — FOUND
- [x] `cd frontend2 && bun run build` exits 0 — VERIFIED
- [x] `cd frontend2 && bun run test` exits 0 (483/483) — VERIFIED
- [x] `cd frontend2 && bun run lint:imports` exits 0 — VERIFIED
- [x] Commits exist:
  - `5d895f0` (test: Task 1 RED) — FOUND
  - `f3fea15` (feat: Task 1 GREEN) — FOUND
  - `e094249` (test: Task 2 RED) — FOUND
  - `e396281` (feat: Task 2 GREEN) — FOUND
  - `2d4e83c` (feat: Task 3 — seam swaps + router + i18n) — FOUND

---
*Phase: 62-loans*
*Automated portion completed: 2026-04-17*
*Human-verify checkpoint: awaiting user approval*
