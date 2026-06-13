---
phase: 08-loans
plan: 06
subsystem: loans-e2e
tags: [e2e, playwright, loans, lifecycle, phase-gate]
requires:
  - "08-02: /loans tabbed list (Active/Overdue/History)"
  - "08-03: /loans/new create form (RetroSelect pickers)"
  - "08-04: LoanRowActions + ReturnLoanDialog"
provides:
  - "live loan-lifecycle E2E phase-gate regression guard"
affects:
  - "frontend2/e2e (new spec only)"
tech-stack:
  added: []
  patterns:
    - "one-login-per-spec (Pitfall 5 / 20-min auth limiter)"
    - "cookie-authed page.request seeding (mirror inventory.spec.ts)"
    - "unique per-run identity via borrower name E2E-loan-${Date.now()}"
    - "locale-agnostic text matchers (/active/i, /returned/i)"
key-files:
  created:
    - frontend2/e2e/loans-lifecycle.spec.ts
  modified: []
decisions:
  - "Loan created through the /loans/new UI (LOAN-02 contract under test); borrower/item/location/inventory-entry seeded via page.request to stay within one login and keep focus on the loan chain."
  - "Row identity = unique per-run borrower name. Loan list rows embed borrower+item names (backend decorates every LoanResponse), so the row is addressable by borrower name — robust vs. the inventory-list name-join quirk."
  - "Return asserted via the dialog Return button; then Active-tab row count 0 + History-tab Returned status proves the lifecycle transition."
metrics:
  duration: ~10m
  completed: 2026-06-13
---

# Phase 8 Plan 06: Live Loan Lifecycle E2E Spec Summary

One batched Playwright spec drives the real loan lifecycle against the live backend + Postgres: log in once, seed a borrower + item + location + inventory entry via the inherited cookie, create the loan through the `/loans/new` UI, assert it appears in the Active tab, return it via the confirm dialog, and assert it moved to History — the phase-gate regression guard at the HTTP boundary (POL-01 pattern applied to loans).

## What was built

`frontend2/e2e/loans-lifecycle.spec.ts` — a single `test` containing the full chain:

1. **Login once** (`loginAsSeeder`, exact-match `/^log in$/i` submit) — respects the documented 20/min auth limiter (Pitfall 5 / T-08-E2E). All subsequent backend calls ride the inherited `access_token` cookie.
2. **Resolve workspace id** via `GET /api/users/me/workspaces` (the same endpoint `WorkspaceProvider` uses).
3. **Seed prerequisites** via cookie-authed `page.request.post`:
   - borrower (`POST /borrowers`, body `{ name }`) — unique name `E2E-loan-${Date.now()}` doubles as the loan row identity
   - item (`POST /items`, `{ name, sku }` — backend 422s without `sku`)
   - location (`POST /locations`, `{ name }`)
   - inventory entry (`POST /inventory`, `{ item_id, location_id, quantity:1, condition:"GOOD", status:"AVAILABLE" }`) — the loan targets this entry's id (`inventory_id`, never `item_id`; Pitfall 1 / override 1).
4. **Create the loan via UI**: `/loans/new` → select the inventory entry (option label contains the seeded item name) + the borrower (by unique name) in the native RetroSelects → `Create loan` → lands on `/loans?tab=active`.
5. **Active assertion**: the row matched by the unique borrower name is visible and shows an `/active/i` status pill.
6. **Return**: the row `RETURN` button opens the `RETURN LOAN?` blue confirm dialog → confirm with the dialog `Return` button → dialog hidden.
7. **Transition assertions**: the Active tab no longer lists the borrower-name row (`toHaveCount(0)`), and `/loans?tab=history` shows the row with a `/returned/i` status.
8. **Cleanup** (`finally`): best-effort archive of the inventory entry; the unique-named borrower/item/location are left inert.

## Verification

- In-plan gate (required, isolated per Pitfall 5 to avoid the auth limiter):
  `npx playwright test --list e2e/loans-lifecycle.spec.ts` → **PASS** — discovered 2 tests (`[chromium]` + `[firefox]`), tsc/parse clean.
- Locators validated against the live component structure:
  - `Window` renders its title in an `<h2>` (heading role) → `getByRole("heading", { name: /new loan/i })` ✓
  - `RetroSelect` associates label via `htmlFor`/`id` → `getByLabel(/inventory entry/i)` + `getByLabel(/^borrower$/i)` ✓
  - `ReturnLoanDialog` titlebar "RETURN LOAN?" + confirm label "Return" → dialog + button matchers ✓
  - Loan list rows embed `borrower.name` (backend `toLoanResponse` decoration) → `hasText: borrowerName` row identity ✓

The full live run (`bun run test:e2e e2e/loans-lifecycle.spec.ts`) is the orchestrator's phase gate, run isolated against the up dev stack — deliberately NOT executed here to keep this executor within one login and off the shared auth limiter.

## Deviations from Plan

None — plan executed exactly as written. The borrower create body (`{ name }`), item create body (`{ name, sku }`), inventory create body, and the loan UI flow were all confirmed against the live backend handlers and existing `inventory.spec.ts` before authoring.

## Self-Check: PASSED

- FOUND: frontend2/e2e/loans-lifecycle.spec.ts
- FOUND: .planning/phases/08-loans/08-06-SUMMARY.md
- Gate: `playwright test --list` discovered 2 tests (chromium + firefox)
