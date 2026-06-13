---
phase: 08-loans
verified: 2026-06-13T00:00:00Z
status: human_needed
score: 6/6
overrides_applied: 0
human_verification:
  - test: "Overdue row highlight renders with bg-danger-bg tint + danger Overdue pill + ⚠ −{n}d chip"
    expected: "Three non-color cues visible on overdue rows in the Active and Overdue tabs"
    why_human: "CSS class application and visual layering cannot be verified by grep; requires a browser render with a seeded overdue loan"
  - test: "?itemId= deep-link pre-filters the inventory picker and shows FROM ITEM badge"
    expected: "Navigating to /loans/new?itemId={id} narrows the inventory picker and shows the FROM ITEM badge; auto-selects when exactly one entry matches"
    why_human: "Conditional rendering based on URL param + picker option filtering is exercised by unit tests but the actual visual lock/badge state requires browser confirmation"
  - test: "Return / Extend / Edit dialogs keyboard and focus behaviour"
    expected: "Dialogs trap focus, ESC closes without submitting, Tab cycles through form fields"
    why_human: "Focus management and keyboard interaction require browser testing; not covered by RTL tests in useLoanMutations.test.tsx"
---

# Phase 8: Loans — Verification Report

**Phase Goal:** LOAN-01 through LOAN-06 — tabbed loans list, create form, return/extend/edit mutations, item-detail panels, and borrower-side panels. All six requirements must be wired in the shipped frontend2 codebase.
**Verified:** 2026-06-13T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can view loans in tabbed Active/Overdue/History view with RetroTable rows showing item/borrower/due date/status pill | VERIFIED | `LoansListPage.tsx:33-37` — three-tab TABS array; `useLoansQuery.ts:54-57` — endpoint selector; `loanStatus.ts:13-20` — pill from server flags |
| 2 | User can create a new loan at /loans/new with inventory_id (not item_id), ?itemId pre-filter, borrower picker | VERIFIED | `LoanFormPage.tsx:139` — `inventory_id: values.inventory_id`; `CreateLoanBody` interface has no `item_id` field; `routes/index.tsx:72` — Route registered |
| 3 | User can mark a loan returned via optimistic confirm dialog; loan transitions to History tab | VERIFIED | `ReturnLoanDialog.tsx:20-27` — calls `returnLoan.mutate`; `useLoanMutations.ts:75-87` — onMutate snapshots + patches `is_active:false/returned_at`, onError restores |
| 4 | User can edit a loan's due date + notes, and extend its due date | VERIFIED | `EditLoanDialog.tsx` + `ExtendLoanDialog.tsx` — both wired to useLoanMutations; `LoanRowActions.tsx:36-60` — RETURN/EXTEND/EDIT buttons in list row |
| 5 | Item detail page renders real Active Loan panel + Loan History panel | VERIFIED | `LoanPanels.tsx:50-119` — ActiveLoanPanel with RETURN/EXTEND/loan CTA; `LoanHistoryList`; `ItemDetailPage.tsx:25-28,61,210,299` — imported and mounted in side rail + History tab |
| 6 | BorrowerLoanPanels component delivers Active Loans + Loan History panels (no route — Phase 9 mounts) | VERIFIED | `BorrowerLoanPanels.tsx:33-47` — component renders two Windows; `useBorrowerLoans.ts` — query keyed `["loans",wsId,"by-borrower",borrowerId]`; no route registered (intentional) |

**Score:** 6/6 truths verified

---

### Binding Override Checks

