---
phase: 09-borrowers
plan: 03
subsystem: ui
tags: [react, react-hook-form, zod, react-router, playwright, borrowers]

# Dependency graph
requires:
  - phase: 09-01
    provides: borrowerFormSchema, useBorrowerMutations (create/update/del + 400 backstop), borrowersApi
  - phase: 09-02
    provides: /borrowers list route + BorrowersListPage
  - phase: 08
    provides: BorrowerLoanPanels + useBorrowerLoans (mounted unmodified)
provides:
  - BorrowerFormPage (create + edit, BORR-02/04) — blue Window, RHF+zod, dirty guard, omit-empty body
  - BorrowerDetailPage (BORR-03/05) — profile + mounted loan panels + proactive delete guard
  - routes /borrowers/new, /borrowers/:id/edit, /borrowers/:id (literal-before-param)
  - live Playwright spec e2e/borrowers.spec.ts (create→list→detail→edit→clean-delete, ONE login)
affects: [phase-09-gate, future scan-deeplink phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "form clones LoanFormPage/InventoryFormPage; detail clones ItemDetailPage"
    - "proactive delete guard via shared useBorrowerLoans cache (no extra fetch)"
    - "navigate at call site; the 09-01 hook owns only toast + 400 mapping"

key-files:
  created:
    - frontend2/src/features/borrowers/BorrowerFormPage.tsx
    - frontend2/src/features/borrowers/BorrowerFormPage.test.tsx
    - frontend2/src/features/borrowers/BorrowerDetailPage.tsx
    - frontend2/src/features/borrowers/BorrowerDetailPage.test.tsx
    - frontend2/e2e/borrowers.spec.ts
  modified:
    - frontend2/src/routes/index.tsx

decisions:
  - "Email validated only when supplied; empty optionals omitted from the wire body (never '')."
  - "Delete confirm is a plain pink RetroConfirmDialog (NOT type-to-confirm) — OQ6."
  - "Active-loan-blocked delete branch covered by component test (MSW 400), not live E2E (auth-limiter cost)."

metrics:
  duration: ~25m
  completed: 2026-06-13
---

# Phase 9 Plan 03: Borrower Form + Detail + Delete Guard + E2E Summary

Shipped the remaining borrower surfaces: a create/edit form (BORR-02/04) cloning
`LoanFormPage`/`InventoryFormPage`, a detail page (BORR-03) cloning
`ItemDetailPage` that mounts the shipped Phase-8 `BorrowerLoanPanels` and adds the
BORR-05 active-loan delete guard, the three route registrations (literal-before-param),
and a live Playwright lifecycle spec.

## What was built

- **BorrowerFormPage** — one blue Window (`NEW BORROWER` / `EDIT BORROWER`),
  RHF + `zodResolver(borrowerFormSchema)`, `max-w-[560px]`, dirty navigation guard
  (butter `DISCARD CHANGES?` + `beforeunload`), form-level error banner, pinned
  footer. Mode from `useParams` id. Edit prefills via `borrowersApi.get` and
  `reset()`s on resolve. `onSubmit` builds the wire body OMITTING empty optionals
  (`if (v.email) body.email = v.email`, etc.) — name only → `{ name }`. Create →
  `navigate('/borrowers/:newId')`, edit → `navigate('/borrowers/:id')`.
- **BorrowerDetailPage** — mint Window titled with the name, `actions` slot
  (`EDIT` + `DELETE…`), profile `<dl>` (ItemDetailPage Field/Muted pattern, missing
  optionals → muted `—`), 404 → `BORROWER NOT FOUND` empty state, load-error →
  `COULDN'T LOAD BORROWER` + RETRY. Mounts `<BorrowerLoanPanels>` unmodified.
  **Delete guard:** `activeCount = useBorrowerLoans(...).data?.active.length ?? 0`
  (shared cache). `activeCount > 0` → `DELETE…` disabled + `aria-disabled`, red
  `RetroBadge` (⚠ Active loans), and an inline `role="status"` danger banner with a
  `View active loans` link → `/loans?tab=active`. Delete confirm is a plain pink
  `RetroConfirmDialog`; `del.mutate(id, { onSuccess: () => navigate('/borrowers') })`
  — navigate at the call site. The 400 backstop from `useBorrowerMutations().del.onError`
  surfaces the active-loans toast.
- **routes/index.tsx** — added `borrowers/new` (ABOVE `:id`), `borrowers/:id/edit`,
  `borrowers/:id`. The existing 09-02 `borrowers` list route untouched.
- **e2e/borrowers.spec.ts** — single test, ONE login (exact-match `/^log in$/i`),
  cookie-authed: create via `/borrowers/new` → assert detail + panels → list (search
  to isolate the row) → EDIT → Save changes → clean DELETE → assert row gone.

## Verification

- `bun run lint:tsc` — clean (exit 0).
- `bun run test src/features/borrowers/` — 4 files, 31 tests passed
  (schema 9 [pre-existing] + ListPage 7 [pre-existing] + FormPage 6 + DetailPage 7;
  new this plan: 13).
- `npx playwright test --list e2e/borrowers.spec.ts` — discovered in both
  chromium + firefox (2 tests).
- `bun run lint:imports` — OK.

The live `borrowers.spec.ts` run is the orchestrator's isolated phase-gate step
(needs the live stack + single auth login); not run here per the in-plan gate.

## Deviations from Plan

None — plan executed as written.

## Known Stubs

None.
