# Phase 9: Borrowers - Research

**Researched:** 2026-06-13
**Domain:** frontend2 React 19 feature parity — borrower CRUD + list/search + delete-with-active-loan-guard + detail page mounting Phase-8 `BorrowerLoanPanels`
**Confidence:** HIGH (every claim cited to a shipped file:line in this repo; this is a parity phase mirroring already-merged patterns)

## Summary

Phase 9 is a parity feature built entirely on patterns that already ship in the repo. The borrower
backend surface is verified (`backend/internal/domain/warehouse/borrower/handler.go`), the loans
side (`BorrowerLoanPanels`, `useBorrowerLoans`, `loansApi.byBorrower`) is merged from Phase 8, and
the list/form/detail composition language is fixed by `InventoryListPage` / `LoanFormPage` /
`ItemDetailPage`. There is almost nothing to invent — the job is to mirror, with two genuinely new
decisions: (1) the pagination strategy given the bare `{items}` list envelope, and (2) the
BORR-05 delete-guard UX (a NEW v3.0 affordance — legacy had no proactive guard).

The decisive constraint is the **bare `{items}` list envelope** (no `total`/`total_pages`):
`BorrowerListResponse` is `{ Items []BorrowerResponse }` only — verified at
`backend/internal/domain/warehouse/borrower/handler.go:286-288`. `RetroPagination`
(`frontend2/src/components/retro/data/RetroPagination.tsx:35`) renders one button **per page** from
a known `pageCount` — it is structurally incompatible with a "next-disabled heuristic." Therefore the
roadmap's explicit "list + RetroPagination" requirement forces **fetch ≤100 + client-paginate**
(constraint 1a). This also matches the legacy borrowers page, which fetched-all then filtered/sorted
client-side (`frontend/app/[locale]/(dashboard)/dashboard/borrowers/page.tsx`).

