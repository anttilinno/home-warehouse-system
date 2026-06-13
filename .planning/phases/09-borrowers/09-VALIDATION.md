---
phase: 09-borrowers
nyquist_compliant: false
wave_0_complete: false
---

# Phase 9 — Borrowers — VALIDATION

Pre-execution validation contract. Flags flip true only after execution closes the Wave-0
gaps (MSW handlers + all test files). Orchestrator verifies at the phase gate.

## Requirement → evidence map
| Req | Deliverable | Verifiable by |
|-----|-------------|---------------|
| BORR-01 | `/borrowers` flat paginated list + client search + RetroPagination | BorrowersListPage.test (rows render, search filters, page nav) + live nav |
| BORR-02 | `/borrowers/new` create (name + optional email/phone/notes) | BorrowerFormPage.test (POST body asserted) |
| BORR-03 | `/borrowers/:id` detail mounts Phase-8 BorrowerLoanPanels (Active + History) | BorrowerDetailPage.test (panels present, profile rows) |
| BORR-04 | `/borrowers/:id/edit` edit profile | BorrowerFormPage.test (PATCH body, prefilled) |
| BORR-05 | delete blocked while active loan: red badge + "View active loans" link; 400 backstop | BorrowerDetailPage.test (active>0 → DELETE disabled + badge + link; active=0 → delete succeeds) + E2E |

## Binding overrides (must hold in shipped code)
1. List pagination CLIENT-side (fetch limit=100, PER_PAGE=25) — RetroPagination fed a client pageCount; never read `total` from the list response.
2. Search CLIENT-filter the loaded array — no `/borrowers/search` call from the list page.
3. Delete guard PROACTIVE (active-loan-count disables DELETE + badge) AND reactive (catch 400 string).
4. Create posts name + only-supplied optional fields; email format validated only when supplied.
5. No archive UI (hard-delete only).
6. `limit` ≤ 100 on every borrower read (422 over).
7. Query-key prefix `["borrowers", wsId, ...]`; render-loop guard mirrored from InventoryListPage.
8. routes/index.tsx single-writer/serialize (Phase-8 lesson) for borrowers list/new/:id/:id/edit (literal-before-param, AP-1).

## Phase gate (orchestrator)
- `bun run lint:tsc` clean, full `bun run test` green, `bun run build`, `bun run lint:imports` OK.
- Live Playwright borrower spec (create → list → detail → edit → delete-guard) isolated (auth limiter).
- gsd-verifier goal-backward PASS; flip BORR-01..05 + traceability; log visual residues.

## Nyquist sign-off (flip after execution)
- [ ] MSW borrowerHandlers shipped (Wave 0 gap).
- [ ] All component tests present + green.
- [ ] E2E spec discovered + green.
