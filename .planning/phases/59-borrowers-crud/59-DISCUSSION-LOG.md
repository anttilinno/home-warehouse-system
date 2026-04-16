# Phase 59: Borrowers CRUD — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 59-borrowers-crud
**Areas discussed:** Active loan count, Delete vs Archive flow, Borrower detail loans

---

## Active Loan Count

| Option | Description | Selected |
|--------|-------------|----------|
| Skip the count for now | Show name + contact info only. No count in API; N+1 queries not acceptable | ✓ |
| Show 'has active loans' badge | Simple badge, inferred lazily or from list-wide loans fetch | |
| Fetch all workspace loans, count client-side | One extra request; group by borrower_id to derive count | |

**User's choice:** Skip the count for now
**Notes:** BORR-01 will be satisfied with name + email/phone display. Accepted scope adjustment — loan count deferred until API exposes it natively.

---

## Delete vs Archive Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Archive-first (like Phase 58 taxonomy) | Primary ARCHIVE button, secondary "delete permanently" link, error toast on 400 | ✓ |
| Simple delete with error toast | Single confirm dialog, DELETE action, 400 surfaces as toast | |

**User's choice:** Archive-first (like Phase 58 taxonomy)
**Notes:** Consistent with taxonomy pattern. Archive is always available; hard-delete blocked by backend if active loans exist.

---

### Archived Borrower Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden by default, toggle to show | Filter chip reveals archived borrowers | ✓ |
| Shown inline with badge | Archived borrowers in main list with muted style + ARCHIVED badge | |

**User's choice:** Hidden by default, toggle to show
**Notes:** Consistent with future Items list archived toggle (ITEM-08).

---

## Borrower Detail Loans

| Option | Description | Selected |
|--------|-------------|----------|
| Wire real loans now | Fetch via loansApi.listForBorrower; detail page fully functional | |
| Placeholder sections only | Section headers + RetroEmptyState; Phase 62 wires real data | ✓ |

**User's choice:** Placeholder sections only
**Notes:** Aligns with ROADMAP note "loan data wired up in Phase 62". Keeps Phase 59 scope focused on borrower CRUD.

---

## Claude's Discretion

- List layout (RetroTable preferred for tabular contact-info data)
- BorrowerPanel component structure (following EntityPanel.tsx pattern)
- Route structure for `/borrowers` and `/borrowers/:id`
- Query invalidation strategy (invalidate borrowerKeys.all after mutations)
- Form schema details (name required, email/phone/notes optional)

## Deferred Ideas

None — discussion stayed within phase scope.
