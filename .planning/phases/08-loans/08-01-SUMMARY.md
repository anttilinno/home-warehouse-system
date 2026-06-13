---
phase: 08-loans
plan: 01
subsystem: loans-contracts
tags: [loans, api-contract, csv-export, msw, status-derivation]
requires: []
provides:
  - loansApi.{list,active,overdue,get,create,return,update,extend,byBorrower}
  - CreateLoanBody (inventory_id)
  - loanStatus(loan) → {variant,label}
  - loansToCsvBlob + triggerCsvDownload
  - loanHandlers (MSW)
affects:
  - frontend2/src/lib/api/loans.ts
tech-stack:
  added: []
  patterns:
    - "Bare {items} list envelopes (huma $schema omitted, Pitfall 4)"
    - "Server-authoritative status flags (no client due-date math, override 2)"
    - "Client-generated in-memory CSV (no backend export, override 3)"
    - "CSV-injection escape: prefix guard + quote-wrap (T-08-CSV)"
key-files:
  created:
    - frontend2/src/features/loans/loanStatus.ts
    - frontend2/src/features/loans/loanCsv.ts
    - frontend2/src/features/loans/loanCsv.test.ts
    - frontend2/src/test/msw/loanHandlers.ts
  modified:
    - frontend2/src/lib/api/loans.ts
decisions:
  - "Create body uses inventory_id (NOT item_id) — loan binds a stocked entry (override 1 / Pitfall 1)"
  - "Status derived from returned_at + is_overdue server flags only — never Date.now/due_date (override 2)"
  - "CSV built client-side from fetched rows via object URL — no /export/loan call (override 3, T-08-TOKEN)"
metrics:
  duration: ~6m
  completed: 2026-06-13
---

# Phase 8 Plan 01: Loans Foundation (Contracts) Summary

Wave 1 contracts-only foundation for Phase 8: extended `loansApi` with the full
lifecycle surface, added the two pure helpers downstream plans consume
(server-flag status derivation + injection-safe client CSV), and shipped MSW loan
handlers so Wave 2/3 component tests have a mockable backend. No UI in this plan.

## What Was Built

- **`loansApi` extension** — added `CreateLoanBody` (field `inventory_id`, never
  `item_id`) and nine methods: `list/active/overdue/get/create/return/update/extend/byBorrower`.
  Lists typed as bare `{ items: Loan[] }`; single-entity routes return `Loan`.
  `byItem` + `PartitionedLoans` left byte-identical (only the import line widened
  from `{ get }` to `{ get, post, patch }`).
- **`loanStatus.ts`** — pure `loanStatus(loan)` returning `{variant,label}` via the
  precedence `returned_at → is_overdue → active`. Reads server flags only; header
  comment cites override 2 (no due-date math).
- **`loanCsv.ts`** — `loansToCsvBlob(rows)` builds a `text/csv` Blob; every cell
  passes through an escape fn (formula-prefix `'` guard for `= + - @ \t \r`, quote
  doubling, quote-wrap). Status column reuses the override-2 precedence
  (lowercased). `triggerCsvDownload` streams via `URL.createObjectURL` →
  anchor click → `revokeObjectURL` (no backend call).
- **`loanCsv.test.ts`** — 5 cases: header row, empty→header-only `text/csv`,
  injection-prefix guard (6 dangerous prefixes), embedded-quote escaping,
  override-2 status precedence.
- **`loanHandlers.ts`** — MSW handlers for list/active/overdue, byBorrower,
  create, return, extend, update, get. Fixture set includes one ACTIVE, one
  OVERDUE (`is_overdue:true`), one RETURNED loan. Lists serve bare `{items}`;
  specific `:id` sub-routes registered before the `:id` catch-all.

## Binding Overrides Honored

| Override | Implementation |
|----------|----------------|
| 1 — create uses `inventory_id` | `CreateLoanBody.inventory_id`; no `item_id` anywhere |
| 2 — server-authoritative overdue | `loanStatus` + CSV status read `returned_at`/`is_overdue`; grep gate (comments stripped) returns 0 for `Date.now`/`due_date <` |
| 3 — client CSV, no backend export | `loansToCsvBlob` + object-URL download; no `/export/loan`, no `downloadBlob` |

## TDD Gate Compliance

Task 3 (loanCsv) followed RED→GREEN: test written first (failed to import — no
impl), then implementation made it green (5/5). Tasks 1–2 are type/pure-contract
tasks whose behavior is exercised through downstream consumer tests (per plan
note: loanStatus "has no test of its own here"); their gates are tsc + the
override grep, both green.

## Verify Gate Results

- `bun run lint:tsc` — clean (no output, exit 0).
- `bun run test src/features/loans/` — 1 file, 5 tests passed.
- Task 1 grep: `inventory_id` count = 2 (interface field + comment).
- Task 2 grep (comments stripped): `Date.now|due_date <` count = 0.
- `byItem`/`PartitionedLoans` additions-only confirmed via `git show` (only the
  import line changed).

## Deviations from Plan

None — plan executed exactly as written. The single removed line in the Task 1
diff is the widened import (`{ get }` → `{ get, post, patch }`), which the plan's
`<action>` explicitly instructs ("Add `post` and `patch` to the existing import line").

## Threat Surface

No new surface beyond the plan's `<threat_model>`. T-08-CSV mitigated by the
escape fn + tests; T-08-TOKEN mitigated by in-memory object-URL export. No
network endpoints, auth paths, or schema changes introduced.

## Known Stubs

None. All deliverables are functional contracts; MSW fixtures are intentional
test doubles, not production stubs.

## Self-Check: PASSED

- frontend2/src/lib/api/loans.ts — FOUND (modified)
- frontend2/src/features/loans/loanStatus.ts — FOUND
- frontend2/src/features/loans/loanCsv.ts — FOUND
- frontend2/src/features/loans/loanCsv.test.ts — FOUND
- frontend2/src/test/msw/loanHandlers.ts — FOUND
- Commits 8ca0c64b, 21da4366, fbc9c751 — present on exec/08-01