**Primary recommendation:** Add `lib/api/borrowers.ts` mirroring `lib/api/loans.ts`; a
`useBorrowersQuery` hook that fetches `limit=100` and client-paginates/searches; a list page that is
a near-copy of `LoansListPage`'s FilterBar + RetroTable + render-loop guard plus `RetroPagination`
fed by a client `pageCount`; a blue RHF+zod form mirroring `LoanFormPage`; and a detail page mirroring
`ItemDetailPage`'s titlebar-actions layout that mounts `BorrowerLoanPanels` and reads the active-loan
count from `useBorrowerLoans` to drive a **proactive** delete guard (disable + red badge + "View
active loans" link when active>0) with the **400 catch as a backstop**.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Borrower list + pagination | API / Backend (data) → Client (paginate/search) | — | List endpoint has NO server filter/total; client owns paginate + search of a ≤100 fetch (mirrors legacy + inventory client-filter) |
| Borrower search | API / Backend (`/borrowers/search`) | Client (debounce) | Separate server endpoint exists; client debounces + swaps endpoint |
| Create / edit borrower | API / Backend (validation authoritative) | Client (zod mirror) | Server owns `format:email`, `minLength` etc.; client zod is a mirror for UX |
| Delete guard (active loans) | API / Backend (400 authoritative) | Client (proactive count via loans) | Server is the source of truth (400); client reads loan count for a proactive, friendlier UX |
| Active/history loan panels | API / Backend (`/borrowers/{id}/loans`) | Client (partition) | Already built Phase 8 — `useBorrowerLoans` partitions client-side on `is_active` |

## User Constraints

> No `09-CONTEXT.md ## Decisions` section exists — the CONTEXT file is structured as "binding
> constraints / carry-forward" + Open Questions. Those binding constraints are treated here with
> locked-decision authority and reproduced verbatim below.

### Locked Decisions (from 09-CONTEXT.md "Binding constraints / carry-forward")
1. **List has no `total`** → resolve pagination as (a) clamp `limit=100` + client-paginate, or (b) page/limit + "Next disabled when < limit rows" heuristic. (RESOLVED below → **(a)**.)
2. **Search is a separate endpoint** — non-empty search box → `/borrowers/search?q=` (debounced), else list endpoint. Mirror InventoryListPage's convention. (RESOLVED below.)
3. **Delete guard is a 400 string**, not a status flag — prefer proactive (read active-loan count via `loansApi.byBorrower`) + catch the 400 as backstop. (RESOLVED below.)
4. **`limit` caps 100** (422 over) — clamp every borrower list/search read ≤100.
5. **RENDER-LOOP landmine** (4× prior) — `t` via ref, destructure `.mutate`. Mirror InventoryListPage exactly.
6. **Query keys** `["borrowers", wsId, ...]` prefix (SSE invalidation convention).
7. **BORR-03 mounts `BorrowerLoanPanels`** — the panels component is done; the detail page is the new surface (profile + EDIT + DELETE + guard).

### Claude's Discretion
- Plan split (planner decides 09-01 / 09-02 boundary — likely split documented below).
- Whether search debounce lives in the hook or the page (recommended: hook).
- Detail-page two-column vs stacked layout (recommend stacked profile + panels, simpler than item detail).

### Deferred Ideas (OUT OF SCOPE)
- **Borrower archive UI** — the `POST /borrowers/{id}/archive` soft endpoint exists (D-02) but BORR-05 is HARD delete; archive UI is out of scope (OQ4 RESOLVED — legacy had no per-row archive button beyond a bulk action; v3.0 parity does not port it).
- Bulk select / bulk export / CSV import (legacy had these; not in BORR-01..05).
- Inline-edit cells in the borrower list (legacy had them; BORR-04 is a dedicated edit form per parity).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BORR-01 | Browse borrowers in a flat paginated list with search input + RetroPagination | Pattern: `LoansListPage` FilterBar+RetroTable + `RetroPagination` fed by client `pageCount` (fetch≤100). §OQ1/OQ2. |
| BORR-02 | Create a new borrower (name + optional contact info) | Pattern: `LoanFormPage` blue Window RHF+zod; schema §OQ5. |
| BORR-03 | View a borrower detail page (active + historical loan panels, LOAN-06) | Mount merged `BorrowerLoanPanels` (`frontend2/src/features/loans/components/BorrowerLoanPanels.tsx:33`). §Detail-page layout. |
| BORR-04 | Edit a borrower's profile | Same form as BORR-02, edit mode (PATCH all-optional). §OQ5. |
| BORR-05 | Delete a borrower; blocked while any loan active (red badge + "View active loans" link) | Proactive count via `useBorrowerLoans` + 400 backstop. §OQ3. |

## Open Questions (RESOLVED)

### OQ1 — Pagination strategy → **fetch ≤100 + client-paginate** (constraint 1a)

**Evidence the list has no total:** `BorrowerListResponse` is bare:
```go
// backend/internal/domain/warehouse/borrower/handler.go:286-288
type BorrowerListResponse struct {
	Items []BorrowerResponse `json:"items"`
}
```
`ListBorrowersInput` (`:275-279`): `page default:"1"`, `limit default:"50" maximum:"100"`,
`archived default:"false"`. There is **no `q` param on the list** and **no `total`/`total_pages`** in
the response.

**Why not the inventory pager:** `InventoryListPage` uses `data?.total_pages` / `data?.page`
(`frontend2/src/features/inventory/InventoryListPage.tsx:94-95`) because **inventory's list endpoint
DOES return the full envelope** — `InventoryListResponse` is `{ items, total, page, total_pages }`
(documented `frontend2/src/lib/api/inventory.ts:11-15,32`). Borrowers do **not** have that, so the
inventory server-pager cannot be copied directly.

**Why RetroPagination forces client-side:** `RetroPagination` renders a numbered button per page from
a known count — `const pages = Array.from({ length: pageCount }, ...)`
(`frontend2/src/components/retro/data/RetroPagination.tsx:35`), and disables NEXT via `page >= pageCount`
(`:69`). It has **no "next-disabled heuristic" mode** — it needs a real `pageCount`. A bare `{items}`
list cannot supply one without fetching everything. Therefore: fetch `limit=100` once, then compute
`pageCount = Math.ceil(filtered.length / PER_PAGE)` client-side and slice.

**Precedent:** legacy borrowers page fetched-all and did client-side filter/sort/paginate
(`frontend/app/[locale]/(dashboard)/dashboard/borrowers/page.tsx` — client `sortedBorrowers`,
client archived filter at `:310-311`). Same shape, ported to the retro pager.

**Exact hook shape:** see `useBorrowersQuery` in Code Examples. `PER_PAGE = 25` (mirrors
`INVENTORY_LIMIT = 25` and `ITEMS_LIMIT`). `?page` round-trips to the URL (deep-link/back-button);
search lives in component state (matches inventory R1 — only `?page` round-trips,
`frontend2/src/features/inventory/hooks/useInventoryQuery.ts:24-30`).

> Caveat (carry the inventory `limit=100` lesson): with >100 borrowers the client only sees the first
> 100 and the pager understates. v3.0 parity seed is small; document as a known limit (mirror
> `InventoryListPage.tsx:78-81` `deferred-items.md` note). A backend `total` is the proper future fix.

### OQ2 — Search → **client-filter the ≤100 list (no `/search` endpoint this phase)**

**The repo convention is client-side search.** Both shipped list pages search client-side, NOT via a
server param:
- Inventory: "search + status + condition + location facets are CLIENT-side ... applied to the loaded
  page; only `?page` round-trips" (`frontend2/src/features/inventory/InventoryListPage.tsx:32-39`),
  filter applied in the `visible` memo `name.includes(q)` (`:120-132`).
- Loans: "Client-side search (item OR borrower name substring) — does NOT round-trip to the URL
  (matches the inventory client-filter convention)"
  (`frontend2/src/features/loans/LoansListPage.tsx:66-78`).

Because OQ1 already fetches the full (≤100) list, a borrower-name substring filter over that array is
the consistent, simplest choice and matches both analogs exactly. **The separate
`/borrowers/search?q=` endpoint is NOT used by the list page** — it exists for the Phase-8 typeahead
pickers and stays unused here. (`borrowersApi.search` IS still added to the module for completeness /
forward-compat — see borrowersApi shape — but the list page filters the loaded array.)

**Rejected alternative (debounced server search):** would require a second query keyed on `q`, a
debounce, and endpoint-swap logic — none of which any shipped list page does. Adding it would
*diverge* from the parity convention for zero benefit at ≤100 rows. Do NOT do it.

> If a future phase removes the ≤100 client-fetch in favor of true server pagination, THEN the
> debounced `/borrowers/search` swap becomes the right move. Not now.

### OQ3 — Delete guard UX → **proactive (active-loan count) + reactive 400 backstop**

**Backend behavior (exact):**
```go
// backend/internal/domain/warehouse/borrower/handler.go:144,154
huma.Delete(api, "/borrowers/{id}", ...)
	return nil, huma.Error400BadRequest("cannot delete borrower with active loans")
```
It is a **400 Bad Request** (NOT 409). The detail string is exactly
`"cannot delete borrower with active loans"`.

**How the repo surfaces a 400 message** — `lib/api.ts` parses the huma error body and throws a typed
`HttpError(status, message)`:
```ts
// frontend2/src/lib/api.ts:44-57
async function parseError(response: Response): Promise<HttpError> {
  const error: ApiError = await response.json();
  return new HttpError(response.status, error.detail || error.message || `HTTP ${response.status}`);
}
```
`HttpError` carries `.status` (`frontend2/src/lib/api.ts:22-30`); `ApiError` is `{ message?, detail?, code? }`
(`frontend2/src/lib/types.ts:5-9`). Huma puts the message in `detail`, so `err.message` ends up being
the human string. **Established mapping pattern** (item delete): catch in `onError`, branch on
`HttpError` + `.status`, map to a friendly i18n string:
```ts
// frontend2/src/features/items/hooks/useItemMutations.ts:56-64 (paraphrased)
onError: (err) =>
  retroToast.error(
    err instanceof HttpError && err.status === 400
      ? t`Only archived items can be deleted.`
      : t`Couldn't delete that item.`,
  ),