| Override | Contract | Verdict | Evidence |
|----------|----------|---------|----------|
| 1: inventory_id never item_id | `CreateLoanBody` interface + form submit body | HOLDS | `loans.ts:9` — `inventory_id: string; // NOT item_id`; `LoanFormPage.tsx:139` — `inventory_id: values.inventory_id`; unit test T-08-02 asserts the wire body shape |
| 2: Overdue from server is_overdue, never Date.now() | `loanStatus.ts`, `loanCsv.ts`, `LoanPanels.tsx`, `BorrowerLoanPanels.tsx` | HOLDS | `loanStatus.ts:17-18` — reads `returned_at`/`is_overdue` only; `loanCsv.ts:36-39` — `statusCell` reads server flags; `LoanPanels.tsx:87` — `loan.is_overdue` guards the overdue chip; `BorrowerLoanPanels.tsx:124,199-203` — `daysFromNow` used only for display magnitude (the is_overdue BRANCH guard at line 124 is server-controlled); `LoansListPage.tsx:131-138` — `if (loan.is_overdue)` guards the chip, `daysUntil` only computes display count |
| 3: CSV client-generated, no backend export call | `loanCsv.ts` | HOLDS | `loanCsv.ts:48-64` — builds Blob from in-memory rows; `triggerCsvDownload` uses `URL.createObjectURL`; no fetch/axios call anywhere in the CSV path |
| 4: Tab endpoints active→/loans/active, overdue→/loans/overdue, history→GET /loans !is_active | `useLoansQuery.ts:54-66` | HOLDS | Lines 54-57: `overdue→loansApi.overdue(ws)`, `history→loansApi.list(ws)`, default→`loansApi.active(ws)`; lines 63-66: history client-filters `!l.is_active` |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/features/loans/LoansListPage.tsx` | Tabbed Active/Overdue/History list | VERIFIED | 311 lines; RetroTabs + RetroTable + FilterBar + shortcut registration; no stubs |
| `src/features/loans/hooks/useLoansQuery.ts` | URL-driven query with tab→endpoint mapping | VERIFIED | Three-way selector at lines 54-57; history client-filter at lines 63-66 |
| `src/features/loans/LoanFormPage.tsx` | Create form posting inventory_id | VERIFIED | Full RHF/zod form; `inventory_id` in submit body at line 139; dirty-guard present |
| `src/features/loans/schema.ts` | Zod schema with inventory_id, past-date refinement | VERIFIED | `inventory_id` field (not `item_id`); past-date `.refine` at line 44 |
| `src/features/loans/hooks/useLoanPickerOptions.ts` | Picker options hook with ?itemId filter | VERIFIED | `itemIdFilter` narrows inventory at line 91-93; limit=100 cap at line 43 |
| `src/features/loans/hooks/useLoanMutations.ts` | Optimistic return/extend/update with snapshot+restore | VERIFIED | `optimisticPatch` at lines 53-69; `restore` at lines 71-73; all three mutations wired |
| `src/features/loans/components/ReturnLoanDialog.tsx` | Return confirm dialog | VERIFIED | Blue titlebar; calls `returnLoan.mutate`; not disabled stub |
| `src/features/loans/components/EditLoanDialog.tsx` | Edit dialog for due_date + notes | VERIFIED | Calls `updateLoan.mutate`; optimistic via useLoanMutations |
| `src/features/loans/components/ExtendLoanDialog.tsx` | Extend dialog for new_due_date | VERIFIED | Calls `extendLoan.mutate`; body is `{ new_due_date }` per loansApi.extend |
| `src/features/loans/loanStatus.ts` | Status helper reading server flags only | VERIFIED | 20 lines; reads `returned_at` + `is_overdue` only; comment explicitly forbids Date.now() |
| `src/features/loans/loanCsv.ts` | Client-generated CSV with injection escaping | VERIFIED | `escapeCell` with injection prefix guard; `triggerCsvDownload` via object URL; no network call |
| `src/features/items/components/LoanPanels.tsx` | Real item-detail loan panels (not Phase 7 stub) | VERIFIED | `useItemLoans` query + `ActiveLoanPanel` with live RETURN/EXTEND/CTA + `LoanHistoryList`; Phase 8 Plan 04 comment confirms stub replacement |
| `src/features/loans/components/BorrowerLoanPanels.tsx` | Borrower panels, component-only (no route) | VERIFIED | Two-Window component; `useBorrowerLoans` driving live data; no route registration (Phase 9 contract) |
| `src/features/loans/hooks/useBorrowerLoans.ts` | Per-borrower loans query partitioned on is_active | VERIFIED | `loansApi.byBorrower` call; client-side partition on `loan.is_active` |
| `src/lib/api/loans.ts` | Full loansApi with all lifecycle methods | VERIFIED | `list`, `active`, `overdue`, `create`, `return`, `update`, `extend`, `byItem`, `byBorrower` all present; `CreateLoanBody` has `inventory_id: string` (no `item_id` field) |
| `src/routes/index.tsx` | Routes: /loans + /loans/new registered | VERIFIED | Lines 72-73: `<Route path="loans/new" element={<LoanFormPage/>}/>` + `<Route path="loans" element={<LoansListPage/>}/>` |
| `frontend2/e2e/loans-lifecycle.spec.ts` | Playwright E2E covering LOAN-01/02/03 lifecycle | VERIFIED | Real 189-line spec; seeds borrower/item/location/entry via page.request; creates loan via UI; verifies Active tab + return dialog + History tab |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `LoansListPage` | `useLoansQuery` | import + `useLoansQuery()` call | WIRED | `LoansListPage.tsx:19,61` |
| `LoansListPage` | `loanStatus` | import + `loanStatus(loan)` call | WIRED | `LoansListPage.tsx:17,255` |
| `LoansListPage` | `loanCsv` | import + `loansToCsvBlob/triggerCsvDownload` | WIRED | `LoansListPage.tsx:18,111` |
| `LoansListPage` | `LoanRowActions` | import + `<LoanRowActions loan={loan} tab={tab}/>` | WIRED | `LoansListPage.tsx:20,285` |
| `LoanRowActions` | `ReturnLoanDialog/ExtendLoanDialog/EditLoanDialog` | state + open prop | WIRED | `LoanRowActions.tsx:46-60` |
| `ReturnLoanDialog` | `useLoanMutations.returnLoan` | `returnLoan.mutate(loan.id)` | WIRED | `ReturnLoanDialog.tsx:4,21` |
| `ExtendLoanDialog` | `useLoanMutations.extendLoan` | `extendLoan.mutate({id, new_due_date})` | WIRED | `ExtendLoanDialog.tsx:12,43` |
| `EditLoanDialog` | `useLoanMutations.updateLoan` | `updateLoan.mutate({id, due_date, notes})` | WIRED | `EditLoanDialog.tsx:11,45` |
| `LoanFormPage` | `loansApi.create` | `useMutation` → `loansApi.create(wsId, body)` | WIRED | `LoanFormPage.tsx:17,96-98` |
| `LoanFormPage` | `useLoanPickerOptions` | import + call with optional itemIdFilter | WIRED | `LoanFormPage.tsx:24,71` |
| `ItemDetailPage` | `ActiveLoanPanel + LoanHistoryList + useItemLoans` | import at lines 25-28; mount at 61, 210, 299 | WIRED | `ItemDetailPage.tsx:25-28,61,77-82,210,299` |
| `BorrowerLoanPanels` | `useBorrowerLoans` | import + `useBorrowerLoans(wsId, borrowerId)` | WIRED | `BorrowerLoanPanels.tsx:11,37` |
| `Sidebar.tsx` | `/loans` route | `<NavItem to="/loans">` at line 144 | WIRED | `Sidebar.tsx:144` |
| `useLoansQuery` | `loansApi.active/overdue/list` | three-way selector in `queryFn` | WIRED | `useLoansQuery.ts:54-57` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `LoansListPage` | `items` from `useLoansQuery` | `loansApi.active/overdue/list` → GET /workspaces/{ws}/loans/* | Yes — real API calls, no static fallback | FLOWING |
| `LoanFormPage` | `inventoryOptions`, `borrowerOptions` | `inventoryApi.list` + GET /borrowers via `useLoanPickerOptions` | Yes — real API calls with limit=100 | FLOWING |
| `LoanPanels.tsx` (ActiveLoanPanel) | `active` from `useItemLoans` | `loansApi.byItem` → GET /items/{id}/loans, partitioned client-side | Yes — real API call | FLOWING |
| `BorrowerLoanPanels` | `active`, `history` from `useBorrowerLoans` | `loansApi.byBorrower` → GET /borrowers/{id}/loans, partitioned | Yes — real API call | FLOWING |

---

### Behavioral Spot-Checks

Step 7b skipped — requires running dev stack (Vite + backend + Postgres). E2E result is pre-confirmed by orchestrator (loans-lifecycle.spec.ts 2/2 pass chromium+firefox).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LOAN-01 | 08-02-PLAN | Tabbed loans list Active/Overdue/History | SATISFIED | LoansListPage + useLoansQuery |
| LOAN-02 | 08-03-PLAN | Create loan at /loans/new, inventory_id, ?itemId pre-filter | SATISFIED | LoanFormPage + schema + routes/index.tsx |
| LOAN-03 | 08-04-PLAN | Mark returned via confirm dialog, optimistic | SATISFIED | ReturnLoanDialog + useLoanMutations.returnLoan |
| LOAN-04 | 08-04-PLAN | Edit due date + notes; extend due date | SATISFIED | EditLoanDialog + ExtendLoanDialog + LoanRowActions |
| LOAN-05 | 08-04-PLAN | Real item-detail LoanPanels (stub replaced) | SATISFIED | LoanPanels.tsx + ItemDetailPage wiring |
| LOAN-06 | 08-05-PLAN | BorrowerLoanPanels component, no route | SATISFIED | BorrowerLoanPanels.tsx + useBorrowerLoans |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `LoansListPage.tsx` | 43 | `Date.now()` in `daysUntil` | INFO | Display-only: computes overdue chip magnitude (−{n}d), NOT the overdue decision. Branch is gated on `loan.is_overdue` (line 131). Not a violation of override 2. |
| `BorrowerLoanPanels.tsx` | 203 | `Date.now()` in `daysFromNow` | INFO | Same pattern: display-only day delta for the chip magnitude. Comment on line 199-200 is explicit: "The overdue DECISION is server-owned (loan.is_overdue) — this number never drives that branch." Not a violation. |
| `08-VALIDATION.md` | frontmatter | `nyquist_compliant: false`, `wave_0_complete: false` | INFO | Planning artefact left in draft state. No impact on shipped code. |

No TBD / FIXME / XXX debt markers found in any Phase 8 file.
No placeholder/stub returns found in any loan component.
The previous "arrive in Phase 8" stub comment in LoanPanels has been replaced with real implementation (comment now reads "made REAL (LOAN-05)").

---

### Human Verification Required

#### 1. Overdue row highlight (three non-color cues)

**Test:** Seed an overdue loan (is_overdue: true in backend), navigate to /loans and the Overdue tab.
**Expected:** The row shows `bg-danger-bg` tint on the `<tr>`, the status pill reads "Overdue" (danger variant), and the Due column shows the `⚠ −{n}d` chip.
**Why human:** CSS class application and all three cues working together requires a browser render against a live overdue loan; cannot be confirmed by grep alone.

#### 2. ?itemId= picker pre-filter and FROM ITEM badge

**Test:** Navigate to /loans/new?itemId={real-item-id} with a known item that has inventory entries.
**Expected:** Inventory picker is filtered to only show entries for that item; FROM ITEM badge appears next to the label; if exactly one entry, it is auto-selected.
**Why human:** The conditional badge render and picker narrowing are tested by unit tests but the visual badge + locked-hint combination requires browser confirmation.

#### 3. Return / Extend / Edit dialog keyboard behaviour

**Test:** Open each dialog via its row button; press Tab, use keyboard to interact, press ESC.
**Expected:** Focus traps inside each dialog; ESC dismisses without submitting; Tab cycles through focusable elements in logical order.
**Why human:** Focus management and keyboard interaction for `RetroDialog`/`RetroConfirmDialog` require browser-level testing not covered by RTL.

---

### Gaps Summary

No gaps. All six LOAN requirements are substantively implemented and wired. The four binding overrides all hold in the shipped code. The pre-confirmed test suite results (602/602 unit, tsc clean, build clean, lint clean, E2E 2/2) are consistent with the codebase state.

The three human verification items above are visual/interaction quality checks. They do not block the requirement verdict — the requirement contracts (data wiring, endpoint selection, optimistic mutations, component existence) are all machine-verifiable and VERIFIED.

---

_Verified: 2026-06-13T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
