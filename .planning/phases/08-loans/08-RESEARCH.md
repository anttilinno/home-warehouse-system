# Phase 8: Loans - Research

**Researched:** 2026-06-13
**Domain:** Loan lifecycle CRUD on frontend2 (React 19 + RR7 lib mode + TanStack Query 5 + retro-os atoms) against the existing Go/huma backend loan domain
**Confidence:** HIGH (every backend contract verified by reading handler source AND live curl against the running stack)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Query keys `["loans", wsId, ...]` per Phase 6 contract. SSE map: `loan` entity_type already registered (bootstrap row, Phase 6). Reuse `loansApi`; extend it with list/tabs/create/return/edit/extend/CSV.
- All UI from shipped atoms (RetroTabs, RetroTable, FilterBar, Dialog/ConfirmDialog, FormField, Select, StatusPill, Pagination) + Phase 7 patterns.
- Loan status → StatusPill: active/overdue/returned (backend enum confirmed below). Overdue is a **server-computed flag** (`is_overdue`); danger row highlight + pill.
- Pickers: item + borrower simple selects (limit ≤ 100 — the 7b/Phase-7 cap lesson; clamp).
- Return/extend optimistic + revert (Phase 7b inline pattern); confirm dialog for return.
- Routes: /loans, /loans/new, /loans/:id (detail or edit) under AppShell; Sidebar INVENTORY Loans entry enabled.
- ?itemId= via useSearchParams preselect (Phase 7 form-prefill pattern).
- CSV via blob helper (Phase 7 downloadBlob) — **see RESOLVED Open Question 1: backend has NO loan export; CSV must be client-generated.**

### Claude's Discretion
- Tab implementation (URL param ?tab= vs local state — prefer URL for deep-link consistency with Phase 7 list), loan detail vs inline edit, exact columns, borrower-panel placement.

### Deferred Ideas (OUT OF SCOPE)
- Borrowers list/CRUD (Phase 9) — read-only picker + panels here.
- Scan deep-link source (Phase 11) — honor ?itemId= only.
- Central exports screen (Phase 14) — per-list export button only is in scope here.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOAN-01 | Tabbed Active/Overdue/History loans list (item/borrower/due/status pill) | `GET /loans/active`, `/loans/overdue` are dedicated endpoints; History = `GET /loans` filtered client-side on `!is_active`. RetroTabs + RetroTable patterns from ItemDetailPage/ItemsListPage. |
| LOAN-02 | Create loan via /loans/new with item + borrower pickers, `?itemId=` preselect | `POST /loans` body shape verified. Picker pattern = `usePickerOptions` (limit=100 RetroSelect). **GOTCHA: create body wants `inventory_id`, NOT `item_id`** — see Pitfall 1. |
| LOAN-03 | Mark returned via confirm dialog → History | `POST /loans/{id}/return` (verified; returns decorated loan). RetroConfirmDialog + optimistic mutation. |
| LOAN-04 | Edit due date + notes after creation | `PATCH /loans/{id}` body `{due_date?, notes?}` (verified). |
| LOAN-05 | Item detail Active Loan + Loan History panels (make Phase 7 stub real) | `LoanPanels.tsx` + `useItemLoans` already SHIPPED read-only; wire return/extend mutations + enable the disabled RETURN button. |
| LOAN-06 | Borrower detail Active + History panels | `GET /borrowers/{borrower_id}/loans` verified. Borrower detail PAGE is Phase 9 → **build component-only** (no borrower detail route exists in frontend2 yet — see RESOLVED OQ2). |
</phase_requirements>

## Summary

The backend loan domain is fully built, decorated, and SSE-wired — this is a pure frontend
parity phase. Every endpoint the phase needs already exists and was verified live. The
critical structural facts: (1) loans are keyed on **`inventory_id`, not `item_id`** — the
create form picks an inventory entry, not an item definition; (2) `is_active` and `is_overdue`
are **server-computed boolean flags** on every `LoanResponse` (no status enum string on the
wire — the three "statuses" are derived from those two booleans); (3) Active/Overdue have
**dedicated endpoints** (`/loans/active`, `/loans/overdue`) — there is no `?status=` query
param; (4) there is **no CSV export for loans** — `/export/loan` returns HTTP 400 (loan is not
a supported export entity type), so the per-list CSV button must be **client-generated** from
the already-fetched rows, not a `downloadBlob` call.