```
404→not-found detection in `ItemDetailPage` uses the same `err instanceof HttpError && err.status === 404`
(`frontend2/src/features/items/ItemDetailPage.tsx:89-91`).

**Proactive source of the active-loan count** — `useBorrowerLoans` already returns the partitioned
`{ active, history }` for a borrower (`frontend2/src/features/loans/hooks/useBorrowerLoans.ts:11-28`),
partitioning the bare `byBorrower` list on `is_active`. The detail page already mounts
`BorrowerLoanPanels` which calls this hook — so `active.length` is available on the page for free.

**Decision — both, proactive-primary:**
- On the **detail page**: read `useBorrowerLoans(wsId, id).data.active.length`. When `> 0`:
  render a **red `RetroBadge variant="danger"`** ("ON LOAN" / "{n} active") next to a **"View active
  loans" link** (an in-page anchor to the Active Loans panel, e.g. `<a href="#active-loans">` or a
  scroll-into-view button), and **disable** the DELETE button (with `aria-disabled`).
- The **delete mutation `onError`** still maps `HttpError.status === 400` →
  `t`Can't delete — this borrower has active loans.`` as a backstop (covers the race where a loan was
  created between the panel read and the click). This mirrors `useItemMutations` exactly.

**Why proactive is required (not just reactive):** BORR-05's text says "red badge + 'View active
loans' link" must be visible as a *blocking affordance*, not only after a failed attempt. A
reactive-only design would let the user click DELETE, see a confirm dialog, confirm, and only then get
an error — worse UX and it never shows the badge. Proactive shows the state up front; reactive guards
the race.

**RetroBadge danger** exists: `frontend2/src/components/retro/RetroBadge.tsx:7` (`danger: "bg-danger-bg"`),
used the same way in `InventoryListPage.tsx:421` (`<RetroBadge variant="neutral">ARCHIVED`).

### OQ4 — Legacy "archive" affordance → **NOT ported; hard-delete-with-guard is the only removal path**

The soft `POST /borrowers/{id}/archive` endpoint exists and always succeeds regardless of active loans
(`backend/internal/domain/warehouse/borrower/handler.go:176-177`, "Archive borrower (soft; always
succeeds regardless of active loans per D-02)"). **But:**
- The v3.0 requirement is explicit: **BORR-05 = HARD delete**, blocked on active loans
  (`.planning/REQUIREMENTS.md:112`). No BORR requirement mentions archive.
- The roadmap Phase 9 line: "flat paginated list + CRUD with active-loan delete guard + detail with
  active+history panels" (`.planning/ROADMAP.md:240`) — no archive.
- Legacy had archive only as a **bulk action** (`handleBulkArchive` mapping to `borrowersApi.delete`,
  `frontend/.../borrowers/page.tsx:500-519` — note legacy's `delete` was wired to the soft path) and a
  client `is_archived` filter; bulk operations are explicitly out of scope for BORR-01..05.

**Conclusion:** Do NOT add an archive button, an `archived` filter chip, or wire the archive endpoint.
The single removal path is `DELETE /borrowers/{id}` gated by the active-loan guard. (`borrowersApi.list`
should still pass `archived=false` implicitly by omitting the param — default is false; archived
borrowers simply won't appear, which is correct.)

### OQ5 — Create/edit form fields → name (req) + email (format-when-supplied) + phone + notes (all optional)

**Backend contract (exact):**
```go
// CreateBorrowerInput.Body — backend/.../borrower/handler.go:303-308
Name  string  `json:"name" minLength:"1" maxLength:"255"`
Email *string `json:"email,omitempty" format:"email"`
Phone *string `json:"phone,omitempty"`
Notes *string `json:"notes,omitempty"`
// UpdateBorrowerInput.Body (:317-322): all fields *pointer/optional (Name? minLength:1 maxLength:255).
```

**Mirror the optional-field pattern from LoanFormPage/InventoryFormPage:** string fields default to
`""` (so RHF `dirtyFields` is meaningful and the PATCH builder can distinguish cleared vs untouched —
`frontend2/src/features/loans/schema.ts:36-40`, `frontend2/src/features/inventory/schema.ts:13-15`).
Absent optionals are **OMITTED, never zero-injected** on submit
(`frontend2/src/features/loans/LoanFormPage.tsx:144-145`). The optional-field hint text under each
field follows `LoanFormPage.tsx:267-269` ("Optional — leave blank ..."). Email is validated
`z.string().email()` **only when non-empty** (the loan due-date refinement uses the same
"only-when-supplied" pattern, `frontend2/src/features/loans/schema.ts:44-47`). Schema in Code Examples.

## Standard Stack

### Core (already present — no installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19 | UI | repo baseline |
| @tanstack/react-query | v5 | data fetching/cache + SSE invalidation prefix | every list/detail/mutation uses it |
| react-hook-form | (repo) | form state | `LoanFormPage`/`InventoryFormPage` |
| @hookform/resolvers/zod + zod | (repo) | schema validation | all forms |
| react-router | v7 (library mode) | routing | `routes/index.tsx` AP-1 |
| @lingui/react/macro | (repo) | i18n (`t` / `<Trans>`) | every page |
| msw | (repo) | test mocking | `src/test/msw/*` |

**Installation:** none — Phase 9 introduces **no new dependencies**.

## Package Legitimacy Audit

Not applicable — Phase 9 installs **no external packages**. All libraries are already in
`frontend2/package.json` and exercised by shipped phases. (slopcheck gate skipped: zero new packages.)

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
   /borrowers (list) ───▶│ useBorrowersQuery  (RQ key ["borrowers",ws]) │
                         │   borrowersApi.list(ws,{page:1,limit:100})    │──▶ GET /workspaces/{ws}/borrowers?limit=100
                         │   → bare { items }                            │     (bare {items}, no total — OQ1)
                         └───────────────┬─────────────────────────────┘
                                         │ client search-filter (name substring, OQ2)
                                         │ client paginate  pageCount = ceil(n/25)
                                         ▼
        FilterBar(search) + RetroTable(rows) + RetroPagination(page,pageCount)   [LoansListPage clone]
                                         │ row click → navigate
                                         ▼
   /borrowers/:id (detail) ──▶ borrowersApi.get  +  useBorrowerLoans(ws,id)  (Phase 8)
                              │   profile (name/email/phone/notes)             │
                              │   titlebar: EDIT → /:id/edit, DELETE (guarded) │
                              │   active.length>0 → red badge + "View active   │──▶ GET /borrowers/{id}/loans
                              │     loans" link + DELETE disabled (OQ3)        │     → BorrowerLoanPanels(active/history)
                              ▼
   /borrowers/new , /:id/edit ─▶ RHF+zod form (blue Window)  [LoanFormPage clone]
                              │   name(req)+email(fmt)+phone+notes(opt) (OQ5)  │
                              │   create→POST  edit→PATCH (all-optional)       │──▶ POST/PATCH /borrowers[/{id}]
                              ▼
   DELETE flow ─▶ useBorrowerMutations.del → DELETE /borrowers/{id}
                  onError: HttpError.status===400 → "active loans" toast (backstop, OQ3)
                  onSuccess: invalidate ["borrowers", ws]; navigate /borrowers
```

### Recommended Project Structure
```
frontend2/src/
├── lib/api/borrowers.ts                    # NEW — mirrors lib/api/loans.ts
├── features/borrowers/
│   ├── schema.ts                           # NEW — zod create/edit (OQ5)
│   ├── BorrowersListPage.tsx               # NEW — clone of LoansListPage (BORR-01)
│   ├── BorrowerFormPage.tsx                # NEW — clone of LoanFormPage (BORR-02/04)
│   ├── BorrowerDetailPage.tsx              # NEW — mounts BorrowerLoanPanels (BORR-03/05)
│   └── hooks/
│       ├── useBorrowersQuery.ts            # NEW — fetch≤100 + client paginate/search
│       └── useBorrowerMutations.ts         # NEW — create/update/delete + 400 mapping
└── test/msw/borrowerHandlers.ts            # NEW — mirrors loanHandlers.ts
```

### Pattern 1: Render-loop guard (MANDATORY — hit 4× in prior phases)
**What:** `useLingui()`'s `t` is not referentially stable; reading it inside shortcut/memo closures
churns the memo and can loop. RQ v5 returns a new mutation wrapper each render but `.mutate` is stable.
**Source:** `frontend2/src/features/loans/LoansListPage.tsx:53-56,92-103` and
`frontend2/src/features/inventory/InventoryListPage.tsx:48-69,167-174`.
```tsx
const { t } = useLingui();
const tRef = useRef(t); tRef.current = t;          // read t via ref in closures
// ...
const { del } = useBorrowerMutations();
const deleteBorrower = del.mutate;                 // destructure the STABLE .mutate
const routeShortcuts = useMemo(() => [
  { key: "N", label: tRef.current`New borrower`, action: goNew },
  { key: "/", label: tRef.current`Focus search`, action: focusSearch },
], [goNew, focusSearch]);                            // STABLE deps only — no `t`
useShortcuts("borrowers", routeShortcuts);
```

### Pattern 2: Mutations mirror useLoanMutations / useItemMutations
Prefix-invalidate `["borrowers", wsId]` on settle (covers list + any future borrower keys — and the
detail page's `useBorrowerLoans` invalidation already rides the `["loans", wsId]` prefix from Phase 8).
Source: `frontend2/src/features/loans/hooks/useLoanMutations.ts:44-49`. The delete `onError` 400-mapping
mirrors `frontend2/src/features/items/hooks/useItemMutations.ts:56-64`.

### Anti-Patterns to Avoid
- **Reading `.total`/`.total_pages` off the borrower list result** — it does not exist (bare envelope).
  The TS type must be `{ items: BorrowerResponse[] }` so this is impossible by type (mirror
  `inventoryApi.byItem` typing discipline, `frontend2/src/lib/api/inventory.ts:40-46`).
- **Adding a debounced `/borrowers/search` swap to the list page** — diverges from the
  inventory/loans client-filter convention (OQ2).
- **Adding an archive button / archived filter** — out of scope (OQ4).
- **Putting `t` in a `useMemo`/`useEffect`/`useShortcuts` dep array** — render-loop landmine.
- **Reactive-only delete guard** — must show the badge proactively (OQ3).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Borrower active/history loan panels | A new loans panel | `BorrowerLoanPanels` (`features/loans/components/BorrowerLoanPanels.tsx:33`) | Already built + unit-tested Phase 8; reuses Return/Extend dialogs |
| Per-borrower loan fetch/partition | A new query | `useBorrowerLoans` (`features/loans/hooks/useBorrowerLoans.ts:11`) | Already partitions on `is_active` under the `["loans",ws]` prefix |
| Pager UI | Custom prev/next | `RetroPagination` (`components/retro/data/RetroPagination.tsx`) | Sketch-008 styled; feed it a client `pageCount` |
| List chrome (search box, count, primary CTA) | Custom toolbar | `FilterBar` (used by `LoansListPage.tsx:202`) | Consistent retro density |
| Error→message mapping | Manual `response.json()` | `HttpError` from `lib/api.ts` + `err.status` | Typed, already parses huma `detail` |
| Dirty-form guard | Custom blocker | The `LoanFormPage` `beforeunload` + `RetroConfirmDialog` pattern (`LoanFormPage.tsx:113-132,291-308`) | `useBlocker` unavailable in declarative-router mode |

**Key insight:** The loans side did the heavy lifting in Phase 8. Phase 9 is plumbing: a list page,
a form, and a detail shell — each a near-copy of an existing file.

## Common Pitfalls

### Pitfall 1: Bare `{items}` list envelope (no total)
**What goes wrong:** Copying `InventoryListPage`'s `data.total_pages` yields `undefined` → pager breaks.
**Why:** Inventory's list has the full envelope; borrowers' does NOT (`handler.go:286-288`).
**Avoid:** Type `borrowersApi.list` as `{ items: BorrowerResponse[] }`; compute `pageCount` client-side.

### Pitfall 2: `limit` > 100 → 422 (never resolves)
**What:** Requesting `limit=200` 422s; the whole list query errors and the page shows the error state.
**Why:** `Limit ... maximum:"100"` (`handler.go:277`).
**Avoid:** Request exactly `limit=100` (same clamp as `useLoanPickerOptions.ts:43` `LIMIT = 100`).
**Warning sign:** empty list + network 422 in devtools.

### Pitfall 3: Render-loop via unstable `t` / mutation wrapper
**What:** Infinite re-render or thrashing shortcuts.
**Avoid:** `tRef` + destructured `.mutate` (Pattern 1). This has bitten 4 prior phases per CONTEXT §5.

### Pitfall 4: Query-key prefix divergence
**What:** Using `["borrower", ...]` (singular) or `exact:true` breaks SSE prefix invalidation.
**Why:** Convention is plural prefix `["borrowers", wsId, ...]`, prefix-match invalidation.
**Evidence:** `useLoanPickerOptions.ts:78` already caches borrowers under `["borrowers", wsId, {limit}]`.
**Avoid:** Always `["borrowers", wsId, ...]`; invalidate with the bare prefix (no `exact`).

### Pitfall 5: Delete 400 swallowed as a generic error
**What:** Showing "Couldn't delete" instead of the active-loan reason.
**Avoid:** Branch on `err instanceof HttpError && err.status === 400` (OQ3 mapping).

### Pitfall 6: Optional contact fields zero-injected
**What:** Sending `email: ""` instead of omitting it → server `format:email` rejects empty string.
**Avoid:** Omit empty optionals on submit (`LoanFormPage.tsx:144-145` pattern); email validated only
when non-empty.

### Pitfall 7: routes/index.tsx single-writer + literal-before-param ordering (AP-1)
**What:** `borrowers/:id` registered before `borrowers/new` → "new" parsed as an id.
**Why:** Library-mode RR7, literal routes must precede param routes
(`frontend2/src/routes/index.tsx:55-73` — loans does exactly this: `loans/new` ABOVE `loans`).
**Avoid:** Register in order `borrowers/new`, `borrowers`, `borrowers/:id/edit`, `borrowers/:id`
(literals before the `:id` param; `:id/edit` is fine relative to `:id` since both are param but the
edit literal segment disambiguates). `routes/index.tsx` is a SHARED file — single-writer between
plan 09-01 and 09-02, or serialize the two route additions (Phase-8 lesson, CONTEXT §plan-split).

## Code Examples

### borrowersApi module (NEW `lib/api/borrowers.ts`) — mirrors `lib/api/loans.ts`
```ts
// Source pattern: frontend2/src/lib/api/loans.ts:29-69 + legacy frontend/lib/api/borrowers.ts
import { get, post, patch, del } from "@/lib/api";

// Backend BorrowerResponse — handler.go:325-336. email/phone/notes optional.
export interface Borrower {
  id: string;
  workspace_id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBorrowerBody {
  name: string;            // required 1..255
  email?: string;          // format:email (omit when empty)
  phone?: string;
  notes?: string;
}
export type UpdateBorrowerBody = Partial<CreateBorrowerBody>; // all-optional PATCH

// List + search BOTH return a BARE { items } (handler.go:286-288, 350-352) — no total.
export const borrowersApi = {
  list: (ws: string, page = 1, limit = 100) =>
    get<{ items: Borrower[] }>(
      `/workspaces/${ws}/borrowers?page=${page}&limit=${limit}`,
    ),
  // Present for forward-compat / pickers; the list page does NOT use this (OQ2).
  search: (ws: string, q: string, limit = 100) =>
    get<{ items: Borrower[] }>(
      `/workspaces/${ws}/borrowers/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    ).then((r) => r.items),
  get: (ws: string, id: string) =>
    get<Borrower>(`/workspaces/${ws}/borrowers/${id}`),
  create: (ws: string, body: CreateBorrowerBody) =>
    post<Borrower>(`/workspaces/${ws}/borrowers`, body),
  update: (ws: string, id: string, body: UpdateBorrowerBody) =>
    patch<Borrower>(`/workspaces/${ws}/borrowers/${id}`, body),
  del: (ws: string, id: string) =>
    del<void>(`/workspaces/${ws}/borrowers/${id}`),
};
```

### useBorrowersQuery (NEW) — fetch ≤100, client paginate + search (OQ1/OQ2)
```ts
// Source pattern: useInventoryQuery.ts (URL ?page) + LoansListPage client search
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { borrowersApi, type Borrower } from "@/lib/api/borrowers";
import { useWorkspace } from "@/features/workspace/useWorkspace";

export const BORROWERS_PER_PAGE = 25;     // mirrors INVENTORY_LIMIT
const FETCH_LIMIT = 100;                   // 422-cap clamp (Pitfall 2)

export interface UseBorrowersResult {
  rows: Borrower[];        // the current page slice (post-search)
  page: number;
  pageCount: number;
  isLoading: boolean;
  isError: boolean;
  setSearch: (q: string) => void;
  search: string;
}

export function useBorrowersQuery(search: string): {
  all: Borrower[]; isLoading: boolean; isError: boolean; page: number;
  pageCount: number; rows: Borrower[];
} {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const [params] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);

  // Single ≤100 fetch, keyed under the SSE prefix (Pitfall 4).
  const query = useQuery({
    queryKey: ["borrowers", wsId, { limit: FETCH_LIMIT, page: 1 }],
    queryFn: () => borrowersApi.list(wsId as string, 1, FETCH_LIMIT),
    enabled: !!wsId,
    retry: false,
  });

  const all = useMemo(() => query.data?.items ?? [], [query.data]);

  // Client search (name substring) — matches LoansListPage convention (OQ2).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((b) => b.name.toLowerCase().includes(q)
      || (b.email ?? "").toLowerCase().includes(q));
  }, [all, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / BORROWERS_PER_PAGE));
  const start = (page - 1) * BORROWERS_PER_PAGE;
  const rows = filtered.slice(start, start + BORROWERS_PER_PAGE);

  return {
    all, isLoading: query.isLoading, isError: query.isError,
    page: Math.min(page, pageCount), pageCount, rows,
  };
}
```
Feed `RetroPagination` exactly as `InventoryListPage.tsx:501-512`, but with the client `pageCount`:
```tsx
<RetroPagination
  page={page} pageCount={pageCount} perPage={BORROWERS_PER_PAGE}
  onPageChange={(p) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev); next.set("page", String(p)); return next;
  })}
/>
```

### useBorrowerMutations (NEW) — create/update/delete + 400 mapping (OQ3)
```ts
// Source: useLoanMutations.ts:44-49 (prefix invalidate) + useItemMutations.ts:56-64 (400 map)
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { borrowersApi, type CreateBorrowerBody, type UpdateBorrowerBody } from "@/lib/api/borrowers";
import { HttpError } from "@/lib/api";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";

export function useBorrowerMutations() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const qc = useQueryClient();
  const { t } = useLingui();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["borrowers", wsId as string] }); // prefix, no exact

  const create = useMutation({
    mutationFn: (b: CreateBorrowerBody) => borrowersApi.create(wsId as string, b),
    onSuccess: () => { invalidate(); retroToast.success(t`Borrower created.`); },
    onError: () => retroToast.error(t`Couldn't create this borrower.`),
  });
  const update = useMutation({
    mutationFn: (a: { id: string; body: UpdateBorrowerBody }) =>
      borrowersApi.update(wsId as string, a.id, a.body),
    onSuccess: () => { invalidate(); retroToast.success(t`Borrower saved.`); },
    onError: () => retroToast.error(t`Couldn't save this borrower.`),
  });
  const del = useMutation({
    mutationFn: (id: string) => borrowersApi.del(wsId as string, id),
    onSuccess: () => { invalidate(); retroToast.success(t`Borrower deleted.`); },
    onError: (err) =>
      retroToast.error(
        err instanceof HttpError && err.status === 400
          ? t`Can't delete — this borrower has active loans.`
          : t`Couldn't delete this borrower.`,
      ),
  });
  return { create, update, del };
}
```

### Borrower zod schema (NEW `features/borrowers/schema.ts`) — OQ5
```ts
// Source pattern: features/loans/schema.ts:31-53 (default "" + only-when-supplied refine)
import { z } from "zod";

export const borrowerFormSchema = z.object({
  name: z.string().trim().min(1, { message: "Name is required." }).max(255),
  // Email validated ONLY when supplied (empty string = absent). Mirror the
  // loan due-date "only-when-supplied" discipline.
  email: z.string().optional().default("")
    .refine((v) => !v || z.string().email().safeParse(v).success,
      { message: "Enter a valid email address." }),
  phone: z.string().optional().default(""),
  notes: z.string().max(10000).optional().default(""),
});
export type BorrowerFormInput = z.input<typeof borrowerFormSchema>;
export type BorrowerFormValues = z.infer<typeof borrowerFormSchema>;
```
On submit, OMIT empty optionals (never zero-inject — `LoanFormPage.tsx:144-145`):
```ts
const body: CreateBorrowerBody = { name: v.name };
if (v.email) body.email = v.email;
if (v.phone) body.phone = v.phone;
if (v.notes) body.notes = v.notes;
```

### RetroTable column set (list page) — mirror `LoansListPage.tsx:243-291`
| Column | Source field | Cell |
|--------|--------------|------|
| Name | `b.name` | `font-semibold` |
| Email | `b.email` | `b.email ?? "—"` muted |
| Phone | `b.phone` | `b.phone ?? "—"` muted |
| (actions) | — | `aria-hidden` th + per-row VIEW / EDIT / DELETE BevelButtons (`stopPropagation`) |
Row `onClick` → `navigate(\`/borrowers/${b.id}\`)` (cursor-pointer, like loan/inventory rows).

### Detail page layout (NEW `BorrowerDetailPage.tsx`) — mirror `ItemDetailPage`
```tsx
// Source: ItemDetailPage.tsx (titlebar EDIT + DELETE, HttpError 404 not-found, mount panels)
const { id } = useParams();
const { currentWorkspaceId: wsId } = useWorkspace();
const detail = useQuery({
  queryKey: ["borrowers", wsId as string, "detail", id],
  queryFn: () => borrowersApi.get(wsId as string, id as string),
  enabled: !!wsId && !!id,
});
const loans = useBorrowerLoans(wsId as string, id as string);   // Phase 8 hook
const activeCount = loans.data?.active.length ?? 0;
const { del } = useBorrowerMutations();

// 404 → not-found state (ItemDetailPage.tsx:89-91 pattern)
const notFound = detail.error instanceof HttpError && detail.error.status === 404;

// Layout: mint Window titled with borrower name; titlebar EDIT → /borrowers/:id/edit.
// DELETE button: disabled + danger badge + "View active loans" anchor when activeCount>0.
<Window title={t`${detail.data?.name ?? "BORROWER"}`} titlebarVariant="mint">
  {/* profile: name / email / phone / notes */}
  {activeCount > 0 && (
    <p className="flex items-center gap-sp-2">
      <RetroBadge variant="danger"><Trans>{activeCount} active</Trans></RetroBadge>
      <a href="#active-loans" className="underline">
        <Trans>View active loans</Trans>
      </a>
    </p>
  )}
  <BevelButton onClick={() => navigate(`/borrowers/${id}/edit`)}><Trans>EDIT</Trans></BevelButton>
  <BevelButton variant="danger"
    disabled={activeCount > 0}
    aria-disabled={activeCount > 0 || undefined}
    onClick={() => setDeleteOpen(true)}><Trans>DELETE</Trans></BevelButton>
