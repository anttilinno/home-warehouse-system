---
phase: 08-loans
plan: 03
subsystem: loans
tags: [loans, create-form, rhf, zod, pickers, routing]
requires:
  - "08-01: loansApi.create + CreateLoanBody (inventory_id contract)"
  - "08-02: loans literal route in routes/index.tsx"
provides:
  - "/loans/new create-loan form (LOAN-02)"
  - "useLoanPickerOptions hook (inventory-entry + borrower options, limit=100, ?itemId filter)"
  - "loanFormSchema (zod, past-date refinement)"
  - "loans/new route (literal-before-param)"
affects:
  - "frontend2/src/routes/index.tsx (added loans/new above loans literal)"
tech-stack:
  added: []
  patterns:
    - "InventoryFormPage mirror: blue Window, RHF + zodResolver, Controller + RetroSelect, dirty-guard butter confirm, form-level error banner, max-w-[560px]"
    - "limit=100 picker clamp (the 422-cap lesson)"
    - "?deep-link PRE-FILTERS a picker (does not preselect/lock a field) — override 1"
key-files:
  created:
    - frontend2/src/features/loans/schema.ts
    - frontend2/src/features/loans/hooks/useLoanPickerOptions.ts
    - frontend2/src/features/loans/LoanFormPage.tsx
    - frontend2/src/features/loans/LoanFormPage.test.tsx
  modified:
    - frontend2/src/routes/index.tsx
decisions:
  - "Form posts inventory_id, never item_id (Pitfall 1 / override 1) — asserted in test"
  - "quantity fixed at 1 this phase (injected in onSubmit, not a user field / not in schema)"
  - "?itemId filters the inventory picker + FROM ITEM badge + auto-selects on single match; with multiple matches the user still chooses the entry"
  - "Inventory option label joins the item name (items?limit=100, mirrors InventoryListPage) + qty·condition disambiguator since the Inventory type carries no embedded name"
  - "loaned_at omitted — defaults server-side (CreateLoanBody)"
metrics:
  duration: ~5m
  completed: 2026-06-13
  tasks: 3
  files: 5
---

# Phase 8 Plan 03: /loans/new Create Form Summary

The single create-loan surface (LOAN-02): a blue-titled `NEW LOAN` Window with an
inventory-entry picker + borrower picker (both clamped to limit=100), an optional
due date (client past-date zod guard) and notes. Submitting posts
`{ inventory_id, borrower_id, quantity:1, due_date?, notes? }` — `inventory_id`,
NEVER `item_id` (override 1). `/loans/new?itemId=X` PRE-FILTERS the inventory
picker to that item's entries, shows a `FROM ITEM` badge, auto-selects when exactly
one entry matches, and autofocuses the borrower field — the forward-compat target
for the Phase 11 scan deep link.

## What was built

- **schema.ts** — `loanFormSchema`: `inventory_id`/`borrower_id` required, optional
  `due_date` (YYYY-MM-DD), optional `notes` (max 1000). A refinement rejects a
  supplied past due date ("Due date can't be in the past."). Input/output type
  split mirrors the inventory schema. quantity is intentionally absent (fixed at 1).
- **hooks/useLoanPickerOptions.ts** — two workspace-scoped reads at limit=100:
  inventory entries (via `inventoryApi.list(ws, {limit:100})`) and borrowers (via
  `get<{items}>('/workspaces/{ws}/borrowers?limit=100')`), plus an items?limit=100
  read for the name join. Keyed `["inventory", wsId, {limit:100}]` /
  `["borrowers", wsId, {limit:100}]` / `["items", wsId, {limit:100}]`. Accepts an
  optional `itemIdFilter` that narrows inventory options by `item_id`. Returns
  `{ inventoryOptions, borrowerOptions, isLoading }`.
- **LoanFormPage.tsx** — RHF + `zodResolver(loanFormSchema)`, Controller-wrapped
  RetroSelects, RetroInput type=date, RetroTextarea. `?itemId` via useSearchParams
  → `itemIdFilter`; FROM ITEM RetroBadge + locked hint + auto-select on single
  match. Dirty-guard butter `DISCARD CHANGES?` confirm. On success: retroToast +
  invalidate `["loans", wsId]` (+ the item's `["loans", wsId, "by-item", itemId]`
  key when created from ?itemId), then navigate to `/items/{itemId}` (from-item) or
  `/loans?tab=active`.
- **routes/index.tsx** — `<Route path="loans/new" element={<LoanFormPage />} />`
  registered ABOVE the existing `loans` literal route (literal-before-param, AP-1).
- **LoanFormPage.test.tsx** — 6 MSW-backed cases.

## Verification

- `bun run lint:tsc` → clean.
- `bun run lint:imports` → OK.
- `bun run test src/features/loans/` → 3 files, 16 tests pass (6 new in this plan).
- LoanFormPage cases: render+pickers; submit asserts `inventory_id` set + NO
  `item_id` on the wire (the load-bearing override-1 assertion) + quantity:1 +
  RFC3339 due_date + notes; ?itemId filters to it-2 entries + FROM ITEM + auto-select
  inv-3; past-date blocks submit with the field error; empty borrower / empty
  inventory disable their select with the add-one-first hint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Test correctness] Duplicate item-name labels + async picker load**
- **Found during:** Task 3 (GREEN run)
- **Issue:** Two inventory entries share item it-1 ("Cordless Drill"), so the
  picker renders two options containing that text — `within(select).getByText`
  threw "Found multiple elements". The ?itemId filter assertion and a couple of
  picker-ready waits also ran before the inventory query settled.
- **Fix:** Switched the picker-populated readiness checks to `getAllByText(...).length`
  and wrapped the filtered-option + Ladder assertions in `waitFor`. No production
  code changed — test-only adjustment to match the (intentional) duplicate-label
  fixture and async load.
- **Files modified:** frontend2/src/features/loans/LoanFormPage.test.tsx
- **Commit:** da3c657

## Known Stubs

None — the form is fully wired to `loansApi.create` and live picker reads. The
`borrowers` and `inventory`/`items` reads hit real backend endpoints in prod (MSW
only in tests).

## Threat Flags

None — no new network surface beyond the planned `loansApi.create` POST and the
wsId-scoped picker reads already in the threat model (T-08-03 / T-08-VAL). The form
posts only ids drawn from wsId-scoped picker lists; the server is authoritative.

## Self-Check: PASSED

- FOUND: frontend2/src/features/loans/schema.ts
- FOUND: frontend2/src/features/loans/hooks/useLoanPickerOptions.ts
- FOUND: frontend2/src/features/loans/LoanFormPage.tsx
- FOUND: frontend2/src/features/loans/LoanFormPage.test.tsx
- FOUND (modified): frontend2/src/routes/index.tsx
- FOUND: commit 0515901 (schema + hook)
- FOUND: commit 0c23a76 (RED test)
- FOUND: commit da3c657 (GREEN impl + route)
