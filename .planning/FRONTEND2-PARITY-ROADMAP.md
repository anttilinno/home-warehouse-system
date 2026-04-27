# Frontend2 Parity Roadmap

> Proposal — not yet merged into `ROADMAP.md`. Scope: bring `/frontend2` (Vite + React Router 7 SPA) to **feature parity** with the legacy `/frontend` (Next.js App Router) so the legacy app can be retired.

*Created: 2026-04-27*
*Author: assist gap analysis after Phase 65 close*

## Status of `/frontend2` today

`/frontend2` already covers the **read + create core**: auth, dashboard, items list/new/detail, loans list, borrowers list/detail, taxonomy management, scan flow (Phase 64-65), settings hub, photo upload. Roughly **60% of legacy routes** and **45% of legacy components** by count.

What's missing is almost entirely **mutation surface** (item edit, loan/borrower CRUD beyond create) plus a handful of feature-flagged subsystems (approvals, containers, imports, declutter, analytics, my-changes, sync-history).

The existing v2.2 milestone (Phases 64-72) is dedicated to **scanning + stabilization** and does *not* close the parity gap. This roadmap is the work that comes after — a proposed v2.3 milestone.

## Estimated total effort

**~10–12 developer days** for a feature-complete, tested MVP, broken into 7 sequenced phases. Not large because the tech stack and patterns are identical (React 19, TanStack Query, react-hook-form + zod, Tailwind, retro components). Missing features are linear additions, not rewrites.

## Proposed milestone: v2.3 — Frontend2 Parity & Legacy Retirement

Depends on: Phase 63 (v2.1 close — core items/loans/borrowers landed) and Phase 66 (Quick-Action Menu, in flight). Independent of the rest of v2.2.

### Phase A — Item Edit + Mutation Hooks
**Goal:** Items have full CRUD parity. User can open `/items/:id/edit`, modify any field, save, and see the cache reflect the change.
**Why first:** Highest user-impact gap, lowest risk — `ItemFormPage` exists for `/items/new`; clone + add update mutation.
**Requirements (proposed):** PAR-ITEM-01 (edit form), PAR-ITEM-02 (delete with confirm), PAR-ITEM-03 (mutation hooks invalidate correctly).
**Effort:** ~1.5 days
**Surface:** `/items/:id/edit`, `useUpdateItem`, `useDeleteItem`, item-detail "Edit" button.

### Phase B — Loan Detail & CRUD
**Goal:** Loans have full lifecycle. User can open `/loans/:id`, edit, return, extend, and delete.
**Requirements (proposed):** PAR-LOAN-01 (detail page), PAR-LOAN-02 (edit/return/extend), PAR-LOAN-03 (delete with confirm).
**Effort:** ~1.5 days
**Surface:** `/loans/:id`, `/loans/:id/edit`, `useUpdateLoan`, `useReturnLoan`, `useDeleteLoan`.

### Phase C — Borrower CRUD
**Goal:** Borrower create/edit/delete from `/borrowers` list and `/borrowers/:id` detail.
**Requirements (proposed):** PAR-BOR-01 (create form), PAR-BOR-02 (edit form), PAR-BOR-03 (delete with confirm + active-loan guard).
**Effort:** ~1 day — pattern identical to Loan/Item; `BorrowerForm` already exists in part.
**Surface:** `/borrowers/new`, `/borrowers/:id/edit`, mutation hooks.

### Phase D — Containers & Hierarchical Inventory
**Goal:** Container CRUD ported. User can create/edit/delete containers and assign items to them.
**Why now, not deferred:** Containers are an established taxonomy in the data model (live in `frontend/app/[locale]/(dashboard)/dashboard/containers/`) and items reference them; without UI, container assignments become read-only orphans.
**Requirements (proposed):** PAR-CONT-01..04.
**Effort:** ~1.5 days — clone the taxonomy/categories pattern from Phase 58.

### Phase E — Approvals Workflow
**Goal:** Pending change approvals (the multi-user review queue) port to `/frontend2`. Highest-complexity phase: decision logic, validation, state guards.
**Why this is the heaviest:** Not a standard CRUD form — branching workflow with reject/approve/needs-changes states, free-text notes, and entity-specific diff rendering.
**Requirements (proposed):** PAR-APP-01..05 (queue list, detail view, approve/reject actions, notes, diff render).
**Effort:** ~2 days
**Surface:** `/approvals`, `/approvals/:id`, `useApprovalsQueue`, `useDecideApproval`.