</Window>
<div id="active-loans">
  <BorrowerLoanPanels wsId={wsId as string} borrowerId={id as string} />
</div>
```
DELETE confirm → `RetroConfirmDialog` (pink), `onConfirm` → `del.mutate(id)` then navigate; the 400
backstop lives in the mutation `onError`.

### MSW handler conventions (NEW `test/msw/borrowerHandlers.ts`)
```ts
// Source: test/msw/loanHandlers.ts — /api prefix (BASE_URL), bare { items }, specific
// routes BEFORE the /:id catch-all, per-test override via server.use(...).
import { http, HttpResponse } from "msw";
const B1 = { id: "bor-1", workspace_id: "ws-1", name: "Alex", email: "a@x.io",
  is_archived: false, created_at: "2026-06-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z" };
export const borrowerHandlers = [
  http.get("/api/workspaces/:wsId/borrowers/search", () =>
    HttpResponse.json({ items: [B1] })),                       // specific BEFORE :id
  http.get("/api/workspaces/:wsId/borrowers/:id", ({ params }) =>
    HttpResponse.json({ ...B1, id: String(params.id) })),
  http.get("/api/workspaces/:wsId/borrowers", () =>
    HttpResponse.json({ items: [B1] })),                       // bare {items}, no total
  http.post("/api/workspaces/:wsId/borrowers", () => HttpResponse.json(B1)),
  http.patch("/api/workspaces/:wsId/borrowers/:id", ({ params }) =>
    HttpResponse.json({ ...B1, id: String(params.id) })),
  http.delete("/api/workspaces/:wsId/borrowers/:id", () => new HttpResponse(null, { status: 204 })),
];
// For the BORR-05 guard test, override delete per-case:
//   server.use(http.delete("/api/workspaces/:wsId/borrowers/:id",
//     () => HttpResponse.json({ detail: "cannot delete borrower with active loans" }, { status: 400 })));
```
> NOTE: `loanHandlers` are NOT in the default `setupServer(...handlers)` set — they are added per-test
> via `server.use(...loanHandlers)` (`LoansListPage.test.tsx:42`). Follow the same convention for
> `borrowerHandlers` (the global `handlers` in `test/msw/handlers.ts` does not currently include
> borrower routes — add via `server.use` in each borrower test, OR extend the global set; mirror loans).

## Runtime State Inventory

Not applicable — Phase 9 is a greenfield frontend feature (new files only) plus two route additions to
`routes/index.tsx`. No rename/refactor/migration; no stored data, live-service config, OS-registered
state, secrets, or build artifacts carry borrower strings that change. (Verified: this phase adds
borrower UI; the borrower DB table + endpoints already exist and are unchanged.)

## State of the Art

| Old Approach (legacy `/frontend`) | v3.0 parity (frontend2) | Why changed |
|--------------|------------------|-------------|
| Inline-edit cells in the borrower table | Dedicated edit form (BORR-04) | Parity convention — forms over inline-edit for profiles |
| Bulk select + bulk archive/export + CSV import | None | Out of scope (BORR-01..05) |
| Delete = plain try/catch toast, no guard UI | Proactive badge + "View active loans" + 400 backstop | BORR-05 is a NEW affordance |
| `is_archived` client filter | None (archived implicitly excluded; `archived=false` default) | No archive UI (OQ4) |
| Fetch-all + client paginate/sort | Same, via RetroPagination (client `pageCount`) | Convention preserved (bare envelope forces it) |

**Deprecated/outdated:** legacy `frontend/lib/api/borrowers.ts` used `apiClient` + a 404-swallow in
`search` — port the *shape* (list/search/get/create/update/delete) but use the frontend2 `lib/api`
helpers (`get/post/patch/del`) and the typed `HttpError`, not the legacy client.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `BorrowerResponse.created_at/updated_at` arrive as ISO strings on the wire (Go `time.Time` → JSON string) | borrowersApi `Borrower` interface | Low — consistent with Loan/Inventory wire types already used as `string` |
| A2 | `/borrowers/{id}/loans` (used by `useBorrowerLoans`) returns active rows reliably so `active.length` is a trustworthy proactive count | OQ3 | Low — already shipped + tested Phase 8; the 400 backstop covers any drift |
| A3 | Adding `borrowerHandlers` via per-test `server.use` (not the global set) is the intended convention | MSW section | Low — directly mirrors `LoansListPage.test.tsx:42`; planner may instead extend global handlers |

## Open Questions

None remaining — OQ1–OQ5 are all RESOLVED above with file:line evidence. Two minor planner choices
remain (Claude's Discretion): debounce-in-hook vs page (recommend: no debounce needed since search is
pure client-filter of a loaded array), and detail-page stacked vs two-column (recommend stacked).

## Environment Availability

Not applicable — no external tools/services beyond the existing dev stack (Vite, backend, Postgres,
MSW for tests). Borrower endpoints are already implemented and live (verified in
`backend/.../borrower/handler.go`). No new runtime dependency.

## Validation Architecture

> `.planning/config.json` not inspected for `nyquist_validation`; the repo has an established vitest +
> MSW + Playwright stack, so the test map is included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom) + MSW for unit/component; Playwright (chromium+firefox) for E2E |
| Config file | `frontend2/vitest` config + `frontend2/playwright.config.ts` (per CLAUDE.md) |
| Quick run command | `cd frontend2 && bun run test` (vitest) |
| Full suite command | `cd frontend2 && bun run test` then `bun run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BORR-01 | List renders rows, search filters, pager pages | component | `bun run test BorrowersListPage` | ❌ Wave 0 — `features/borrowers/BorrowersListPage.test.tsx` |
| BORR-02 | Create form validates + posts | component | `bun run test BorrowerFormPage` | ❌ Wave 0 — `features/borrowers/BorrowerFormPage.test.tsx` |
| BORR-03 | Detail mounts BorrowerLoanPanels (active+history) | component | `bun run test BorrowerDetailPage` | ❌ Wave 0 |
| BORR-04 | Edit form prefills + PATCHes | component | `bun run test BorrowerFormPage` | ❌ Wave 0 (same file, edit mode) |
| BORR-05 | active>0 → DELETE disabled + badge + link; 400 backstop toast | component | `bun run test BorrowerDetailPage` | ❌ Wave 0 |
| (api) | borrowersApi list/search/get/create/update/delete URLs + bare-envelope | unit | `bun run test borrowers` | ❌ Wave 0 — `lib/api/borrowers.test.ts` (mirror `lib/api/loans` tests) |