The frontend foundation is largely in place: `frontend2/src/lib/api/loans.ts` exists with
`loansApi.byItem` (07-01), the `Loan` type is fully modelled in `lib/types.ts`, `LoanPanels.tsx`
ships read-only panels on ItemDetailPage with a disabled RETURN button explicitly hinting
"Phase 8", and the Sidebar already has a `Loans` nav entry (currently disabled — just add
`to="/loans"`). The SSE invalidation map already routes `loan` events to `["loans"]`. So this
phase **extends** rather than rebuilds: add list/create/return/edit/extend methods to `loansApi`,
add three routes, build a tabbed list page mirroring `ItemsListPage`, make the existing panels
interactive, and build a prop-driven borrower-loan-panel component (mountable later by Phase 9).

**Primary recommendation:** Extend `loansApi` with `list`/`active`/`overdue`/`get`/`create`/`return`/`update`/`extend`/`byBorrower`; build `/loans` as a `?tab=`-driven RetroTabs page calling the three list endpoints; reuse the Phase-7b optimistic-mutation pattern for return/extend; client-generate the CSV; ship `BorrowerLoanPanels` as a prop-driven component with unit tests but no route.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Loan list (active/overdue/history) | API / Backend | Frontend (tab routing) | Backend owns the active/overdue determination via dedicated endpoints; frontend only partitions History client-side on `!is_active`. |
| Overdue determination | API / Backend | — | `is_overdue` is computed server-side (`due_date < now AND returned_at == nil`). Frontend MUST NOT recompute — render the flag. |
| Create / return / extend / edit | API / Backend | Frontend (optimistic UI) | All mutations are server-authoritative; frontend does optimistic patch + revert-on-error. |
| Loan→item/borrower decoration | API / Backend | — | Every `LoanResponse` is decorated server-side with embedded `item` + `borrower` names; frontend never joins. |
| Item/borrower pickers | Frontend | API (read lists) | Frontend fetches read lists (limit=100) and maps to RetroSelect options. |
| CSV export | Frontend | — | **No backend loan export.** Frontend generates CSV from fetched rows in-memory. |
| SSE cache invalidation | Frontend | API (publish) | Backend publishes `loan.created/returned/updated`; frontend's existing dispatcher invalidates `["loans"]`. |

## Standard Stack

No new dependencies. This phase is built entirely from the shipped toolchain and atoms.

### Core (already installed — verified in frontend2)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | 5.x | Server state, optimistic mutations | Phase 6 contract; query keys `["loans", wsId, ...]` |
| `react-router` | 7.x (lib mode) | Routes `/loans`, `/loans/new`, `/loans/:id`; `useSearchParams` for `?tab=`/`?itemId=` | AP-1 library mode; literal-before-param ordering |
| `react-hook-form` + `zod` + `@hookform/resolvers/zod` | 7.x / 4.x | Create/edit loan form | Mirrors `ItemFormPage`/`InventoryFormPage` |
| `@lingui/react/macro` | — | `Trans`/`useLingui` i18n | All user strings (no inline literals) |

### Supporting (retro atoms — all shipped, `@/components/retro`)
| Atom | Purpose |
|------|---------|
| `RetroTabs` + `RetroTab` | Active/Overdue/History tabs (used in ItemDetailPage already) |
| `RetroTable` | Loan rows (item / borrower / due date / status pill) |
| `StatusPill` | active=info, overdue=danger, returned=ok |
| `RetroConfirmDialog` | Return confirmation |
| `RetroSelect` | Item + borrower pickers (native select, no type-ahead per lock) |
| `FilterBar` / `RetroPagination` / `RetroEmptyState` / `Window` / `BevelButton` | List chrome |
| `retroToast` | error toasts on mutation failure |
| `useShortcuts` | route shortcuts (N → new loan) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-generated CSV | `downloadBlob('/export/loan')` | **Not viable — backend returns 400.** Client-gen is the only path until a backend `loan` export entity lands (defer to Phase 14). |
| Three list endpoints | `GET /loans` + client partition into 3 tabs | The dedicated `/active` + `/overdue` endpoints push the active/overdue computation server-side (correct tier) and avoid pulling returned loans into the Active tab. Use them. History = `GET /loans` filtered `!is_active`. |