### Phase F — Imports / Export (CSV Backup & Restore)
**Goal:** CSV-based bulk operations (the legacy `/imports` and `/data` flows) available in `/frontend2`.
**Requirements (proposed):** PAR-IO-01 (export workspace), PAR-IO-02 (import CSV with validation preview), PAR-IO-03 (progress indicator + error report).
**Effort:** ~1 day — the backend endpoints already exist (`/import/workspace`, `/export/workspace`).
**Surface:** Settings → Data subpage gets active controls (currently stubbed).

### Phase G — Read-only Auxiliaries (Analytics, My-Changes, Sync-History, Declutter, Out-of-Stock)
**Goal:** Read-only legacy screens ported as a batch. Lower-value, high-coverage tail.
**Decision needed:** Which of these are still wanted vs. dropped? Sync-history is meaningless in online-only `/frontend2` (no offline mutation queue). Declutter and out-of-stock are useful filters. Analytics is debatable.
**Requirements (proposed):** PAR-AUX-01..04 (one per kept screen).
**Effort:** ~1–1.5 days depending on what survives the cull.

### Phase H — Legacy Retirement (Gate)
**Goal:** Delete `/frontend` once parity verified.
**Success Criteria:**
1. All v2.3 requirements (PAR-*) marked Complete in REQUIREMENTS.md.
2. E2E suite covers the new mutation surfaces (extend `frontend2/e2e/`).
3. CI build for `/frontend` removed; nginx/proxy config routes only to `/frontend2`.
4. `/frontend` directory deleted in a single commit; this commit is reversible if regressions found.
**Effort:** ~0.5 days

## Dependency graph

```
A (item edit) ─┐
B (loan CRUD) ─┼─ all parallel; same patterns, different entities
C (borrower) ──┘
        │
        ▼
D (containers) ─── after A so item↔container linkage is complete
        │
        ▼
E (approvals) ─── biggest, can start in parallel with D
        │
        ▼
F (imports) ─── after A/D so CSV diff knows about all entity fields
        │
        ▼
G (auxiliaries) ─── parallelizable, low priority
        │
        ▼
H (retirement gate) ─── after all of A-G
```

## Open decisions before planning starts

| # | Question | Default if unanswered |
|---|----------|----------------------|
| 1 | Drop sync-history / my-changes? `/frontend2` is online-only, so the offline mutation queue these surfaced doesn't exist. | Drop both. |
| 2 | Keep analytics screen? Legacy version is sparse (counts + charts). Backend has no dedicated analytics endpoint. | Drop or stub for v2.4. |
| 3 | Approvals workflow — does it still match current backend contract? Backend may have evolved since `/frontend` last shipped. | Audit before planning Phase E. |
| 4 | Declutter assistant — port as-is or redesign? Legacy version is mobile-only, opinionated. | Port as-is, redesign later. |
| 5 | Imports CSV — keep CSV format, or move to JSON? Backend supports both. | Keep CSV (user familiarity). |

## Out of scope for v2.3

- Offline / PWA in `/frontend2` — explicit v2.0 decision (online-only).
- Mobile FAB — already covered by Phase 67 in v2.2.
- Quick Capture — already covered by Phase 69 in v2.2.
- Backend changes — every endpoint listed already exists. v2.3 is pure frontend porting.
- Marketing / landing page — separate concern, not part of authenticated app.

## Progress

| Phase | Name | Effort | Status |
|-------|------|--------|--------|
| A | Item Edit + Mutations | 1.5d | Not started |
| B | Loan Detail & CRUD | 1.5d | Not started |
| C | Borrower CRUD | 1d | Not started |
| D | Containers | 1.5d | Not started |
| E | Approvals Workflow | 2d | Not started |
| F | Imports / Export | 1d | Not started |
| G | Read-only Auxiliaries | 1–1.5d | Not started — decisions pending |
| H | Legacy Retirement Gate | 0.5d | Not started |

**Total:** ~10–12 days, sequenced or partly parallel.

---

*Next step:* run `/gsd-new-milestone v2.3 "Frontend2 Parity & Legacy Retirement"` to fold this into the live roadmap, or `/gsd-spec-phase A` to start refining Phase A in detail.