### Sampling Rate
- **Per task commit:** `cd frontend2 && bun run test <changed-file>`
- **Per wave merge:** `cd frontend2 && bun run test` (full vitest)
- **Phase gate:** full vitest green + an E2E borrower spec (optional — mirror `login-dashboard.spec.ts`) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `lib/api/borrowers.test.ts` — URL shapes + bare-envelope typing (mirror loans api test)
- [ ] `features/borrowers/BorrowersListPage.test.tsx` — covers BORR-01
- [ ] `features/borrowers/BorrowerFormPage.test.tsx` — covers BORR-02/04
- [ ] `features/borrowers/BorrowerDetailPage.test.tsx` — covers BORR-03/05 (guard)
- [ ] `test/msw/borrowerHandlers.ts` — fixtures + 400 delete override

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited) | cookie-JWT via `credentials:"include"` in `lib/api.ts` — no token plumbing in Phase 9 |
| V4 Access Control | yes | All routes are workspace-scoped `/workspaces/{wsId}/borrowers...`; backend enforces tenant (handler 401 on missing ws context) |
| V5 Input Validation | yes | zod client mirror + backend `format:email` / `minLength`/`maxLength` authoritative |
| V6 Cryptography | no | none (no secrets handled) |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant borrower read/delete | Information Disclosure / Tampering | Workspace-scoped URL + server `workspace_id` filter (handler enforces ws context, `:147` etc.) — never trust client-supplied ids alone |
| XSS via borrower name/notes | Tampering | React escapes by default; no `dangerouslySetInnerHTML` in any analog page |