**Installation:** None. `npm`/`bun` install is a no-op for this phase.

## Package Legitimacy Audit

> Not applicable — this phase installs **zero** new external packages. All dependencies are
> already present in `frontend2/package.json` and were shipped/audited in Phases 1-7b.

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────────────────────────────────┐
  /loans?tab=active ───▶│  LoansListPage (RetroTabs, ?tab= URL)     │
                        │   active tab  → useLoansQuery("active")   │──▶ GET /loans/active
                        │   overdue tab → useLoansQuery("overdue")  │──▶ GET /loans/overdue
                        │   history tab → useLoansQuery("all")      │──▶ GET /loans  ──┐
                        │                  filter !is_active        │                 │ {items:[Loan]}
                        │   [⤓ EXPORT] → client-gen CSV from rows   │                 │ each Loan is
                        └───────┬───────────────────────────────────┘                 │ server-decorated
                                │ row click                                            │ with item+borrower
                                ▼                                                      ▼
  /loans/new?itemId= ──▶ LoanFormPage (RHF+zod)            /loans/:id ──▶ LoanDetailPage
        │  item picker  ──▶ GET /items?limit=100               │  RETURN  ──▶ POST /loans/{id}/return
        │  borrower pk  ──▶ GET /borrowers?limit=100            │  EXTEND  ──▶ PATCH /loans/{id}/extend
        │  ⚠ resolves item → inventory_id (Pitfall 1)           │  EDIT    ──▶ PATCH /loans/{id}
        └─ POST /loans {inventory_id,borrower_id,quantity,...}  └─────────────┬─────────────────
                                                                              │
   ItemDetailPage (LOAN-05) ──▶ useItemLoans ──▶ GET /items/{id}/loans        │ all mutations
        ActiveLoanPanel (enable RETURN) + LoanHistoryList                     ▼ publish SSE
                                                              loan.created/returned/updated
   BorrowerLoanPanels (LOAN-06, component-only) ──▶ GET /borrowers/{id}/loans         │
                                                                                      ▼
                                                  SSEProvider dispatcher → invalidate ["loans", wsId]
                                                  (already wired — Phase 6 bootstrap row)
```

### Recommended Feature Structure (mirror `features/inventory`)
```
frontend2/src/
├── lib/api/loans.ts                         # EXTEND existing (add list/active/overdue/get/create/return/update/extend/byBorrower)
├── features/loans/
│   ├── LoansListPage.tsx                     # tabbed list (?tab=); RetroTabs + RetroTable + CSV
│   ├── LoanFormPage.tsx                      # /loans/new + /loans/:id/edit; RHF+zod; pickers
│   ├── LoanDetailPage.tsx                    # /loans/:id (or fold edit inline — discretion)
│   ├── schema.ts                             # zod loan form schema
│   ├── loanCsv.ts                            # client-side CSV builder (NO backend export)
│   ├── hooks/
│   │   ├── useLoansQuery.ts                  # tab → endpoint selector; keys ["loans", wsId, tab|"by-...", ...]
│   │   ├── useLoanMutations.ts               # create/return/extend/update; optimistic + revert
│   │   └── usePickerOptions.ts (loans)       # items + borrowers at limit=100  (or reuse/extend the inventory one)
│   └── components/
│       └── BorrowerLoanPanels.tsx            # LOAN-06 prop-driven (borrowerId); unit-tested; NO route this phase
└── features/items/components/LoanPanels.tsx  # MAKE REAL: enable RETURN, wire mutations
```

### Pattern 1: Tab → endpoint selector (mirror ItemsListPage URL-param writer)
**What:** `?tab=active|overdue|history` (default active) drives which endpoint the query hits.
**When:** LoansListPage top-level.
```typescript
// useLoansQuery.ts — query key includes the tab so the three caches coexist.
// ["loans", wsId] PREFIX still matches the SSE invalidation rule (§2 of the contract).
const tab = searchParams.get("tab") ?? "active";
const endpoint =
  tab === "overdue" ? "loans/overdue" :
  tab === "history" ? "loans" : "loans/active";
