# Phase 62: Loans - Research

**Researched:** 2026-04-17
**Domain:** Full-stack CRUD feature — Go/Huma backend endpoint addition + React 19 / TanStack Query / react-hook-form / zod frontend composition on an existing retro design system
**Confidence:** HIGH

## Summary

Phase 62 is a **composition phase over an established stack**, not a technology selection phase. The project is in active v2.1 milestone execution (Phases 56–61 complete); every primitive, pattern, mutation-hook convention, and style token needed for Phase 62 already exists and has been validated in production by Phases 58–61. Research is therefore about pinning down **which existing patterns to replicate** and **which local gaps to close** — not "what library should we use."

Three concrete work items cross the front/back boundary:

1. **Backend:** add `PATCH /loans/{id}` handler, a corresponding `service.Update()` method, and embed `item` (name + `primary_photo_thumbnail_url`) + `borrower` (name) into `LoanResponse` so list rows render without N+1 round-trips. An existing sqlc query (`GetLoanWithDetails`/`ListActiveLoansWithDetails`) already demonstrates the join pattern needed, but no list endpoint currently returns it — the repository layer will need a new join-returning query variant, or the handler will need a batched ID→decoration map approach (mirroring Phase 61's `lookupPrimaryPhotos` helper).
2. **Frontend API:** extend `loansApi` with `update()`, `listForItem()`, and extended `Loan` interface for embedded decoration; add `loanKeys.forItem()`.
3. **Frontend UI:** compose `LoansListPage` (first production consumer of `RetroTabs`, reusing `useHashTab` from Phase 58), `LoanPanel` + `LoanForm` (slide-over, direct twin of `BorrowerPanel` + `BorrowerForm`), `LoanReturnFlow` (single-step confirm, non-destructive amber), and four loan-data panels slotted into Phase 59/60 placeholder seams.

**Primary recommendation:** Follow the 4-plan split in CONTEXT.md D-08 verbatim. Replicate Phase 59's panel+form composition pattern for create/edit, Phase 60's table+filter+archive-flow pattern for the list page, and Phase 61's decoration-embedded-in-list-response pattern for the item/borrower name embedding. Introduce zero new runtime dependencies; zero new retro primitives.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Loan domain state (create/return/update/read) | API (Go/Huma + Postgres) | — | Authoritative source of truth; enforces inventory-available + already-returned guards in `service.go` |
| Loan list filtering (active/overdue/history) | API | Frontend cache | Backend owns `is_active`/`is_overdue` computation; frontend caches per tab via React Query keys |
| Tab counts for ACTIVE/OVERDUE/HISTORY | Frontend (TanStack Query) | — | Per CONTEXT.md D-07: three parallel list calls, count = `response.items.length`; no backend stats endpoint |
| Tab hash-state (`#active`/`#overdue`/`#history`) | Browser (URL hash) | React state | `useHashTab` reads `location.hash` + `hashchange` events; SSR-safe |
| Form validation (zod rules) | Frontend (react-hook-form + zod) | API (authoritative) | UX-level field caps enforced client-side; backend re-validates |
| Slide-over UX (focus trap, backdrop, unsaved-changes guard) | Browser (`@floating-ui/react` + `SlideOverPanel`) | — | Pure UI concern; Phase 58/59/60 reusable shell |
| Cache invalidation after mutations | Frontend (TanStack Query) | — | `useMutation.onSuccess` invalidates `loanKeys.all` + related item/borrower detail keys |
| Item + borrower name rendering in rows | API (embed decoration) | Frontend (render) | Per CONTEXT.md D-03: embedded in list response to avoid N+1 |
| Mark-returned flow | Frontend dialog → API `POST /loans/{id}/return` | — | Confirmation in dialog; state transition in backend |

## Standard Stack

### Core (all present, verified in `frontend2/package.json` + `backend/go.mod`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.5 | UI framework | [VERIFIED: package.json] Project baseline since v2.0 |
| TanStack Query | ^5 | Server-state cache + mutations | [VERIFIED: package.json] v2.1 decision locked in STATE.md |
| react-hook-form | 7.72.1 | Form state | [VERIFIED: package.json] v2.1 substrate (STATE.md) |
| zod | 4.3.6 | Runtime validation | [VERIFIED: package.json] v2.1 substrate (STATE.md) |
| @hookform/resolvers | 5.2.2 | Zod↔RHF bridge | [VERIFIED: package.json] Standard pairing |
| @lingui/react | 5.9.5 | i18n (t macro) | [VERIFIED: package.json] v2.0 locked |
| @lingui/swc-plugin | 5.11.0 | Compile-time macro transform | [VERIFIED: package.json] |
| react-router | 7.14.0 | Routing (library mode) | [VERIFIED: package.json] v2.0 locked |
| @floating-ui/react | 0.27.19 | Slide-over, combobox positioning, focus trap | [VERIFIED: package.json] Used by `SlideOverPanel`, `RetroCombobox`, `RetroDialog` |
| Huma | v2 | Go HTTP framework for typed handlers | [VERIFIED: handler.go imports `huma/v2`] Backend baseline |
| google/uuid | — | UUID type on Go domain boundaries | [VERIFIED: handler.go] |
| jackc/pgx v5 | — | Postgres driver | [VERIFIED: loan_repository.go] |
| sqlc | — | SQL→Go typed query generator | [VERIFIED: `backend/internal/infra/queries/`] |
| Go | 1.25.0 | Compiler | [VERIFIED: backend/go.mod line 3] |

### Supporting (all present)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 4.1.3 | Frontend test runner | All frontend unit/component tests |
| @testing-library/react | 16.3.2 | React component tests | Panel + form + page render/interaction tests |
| @testing-library/user-event | 14.6.1 | Typed user event simulation | Click/type/tab in form + dialog tests |
| stretchr/testify | — | Go assertions + mock | `handler_test.go`, `service_test.go` |
| lucide-react | — | Icon set (already used) | `Plus`, `Undo2`, `Pencil`, `ImageOff`, `AlertTriangle`, `ArrowLeft` per UI-SPEC |

### Alternatives Considered — None

No dependency additions needed. CONTEXT.md and STATE.md lock the stack. Phase 62 is a pure composition.

**Installation:** No new packages.

**Version verification:** Skipped — no new packages to verify against npm registry. All versions verified from the on-disk `frontend2/package.json` (read 2026-04-17) and `backend/go.mod` (read 2026-04-17). [VERIFIED: filesystem]

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Edit Endpoint (O-01 resolved)**
- **D-01:** Add a unified `PATCH /loans/{id}` backend endpoint that accepts `{ due_date?: string; notes?: string }`. This satisfies LOAN-04 (edit both fields in one request). The existing `PATCH /loans/{id}/extend` endpoint remains and may be kept or deprecated — the new endpoint supersedes it for the edit flow.
- **D-02:** Add `loansApi.update(wsId: string, id: string, body: { due_date?: string; notes?: string })` to `frontend2/src/lib/api/loans.ts`. The edit slide-over submits a single call to this method. The `loansApi.extend()` method remains in the API client but is no longer used by the edit flow.

**Loan Row Decoration (O-02 resolved)**
- **D-03:** The backend embeds item and borrower data directly in loan list responses. Specifically, each loan object in the list response includes:
  - `item: { id: string; name: string; primary_photo_thumbnail_url: string | null }`
  - `borrower: { id: string; name: string }`
  This matches the decoration pattern established in Phase 61 (items list embeds `primary_photo_thumbnail_url`). Zero extra round-trips per row.
- **D-04:** The `Loan` interface in `frontend2/src/lib/api/loans.ts` must be extended to include the embedded `item` and `borrower` fields. The `LoanResponse` struct in the backend handler must likewise include these fields.

**Per-Item Loans Fetch**
- **D-05:** Add `loansApi.listForItem(wsId: string, inventoryId: string)` to `frontend2/src/lib/api/loans.ts`. This calls `GET /workspaces/{wsId}/inventory/{inventoryId}/loans`. The item detail hooks call this once and partition the result client-side into active loan (first `is_active === true` entry) and history (all `is_active === false` entries, most recent first).
- **D-06:** Add `loanKeys.forItem(inventoryId: string)` to the `loanKeys` query key factory.

**Tab Counts (O-03 resolved per UI-SPEC)**
- **D-07:** Tab counts are derived by firing all three list endpoints on page mount (`listActive`, `listOverdue`, `list` without filters for history). Count = `response.items.length`. While any count query is loading, tabs show `{LABEL} · …` (mono ellipsis). All three queries fire in parallel.

**Plan Structure**
- **D-08:** Phase 62 splits into **4 plans** following the Phase 59/60 pattern:
  1. **62-01:** Backend — `PATCH /loans/{id}` endpoint + extend `LoanResponse` to embed item/borrower names + `primary_photo_thumbnail_url`
  2. **62-02:** Frontend API client + hooks — `loansApi.update`, `loansApi.listForItem`, `loanKeys.forItem`, query hooks (`useLoansActive`, `useLoansOverdue`, `useLoansHistory`, `useLoansForItem`, `useLoansForBorrower`, `useReturnLoan`, `useCreateLoan`, `useUpdateLoan` mutations)
  3. **62-03:** `LoansListPage` composition — `RetroTabs` integration, `LoansTable`, `LoanRow`, `LoanPanel` (create + edit), `LoanForm`, `LoanRowActions`, `LoanReturnFlow`, pagination, empty states, `useHashTab`
  4. **62-04:** Item/borrower detail wiring — `ItemActiveLoanPanel`, `ItemLoanHistoryPanel`, `BorrowerActiveLoansPanel`, `BorrowerLoanHistoryPanel` replacing Phase 60/59 placeholders + Lingui `t` macro sweep + `bun run extract` + human-verify checkpoint

### Claude's Discretion

- Whether `PATCH /loans/{id}` in the backend reuses the existing `extend` handler (plus a notes field) or is a new handler
- Whether `useHashTab` is imported from Phase 58's location or inlined in the loans feature
- Whether `loanKeys.forItem()` is stored as `forItem` or `list({ inventory_id })` — key shape details
- Whether plan 62-01 also addresses the `listActive` / `listOverdue` embed in one go or leaves the non-list endpoints for a follow-up
- Exact query invalidation key set after each mutation (planner follows UI-SPEC's invalidation table)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOAN-01 | User can view loans in a tabbed list: Active, Overdue, and History | `RetroTabs` + `useHashTab` hook both exist and are production-ready; three list endpoints already exist on backend (`list`, `listActive`, `listOverdue`). Plan 62-03 composes them. |
| LOAN-02 | User can create a loan by selecting an item and borrower, with optional due date and notes | `loansApi.create` already exists (`POST /loans`); `RetroCombobox` supports async option loading via `onSearch` + `loading` props. `BorrowerPanel`/`BorrowerForm` is the direct template. Plan 62-03 composes. |
| LOAN-03 | User can mark an active loan as returned | `loansApi.return` already exists (`POST /loans/{id}/return`); `RetroConfirmDialog` supports the amber "completion" variant via `variant="soft"` + no hazard stripe. Plan 62-03 composes `LoanReturnFlow`. |
| LOAN-04 | User can edit a non-returned loan's due date and notes | **Requires backend change** (D-01): new `PATCH /loans/{id}` in plan 62-01. No current endpoint accepts both `due_date` and `notes` in one call; `extend` accepts only `new_due_date`. Edit slide-over flow composes in plan 62-03. |
| LOAN-05 | Item detail page shows the item's active loan and loan history | **Requires backend decoration** (D-03) so rows render without N+1. `GET /inventory/{inventory_id}/loans` already exists. Needs embedded `item`+`borrower` in response. Plan 62-04 wires `ItemActiveLoanPanel` + `ItemLoanHistoryPanel` replacing Phase 60's placeholder. |
| LOAN-06 | Borrower detail page shows the borrower's active loans and loan history | **Requires backend decoration** (D-03). `GET /borrowers/{borrower_id}/loans` already exists. Plan 62-04 wires `BorrowerActiveLoansPanel` + `BorrowerLoanHistoryPanel` replacing Phase 59's two placeholders. |

## Project Constraints (from CLAUDE.md)

No `./CLAUDE.md` exists in this repository [VERIFIED: filesystem read]. Project-specific constraints are instead documented in `.planning/STATE.md`, `.planning/PROJECT.md`, and inherited from prior phase CONTEXT.md files. The following directives have been extracted and apply to Phase 62:

1. **Online-only** — no IndexedDB, no Serwist, no service worker. Enforced by `frontend2/scripts/check-forbidden-imports.mjs` (v2.1 CI guard per STATE.md).
2. **Retro components only** — all UI composes from `@/components/retro` barrel. No shadcn. No new global retro primitives in this phase.
3. **TanStack Query v5** — use `placeholderData: (prev) => prev`, not v4's `keepPreviousData: true` (verified by `useItemsList.ts` comment, Pitfall #6 below).
4. **No optimistic updates** — `useMutation.onSuccess` invalidation only (explicit STATE.md baseline for v2.1).
5. **Lingui `t` macro for all literals** — `bun run extract` must run at phase close; both `en` and `et` catalogs must be updated.
6. **`workspaceId` from `useAuth()`, not props** — v2.0/v2.1 rule, verified in every existing hook.
7. **Empty string → undefined coercion** in form resolvers — established pattern in `ItemForm.tsx` and `BorrowerForm.tsx` to prevent zod from running optional validators on empty controlled inputs.
8. **`HttpError` class for status-code branching** — 400 Bad Request → specific toast; other errors → generic connection toast. Pattern in `useDeleteBorrower`.

## Architecture Patterns

### System Architecture Diagram

```
                   ┌─────────────────────────────┐
                   │     /loans   (LoansListPage) │
                   │  URL hash: #active / #over-  │
                   │  due / #history              │
                   └──────────────┬───────────────┘
                                  │
                    useHashTab (reads location.hash)
                                  │
             ┌────────────────────┼────────────────────┐
             ▼                    ▼                    ▼
     ┌──────────────┐    ┌──────────────┐    ┌───────────────┐
     │ useLoansActive│   │useLoansOverdue│   │useLoansHistory│
     │ listActive()  │   │ listOverdue() │   │ list({})      │
     └───────┬───────┘   └───────┬───────┘   └───────┬───────┘
             │                   │                   │
             └─────────┬─────────┴─────────┬─────────┘
                       ▼                   ▼
              ┌──────────────────────────────────────┐
              │  React Query cache                   │
              │  keys: loanKeys.list({active:true})  │
              │        loanKeys.list({overdue:true}) │
              │        loanKeys.list({})             │
              └───────────────┬──────────────────────┘
                              │
                              ▼
                  HTTP GET (cookie auth)
                              │
                              ▼
              ┌──────────────────────────────────────┐
              │  Go / Huma backend                   │
              │  RegisterRoutes(api, svc, broadcaster)│
              │                                      │
              │  GET /workspaces/{ws}/loans          │
              │  GET /workspaces/{ws}/loans/active   │
              │  GET /workspaces/{ws}/loans/overdue  │
              │  GET /workspaces/{ws}/loans/{id}     │
              │  POST /workspaces/{ws}/loans         │
              │  POST /workspaces/{ws}/loans/{id}/return
              │  PATCH /workspaces/{ws}/loans/{id}/extend  (kept)
              │  PATCH /workspaces/{ws}/loans/{id}         (NEW, 62-01)
              │  GET /workspaces/{ws}/borrowers/{id}/loans │
              │  GET /workspaces/{ws}/inventory/{id}/loans │
              └───────────────┬──────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
     ┌──────────────┐              ┌────────────────────┐
     │ loan.Service │              │ inventory.Repository│
     │ Create/      │              │ (status→ON_LOAN on  │
     │ Return/      │              │  create, →AVAILABLE │
     │ ExtendDue/   │              │  on return)         │
     │ Update (NEW) │              │                    │
     │ List/...     │              └────────────────────┘
     └───────┬──────┘
             │
             ▼
     ┌──────────────┐
     │ loan.Repo    │
     │ (sqlc-gen'd) │  ───────►  Postgres warehouse.loans
     └──────────────┘
                                   + join: inventory,
                                     items, borrowers
                                     (for decoration)
```

**Mutation flows** (create / edit / return):
```
User → LoanPanel / LoanReturnFlow → useCreate/Update/ReturnLoan
      → loansApi.create/update/return → HTTP → service → repo → SQL
      ← onSuccess → qc.invalidateQueries(loanKeys.all)
                  + qc.invalidateQueries(itemKeys.detail(inv_id))
                  + qc.invalidateQueries(borrowerKeys.detail(bor_id))
      ← toast("Loan …")
```

### Recommended Project Structure (new files for Phase 62)

```
frontend2/src/features/loans/
├── LoansListPage.tsx           # route component, tab state, composition
├── LoansListPage.test.tsx
├── LoanDetailPage.tsx          # NOT CREATED — UI-SPEC confirms no /loans/:id route
├── hooks/
│   ├── useLoansActive.ts
│   ├── useLoansOverdue.ts
│   ├── useLoansHistory.ts
│   ├── useLoansForItem.ts
│   ├── useLoansForBorrower.ts
│   ├── useLoanMutations.ts     # useCreateLoan, useUpdateLoan, useReturnLoan
│   └── useLoansTabs.ts         # thin wrapper over useHashTab (D-08 discretion)
├── forms/
│   ├── schemas.ts              # loanCreateSchema, loanEditSchema
│   └── LoanForm.tsx            # RHF + zod, create + edit modes
├── panel/
│   └── LoanPanel.tsx           # SlideOverPanel + LoanForm
├── table/
│   ├── LoansTable.tsx          # tab-configured columns
│   ├── LoanRow.tsx
│   └── LoanRowActions.tsx
├── actions/
│   └── LoanReturnFlow.tsx      # single-step amber confirm dialog
├── panels/                     # item/borrower detail wiring
│   ├── ItemActiveLoanPanel.tsx
│   ├── ItemLoanHistoryPanel.tsx
│   ├── BorrowerActiveLoansPanel.tsx
│   └── BorrowerLoanHistoryPanel.tsx
├── icons.tsx                   # lucide-react re-exports (mirrors items/icons.tsx)
├── LoansPage.tsx               # EXISTS, placeholder — REPLACE / delete in 62-03
└── __tests__/
    ├── fixtures.ts             # makeLoan factory + re-exports
    ├── LoanForm.test.tsx
    ├── LoanPanel.test.tsx
    ├── LoansListPage.test.tsx
    ├── LoanReturnFlow.test.tsx
    ├── ItemActiveLoanPanel.test.tsx
    └── BorrowerActiveLoansPanel.test.tsx

backend/internal/domain/warehouse/loan/
├── handler.go                  # EXTEND: add PATCH /loans/{id}, extend LoanResponse with Item + Borrower embeds
├── service.go                  # EXTEND: add Update(ctx, wsID, loanID, dueDate, notes)
├── repository.go               # EXTEND: add Update() method signature
├── handler_test.go             # EXTEND: TestPatchLoan_* cases
└── service_test.go             # EXTEND: TestService_Update_* cases

backend/internal/infra/postgres/
└── loan_repository.go          # EXTEND: Update() method uses new sqlc query

backend/db/queries/loans.sql    # EXTEND: new `UpdateLoan` query (both fields)
                                # + possibly a `ListLoansWithDetails`
                                # + `ListActiveLoansWithDetails` (already present)
                                # + `ListOverdueLoansWithDetails` (new) + `ListLoansByBorrowerWithDetails` (new)
                                # + `ListLoansByInventoryWithDetails` (new)
```

### Pattern 1: Slide-Over Panel + Imperative Ref (Phase 59/60 template)

**What:** Panel component exposes `open(mode, entity?)` and `close()` via `useImperativeHandle`; parent holds a `useRef` and triggers opens. Internal `SlideOverPanel` owns the floating-ui dialog, focus trap, backdrop, and unsaved-changes guard. Form submits via `formId` attribute on the footer button.

**When to use:** Any slide-over create/edit flow in this codebase.

**Example:** See `BorrowerPanel.tsx` (81 lines) — direct template for `LoanPanel`. Key elements:
- `forwardRef` with `BorrowerPanelHandle` exposing `open`/`close`
- `mode: "create" | "edit"` + entity state
- `isDirty` state bubbled up from `BorrowerForm` via `onDirtyChange` callback; passed to `SlideOverPanel` which gates the discard dialog
- Submit label is derived: `isPending ? "WORKING…" : mode === "create" ? "CREATE X" : "SAVE X"`
- Footer uses `form={formId}` to submit the external form

### Pattern 2: React Query Mutation Hook (Phase 59/60 template)

**What:** One `useMutation` per operation; `onSuccess` invalidates relevant query keys and fires success toast; `onError` fires failure toast (optionally branching on `HttpError.status`).

**Example:** `useBorrowerMutations.ts` (read verbatim in research). Key elements:
- `const { workspaceId } = useAuth()` — NEVER pass as prop
- `const qc = useQueryClient()`
- Success toast uses Lingui `t` macro
- 400-status branching via `HttpError` check (see `useDeleteBorrower` for the BORR-04 active-loans guard)

**Phase 62 invalidation sets** (from UI-SPEC Interaction Contracts):
- Create success → `loanKeys.all` + `itemKeys.detail(inventory_id)` + `borrowerKeys.detail(borrower_id)` + `itemKeys.lists()` + `borrowerKeys.lists()`
- Update success → `loanKeys.all`
- Return success → `loanKeys.all` + `itemKeys.detail(inventory_id)` + `borrowerKeys.detail(borrower_id)`

### Pattern 3: Tab State via URL Hash (Phase 58 template)

**What:** `useHashTab<T>(defaultTab, validKeys)` in `features/taxonomy/hooks/useHashTab.ts`. Returns `[tab, setTab]`. Validates hash against allowlist (user-controlled input cannot inject arbitrary tab ids). Uses `history.replaceState` (no history pollution). Listens to `hashchange` for back/forward nav.

**Example:** `TaxonomyPage.tsx`:
```tsx
const TAB_KEYS = ["categories", "locations", "containers"] as const;
type TabKey = (typeof TAB_KEYS)[number];
const [tab, setTab] = useHashTab<TabKey>("categories", TAB_KEYS);
```

**Phase 62 application:**
```tsx
const LOAN_TAB_KEYS = ["active", "overdue", "history"] as const;
type LoanTab = (typeof LOAN_TAB_KEYS)[number];
const [tab, setTab] = useHashTab<LoanTab>("active", LOAN_TAB_KEYS);
```

**Discretion (D-08):** Either import directly from `@/features/taxonomy/hooks/useHashTab` or mirror it into `@/features/loans/hooks/useLoansTabs`. **Recommendation: import directly from taxonomy location.** No behavior divergence needed; duplicating invites drift. Future refactor can promote to `@/lib/hooks/useHashTab.ts` if a third consumer arrives.

### Pattern 4: Decoration Via Response Embedding (Phase 61 template for D-03)

**What:** Backend list/detail handler batches a secondary lookup and attaches the decoration to the response struct. Frontend reads it directly off the entity; no separate query needed.

**Example (Phase 61, verified in `item/handler.go`):**
```go
// Batch fetch — 1 SQL round-trip for N items
primaryByItem := lookupPrimaryPhotos(ctx, photos, workspaceID, items)

// Render
items := make([]ItemResponse, len(items))
for i, it := range items {
    primary := primaryByItem[it.ID()]
    items[i] = toItemResponse(it, primary, photoURLGen)
}
```

`toItemResponse` then sets `resp.PrimaryPhotoThumbnailURL` when `primary != nil`.

**Phase 62 application (Plan 62-01):** Extend `LoanResponse` with:
```go
type LoanEmbeddedItem struct {
    ID                        uuid.UUID `json:"id"`
    Name                      string    `json:"name"`
    PrimaryPhotoThumbnailURL  *string   `json:"primary_photo_thumbnail_url,omitempty"`
}
type LoanEmbeddedBorrower struct {
    ID   uuid.UUID `json:"id"`
    Name string    `json:"name"`
}
type LoanResponse struct {
    ...existing fields...
    Item     LoanEmbeddedItem     `json:"item"`
    Borrower LoanEmbeddedBorrower `json:"borrower"`
}
```

**Two implementation paths** (Claude's discretion in CONTEXT.md):
- **Path A (preferred):** Use sqlc join queries — add `ListActiveLoansWithDetails` (already exists!), `ListOverdueLoansWithDetails` (new), `ListLoansByBorrowerWithDetails` (new), `ListLoansByInventoryWithDetails` (new), `ListLoansByWorkspaceWithDetails` (new). Repository returns a struct with both the loan entity and decoration fields. Simpler, fewer round-trips.
- **Path B:** Keep existing repo list queries; add a `lookupItemsForLoans` + `lookupBorrowersForLoans` batched helper in the handler (mirrors `lookupPrimaryPhotos`). Less SQL work, more Go.

Path A has precedent (`ListActiveLoansWithDetails` already demonstrates the join shape in `backend/db/queries/loans.sql` lines 64–77, see Code Examples below). Path B has Phase 61 precedent (`lookupPrimaryPhotos`). **Recommendation: Path A.** The join already exists for one case; symmetry argues for completing the set. Path B duplicates the join logic across services.

### Pattern 5: Archive-First Confirm Flow (Phase 60 template for LoanReturnFlow)

**What:** `forwardRef` wrapper holding two internal `RetroConfirmDialog` refs; `switchToDelete()` closes first + `setTimeout(..., 0)` opens second to avoid dialog-race.

**Phase 62 simplification:** `LoanReturnFlow` is **single-step** — no second dialog. One `RetroConfirmDialog` with `variant="soft"` (amber, no hazard stripe) and `destructiveLabel="RETURN LOAN"`. Pattern is simpler than `ItemArchiveDeleteFlow` but shares the same `forwardRef` + `open()` imperative handle. UI-SPEC explicitly calls this out: "mirrors `ItemArchiveDeleteFlow` but single-step and non-destructive."

### Pattern 6: Page-Filter URL State (Phase 60 template for pagination)

**What:** `useItemsListQueryParams` in `features/items/filters/` exposes `[ui, updateUi, clearFilters]` where `ui.page` is URL-driven (`?page=2`). Ensures deep links work + browser history works.

**Phase 62 application:** `?page=N` per tab (UI-SPEC: tabs reset page to 1 on tab switch). Likely one `useLoansListQueryParams` hook reading `page` only; the tab portion goes through the hash, so the two states are orthogonal.

### Anti-Patterns to Avoid

- **Per-row fetches to hydrate names.** UI-SPEC explicitly rejects Option B in O-02 (frontend issuing parallel item/borrower GETs per row). Backend MUST embed.
- **Hand-rolling a tab component.** `RetroTabs` exists; use it. First production consumer is part of its value — no further primitives needed.
- **Optimistic updates for create/return/update.** STATE.md locks "`useMutation onSuccess` invalidation is enough" for v2.1. Phase 59/60/61 baseline. Don't break.
- **Form resolver running zod on empty strings.** Use the empty-string-to-undefined coercion pattern from `BorrowerForm.tsx` lines 18–28 and `ItemForm.tsx` lines 27–37.
- **Passing `workspaceId` as prop.** Read from `useAuth()` in every hook. Verified in every existing hook.
- **Catching `HttpError.status` with string matching.** Check `err instanceof HttpError && err.status === 400` first; only then look at `err.message` if a specific 400 sub-case is needed.
- **Using v4 TanStack Query idioms.** Use `placeholderData: (prev) => prev` not `keepPreviousData`. See `useItemsList.ts` comment.
- **`SlideOverPanel` without `isDirty`.** The panel gates Esc / backdrop / X close through the discard-changes dialog when `isDirty === true`. `LoanForm` must call `onDirtyChange` on every `formState.isDirty` change (see `BorrowerForm.tsx` line 55–57).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab row with ARIA + keyboard nav | Custom role="tablist" with arrow-key handling | `RetroTabs` (first production use — it already covers the styles per 62-UI-SPEC) | ARIA tab semantics are subtle; keyboard nav (←/→/Home/End) is easy to get wrong |
| Tab URL hash state | `useEffect` listening to `location.hash` | `useHashTab` from `features/taxonomy/hooks/` | Already handles SSR-safety, validation allowlist, `hashchange` event, `history.replaceState` |
| Slide-over panel + focus trap + backdrop | Manual portal + focus management | `SlideOverPanel` + `@floating-ui/react` (`FloatingFocusManager`) | Focus traps are tricky; backdrop click should bubble to the unsaved-changes guard |
| Async option picker | Custom combobox | `RetroCombobox` with `onSearch` + `loading` + `options` props | Covers keyboard nav, ARIA `combobox` + `listbox` roles, virtual active-descendant, debouncing (internal 250ms) |
| Confirm dialog | Custom modal | `RetroConfirmDialog` with `variant="soft"` (amber) or `variant="destructive"` (red) | Already handles pending state, secondary link, button disable during confirm |
| Form field row (label + input + helper + error) | Manual layout | `RetroFormField` with `name` + `control` props | Wires react-hook-form `Controller` internally |
| Date input | Custom calendar picker | `<RetroInput type="date">` (UI-SPEC confirms native picker is sufficient) | Browser-native; no dependency; iOS Safari works |
| Toast notifications | Custom portal/queue | `useToast()` from retro barrel | Already in `App.tsx` `ToastProvider` wrapper |
| Overdue detection in frontend | Client-side date comparison | `loan.is_overdue` (backend-computed) | UI-SPEC explicitly: "UI trusts the `is_overdue` boolean" |
| SKU/ID generation | Custom util | N/A — loans don't have user-visible short codes; UUID is sufficient | — |
| Pagination controls | Custom prev/next | `RetroPagination` | Already handles page count, boundary disable, keyboard a11y |
| Table rendering | Custom `<table>` | `RetroTable` with `columns` + `data` props | Handles the font-mono default, header styles, responsive overflow |
| Error-on-empty-string zod validation | Manual input coercion | `.optional().or(z.literal(""))` + resolver wrapper | Copy from `BorrowerForm.tsx` + `ItemForm.tsx`; both have the exact pattern |

**Key insight:** The Phase 56 + 57 + 58 + 59 + 60 + 61 investment means **every pattern Phase 62 needs is already production-proven on this codebase.** The failure mode for Phase 62 is reinventing something that exists one directory over — e.g., writing a custom tab component instead of using `RetroTabs`, or writing a new slide-over shell instead of reusing `SlideOverPanel`. Plans should explicitly reference the Phase 59/60/61 template files by name so the implementer is aimed at the exact precedent.

## Runtime State Inventory

**Trigger:** Phase 62 is a greenfield feature. It introduces new routes, new UI components, new backend endpoints, and extends API types. It does NOT rename, refactor, or replace any existing string keys, DB tables, or service identifiers.

- **Stored data:** None — `warehouse.loans` table already exists (Phase 3 backend); no schema change needed (all new backend work is on existing columns). No migration.
- **Live service config:** None — no n8n / external service integration.
- **OS-registered state:** None.
- **Secrets/env vars:** None added.
- **Build artifacts:** sqlc needs to regenerate `loans.sql.go` after `backend/db/queries/loans.sql` is edited for the new `UpdateLoan` query (and possibly new `*WithDetails` queries). Standard project workflow — run `sqlc generate` per the build process. Not a rename risk.

**Verdict:** No runtime state migration needed. Skip this category in the plan.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js + Bun | frontend2 build + i18n extract | ✓ (assumed from existing v2.0/v2.1 phases) | — | — |
| Go 1.25.0 | backend compile + test | ✓ | 1.25.0 | — |
| Postgres | loan repository | ✓ (assumed running per Phase 3–5 completion) | — | — |
| sqlc CLI | regenerate typed queries | ✓ (must be available — prior phases have added queries) | — | — |
| `bun run extract` (Lingui CLI) | i18n catalog update | ✓ (used in every prior frontend phase) | 5.9.5 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

**Verdict:** No environment-availability risk. Standard dev-box for this project satisfies every need. Skip install steps in plans.

## Common Pitfalls

### Pitfall 1: RetroCombobox async search with a fresh 300ms debounce but an internal 250ms debounce

**What goes wrong:** Documentation (UI-SPEC §Interaction Contracts) says "300ms debounce" for the Item picker, but `RetroCombobox.tsx` hard-codes `DEBOUNCE_MS = 250`. Plan 62-03 should NOT wire an external debounce on top of the combobox's internal one.

**Why it happens:** UI-SPEC used round-figure 300ms as design guidance; implementation is 250ms. Close enough; don't double-debounce.

**How to avoid:** In the `onSearch` callback, call the query hook directly with the search term. Let `RetroCombobox` handle the debounce internally. Don't wrap in another `useDebouncedCallback`.

**Warning sign:** A `useDebouncedValue` import appearing in `LoanForm.tsx`. Remove it.

[VERIFIED: RetroCombobox.tsx line 42 + useEffect lines 108–112]

### Pitfall 2: Tab state hash collision with `/loans#history?page=2`

**What goes wrong:** URL hash `#history` + query string `?page=2` look fine, but JS `location.hash` includes only the `#history` portion and `location.search` includes only `?page=2` — they're independent. But: a link like `/loans#history?item_id=X` would put `?item_id=X` **inside** the hash (after the `#`), NOT in the query string. `useHashTab` would read `history?item_id=X` as the hash, fail validation against `["active","overdue","history"]`, and fall back to default.

**Why it happens:** Browser URL parsing puts everything after `#` into `location.hash`, including any `?` that follows. The Phase 62 UI-SPEC `[VIEW ALL LOANS]` link to `/loans#history?item_id={id}` is a red flag here.

**How to avoid:** Emit hash first, query second: `/loans?item_id={id}#history`. OR drop the deep-link filter entirely (UI-SPEC accepts this: "alternative: the link points to `/loans#history` without a filter"). **Recommendation: drop the filter for now** — item-filter on the loans list is not a LOAN-01 through LOAN-06 requirement and is explicitly marked out of scope in the UI-SPEC (`"item-filter support is out of scope for Phase 62"`).

**Warning sign:** `window.location.hash === "history?item_id=..."` observed during testing. `useHashTab` falls back to `"active"` despite the hash being "set."

### Pitfall 3: Loan edit "extend" still wired to the form after D-01

**What goes wrong:** A half-finished refactor where `LoanForm` (edit mode) calls `loansApi.extend(...)` for the due_date field and a second mutation for notes. Two round-trips, two success toasts, partial-failure states.

**Why it happens:** CONTEXT.md D-02 says the extend endpoint "remains and may be kept or deprecated — the new endpoint supersedes it for the edit flow." Developer sees `extend` still in the API client, wires to it out of habit.

**How to avoid:** The edit flow uses `useUpdateLoan` → `loansApi.update(...)` **exclusively**. `loansApi.extend()` is dead code from the edit flow's perspective. Consider an ESLint rule or a comment in `loans.ts` marking `extend` as legacy.

**Warning sign:** Two pending mutation calls visible in DevTools when submitting an edit. Only one should fire.

### Pitfall 4: LoanResponse embedding breaks existing `GET /loans/{id}` callers

**What goes wrong:** Plan 62-01 extends `LoanResponse` to include `item` and `borrower` fields. If a test or unrelated caller assumes the old shape (no `item` / `borrower`), it breaks. More importantly: the **SSE event payloads** in `handler.go` lines 145–151 and 225–231 serialize `loan.ID()` / `loan.BorrowerID()` / `loan.DueDate()` directly — those are independent of `LoanResponse` and won't be affected. But a TypeScript `Loan` consumer on the frontend that doesn't know about `item` will see the new fields as excess — non-breaking under TS structural typing.

**Why it happens:** Adding fields to an HTTP response is generally backward-compatible in JSON, but Go struct tests may check field presence explicitly.

**How to avoid:** Run the full `backend/internal/domain/warehouse/loan/` test suite after Plan 62-01 lands. The backend tests use `assert.Contains(t, rec.Body.String(), "item")` style, not full-struct equality — so adding fields should not break existing tests. Verify by running `go test ./internal/domain/warehouse/loan/...` in the verify step.

**Warning sign:** Test output with `want != got` on SOME loan test expecting exact JSON.

### Pitfall 5: Inventory status stays ON_LOAN after mark-returned if DB migration is partial

**What goes wrong:** Not a Phase 62 concern — `service.Return()` already flips inventory status back to AVAILABLE (verified in `service.go` lines 114–143). But: if the frontend invalidates `loanKeys.all` only and forgets `itemKeys.detail`, the item detail page's cached item status shows `on_loan` after a return until it naturally goes stale.

**Why it happens:** Missing cache invalidation key.

**How to avoid:** UI-SPEC §Interaction Contracts `Mark-returned success` line explicitly lists the invalidation set. Plan 62-02 must translate that table verbatim into `useReturnLoan.onSuccess`.

**Warning sign:** User marks loan returned → success toast → navigates to `/items/{id}` → sees stale status badge until manual refresh.

### Pitfall 6: TanStack Query v5 `keepPreviousData` compile error

**What goes wrong:** Copy-pasting from older tutorials or other projects, plan uses `keepPreviousData: true` in `useQuery` options. TS error under v5.

**Why it happens:** v5 replaced `keepPreviousData: true` with `placeholderData: (prev) => prev`.

**How to avoid:** Use `placeholderData: (prev) => prev`. See `useItemsList.ts` comment for the verbatim migration note.

**Warning sign:** TS error "Object literal may only specify known properties, and 'keepPreviousData' does not exist in type 'UseQueryOptions'."

[VERIFIED: frontend2/package.json — `@tanstack/react-query: ^5`]

### Pitfall 7: History tab rows show `[EDIT]` / `[MARK RETURNED]` because the table variant is not properly tab-gated

**What goes wrong:** `LoansTable` receives `tab` prop but doesn't actually swap the columns array; row renders still include the action cluster.

**Why it happens:** Tempting to render the action cluster conditionally inside `LoanRow` (`{loan.is_active && <LoanRowActions ... />}`). Per UI-SPEC §Loan row action buttons, the **entire `ACTIONS` column should be absent from the History tab's column list**, not just the row content.

**How to avoid:** `LoansTable` builds a different `columns` array per `tab` value; History tab's columns are `[thumb, item, borrower, qty, loaned, returned]` — no `actions`. UI-SPEC §specifics calls this out: "`LoansTable` should configure columns as a prop (tab-driven) rather than conditional rendering per cell."

**Warning sign:** Header row width + column count differs from the body width. `ACTIONS` column is empty but present.

### Pitfall 8: Slide-over Esc key swallows intended form Esc behavior

**What goes wrong:** Inside the slide-over, user presses Esc while focused on a combobox dropdown. The combobox's internal `useDismiss` wants to close the dropdown. The `SlideOverPanel`'s `onKey` handler (handler.go line 70–80 of `SlideOverPanel.tsx`) also fires — and attemptClose triggers the unsaved-changes discard dialog over a trivial dropdown close.

**Why it happens:** Both the floating-ui portal and the slide-over listen on `window` for Esc.

**How to avoid:** Verified: `SlideOverPanel` uses `window.addEventListener("keydown", ...)`, but the combobox uses `useDismiss` which stops propagation internally via floating-ui. Test manually: open slide-over → open combobox → Esc — dropdown closes, panel stays. If it behaves incorrectly in the field, add `e.stopPropagation()` inside the combobox dismissal or check `e.defaultPrevented` in the panel's handler. **This is mostly a precautionary pitfall**; Phase 58/59/60 panels with comboboxes work correctly in production, so the pattern is already safe.

**Warning sign:** Pressing Esc to close a combobox immediately prompts the discard-changes dialog.

### Pitfall 9: Lingui catalogs not re-extracted before phase verification

**What goes wrong:** New strings like `CONFIRM RETURN`, `MARK RETURNED`, `NO OVERDUE LOANS` are wrapped in `t` macro in TSX but never land in `locales/en/messages.po` + `locales/et/messages.po`. Build passes; runtime shows `{KEY_MISSING}` or the raw key.

**Why it happens:** `bun run extract` is a manual step; it's easy to forget after a long plan.

**How to avoid:** UI-SPEC contract + Plan 62-04 checkpoint explicitly requires `bun run extract`. Verify by grepping `locales/en/messages.po` for a representative new string (e.g., `"NO ACTIVE LOANS"`).

**Warning sign:** CI fails with "orphan strings detected" or human-verify reports broken labels in ET.

### Pitfall 10: `inventory_id` in GET /inventory/{inventory_id}/loans URL is not snake_case consistent with TS

**What goes wrong:** Go backend path param is `{inventory_id}` (snake_case). JS code might pass `inventoryId` from a TS variable. `toQuery` is for query strings, not path params — so no automatic conversion. A developer might write:

```ts
// WRONG — this would try to interpolate `inventoryId` but path expects raw string
listForItem: (wsId: string, inventoryId: string) =>
  get(`/workspaces/${wsId}/inventory/${inventoryId}/loans`),
```

This is actually correct — the TS variable name doesn't matter, only the string interpolated into the URL path. But confusion is common.

**Why it happens:** TS camelCase convention + Go snake_case path templates.

**How to avoid:** Trust the URL string, not the TS variable name. Use the existing `loansApi.listForBorrower` pattern (which interpolates `borrowerId` into a `/{borrower_id}/` path slot) as the template — verified to work.

**Warning sign:** 404 on the loans-for-item endpoint. (It's more likely a missing `/loans` trailing segment.)

## Code Examples

Verified patterns from the existing codebase (all confirmed via Read). File paths are absolute-relative to the repo root.

### Example 1: Backend handler — PATCH endpoint addition

Based on existing `PATCH /loans/{id}/extend` pattern in `backend/internal/domain/warehouse/loan/handler.go` lines 197–237.

```go
// NEW (plan 62-01): PATCH /loans/{id} — supersedes /extend for the edit flow
huma.Patch(api, "/loans/{id}", func(ctx context.Context, input *UpdateLoanInput) (*UpdateLoanOutput, error) {
    workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
    if !ok {
        return nil, huma.Error401Unauthorized("workspace context required")
    }

    loan, err := svc.Update(ctx, input.ID, workspaceID, input.Body.DueDate, input.Body.Notes)
    if err != nil {
        if err == ErrLoanNotFound {
            return nil, huma.Error404NotFound("loan not found")
        }
        if err == ErrAlreadyReturned {
            return nil, huma.Error400BadRequest("cannot edit returned loan")
        }
        if err == ErrInvalidDueDate {
            return nil, huma.Error400BadRequest("due date must be after loaned date")
        }
        return nil, huma.Error400BadRequest(err.Error())
    }

    // SSE event — loan.updated
    authUser, _ := appMiddleware.GetAuthUser(ctx)
    if broadcaster != nil && authUser != nil {
        userName := appMiddleware.GetUserDisplayName(ctx)
        broadcaster.Publish(workspaceID, events.Event{
            Type:       "loan.updated",
            EntityID:   loan.ID().String(),
            EntityType: "loan",
            UserID:     authUser.ID,
            Data: map[string]any{
                "id":        loan.ID(),
                "due_date":  loan.DueDate(),
                "notes":     loan.Notes(),
                "user_name": userName,
            },
        })
    }

    return &UpdateLoanOutput{Body: toLoanResponse(loan)}, nil
})

type UpdateLoanInput struct {
    ID   uuid.UUID `path:"id"`
    Body struct {
        DueDate *time.Time `json:"due_date,omitempty" doc:"New due date for the loan"`
        Notes   *string    `json:"notes,omitempty" doc:"Updated notes"`
    }
}

type UpdateLoanOutput struct {
    Body LoanResponse
}
```

**Source:** Adapted from `backend/internal/domain/warehouse/loan/handler.go` lines 197–237 (existing `extend` handler).

### Example 2: Frontend API client — `update` + `listForItem`

```ts
// Extension to frontend2/src/lib/api/loans.ts

export interface LoanEmbeddedItem {
  id: string;
  name: string;
  primary_photo_thumbnail_url?: string | null;
}

export interface LoanEmbeddedBorrower {
  id: string;
  name: string;
}

export interface Loan {
  // ... existing fields unchanged ...
  id: string;
  workspace_id: string;
  inventory_id: string;
  borrower_id: string;
  quantity: number;
  loaned_at: string;
  due_date?: string | null;
  returned_at?: string | null;
  notes?: string | null;
  is_active: boolean;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
  // NEW (D-04):
  item: LoanEmbeddedItem;
  borrower: LoanEmbeddedBorrower;
}

export interface UpdateLoanInput {
  due_date?: string;
  notes?: string;
}

export const loansApi = {
  // ... existing methods unchanged ...
  update: (wsId: string, id: string, body: UpdateLoanInput) =>
    patch<Loan>(`${base(wsId)}/${id}`, body),
  listForItem: (wsId: string, inventoryId: string) =>
    get<LoanListResponse>(`/workspaces/${wsId}/inventory/${inventoryId}/loans`),
};

export const loanKeys = {
  all: ["loans"] as const,
  lists: () => [...loanKeys.all, "list"] as const,
  list: (params: LoanListParams) => [...loanKeys.lists(), params] as const,
  details: () => [...loanKeys.all, "detail"] as const,
  detail: (id: string) => [...loanKeys.details(), id] as const,
  // NEW (D-06):
  forItem: (inventoryId: string) => [...loanKeys.all, "forItem", inventoryId] as const,
  forBorrower: (borrowerId: string) => [...loanKeys.all, "forBorrower", borrowerId] as const,
};
```

**Source:** `frontend2/src/lib/api/loans.ts` (existing) + `frontend2/src/lib/api/items.ts` pattern (for embedded `primary_photo_thumbnail_url`).

### Example 3: Zod schemas for create + edit

```ts
// frontend2/src/features/loans/forms/schemas.ts

import { z } from "zod";

export const loanCreateSchema = z.object({
  inventory_id: z.string().uuid("Pick an item."),
  borrower_id: z.string().uuid("Pick a borrower."),
  quantity: z.coerce
    .number()
    .int("Whole units only.")
    .min(1, "Quantity must be between 1 and 999.")
    .max(999, "Quantity must be between 1 and 999."),
  loaned_at: z.string().optional().or(z.literal("")),      // ISO date
  due_date: z.string().optional().or(z.literal("")),        // ISO date
  notes: z.string().max(1000, "Must be 1000 characters or fewer.").optional().or(z.literal("")),
});

export const loanEditSchema = z.object({
  due_date: z.string().optional().or(z.literal("")),
  notes: z.string().max(1000, "Must be 1000 characters or fewer.").optional().or(z.literal("")),
});

export type LoanCreateValues = z.infer<typeof loanCreateSchema>;
export type LoanEditValues = z.infer<typeof loanEditSchema>;
```

Note: `loaned_at`/`due_date` as strings match `<input type="date">`. Cross-field validation ("due_date must be ≥ loaned_at") is best done in a `.superRefine` or at the submit coercion step — UI-SPEC error copy is "Due date can't be before the loaned-on date."

**Source:** Pattern from `frontend2/src/features/borrowers/forms/schemas.ts` + `frontend2/src/features/items/forms/schemas.ts`.

### Example 4: sqlc join query (already exists — pattern for new `*WithDetails` queries)

```sql
-- VERIFIED: backend/db/queries/loans.sql lines 64–77 (already exists!)

-- name: ListActiveLoansWithDetails :many
SELECT l.*,
       i.quantity as inventory_quantity,
       it.name as item_name, it.sku,
       b.name as borrower_name, b.email as borrower_email,
       loc.name as location_name
FROM warehouse.loans l
JOIN warehouse.inventory i ON l.inventory_id = i.id
JOIN warehouse.items it ON i.item_id = it.id
JOIN warehouse.borrowers b ON l.borrower_id = b.id
JOIN warehouse.locations loc ON i.location_id = loc.id
WHERE l.workspace_id = $1 AND l.returned_at IS NULL
ORDER BY l.due_date ASC NULLS LAST
LIMIT $2 OFFSET $3;
```

**Gap:** this query exists but (a) it's not wired into the repository, and (b) it joins `locations` which isn't needed for Phase 62. Phase 62 needs the primary photo thumbnail from `item_photos` joined by `is_primary = true`. Plan 62-01 may need to add/modify this query to return `(it.primary_photo_thumbnail_url equivalent)`. **Action item for the planner:** decide between modifying `ListActiveLoansWithDetails` vs. adding a separate batched lookup. Given Phase 61 precedent, the batched lookup is simpler and avoids destabilizing an existing query.

**Source:** `backend/db/queries/loans.sql` lines 64–77 (verified via Read).

### Example 5: useMutation hook with multi-key invalidation

```ts
// frontend2/src/features/loans/hooks/useLoanMutations.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/retro";
import {
  loansApi,
  loanKeys,
  type Loan,
  type CreateLoanInput,
  type UpdateLoanInput,
} from "@/lib/api/loans";
import { itemKeys } from "@/lib/api/items";
import { borrowerKeys } from "@/lib/api/borrowers";

export function useCreateLoan() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<Loan, unknown, CreateLoanInput>({
    mutationFn: (input) => loansApi.create(workspaceId!, input),
    onSuccess: (loan) => {
      qc.invalidateQueries({ queryKey: loanKeys.all });
      qc.invalidateQueries({ queryKey: itemKeys.detail(loan.inventory_id) });
      qc.invalidateQueries({ queryKey: borrowerKeys.detail(loan.borrower_id) });
      qc.invalidateQueries({ queryKey: itemKeys.lists() });
      qc.invalidateQueries({ queryKey: borrowerKeys.lists() });
      addToast(t`Loan created.`, "success");
    },
    onError: () =>
      addToast(t`Could not create loan. Check your connection and try again.`, "error"),
  });
}

export function useReturnLoan() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<void, unknown, { id: string; inventoryId: string; borrowerId: string }>({
    mutationFn: ({ id }) => loansApi.return(workspaceId!, id),
    onSuccess: (_void, { id, inventoryId, borrowerId }) => {
      qc.invalidateQueries({ queryKey: loanKeys.all });
      qc.invalidateQueries({ queryKey: itemKeys.detail(inventoryId) });
      qc.invalidateQueries({ queryKey: borrowerKeys.detail(borrowerId) });
      addToast(t`Loan returned.`, "success");
    },
    onError: () =>
      addToast(t`Could not return loan. Try again.`, "error"),
  });
}

export function useUpdateLoan() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<Loan, unknown, { id: string; input: UpdateLoanInput }>({
    mutationFn: ({ id, input }) => loansApi.update(workspaceId!, id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: loanKeys.all });
      addToast(t`Loan updated.`, "success");
    },
    onError: () =>
      addToast(t`Could not update loan. Try again.`, "error"),
  });
}
```

**Source:** Pattern from `frontend2/src/features/borrowers/hooks/useBorrowerMutations.ts` + UI-SPEC §Interaction Contracts invalidation table.

### Example 6: Page composition with `RetroTabs` + `useHashTab`

```tsx
// frontend2/src/features/loans/LoansListPage.tsx (sketch)

const TAB_KEYS = ["active", "overdue", "history"] as const;
type TabKey = (typeof TAB_KEYS)[number];

export function LoansListPage() {
  const { t } = useLingui();
  const [tab, setTab] = useHashTab<TabKey>("active", TAB_KEYS);
  const activeQuery = useLoansActive();
  const overdueQuery = useLoansOverdue();
  const historyQuery = useLoansHistory();

  const activeCount = activeQuery.data?.items.length;
  const overdueCount = overdueQuery.data?.items.length;
  const historyCount = historyQuery.data?.items.length;

  const label = (base: string, n: number | undefined) =>
    n === undefined ? `${base} · …` : `${base} · ${n}`;

  return (
    <div className="flex flex-col gap-lg p-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-semibold uppercase tracking-wider text-retro-ink">
          {t`LOANS`}
        </h1>
        <RetroButton variant="primary" onClick={() => panelRef.current?.open("create")}>
          {t`+ NEW LOAN`}
        </RetroButton>
      </div>

      <RetroTabs
        tabs={[
          { key: "active", label: label(t`ACTIVE`, activeCount) },
          { key: "overdue", label: label(t`OVERDUE`, overdueCount) },
          { key: "history", label: label(t`HISTORY`, historyCount) },
        ]}
        activeTab={tab}
        onTabChange={(k) => setTab(k as TabKey)}
      />

      <div role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "active" && <LoansTable tab="active" loans={activeQuery.data?.items ?? []} />}
        {tab === "overdue" && <LoansTable tab="overdue" loans={overdueQuery.data?.items ?? []} />}
        {tab === "history" && <LoansTable tab="history" loans={historyQuery.data?.items ?? []} />}
      </div>

      <LoanPanel ref={panelRef} />
      <LoanReturnFlow ref={returnFlowRef} loan={returnTarget} />
    </div>
  );
}
```

**Source:** `frontend2/src/features/taxonomy/TaxonomyPage.tsx` + UI-SPEC §Layout Contract.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TanStack Query v4 `keepPreviousData: true` | v5 `placeholderData: (prev) => prev` | v5 (2023) | Current code uses v5 idiom (verified in `useItemsList.ts` comment) — don't regress |
| Lingui v3 inline `<Trans>` | Lingui v5 `t` macro + SWC plugin | v5 (2024) | All new strings use `t` macro |
| react-router v6 element routes + `<Route element={}>` | react-router v7 library mode, same shape | v7 (2024) | Already in use (`frontend2/src/routes/index.tsx`); no v7 framework-mode migration |
| Optimistic updates as default | Invalidate-only (v2.1 baseline) | v2.1 STATE.md | Don't introduce optimistic updates in Phase 62 |

**Deprecated / outdated (do not use):**
- `PATCH /loans/{id}/extend` for new edit flows — per CONTEXT.md D-02, this endpoint remains available but is superseded by `PATCH /loans/{id}` for the Phase 62 edit slide-over. Don't call `extend` from `LoanForm`.
- `keepPreviousData: true` — v5 removed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Backend `ListActiveLoansWithDetails` in `loans.sql` lines 64-77 does not currently include the primary photo thumbnail URL (it joins location instead) | Code Examples §Example 4 | Plan 62-01 might need to extend the existing query rather than add a new one. Low risk — planner can adjust. |
| A2 | The sqlc codegen flow (run `sqlc generate` after editing `loans.sql`) is the standard project workflow | Environment Availability | If the project uses a different codegen trigger, Plan 62-01 needs the correct command. Resolves by grepping existing phases for sqlc invocations. |
| A3 | The `warehouse.item_photos` table has an `is_primary boolean` column and a thumbnail URL column such that a join like `LEFT JOIN warehouse.item_photos ip ON ip.item_id = ... AND ip.is_primary = true` is feasible | Architecture Patterns §Pattern 4 | If the primary-photo lookup is more complex (e.g., multiple queries via `ListPrimaryByItemIDs` in `itemphoto.Service`), the handler will need to use the batched-lookup path (Path B). |
| A4 | No frontend tests currently block Phase 62 — the existing `LoansPage.tsx` placeholder has no tests | Recommended Project Structure | Tests will be added fresh. If placeholder tests exist, they need deletion. Low risk. |
| A5 | `workflow.nyquist_validation` is not explicitly set in config.json, so the Validation Architecture section SHOULD be included (treating absent key as enabled) | Output | Matches instruction "If the key is absent or `true`, include the section." |
| A6 | `security_enforcement` is not configured and Phase 62 has no new auth/crypto/input-validation-sensitive surfaces beyond existing session + workspace middleware | Output | Security Domain section is omitted as the phase does not introduce new security-sensitive surfaces. If reviewers disagree, add a minimal V5 (input validation via zod + Huma binding) entry. |

## Open Questions

1. **Should `ListActiveLoansWithDetails` be modified to include primary_photo_thumbnail_url, or should Plan 62-01 add a separate batched lookup?**
   - What we know: The query exists but joins `locations` (unneeded for Phase 62) and does NOT return primary photo. Phase 61 established a batched-lookup pattern for primary photos (`lookupPrimaryPhotos` in `item/handler.go` line 523).
   - What's unclear: Whether modifying a shared sqlc query causes regressions for other callers (no callers found in a quick grep — the query appears unused, but worth a thorough check in the planning step).
   - Recommendation: Planner should grep for `ListActiveLoansWithDetails` across the backend to confirm it's unused, then either modify or add a new `*WithDetails` query variant. If time-boxed, use the batched-lookup pattern (Path B) — it's uniform with Phase 61 and carries no migration risk.

2. **Should `useHashTab` be promoted to a shared hook location?**
   - What we know: Only Phase 58 (taxonomy) consumes it today; Phase 62 is the second consumer.
   - What's unclear: Whether the team wants to promote it now or keep it in taxonomy for another phase.
   - Recommendation: Import directly from `@/features/taxonomy/hooks/useHashTab` for Phase 62. A third consumer justifies promotion to `@/lib/hooks/`. Defer the refactor.

3. **Does the `/loans` route need a `/:id` nested detail route?**
   - What we know: UI-SPEC line 105 explicitly says "Phase 62 does NOT introduce a `/loans/:id` route; all edit + mark-returned actions happen inline via row-action + slide-over." Decision is locked.
   - Recommendation: Do not add `/loans/:id`. If a future phase needs shareable loan links, add then.

4. **Should the old `PATCH /loans/{id}/extend` endpoint be deprecated/removed in this phase?**
   - What we know: CONTEXT.md D-01 says it "may be kept or deprecated — the new endpoint supersedes it for the edit flow."
   - Recommendation: Keep it. Removing is a separate cleanup concern and may break external clients (SSE subscribers, mobile apps, test fixtures). Deprecate via a comment in `handler.go`; remove in a follow-up phase if truly unused.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Frontend framework | Vitest 4.1.3 + @testing-library/react 16.3.2 + jsdom 29.0.2 [VERIFIED: package.json] |
| Backend framework | Go `testing` + stretchr/testify (mock + assert) [VERIFIED: handler_test.go line 11–17] |
| Frontend config file | `frontend2/vitest.config.ts` [VERIFIED: ls output] |
| Backend config file | implicit (standard Go) — `go test` reads `_test.go` files [VERIFIED: filesystem] |
| Quick run command (frontend) | `cd frontend2 && bun run test -- src/features/loans` |
| Quick run command (backend) | `go test ./internal/domain/warehouse/loan/... -count=1` |
| Full suite command (frontend) | `cd frontend2 && bun run test` |
| Full suite command (backend) | `go test ./... -count=1` |
| Phase gate | Both suites green before `/gsd-verify-work` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOAN-01 | Tabbed loans list renders all three tabs with counts | component | `bun run test -- src/features/loans/__tests__/LoansListPage.test.tsx` | ❌ Wave 0 |
| LOAN-01 | `useHashTab` drives tab state | unit | `bun run test -- src/features/loans/__tests__/LoansListPage.test.tsx` | ❌ Wave 0 |
| LOAN-02 | Create loan with item + borrower + optional due date + notes | component | `bun run test -- src/features/loans/__tests__/LoanForm.test.tsx` | ❌ Wave 0 |
| LOAN-02 | `useCreateLoan` mutation invalidates the right keys | unit | `bun run test -- src/features/loans/__tests__/useLoanMutations.test.ts` | ❌ Wave 0 |
| LOAN-03 | Mark-returned confirm dialog → `useReturnLoan` → toast | component | `bun run test -- src/features/loans/__tests__/LoanReturnFlow.test.tsx` | ❌ Wave 0 |
| LOAN-03 | Backend `POST /loans/{id}/return` transitions inventory to AVAILABLE | integration | `go test ./internal/domain/warehouse/loan/... -run TestService_Return` | ✅ (exists) |
| LOAN-04 | Edit-mode `LoanPanel` calls `loansApi.update` with both fields | component | `bun run test -- src/features/loans/__tests__/LoanPanel.test.tsx` | ❌ Wave 0 |
| LOAN-04 | Backend `PATCH /loans/{id}` updates both due_date and notes in one call | integration | `go test ./internal/domain/warehouse/loan/... -run TestHandler_UpdateLoan` | ❌ Wave 0 (new) |
| LOAN-04 | Backend rejects edit of already-returned loan | integration | `go test ./internal/domain/warehouse/loan/... -run TestService_Update_AlreadyReturned` | ❌ Wave 0 |
| LOAN-05 | `ItemActiveLoanPanel` shows active loan + `MARK RETURNED` button | component | `bun run test -- src/features/loans/__tests__/ItemActiveLoanPanel.test.tsx` | ❌ Wave 0 |
| LOAN-05 | `ItemLoanHistoryPanel` shows past loans | component | `bun run test -- src/features/loans/__tests__/ItemLoanHistoryPanel.test.tsx` | ❌ Wave 0 |
| LOAN-06 | `BorrowerActiveLoansPanel` renders multiple rows | component | `bun run test -- src/features/loans/__tests__/BorrowerActiveLoansPanel.test.tsx` | ❌ Wave 0 |
| LOAN-06 | `BorrowerLoanHistoryPanel` renders most-recent-first | component | `bun run test -- src/features/loans/__tests__/BorrowerLoanHistoryPanel.test.tsx` | ❌ Wave 0 |
| Decoration | List response embeds `item` and `borrower` objects | integration | `go test ./internal/domain/warehouse/loan/... -run TestHandler_ListResponseIncludesEmbeds` | ❌ Wave 0 (new) |
| End-to-end | Human-verify checkpoint walks create → mark-returned → history | manual | (human-verify record) | N/A |

### Sampling Rate

- **Per task commit:** relevant file test (e.g., `bun run test -- LoanForm.test.tsx`) and `go test ./internal/domain/warehouse/loan/...`
- **Per wave merge:** full frontend `bun run test` + full backend `go test ./...`
- **Phase gate:** both full suites green + `bun run lint` + `bun run i18n:extract --overwrite` diff reviewed

### Wave 0 Gaps

- [ ] `frontend2/src/features/loans/__tests__/fixtures.ts` — `makeLoan` factory + re-exports from taxonomy fixtures (mirrors `items/__tests__/fixtures.ts`)
- [ ] `frontend2/src/features/loans/__tests__/LoansListPage.test.tsx` — tab switching + counts + empty states (covers LOAN-01)
- [ ] `frontend2/src/features/loans/__tests__/LoanForm.test.tsx` — validation + combobox flows (covers LOAN-02, LOAN-04 edit)
- [ ] `frontend2/src/features/loans/__tests__/LoanPanel.test.tsx` — create/edit mode switching + submit wiring
- [ ] `frontend2/src/features/loans/__tests__/LoanReturnFlow.test.tsx` — confirm dialog → mutation (covers LOAN-03)
- [ ] `frontend2/src/features/loans/__tests__/useLoanMutations.test.ts` — invalidation key sets
- [ ] `frontend2/src/features/loans/__tests__/ItemActiveLoanPanel.test.tsx` — present + absent active loan states (covers LOAN-05)
- [ ] `frontend2/src/features/loans/__tests__/ItemLoanHistoryPanel.test.tsx` — history ordering (covers LOAN-05)
- [ ] `frontend2/src/features/loans/__tests__/BorrowerActiveLoansPanel.test.tsx` — multiple active loans (covers LOAN-06)
- [ ] `frontend2/src/features/loans/__tests__/BorrowerLoanHistoryPanel.test.tsx` — ordering (covers LOAN-06)
- [ ] `backend/internal/domain/warehouse/loan/handler_test.go` — add `TestHandler_UpdateLoan_*` and `TestHandler_ListResponseIncludesEmbeds` cases (extend existing file)
- [ ] `backend/internal/domain/warehouse/loan/service_test.go` — add `TestService_Update_*` cases

No framework install needed — Vitest + @testing-library and Go testing are both in place and exercised by Phase 58–61 tests.

## Security Domain

Phase 62 does not introduce any new security-sensitive surfaces beyond what existing middleware already handles (cookie auth, workspace membership enforcement via `appMiddleware.GetWorkspaceID`). Nonetheless, the minimal applicable ASVS checks:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (inherited from existing auth middleware — no new login surface) | session cookie in existing middleware |
| V3 Session Management | no (inherited) | existing middleware |
| V4 Access Control | yes | `appMiddleware.GetWorkspaceID(ctx)` called in EVERY new handler — enforces workspace scoping. `PATCH /loans/{id}` MUST include this check. [VERIFIED: existing handlers pattern lines 19–22, 44–47, 66–69 etc.] |
| V5 Input Validation | yes | Huma's `Body` struct tags + `zod` on the frontend. Date fields: backend parses to `*time.Time`; frontend validates ISO format. Quantity: min 1, max 999. Notes: max 1000 chars (frontend) — backend has no explicit notes cap, see V5 note below. |
| V6 Cryptography | no | no new crypto, no passwords, no tokens generated |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via loan ID, notes field | Tampering | sqlc parameterized queries (already in place) + pgtype.Date binding — no string concat [VERIFIED: loan_repository.go] |
| Cross-workspace loan access | Information disclosure / Elevation of privilege | `svc.GetByID(ctx, input.ID, workspaceID)` returns `ErrNotFound` if workspace mismatch. Plan 62-01 `Update` MUST apply the same `workspaceID` scoping. |
| Race between two concurrent returns | Tampering | `service.Return()` checks `loan.Return()` which errors if already returned (`ErrAlreadyReturned`). Repository save is transactional. [VERIFIED: entity.go lines 108-116] |
| XSS via notes field rendered unescaped | Tampering | React auto-escapes by default; notes are rendered as `{loan.notes}` in JSX. Do NOT use `dangerouslySetInnerHTML`. [ASSUMED — planner should verify no `dangerouslySetInnerHTML` in any new component] |
| Notes field length DOS | Denial of service | UI cap 1000 chars (zod). Backend SHOULD enforce server-side cap. **Gap:** current backend `CreateLoanInput.Body.Notes` has no `maxLength` tag (verified — `Notes *string `json:"notes,omitempty"`` line 333). Plan 62-01 SHOULD add `maxLength:"1000"` to both `CreateLoanInput.Body.Notes` and the new `UpdateLoanInput.Body.Notes`. [VERIFIED: handler.go lines 326–335] |

**Action for planner:** Plan 62-01 should add `maxLength:"1000"` Huma tag to both existing create and new update `Notes` fields. This closes the server-side length gap.

## Sources

### Primary (HIGH confidence)

- **Filesystem reads (verified 2026-04-17):**
  - `frontend2/package.json` — dependency versions
  - `backend/go.mod` — Go version
  - `backend/internal/domain/warehouse/loan/handler.go` — existing loan handlers + request/response types
  - `backend/internal/domain/warehouse/loan/service.go` — service methods
  - `backend/internal/domain/warehouse/loan/repository.go` — repo interface
  - `backend/internal/domain/warehouse/loan/entity.go` — domain entity
  - `backend/internal/domain/warehouse/loan/errors.go` — error taxonomy
  - `backend/internal/infra/postgres/loan_repository.go` — repo implementation
  - `backend/db/queries/loans.sql` — sqlc queries (including existing `ListActiveLoansWithDetails`)
  - `backend/internal/domain/warehouse/item/handler.go` (lines 495–710) — Phase 61 decoration pattern (`lookupPrimaryPhotos`, `toItemResponse`, `ItemResponse.PrimaryPhotoThumbnailURL`)
  - `frontend2/src/lib/api/loans.ts` — current loan API client
  - `frontend2/src/lib/api/items.ts` — items API (for `primary_photo_thumbnail_url` shape)
  - `frontend2/src/lib/api/borrowers.ts` — borrowers API
  - `frontend2/src/features/borrowers/panel/BorrowerPanel.tsx` — direct template for `LoanPanel`
  - `frontend2/src/features/borrowers/forms/BorrowerForm.tsx` — form pattern
  - `frontend2/src/features/borrowers/hooks/useBorrowerMutations.ts` — mutation hook pattern
  - `frontend2/src/features/items/ItemsListPage.tsx` — list-page composition pattern
  - `frontend2/src/features/items/ItemDetailPage.tsx` — detail-page Phase 60 LOANS placeholder seam (line 249–260)
  - `frontend2/src/features/borrowers/BorrowerDetailPage.tsx` — detail-page Phase 59 ACTIVE LOANS + LOAN HISTORY placeholder seams (lines 101–125)
  - `frontend2/src/features/items/actions/ItemArchiveDeleteFlow.tsx` — archive-first flow (simplify to single-step for `LoanReturnFlow`)
  - `frontend2/src/features/items/photos/ItemThumbnailCell.tsx` — 40×40 thumb cell, reusable in loan rows
  - `frontend2/src/features/items/hooks/useItemsList.ts` — v5 `placeholderData` comment (Pitfall 6 evidence)
  - `frontend2/src/features/items/hooks/useItemMutations.ts` — invalidation key sets and `HttpError` branching
  - `frontend2/src/features/items/forms/schemas.ts` + `frontend2/src/features/borrowers/forms/schemas.ts` — empty-string-to-undefined coercion pattern
  - `frontend2/src/features/taxonomy/panel/SlideOverPanel.tsx` — reusable slide-over shell + discard-changes guard
  - `frontend2/src/features/taxonomy/hooks/useHashTab.ts` — tab URL hash hook
  - `frontend2/src/features/taxonomy/TaxonomyPage.tsx` — first tab-page consumer pattern
  - `frontend2/src/components/retro/RetroTabs.tsx` — tab primitive (exists, first production consumer in Phase 62)
  - `frontend2/src/components/retro/RetroCombobox.tsx` — combobox props + internal 250ms debounce
  - `frontend2/src/components/retro/RetroConfirmDialog.tsx` — variants (`soft` vs `destructive`)
  - `frontend2/src/components/retro/index.ts` — barrel exports
  - `frontend2/src/routes/index.tsx` — route already registered for `/loans` → `LoansPage`
  - `frontend2/src/App.tsx` — provider stack (QueryClientProvider + ToastProvider + AuthProvider + BrowserRouter)
  - `backend/internal/api/router.go` — `loan.RegisterRoutes` wiring (lines 221, 418)
  - `.planning/REQUIREMENTS.md` — LOAN-01..LOAN-06 canonical wording
  - `.planning/STATE.md` — v2.1 decisions (TanStack Query v5, RHF+zod, online-only, `CI grep guard`)
  - `.planning/ROADMAP.md` lines 410–421 — Phase 62 roadmap entry
  - `.planning/phases/62-loans/62-CONTEXT.md` — canonical decisions (D-01 through D-08)
  - `.planning/phases/62-loans/62-UI-SPEC.md` — approved UI design contract

### Secondary (MEDIUM confidence)

None — all findings were verified against filesystem reads.

### Tertiary (LOW confidence)

None — no WebSearch or external-source claims in this research.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — every dependency verified from `package.json` / `go.mod`
- Architecture: HIGH — every pattern has a working precedent in Phase 58/59/60/61 verified by Read tool
- Pitfalls: HIGH — pitfalls either verified against specific code lines or inherited from documented Phase 60/61 pitfalls
- Validation: HIGH — existing tests for loans (handler_test.go, service_test.go) were read; gap analysis is concrete
- Security: MEDIUM — notes maxLength gap is VERIFIED against current handler code; XSS assumption is ASSUMED pending code review of any new `dangerouslySetInnerHTML` usage (A3 in Assumptions)

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (30 days — stack is stable, no dependency upgrades expected in this window)