## Sources

### Primary (HIGH confidence — this repo, verified file:line)
- `backend/internal/domain/warehouse/borrower/handler.go` — list/search/get/create/update/delete/archive shapes; 400 string `:154`; bare envelope `:286-288`; limit max 100 `:277`; field contracts `:303-322`.
- `frontend2/src/lib/api/loans.ts:29-69` — borrowersApi style template (`byBorrower` `:65-68`).
- `frontend2/src/lib/api/inventory.ts:11-15,32,40-46` — full-vs-bare envelope discipline.
- `frontend2/src/lib/api.ts:22-30,44-57,165-167` — `HttpError`, `parseError` (`detail||message`), `del`.
- `frontend2/src/lib/types.ts:5-9` — `ApiError`.
- `frontend2/src/features/inventory/InventoryListPage.tsx:48-69,94-95,120-132,167-174,501-512` — render-loop guard, server-pager (NOT applicable), client filter, RetroPagination feed.
- `frontend2/src/features/inventory/hooks/useInventoryQuery.ts:12,24-30` — URL `?page` only.
- `frontend2/src/features/loans/LoansListPage.tsx:53-56,66-78,92-103,202-291` — list page template + client search.
- `frontend2/src/features/loans/LoanFormPage.tsx:46-51,113-155,164-308` — form template + dirty guard + omit-empty.
- `frontend2/src/features/loans/schema.ts:31-53` — optional-field/only-when-supplied zod pattern.
- `frontend2/src/features/loans/hooks/useLoanMutations.ts:44-49` — prefix invalidate.
- `frontend2/src/features/loans/hooks/useBorrowerLoans.ts:11-28` — per-borrower partitioned loans.
- `frontend2/src/features/loans/components/BorrowerLoanPanels.tsx:33-47` — mount target (BORR-03).
- `frontend2/src/features/loans/hooks/useLoanPickerOptions.ts:43,76-84` — `["borrowers",ws,{limit}]` key + bare `{items}` + LIMIT=100.
- `frontend2/src/features/items/ItemDetailPage.tsx:16,72,85-91,281-339` — detail layout + HttpError mapping + delete confirm.
- `frontend2/src/features/items/hooks/useItemMutations.ts:44-66` — delete 400-mapping template.
- `frontend2/src/features/inventory/schema.ts:13-15` — `default("")` rationale.
- `frontend2/src/components/retro/data/RetroPagination.tsx:4-79` — props + per-page-button rendering (forces client pageCount).
- `frontend2/src/components/retro/RetroBadge.tsx:7,13-28` — `variant="danger"`.
- `frontend2/src/routes/index.tsx:39-91` — AP-1 literal-before-param, library mode, single-writer.
- `frontend2/src/test/msw/loanHandlers.ts` + `server.ts` + `LoansListPage.test.tsx:42` — MSW conventions + per-test `server.use`.
- `.planning/REQUIREMENTS.md:104,108-112,369-374` — BORR-01..05 + LOAN-06 status.
- `.planning/ROADMAP.md:240` — Phase 9 scope ("CRUD with active-loan delete guard").
- `frontend/app/[locale]/(dashboard)/dashboard/borrowers/page.tsx:310-311,428-443,500-519` + `frontend/lib/api/borrowers.ts` — legacy parity reference (client paginate, plain delete catch, bulk archive only).

### Secondary / Tertiary
- None — no web sources used; this is an internal-codebase parity phase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; all libraries already shipped.
- Architecture: HIGH — every pattern cited to a merged file:line; OQ1/OQ2/OQ3/OQ4/OQ5 resolved with backend + frontend evidence.
- Pitfalls: HIGH — carried from loans/inventory CONTEXT + verified against the same source files.

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (stable internal codebase; re-verify only if the borrower backend handler or `lib/api.ts` error shape changes).