useQuery({
  queryKey: ["loans", wsId, tab],
  queryFn: () => get<{ items: Loan[] }>(`/workspaces/${wsId}/${endpoint}`)
    .then((r) => tab === "history" ? r.items.filter((l) => !l.is_active) : r.items),
  enabled: Boolean(wsId),
});
```

### Pattern 2: Optimistic return/extend with revert (mirror useInventoryMutations)
**What:** snapshot every `["loans", wsId]` query, patch the matching loan in place, revert + persistent toast on error, re-invalidate on settle.
**When:** return + extend + edit mutations.
```typescript
// Source: frontend2/src/features/inventory/hooks/useInventoryMutations.ts (verbatim pattern)
const prefix = ["loans", wsId];
async function optimisticPatch(id, patch) {
  await queryClient.cancelQueries({ queryKey: prefix });
  const snapshots = queryClient.getQueriesData({ queryKey: prefix });
  queryClient.setQueriesData({ queryKey: prefix }, (old) =>
    old?.items ? { ...old, items: old.items.map((l) => l.id === id ? { ...l, ...patch } : l) } : old);
  return { snapshots };
}
// onError: snapshots.forEach(([k,d]) => qc.setQueryData(k,d)); retroToast.error(...)
// onSettled: qc.invalidateQueries({ queryKey: prefix })
```

### Pattern 3: Picker options at LIMIT=100 (the 7b/Phase-7 422 cap lesson)
**What:** read lists are fetched once at `limit=100` and mapped to flat `{id,label}` options. The backend `Limit` query param is `maximum:"100"` — exceeding it is a 422.
**When:** item picker + borrower picker on the create form.
```typescript
// Verified caps: ListLoansInput.Limit max=100, ListBorrowersInput.Limit max=100, items list max=100.
// Mirror usePickerOptions.ts — but add borrowers; items uses GET /items?limit=100, borrowers GET /borrowers?limit=100.
```

### Pattern 4: Client-side CSV (no backend export)
**What:** build a CSV string from the rows already in the tab's query cache; trigger a download via an in-memory Blob anchor (NOT `downloadBlob`, which expects a server endpoint).
**When:** the [⤓ EXPORT] button on LoansListPage.
```typescript
// loanCsv.ts
export function loansToCsvBlob(rows: Loan[]): Blob {
  const header = ["item","borrower","quantity","loaned_at","due_date","returned_at","status"];
  const line = (l: Loan) => [
    l.item.name, l.borrower.name, l.quantity, l.loaned_at,
    l.due_date ?? "", l.returned_at ?? "",
    l.returned_at ? "returned" : l.is_overdue ? "overdue" : "active",
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
  return new Blob([[header.join(","), ...rows.map(line)].join("\n")], { type: "text/csv" });
}
// then: URL.createObjectURL(blob) → anchor click → revoke (same mechanics as downloadBlob, local blob).
```

### Anti-Patterns to Avoid
- **Recomputing overdue client-side** — `is_overdue` is authoritative server flag; reading `due_date < Date.now()` will drift across timezones/clock skew. Render the flag.
- **Sending `item_id` to `POST /loans`** — the create body field is `inventory_id`. Picking an item is a UX convenience but you MUST resolve it to an inventory entry before posting (Pitfall 1).
- **Calling `/export/loan`** — returns 400. Do not wire `downloadBlob` to it.
- **Modelling a `total`/`total_pages`/`page` on the loan list** — the loan list envelope is bare `{items:[...]}` (no pagination metadata on the wire, unlike items). Pagination is offset-only via `page`/`limit` query params; the response gives you no page count. Page the tabs only if needed; default `limit=50` (max 100).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Active/overdue partitioning | Client `due_date` math | `GET /loans/active` + `/loans/overdue` | Server owns the computation; avoids TZ/skew bugs |
| Loan→item/borrower names | Client join against items/borrowers | Embedded `loan.item.name` / `loan.borrower.name` | Backend decorates every LoanResponse (3 batch reads) |
| Optimistic mutation + revert | Bespoke state machine | `useInventoryMutations` snapshot/revert pattern | Already shipped, tested, matches the SSE re-invalidate contract |
| Tabs + URL deep-link | Local `useState` tab | `?tab=` via `useSearchParams` | Matches Phase 7 deep-link discipline; CONTEXT prefers URL |
| SSE cache invalidation | New listener | Existing dispatcher (`loan` row already in `INVALIDATION_MAP`) | Phase 6 bootstrap registered `loan → ["loans"]`; nothing to add |

**Key insight:** The backend already does all the hard work (decoration, overdue computation, dedicated tab endpoints, SSE publishing). The frontend's job is purely presentation + optimistic UX. Resist re-deriving anything the wire already gives you.

## Runtime State Inventory

> Not a rename/refactor/migration phase — greenfield frontend feature. Section omitted per protocol. (No stored data, OS state, or build artifacts carry loan strings that need migrating.)

## Common Pitfalls

### Pitfall 1: Loans key on inventory_id, not item_id (HIGH severity)
**What goes wrong:** `POST /loans` body requires `inventory_id`. If the create form picks an *item definition* (warehouse.items row) and posts its id, the backend rejects it or loans the wrong thing.
**Why:** A loan is against a physical inventory entry (the thing on a shelf), not an abstract item. The decoration layer joins inventory → item for display, masking this on reads.
**How to avoid:** The create-form item picker should populate from **inventory** entries (`GET /inventory?limit=100`, label = item name + location) OR pick an item then resolve its inventory entry. For `?itemId=` preselect (scan deep-link), resolve the item to its inventory entry(ies) — if an item has multiple inventory rows, the form must let the user choose which one. Simplest correct approach: **picker is over inventory entries**, and `?itemId=` filters that picker to entries whose `item_id` matches.
**Warning signs:** 400 "inventory is not available for loan" or loans appearing against the wrong physical unit.

### Pitfall 2: No status enum on the wire — derive from two booleans
**What goes wrong:** Planner expects a `status: "active"|"overdue"|"returned"` field; it doesn't exist.
**Why:** Backend exposes `is_active` (`returned_at == nil`) and `is_overdue` (`!returned && due_date < now`).
**How to avoid:** Derive the StatusPill variant: `returned_at ? "returned"(ok) : is_overdue ? "overdue"(danger) : "active"(info)`. A returned loan can never be overdue (server guarantees `is_overdue=false` when returned).
**Warning signs:** TypeScript error accessing `loan.status`.

### Pitfall 3: Loan list has no pagination metadata
**What goes wrong:** Reusing the ItemsListPage `data.total_pages`/`data.total` wiring → `undefined`.
**Why:** `LoanListResponse` is `{items: []}` only. `/loans` accepts `page`/`limit` query params but returns no count.
**How to avoid:** Don't render server-driven pagination on loans unless you add a count; for the parity surface, `limit=50` (or 100) per tab is fine. The tabs themselves are the primary navigation, not pages.

### Pitfall 4: huma injects `$schema` into every envelope
**What goes wrong:** Strict response typing or snapshot tests trip on the extra `$schema` key.
**Why:** huma adds `"$schema": ".../LoanListResponse.json"` to every body (confirmed live).
**How to avoid:** Don't model `$schema`; treat envelopes as `{items: Loan[]} & Record<string, unknown>` (same as inventory — Pitfall 7 of 07b).

### Pitfall 5: E2E auth rate limit — 20/min (HIGH for test planning)
**What goes wrong:** A multi-spec loan E2E suite that logs in per-test hits the 20/min auth limiter and flakes.
**Why:** Documented in CLAUDE.md. Two Playwright projects (chromium + firefox) double login count.
**How to avoid:** Run the loan flow as ONE spec (create → active → return → history) with a single login + reused `page.request` cookie (the auth contract in CLAUDE.md). Batch all API seeding through the inherited cookie.

### Pitfall 6: `?itemId=` is item-scoped but create wants inventory (cross-ref Pitfall 1)
**How to avoid:** When `?itemId=` is present, pre-filter the inventory picker to that item's entries and auto-select if exactly one. Forward-compat with Phase 11 scan flow, which will deep-link `/loans/new?itemId=<id>`.

## Code Examples

### loansApi extension (extend the existing file — do NOT rebuild)
```typescript
// frontend2/src/lib/api/loans.ts — ADD to the existing object (byItem stays).
// Verified shapes from loan/handler.go + live curl 2026-06-13.
import { get, post, patch } from "@/lib/api";
import type { Loan } from "@/lib/types";

export interface CreateLoanBody {
  inventory_id: string;        // NOT item_id (Pitfall 1)
  borrower_id: string;
  quantity: number;            // minimum 1
  loaned_at?: string;          // RFC3339; defaults to now server-side
  due_date?: string;           // RFC3339
  notes?: string;              // maxLength 1000
}

export const loansApi = {
  byItem(/* ...existing... */) {/* unchanged */},
  list:    (ws: string, p = 1, l = 50) => get<{ items: Loan[] }>(`/workspaces/${ws}/loans?page=${p}&limit=${l}`),
  active:  (ws: string) => get<{ items: Loan[] }>(`/workspaces/${ws}/loans/active`),
  overdue: (ws: string) => get<{ items: Loan[] }>(`/workspaces/${ws}/loans/overdue`),
  get:     (ws: string, id: string) => get<Loan>(`/workspaces/${ws}/loans/${id}`),
  create:  (ws: string, body: CreateLoanBody) => post<Loan>(`/workspaces/${ws}/loans`, body),
  return:  (ws: string, id: string) => post<Loan>(`/workspaces/${ws}/loans/${id}/return`),
  update:  (ws: string, id: string, body: { due_date?: string; notes?: string }) =>
             patch<Loan>(`/workspaces/${ws}/loans/${id}`, body),
  extend:  (ws: string, id: string, new_due_date: string) =>
             patch<Loan>(`/workspaces/${ws}/loans/${id}/extend`, { new_due_date }),
  byBorrower: (ws: string, borrowerId: string) =>
             get<{ items: Loan[] }>(`/workspaces/${ws}/borrowers/${borrowerId}/loans`),
};
```

### Status pill derivation
```typescript
function loanStatus(l: Loan): { variant: "ok"|"danger"|"info"; label: string } {
  if (l.returned_at) return { variant: "ok", label: "RETURNED" };
  if (l.is_overdue)  return { variant: "danger", label: "OVERDUE" };
  return { variant: "info", label: "ACTIVE" };
}
// Overdue row highlight: add a danger class to <tr> when l.is_overdue (CONTEXT: danger treatment).
```

### Sidebar enable (one-line change)
```tsx
// frontend2/src/components/layout/Sidebar.tsx:144 — add `to="/loans"`.
<NavItem glyph="↧" label={<Trans>Loans</Trans>} count={stats?.active_loans} to="/loans" />
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `/loans/{id}/extend` single-purpose | `PATCH /loans/{id}` (due_date + notes) | Plan 62-01 D-01 | Both exist; `/extend` retained for back-compat. Edit form should use `PATCH /loans/{id}`; the EXTEND quick-action on a panel can use either. Prefer `PATCH /loans/{id}` for edits, keep `/extend` only if a "+N days" affordance is wanted. |

**Deprecated/outdated:**
- Nothing deprecated. `/extend` is "legacy single-purpose, retained" — not removed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Create-form picker should be over **inventory entries** (not items) to satisfy the `inventory_id` requirement | Pitfall 1 / Patterns | Medium — if the planner picks items + a resolve step instead, that's also valid; the constraint (post `inventory_id`) is VERIFIED, the UX choice is the assumption. Flag for planner. |
| A2 | History tab = `GET /loans` filtered client-side on `!is_active` | Pattern 1 | Low — verified there's no `/loans/returned` endpoint and no status param; client filter is the only path. Returned loans appear in `GET /loans`. |
| A3 | CSV column set (item/borrower/qty/dates/status) | Pattern 4 | Low — cosmetic; parity §4 doesn't pin columns. |

## Open Questions

1. **Loan CSV export — RESOLVED.** Backend has **no loan export**: `/export/loan?format=csv` returns **HTTP 400** (verified live; loan absent from `EntityType` enum — only item/location/container/category/label/company/borrower are valid). `/export/borrower` returns 200. → **The per-list loan CSV must be client-generated** from fetched rows (Pattern 4). Do NOT use `downloadBlob`. (If a server-side loan export is wanted, it's a backend change deferred to Phase 14 central exports.)

2. **Borrower detail page existence (LOAN-06 mount vs component-only) — RESOLVED.** No borrower route exists in frontend2 (`routes/index.tsx` has items/inventory/settings only; the Sidebar `Borrowers` entry is disabled with no `to`). The `GET /borrowers/{borrower_id}/loans` endpoint exists and is verified. → **Build `BorrowerLoanPanels` as a prop-driven component (borrowerId in) with unit tests; do NOT add a borrower route this phase.** Phase 9 (BORR-03) mounts it on the borrower detail page.

3. **Overdue determination — RESOLVED.** Server-computed `is_overdue` flag on every LoanResponse (`!returned && due_date != nil && now > due_date`). Frontend renders the flag; never recomputes. Verified in `loan/entity.go:101-106` and live (`"is_overdue":false` on a not-yet-due loan; the active-loans fixture includes a "1 month overdue" seed).

4. **loansApi reuse plan — RESOLVED.** `frontend2/src/lib/api/loans.ts` exists (07-01, `byItem` only). **Extend it** with the methods in the Code Examples block; keep `byItem` untouched (ItemDetailPage's `useItemLoans` depends on its `PartitionedLoans` shape). The `Loan` type in `lib/types.ts` is complete and verified — no type changes needed.

5. **Detail vs inline edit (discretion):** Recommend a lightweight `/loans/:id` detail page that shows the loan + RETURN/EXTEND/EDIT actions, with edit as an inline form or a dialog (avoid a separate `/loans/:id/edit` route unless the form is large). Either satisfies LOAN-04.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Backend loan domain | All LOAN reqs | ✓ (verified live :8080) | current | — |
| Postgres dev DB | E2E + dev | ✓ (seeded; loan fixtures present incl. overdue) | — | — |
| Frontend toolchain (Vite/RR7/RQ/RHF/zod/lingui) | All | ✓ | per package.json | — |
| Retro atoms (RetroTabs/Table/Select/ConfirmDialog/etc.) | All UI | ✓ (Phase 4) | — | — |
| Backend loan CSV export | per-list CSV | ✗ | — | **Client-generated CSV (Pattern 4)** |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** loan CSV export → client-side generation.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (unit/component, MSW for API) + Playwright (E2E, real backend) |
| Config file | `frontend2/vitest.config.ts` (or vite test config), `frontend2/playwright.config.ts` |
| Quick run command | `cd frontend2 && bun run test` (vitest) |
| Full suite command | `cd frontend2 && bun run test && E2E_USER=seeder@test.local E2E_PASS=password123 bun run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOAN-01 | Tabs render active/overdue/history from correct endpoints; overdue row danger | component (MSW) | `bun run test loans/LoansListPage` | ❌ Wave 0 |
| LOAN-02 | Create posts `inventory_id`; `?itemId=` preselects | component (MSW) | `bun run test loans/LoanFormPage` | ❌ Wave 0 |
| LOAN-03 | Return → optimistic move to History; confirm dialog | component (MSW) | `bun run test loans/useLoanMutations` | ❌ Wave 0 |
| LOAN-04 | Edit due_date + notes → PATCH /loans/{id} | component (MSW) | `bun run test loans/LoanFormPage` | ❌ Wave 0 |
| LOAN-05 | ItemDetail RETURN enabled + wired | component (MSW) | `bun run test items/LoanPanels` | ⚠ exists read-only; extend |
| LOAN-06 | BorrowerLoanPanels renders active+history from byBorrower | component (MSW) | `bun run test loans/BorrowerLoanPanels` | ❌ Wave 0 |
| LOAN-01..03 | Full flow create→active→return→history | E2E (real backend) | `bun run test:e2e loans` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend2 && bun run test <changed file>` (vitest, <30s)
- **Per wave merge:** `cd frontend2 && bun run test` (full vitest)
- **Phase gate:** full vitest green + the single batched loan E2E spec green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `features/loans/hooks/useLoanMutations.test.ts` — optimistic return/extend + revert (LOAN-03/04)
- [ ] `features/loans/LoansListPage.test.tsx` — tab→endpoint, overdue highlight, CSV (LOAN-01)
- [ ] `features/loans/LoanFormPage.test.tsx` — `inventory_id` post, `?itemId=` preselect (LOAN-02/04)
- [ ] `features/loans/components/BorrowerLoanPanels.test.tsx` — prop-driven panels (LOAN-06)
- [ ] Extend `features/items/components/LoanPanels.test.tsx` — RETURN now enabled + fires mutation (LOAN-05)
- [ ] `frontend2/e2e/loans-lifecycle.spec.ts` — ONE batched spec: create → active → return → history (mind 20/min auth limit)
- [ ] MSW fixtures: loans list, /active, /overdue, create, return, extend, byBorrower (reuse the live shapes captured in this research)

## Security Domain

> `security_enforcement` not present in config.json → treated as enabled. This is a frontend
> feature against an already-hardened backend; the relevant controls are tenant scoping +
> input validation, both server-enforced.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Cookie-JWT (`credentials:"include"`) via shipped `lib/api.ts`; no token in URL |
| V3 Session Management | yes | 401 single-flight refresh in `api.ts` (inherited) |
| V4 Access Control | yes | **Server-enforced workspace scoping** — every loan/borrower handler reads `GetWorkspaceID(ctx)`; the loan-provided `inventory_id`/`borrower_id` are NOT trusted as auth signals (decoration lookups re-scope by workspace_id, per T-62-02/05). Frontend always calls `/workspaces/{wsId}/...`. |
| V5 Input Validation | yes | Backend huma validation (quantity ≥ 1, notes ≤ 1000, due_date > loaned_at). Frontend zod mirrors for UX; server is authoritative. |
| V6 Cryptography | no | No crypto in this phase. |

### Known Threat Patterns for {React SPA + huma REST}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant loan/borrower access (IDOR) | Information Disclosure / Elevation | Server scopes all reads/writes by `workspace_id`; frontend never sends a workspaceId it doesn't own (SSOT from `useWorkspace`). Backend decoration explicitly does not trust loan-embedded IDs. |
| XSS via borrower name / notes | Tampering | React escapes by default; no `dangerouslySetInnerHTML`. CSV export quotes/escapes fields (Pattern 4) but note CSV-injection (`=`/`+`/`@` prefixes) is a spreadsheet risk — prefix-guard if exporting to untrusted Excel. |
| Token leak via export URL | Information Disclosure | Client-gen CSV uses an in-memory Blob — no server URL, no token exposure. |

## Sources

### Primary (HIGH confidence — read source + live curl 2026-06-13)
- `backend/internal/domain/warehouse/loan/handler.go` — all routes, request/response shapes, SSE publish sites
- `backend/internal/domain/warehouse/loan/entity.go` — `IsActive`/`IsOverdue`/`Return`/`Update` logic
- `backend/internal/domain/warehouse/borrower/handler.go` — borrower read/list/search endpoints + shapes
- `backend/internal/domain/importexport/{handler,types}.go` — export entity-type enum (loan ABSENT)
- Live curl: `/loans`, `/loans/active`, `/borrowers`, `/export/loan` (400), `/export/borrower` (200) against :8080
- `frontend2/src/lib/api/loans.ts`, `lib/types.ts` (Loan), `lib/api.ts` (helpers), `features/items/components/LoanPanels.tsx`, `features/items/ItemsListPage.tsx`, `features/inventory/hooks/{useInventoryMutations,usePickerOptions}.ts`, `features/inventory/InventoryFormPage.tsx`, `routes/index.tsx`, `components/layout/Sidebar.tsx`, `docs/sse-invalidation-contract.md`

### Secondary / Tertiary
- None — every claim is source- or live-verified.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all atoms shipped & verified in tree
- Architecture / contracts: HIGH — handler source + live curl agree
- Pitfalls: HIGH — inventory_id requirement, no-status-enum, no-loan-export, no-pagination-meta all verified live
- The single MEDIUM-risk item is A1 (inventory-picker UX choice) — the constraint is verified, the UX resolution is a recommendation for the planner.

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (stable backend; re-verify the export entity-type list if a backend loan-export lands)
