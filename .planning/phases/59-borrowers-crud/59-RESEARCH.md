# Phase 59: Borrowers CRUD — Research

**Researched:** 2026-04-16
**Domain:** React 19 + TanStack Query v5 + react-hook-form + zod — flat-list CRUD + detail page over Go/Huma backend
**Confidence:** HIGH (frontend patterns + types) / MEDIUM (some CONTEXT decisions depend on backend changes — see Open Questions)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 Active Loan Count (BORR-01):** Do **NOT** show active loan count in the borrower list. Backend `BorrowerResponse` has no count field and per-borrower fetching is N+1. List shows **name** plus available email/phone only. Scope adjustment is accepted.
- **D-02 Archive/Delete Flow (BORR-04):** Archive-first confirm dialog, identical to Phase 58:
  - Primary action: **ARCHIVE** (amber `RetroButton variant="primary"`) — soft-archive, reversible via Restore
  - Secondary action: small `delete permanently` text link → second danger-styled `RetroConfirmDialog` → hard-delete
  - If backend returns 400 (active loans), surface as error toast: "Cannot delete: this borrower has active loans." — archive is always available regardless
  - Archived rows get a Restore action via the same dialog flow
- **D-03 Archived Borrower Visibility (BORR-01 extension):** Archived borrowers hidden by default. A "Show archived" toggle (`RetroCheckbox`, ITEM-08 pattern) reveals them. Archived rows render with muted text + `ARCHIVED` badge + Restore action.
- **D-04 Borrower Detail — Loan Sections (BORR-05):** `/borrowers/:id` renders two section headers ("Active Loans", "Loan History"). Both use `RetroEmptyState` placeholder ("Loan data will be available soon"). Real data wired in Phase 62. **Phase 59 does NOT call the loans API.**

### Claude's Discretion
- List layout: `RetroTable` — columns for name, email (if present), phone (if present), row action buttons (Edit, Archive/Restore, Delete)
- `SlideOverPanel` reuse pattern — follow `EntityPanel.tsx` from Phase 58 (single panel with create/edit modes)
- Route structure: `/borrowers` (list), `/borrowers/:id` (detail), both as children under `AppShell`
- Query invalidation: invalidate `borrowerKeys.all` after mutate
- Form schema: name required (min 1), email optional (email format), phone optional (string), notes optional (string)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BORR-01 | Borrowers list — scoped to **name + email + phone** per D-01; active loan count is deferred. Success criterion #1 is met by list existence. | `borrowersApi.list(workspaceId, { page, limit })` returns `{ items: Borrower[] }`; `useBorrowersList` hook wraps `useQuery`. Archive toggle per D-03 needs backend list filter OR all-rows-then-client-filter (see Open Q1). |
| BORR-02 | Create borrower — name required + optional email/phone/notes | `borrowersApi.create(workspaceId, body)`; zod `borrowerCreateSchema` mirrors backend `CreateBorrowerInput` (name minLength 1, optional email format, optional phone/notes). `BorrowerPanel` + `BorrowerForm` inside `SlideOverPanel`. |
| BORR-03 | Edit borrower fields | `borrowersApi.update(workspaceId, id, body)`; same form, pre-populated via `defaultValues` in edit mode. |
| BORR-04 | Delete blocked when active loans | **Backend gap** (see Open Q2): current handler calls `Archive` and never surfaces `ErrHasActiveLoans`. CONTEXT D-02 requires hard-delete + archive + restore endpoints the handler does not expose today. Plan must either (a) add 3 HTTP endpoints in backend, or (b) degrade to soft-archive only. Assumed path: (a). |
| BORR-05 | Borrower detail — active + historical loans | `/borrowers/:id` route + `BorrowerDetailPage`; two `RetroPanel`-wrapped sections each containing a `RetroEmptyState`; real loan data wiring deferred to Phase 62 (D-04). |
</phase_requirements>

## Summary

Phase 59 is a pure feature-UI phase built on foundations shipped in Phase 56 (`@/lib/api/borrowers.ts`, TanStack Query) and Phase 57 (retro primitives + forms + dialogs), reusing Phase 58 patterns (`SlideOverPanel`, `EntityPanel`, `ArchiveDeleteFlow`). There are **zero new runtime dependencies**.

The phase ships (1) archive/restore/remove additions to `borrowersApi` + mutation hooks, (2) a flat list page with search-less `RetroTable`, (3) a shared slide-over `BorrowerPanel` with `BorrowerForm`, (4) a reuseable `BorrowerArchiveDeleteFlow` (near-copy of taxonomy's `ArchiveDeleteFlow`, but with 400-on-hard-delete mapping instead of 409), (5) a minimal borrower detail page with two empty-state sections, and (6) route registrations.

**However**, the backend has three gaps that **must** be resolved before Phase 59's CONTEXT can be implemented verbatim:

1. **`DELETE /borrowers/{id}` currently calls `svc.Archive`, not hard-delete.** The `ErrHasActiveLoans` check at `handler.go:153` is dead code — `svc.Archive` never returns that error. [VERIFIED: read `backend/internal/domain/warehouse/borrower/handler.go:142-174` + `service.go:80-88`]
2. **No `POST /borrowers/{id}/restore` endpoint exists.** `svc.Restore` exists (service.go:90) but is not wired to HTTP. [VERIFIED: grep over handler.go]
3. **`GET /borrowers` SQL hard-codes `AND is_archived = false`.** There is no `?archived=` query param. D-03's "Show archived" toggle cannot be satisfied by client-side filtering because archived rows never leave the server. [VERIFIED: `backend/internal/infra/queries/borrowers.sql.go:107-112`]

**Primary recommendation:** Three-plan structure — **(59-01)** API client archive/restore/remove additions + zod schemas + mutation hooks + backend endpoint additions (Go) for archive/restore/delete + list filter param + dead-code removal; **(59-02)** `BorrowerForm` + `BorrowerPanel` + `BorrowerArchiveDeleteFlow` components; **(59-03)** `BorrowersListPage` + `BorrowerDetailPage` + route wiring + integration tests. If the orchestrator prefers frontend-only scope, degrade to Plan 59-01a (frontend API additions calling planned endpoints) and leave backend as a blocker — but this defers BORR-04 success criteria. Strongly prefer the combined frontend+backend approach because the backend changes are small (< 60 lines of Go) and unblock all CONTEXT.md decisions.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| List rendering + row actions | Browser (`BorrowersListPage`) | — | Pure client presentation over cached query |
| Pagination / archived filter | API (`GET /borrowers?archived=...&page=...`) | Browser (params in query key) | Server is source of truth; archived filter must be server-side because SQL filter can't be bypassed client-side |
| Create/update form state + validation | Browser (RHF + zod) | API (server re-validates) | Phase 57 D-03 pattern; server is authoritative |
| Archive / Restore / Hard-delete mutation | API (`svc.Archive`, `svc.Restore`, `svc.Delete` — 3 HTTP endpoints needed) | Browser (TanStack mutation + toast + invalidation) | Service layer logic already exists; only HTTP wiring + frontend integration needed |
| 400 on hard-delete with active loans | API (`svc.Delete → ErrHasActiveLoans → huma.Error400BadRequest`) | Browser (`HttpError.status === 400` → error toast) | Backend owns guard; client maps to UX copy |
| Detail page — active + history loan sections | Browser (`BorrowerDetailPage`) | API (deferred — Phase 62 wires `loansApi.listForBorrower`) | Phase 59 ships empty-state placeholders only (D-04) |
| Route registration | Browser (`routes/index.tsx`) | — | Client-side SPA routing |

## Standard Stack

### Core (already installed — verified in `frontend2/package.json`)

| Library | Version (installed) | Purpose | Verified |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | ^5 | Mutation hooks + cache invalidation | [VERIFIED: package.json] |
| `@tanstack/react-query-devtools` | ^5 | Dev introspection | [VERIFIED: package.json] |
| `react-hook-form` | ^7.72.1 | Form state + `isDirty` for unsaved-changes guard | [VERIFIED: package.json] |
| `zod` | ^4.3.6 | `borrowerCreateSchema` + `borrowerUpdateSchema` | [VERIFIED: package.json] |
| `@hookform/resolvers` | ^5.2.2 | `zodResolver` bridge | [VERIFIED: package.json] |
| `@floating-ui/react` | ^0.27.19 | Already consumed by `SlideOverPanel` | [VERIFIED: package.json] |
| `react-router` | ^7.14.0 | `/borrowers` + `/borrowers/:id` under `AppShell` `<Outlet>` | [VERIFIED: package.json] |
| `@lingui/react` + `@lingui/core` | ^5.9.5 | `t` macro mandatory on every user-visible string | [VERIFIED: package.json] |
| `lucide-react` | (project icon re-exports) | Pencil, Archive, Undo2, Trash, Plus, ArrowLeft | [CITED: `features/taxonomy/icons.tsx`] |

### Backend (Go)

| Module | Purpose | Verified |
|--------|---------|----------|
| `github.com/danielgtaylor/huma/v2` | HTTP route registration (existing) | [VERIFIED: `handler.go:7`] |
| Service layer (`borrower.Service`) | Already has `Archive`, `Restore`, `Delete(ctx, id, workspaceID)` | [VERIFIED: `service.go:12-21`] |

### No New Dependencies

Phase 59 adds zero runtime packages. Every retro primitive already exists in `@/components/retro` barrel.

### Alternatives Considered

| Instead of | Could Use | Why Not |
|------------|-----------|---------|
| 3 backend endpoints + client archive/restore/remove | Frontend calls only `DELETE /borrowers/{id}` (current behaviour) | D-02's "delete permanently" link and Restore cannot function — degrades BORR-04 success criteria |
| Server `?archived=all|true` list filter | Client-side fetch-all-then-filter | `ListBorrowers` SQL hard-filters `is_archived=false`; client never sees archived rows — physically impossible without backend change |
| `RetroTable` for list | Card grid | CONTEXT Discretion prefers tabular; email/phone fit columns naturally |
| Per-borrower active-loan count | Defer (D-01) | No backend support; N+1 queries avoided |
| New archive/delete flow component | Reuse taxonomy's `ArchiveDeleteFlow` as-is | Taxonomy flow short-circuits on 409; borrower flow short-circuits on 400 — small semantic diff; preferred: new `BorrowerArchiveDeleteFlow` (parallel structure) |
| Separate `BorrowerCreatePanel` + `BorrowerEditPanel` | One `BorrowerPanel` w/ create/edit modes | Phase 58 `EntityPanel` demonstrates the combined pattern works cleanly |

## Architecture Patterns

### System Architecture Diagram

```
 User
  |
  v
 /borrowers (list)                              /borrowers/:id (detail)
  |                                              |
  v                                              v
 <BorrowersListPage>                            <BorrowerDetailPage>
  | - useBorrowersList({archived, page})         | - useBorrower(id)  (react-query)
  | - archived toggle state                      |
  | - row: Edit -> open panel in edit mode       |    [Empty-state: Active Loans]
  | - row: Archive -> open ArchiveDeleteFlow     |    [Empty-state: Loan History]
  | - row: Restore -> useRestoreBorrower         |    (Phase 62 wires loansApi.listForBorrower)
  |                                              |
  +--> <BorrowerPanel (ref)>                     +--> back link -> /borrowers
  |     - SlideOverPanel
  |     - <BorrowerForm>
  |         - useForm(zodResolver(borrowerCreateSchema | borrowerUpdateSchema))
  |         - RetroFormField x { name, email, phone, notes }
  |     - Submit -> useCreateBorrower | useUpdateBorrower
  |
  +--> <BorrowerArchiveDeleteFlow (ref)>
        - RetroConfirmDialog variant="soft"   (ARCHIVE primary, delete-permanently link)
        - RetroConfirmDialog variant="destructive" (HARD DELETE danger)
        - on hard-delete HttpError.status === 400 -> toast, close both dialogs

 TanStack Query cache
  - borrowerKeys.list({archived, page}) -> invalidated on every mutation via borrowerKeys.all
  - borrowerKeys.detail(id) -> invalidated on update

 HTTP layer (frontend2/src/lib/api.ts)
  - get/post/patch/del -> HttpError on non-2xx

 Backend (Go/huma)
  - GET    /workspaces/{wsId}/borrowers?page&limit&archived         <-- extend
  - GET    /workspaces/{wsId}/borrowers/{id}
  - POST   /workspaces/{wsId}/borrowers
  - PATCH  /workspaces/{wsId}/borrowers/{id}
  - POST   /workspaces/{wsId}/borrowers/{id}/archive                <-- ADD
  - POST   /workspaces/{wsId}/borrowers/{id}/restore                <-- ADD
  - DELETE /workspaces/{wsId}/borrowers/{id}                        <-- REWIRE to svc.Delete (hard)
```

### Recommended Project Structure

```
frontend2/src/features/borrowers/
├── BorrowersListPage.tsx
├── BorrowerDetailPage.tsx
├── forms/
│   ├── BorrowerForm.tsx
│   └── schemas.ts                         # zod create/update schemas
├── panel/
│   └── BorrowerPanel.tsx                  # parallels taxonomy/panel/EntityPanel.tsx
├── actions/
│   └── BorrowerArchiveDeleteFlow.tsx      # parallels taxonomy/actions/ArchiveDeleteFlow.tsx
├── hooks/
│   ├── useBorrowersList.ts
│   ├── useBorrower.ts
│   └── useBorrowerMutations.ts            # create/update/archive/restore/remove (5 hooks in one file, matching useContainerMutations.ts shape)
├── icons.tsx                              # re-export lucide icons used on this page (matches taxonomy/icons.tsx)
└── __tests__/
    ├── BorrowerForm.test.tsx
    ├── BorrowerPanel.test.tsx
    ├── BorrowerArchiveDeleteFlow.test.tsx
    ├── BorrowersListPage.test.tsx
    ├── BorrowerDetailPage.test.tsx
    └── fixtures.ts                        # makeBorrower + renderWithProviders

frontend2/src/lib/api/borrowers.ts         # EXTEND: archive(), restore(), list({archived})
frontend2/src/routes/index.tsx             # EXTEND: /borrowers, /borrowers/:id

backend/internal/domain/warehouse/borrower/handler.go  # EXTEND: 3 endpoint changes (see backend changes below)
```

### Pattern 1: API client extension

```ts
// frontend2/src/lib/api/borrowers.ts  -- APPEND to existing module
// Source: mirrors frontend2/src/lib/api/categories.ts:46-59 (VERIFIED pattern)

export interface BorrowerListParams {
  page?: number;
  limit?: number;
  archived?: boolean;   // NEW — requires backend support
}

export const borrowersApi = {
  // ...existing list/get/create/update/remove...
  archive: (wsId: string, id: string) => post<void>(`${base(wsId)}/${id}/archive`),
  restore: (wsId: string, id: string) => post<void>(`${base(wsId)}/${id}/restore`),
};
```

### Pattern 2: Mutation hooks (5 hooks in one file)

```ts
// frontend2/src/features/borrowers/hooks/useBorrowerMutations.ts
// Source: mirror frontend2/src/features/taxonomy/hooks/useContainerMutations.ts verbatim,
// with additional HttpError.status === 400 handling on useDeleteBorrower.
// VERIFIED pattern: containers/categories use identical shape.

export function useDeleteBorrower() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => borrowersApi.remove(workspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: borrowerKeys.all });
      addToast(t`Borrower deleted.`, "success");
    },
    onError: (err) => {
      if (err instanceof HttpError && err.status === 400) {
        // CONTEXT D-02 copy — interpolate name at call site if available
        addToast(t`Cannot delete: this borrower has active loans.`, "error");
        return;
      }
      addToast(t`Connection lost. Your change was not saved.`, "error");
    },
  });
}
```

### Pattern 3: `BorrowerForm` with RHF + zod

```ts
// frontend2/src/features/borrowers/forms/schemas.ts
// Mirrors frontend2/src/features/taxonomy/forms/schemas.ts pattern.

import { z } from "zod";

export const borrowerCreateSchema = z.object({
  name: z.string().min(1, "Name is required.").max(255, "Must be 255 characters or fewer."),
  email: z.string().email("Enter a valid email.").max(255).optional().or(z.literal("")),
  phone: z.string().max(64).optional(),
  notes: z.string().max(1000).optional(),
});
export const borrowerUpdateSchema = borrowerCreateSchema.partial();

export type BorrowerCreateValues = z.infer<typeof borrowerCreateSchema>;
export type BorrowerUpdateValues = z.infer<typeof borrowerUpdateSchema>;
```

Coerce empty strings to `undefined` before submit — same trick as `CategoryForm.tsx:20-30`. This avoids `z.string().email()` firing on an empty input.

### Pattern 4: `BorrowerPanel` (create/edit dual-mode)

Mirror `EntityPanel.tsx` verbatim but simplified — only one `kind`:

```tsx
// Source: frontend2/src/features/taxonomy/panel/EntityPanel.tsx (VERIFIED pattern)
interface BorrowerPanelHandle {
  open: (mode: "create" | "edit", borrower?: Borrower) => void;
  close: () => void;
}
// Inside: SlideOverPanel + BorrowerForm + useCreateBorrower / useUpdateBorrower,
// with isDirty dirty-guard wired to SlideOverPanel.
```

### Pattern 5: Archive/Delete flow (two-stage confirm)

```tsx
// Source: mirrors frontend2/src/features/taxonomy/actions/ArchiveDeleteFlow.tsx (VERIFIED pattern)
// Semantic diffs:
//   - 400 short-circuit (not 409)
//   - No "entity kind" — always "BORROWER"
//   - Body copy: "This will hide '{name}' from loan pickers. You can restore them later." (D-02 copy)
//   - Hard-delete body: "Permanently delete '{name}'? This cannot be undone."
```

### Pattern 6: Row action rendering (Archive vs Restore)

`RetroTable` data cells are already ReactNode-typed. Build row objects like:

```tsx
const rowData = borrowers.map((b) => ({
  name: (
    <span className={b.is_archived ? "line-through text-retro-gray" : "font-sans"}>
      {b.name}
      {b.is_archived && <RetroBadge variant="neutral" className="ml-sm font-mono">{t`ARCHIVED`}</RetroBadge>}
    </span>
  ),
  email: b.email ?? <span className="text-retro-gray">—</span>,
  phone: b.phone ?? <span className="text-retro-gray">—</span>,
  actions: <RowActions borrower={b} ... />,
}));
```

Note: `RetroTable` currently applies `font-mono` to every `<td>` (line 40 of `RetroTable.tsx`). Name and email deserve `font-sans` per Established Patterns. Option A: wrap cell children in `<span className="font-sans">...`. Option B: extend `RetroTable` with a `cellClassName` override. Recommend Option A (lower blast radius).

### Pattern 7: Detail page empty-state sections

```tsx
// Source: frontend2/src/components/retro/RetroEmptyState.tsx (VERIFIED)
<section aria-labelledby="active-loans-h2">
  <h2 id="active-loans-h2" className="text-[20px] font-bold uppercase text-retro-ink mb-md">
    {t`ACTIVE LOANS`}
  </h2>
  <RetroEmptyState
    title={t`NO ACTIVE LOANS`}
    body={t`Loan data will be available soon.`}
  />
</section>
<section aria-labelledby="history-h2">
  <h2 id="history-h2" className="text-[20px] font-bold uppercase text-retro-ink mb-md">
    {t`LOAN HISTORY`}
  </h2>
  <RetroEmptyState
    title={t`NO LOAN HISTORY`}
    body={t`Loan history will appear here once loans are wired.`}
  />
</section>
```

### Pattern 8: Backend endpoint additions (Go/huma)

```go
// backend/internal/domain/warehouse/borrower/handler.go -- REPLACE/EXTEND

// Archive — soft archive
huma.Post(api, "/borrowers/{id}/archive", func(ctx context.Context, input *GetBorrowerInput) (*struct{}, error) {
    workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
    if !ok { return nil, huma.Error401Unauthorized("workspace context required") }
    if err := svc.Archive(ctx, input.ID, workspaceID); err != nil {
        return nil, huma.Error400BadRequest(err.Error())
    }
    // publish borrower.archived event
    return nil, nil
})

// Restore — unarchive
huma.Post(api, "/borrowers/{id}/restore", func(ctx context.Context, input *GetBorrowerInput) (*struct{}, error) {
    workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
    if !ok { return nil, huma.Error401Unauthorized("workspace context required") }
    if err := svc.Restore(ctx, input.ID, workspaceID); err != nil {
        return nil, huma.Error400BadRequest(err.Error())
    }
    return nil, nil
})

// Delete — hard delete (replaces the current Archive-calling handler)
huma.Delete(api, "/borrowers/{id}", func(ctx context.Context, input *DeleteBorrowerInput) (*struct{}, error) {
    workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
    if !ok { return nil, huma.Error401Unauthorized("workspace context required") }
    if err := svc.Delete(ctx, input.ID, workspaceID); err != nil {  // <-- now calls Delete, not Archive
        if errors.Is(err, ErrHasActiveLoans) {
            return nil, huma.Error400BadRequest("cannot delete borrower with active loans")
        }
        return nil, huma.Error400BadRequest(err.Error())
    }
    return nil, nil
})
```

Matches category handler idiom (`category/handler.go:187,218,249`). Repository layer already exposes `Delete` (hard) via `Archive`... wait — verify: `postgres/borrower_repository.go:73-75` defines `Delete` which calls `r.queries.ArchiveBorrower(ctx, id)`. That is ALSO incorrect — the `Delete` repo method soft-archives. So a TRUE hard delete SQL query must exist or be added. [VERIFIED: read of `borrower_repository.go:73-75`]. See Pitfall 5.

### Pattern 9: List filter param

```go
// handler.go — extend ListBorrowersInput
type ListBorrowersInput struct {
    Page     int    `query:"page" default:"1" minimum:"1"`
    Limit    int    `query:"limit" default:"50" minimum:"1" maximum:"100"`
    Archived string `query:"archived" default:"active" enum:"active,archived,all"`
}
```

`service.List` signature extended to take `archived` filter; `repository.FindByWorkspace` extended; SQL query updated to conditionally drop the `is_archived = false` predicate or invert it.

Simpler alternative: boolean `archived` (default false). Tri-state is nicer for "Show archived" which really means "include archived" (i.e., show both).

### Anti-Patterns to Avoid

- **Calling `loansApi.listForBorrower` in Phase 59.** CONTEXT D-04 explicitly defers loan data wiring to Phase 62. The detail page ships with empty-state placeholders ONLY.
- **Interpolating borrower name into Lingui `t` template literal** — `t`Archive ${borrower.name}`` works but Lingui CLI extraction handles it correctly only when the *template shape* is static. [CITED: taxonomy/actions/ArchiveDeleteFlow.tsx:42-56 — note on static labels]. Use the same "static label variants" technique where possible (e.g., `t`ARCHIVE BORROWER``), and let interpolated string content (the name) be runtime-only.
- **Generic `CANCEL` / `DELETE` buttons.** All dialog labels must follow the retro copywriting rule from UI-SPEC — entity-prefixed labels (`ARCHIVE BORROWER`, `DELETE BORROWER`, `← BACK`).
- **Storing workspaceId in component props.** It comes from `useAuth().workspaceId` — mandatory pattern, verified in all existing hooks.
- **New retro primitives.** Every UI element in scope already has a component in `@/components/retro`. Adding new primitives here is forbidden.
- **Bypassing the retro barrel.** All retro imports MUST come from `@/components/retro/index.ts` — locked v2.0 decision.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slide-over panel | Custom right-docked dialog | Reuse `@/features/taxonomy/panel/SlideOverPanel.tsx` OR extract to `@/components/layout/` | Already handles focus management, dirty-state guard, backdrop, ESC, portal — all non-trivial. Phase 58 shipped it. |
| Archive-first two-stage dialog | Custom state machine | Reuse `@/features/taxonomy/actions/ArchiveDeleteFlow.tsx` shape | Short-circuit logic on HttpError status + dialog handoff timing (`setTimeout(..., 0)`) is error-prone; taxonomy version is tested. |
| Query key factory | Hand-roll cache invalidation | `borrowerKeys` already exported in `@/lib/api/borrowers.ts` | Verified in `__tests__/queryKeys.test.ts`. |
| Table rendering | Custom `<table>` | `@/components/retro/RetroTable.tsx` | Exists, tested. |
| Empty state | Plain `<div>` | `RetroEmptyState` | Amber-toned retro bevel — consistent with all other phases. |
| Form state machine | Custom | `react-hook-form` + `RetroFormField` `Controller`-for-all | Phase 57 D-03 locked. |
| Schema validation | Hand-rolled validators | `zod` + `@hookform/resolvers` | Phase 57 D-04 locked; type inference from schema is the feature. |
| Toast messaging | `alert()` | `useToast` from `@/components/retro` | Already available in app; matches all existing mutation hooks. |

**Key insight:** Phase 59 is 70% composition of Phase 58 patterns. The ONLY novel code is the borrower-specific form schema, the borrower detail page layout, the 400-on-hard-delete error handling, and the backend endpoint rewiring.

## Runtime State Inventory

Not applicable — Phase 59 is greenfield feature work. No rename, refactor, or migration is involved.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — borrower rows are new user-created records only. | None. |
| Live service config | None. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None. | None. |
| Build artifacts | None. | None. |

## Common Pitfalls

### Pitfall 1: `is_archived` filter is server-side only

**What goes wrong:** The "Show archived" toggle (D-03) renders, but flipping it does nothing — the list stays the same.

**Why it happens:** `ListBorrowers` SQL is `WHERE workspace_id = $1 AND is_archived = false` [VERIFIED: `queries/borrowers.sql.go:107-112`]. Archived rows never leave the server. Categories use the same approach; their `categoriesApi.list()` accepts `{ archived }` and the handler actually respects it — borrowers do not.

**How to avoid:** Add an `Archived` query param to `ListBorrowersInput`, extend service `List(ctx, wsId, pagination, archived)`, update SQL query to conditionally filter. Do NOT attempt client-side filter.

**Warning signs:** Toggle visually flips but row count stays identical; network tab shows `?archived=...` in request URL but response payload never contains `is_archived: true` rows.

### Pitfall 2: Dead `ErrHasActiveLoans` branch

**What goes wrong:** Plan author copies the existing handler, assumes the 400 branch is live, and never exercises it. When borrower has active loans, hard-delete "just works" (because service layer is archive, not delete).

**Why it happens:** Handler.go line 153 reads `if err == ErrHasActiveLoans { ... }` but `svc.Archive` never returns that error — it's only returned by `svc.Delete`. [VERIFIED: `service.go:80-88` vs `service.go:100-117`].

**How to avoid:** The planned rewrite (Pattern 8) wires `svc.Delete` to the HTTP `DELETE` route. Add integration test: seed a borrower with an active loan, hit `DELETE /borrowers/{id}`, assert 400 response.

**Warning signs:** No error returned from hard-delete even when active loans exist; related frontend toast never fires in manual testing.

### Pitfall 3: `BorrowerRepository.Delete` is not a hard delete

**What goes wrong:** Backend `svc.Delete` calls `repo.Delete` which runs the `ArchiveBorrower` SQL — borrower is soft-archived, not hard-deleted.

**Why it happens:** `postgres/borrower_repository.go:73-75` defines `Delete(ctx, id)` as `r.queries.ArchiveBorrower(ctx, id)`. The SQL `ArchiveBorrower` is `UPDATE ... SET is_archived = true`. [VERIFIED: `borrowers.sql.go:16`].

**How to avoid:** Add a `DeleteBorrower` SQL query (`DELETE FROM warehouse.borrowers WHERE id = $1`) via sqlc codegen OR inline a `pgx` delete. Update `BorrowerRepository.Delete` to call the new query. Also add a separate `ArchiveBorrower` (soft-archive) repo method and wire `svc.Archive` to use it. [CITED: same file layout in `postgres/category_repository.go` for reference.]

**Warning signs:** After "delete permanently" the borrower row still exists in DB with `is_archived=true` and can be restored.

### Pitfall 4: Lingui dynamic string extraction

**What goes wrong:** Strings like `t`ARCHIVE ${entityKind}`` don't appear in the `.po` catalog; Estonian translation is empty.

**Why it happens:** Lingui CLI is AST-based — template interpolation over a variable breaks static extraction. Same issue solved in `ArchiveDeleteFlow.tsx:42-56` with the discriminated-literal technique.

**How to avoid:** Use static string variants: `t`ARCHIVE BORROWER`` directly (not interpolated over an entityKind). Borrower-name interpolation into dialog BODY copy is fine — Lingui supports it via `t`...hide '${name}'...`` because the surrounding template is static.

**Warning signs:** `bun run i18n:extract` output missing expected keys; Estonian strings fall back to English at runtime.

### Pitfall 5: `RetroTable` forces `font-mono` on all cells

**What goes wrong:** Borrower names render in a monospace font, looking like a database dump instead of a readable list.

**Why it happens:** `RetroTable.tsx:40` applies `font-mono text-[14px] text-retro-ink py-sm px-md border-retro-thick border-retro-ink` to every `<td>` unconditionally.

**How to avoid:** Wrap cell content in `<span className="font-sans">` for name/email/notes. Keep `font-mono` default for IDs / short codes. Do NOT modify `RetroTable` (blast radius across phases 56–58).

**Warning signs:** Name column looks like a code listing; UI-SPEC `font-sans` contract violated.

### Pitfall 6: Route ordering with dynamic segment

**What goes wrong:** Navigating to `/borrowers` resolves the `/borrowers/:id` route with `id="new"` or similar string, because React Router picks the first matching segment.

**Why it happens:** React Router v7 library-mode `<Routes>` ordering matters only when both are declared as children of the same `Route`. In this project both live under `<AppShell>` `<Outlet>`.

**How to avoid:** Declare `<Route path="borrowers" element={<BorrowersListPage />} />` before `<Route path="borrowers/:id" element={<BorrowerDetailPage />} />`, OR rely on React Router v7's specificity-based matching (more specific static paths win over dynamic). [CITED: reactrouter.com/en/main/start/tutorial — v7 uses rank-based matching, so either order works — but explicit ordering is a safety habit.]

**Warning signs:** `useParams().id === "borrowers"` at runtime; list page never renders.

### Pitfall 7: Dirty-form unsaved-changes guard false positive

**What goes wrong:** Opening the edit panel on an existing borrower immediately flags the form as dirty because RHF default values disagree with React-Hook-Form's initial snapshot.

**Why it happens:** When you pass `email: ""` vs `email: undefined` inconsistently as `defaultValues`, RHF sees a change on first render.

**How to avoid:** Normalize defaults upfront — in edit mode map `email: borrower.email ?? ""`, `phone: borrower.phone ?? ""`, `notes: borrower.notes ?? ""`. In submit, re-coerce empty strings to `undefined` before sending (mirrors `CategoryForm` submit handler).

**Warning signs:** SlideOverPanel shows discard-changes dialog on first close of an edit panel with no edits.

### Pitfall 8: Pagination strategy for v1

**What goes wrong:** Unclear whether the list should paginate, lazy-load, or fetch-all. Plan picks one, reviewer picks another.

**Why it happens:** CONTEXT is silent on pagination; backend supports `page`/`limit` up to 100. Phase 58 fetches all (dedicated small-dataset assumption). Borrower dataset is also small in home-inventory contexts.

**How to avoid:** Recommend **fetch-all (limit=100, page=1)** for v1 — matches Phase 58 taxonomy approach; borrower count in home inventory is realistically <50. If dataset grows, add `RetroPagination` wiring in a follow-up. Document this decision in the plan.

**Warning signs:** Only first 50 borrowers visible; "Load more" button pressure in manual testing.

## Code Examples

Verified patterns; copy-paste with entity renaming.

### Example 1: `useBorrower(id)` detail hook

```ts
// frontend2/src/features/borrowers/hooks/useBorrower.ts
// Source: mirror of existing detail hooks; no taxonomy parallel because taxonomy is tree-only.
import { useQuery } from "@tanstack/react-query";
import { borrowersApi, borrowerKeys, type Borrower } from "@/lib/api/borrowers";
import { useAuth } from "@/features/auth/AuthContext";

export function useBorrower(id: string | undefined) {
  const { workspaceId } = useAuth();
  return useQuery<Borrower>({
    queryKey: borrowerKeys.detail(id ?? ""),
    queryFn: () => borrowersApi.get(workspaceId!, id!),
    enabled: !!workspaceId && !!id,
  });
}
```

### Example 2: `useBorrowersList({ archived })`

```ts
// frontend2/src/features/borrowers/hooks/useBorrowersList.ts
import { useQuery } from "@tanstack/react-query";
import { borrowersApi, borrowerKeys, type BorrowerListParams } from "@/lib/api/borrowers";
import { useAuth } from "@/features/auth/AuthContext";

export function useBorrowersList(showArchived: boolean) {
  const { workspaceId } = useAuth();
  // Tri-state: "active" (default) | "all" (show archived also) — map boolean to backend enum
  const params: BorrowerListParams = {
    page: 1,
    limit: 100,
    archived: showArchived ? true : undefined, // or "all" / omitted — pick one in plan
  };
  return useQuery({
    queryKey: borrowerKeys.list(params),
    queryFn: () => borrowersApi.list(workspaceId!, params),
    enabled: !!workspaceId,
  });
}
```

### Example 3: Route wiring

```tsx
// frontend2/src/routes/index.tsx — inside the authenticated AppShell Routes block
import { BorrowersListPage } from "@/features/borrowers/BorrowersListPage";
import { BorrowerDetailPage } from "@/features/borrowers/BorrowerDetailPage";
// ...
<Route path="borrowers" element={<BorrowersListPage />} />
<Route path="borrowers/:id" element={<BorrowerDetailPage />} />
```

### Example 4: BorrowerDetailPage skeleton

```tsx
import { useParams, Link } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { useBorrower } from "./hooks/useBorrower";
import { RetroPanel, RetroEmptyState, HazardStripe, RetroButton } from "@/components/retro";

export function BorrowerDetailPage() {
  const { t } = useLingui();
  const { id } = useParams<{ id: string }>();
  const borrowerQuery = useBorrower(id);

  if (borrowerQuery.isPending) {
    return <RetroPanel><p className="font-mono">{t`Loading…`}</p></RetroPanel>;
  }
  if (borrowerQuery.isError || !borrowerQuery.data) {
    return (
      <RetroPanel>
        <HazardStripe className="mb-md" />
        <p className="text-retro-red">{t`Borrower not found.`}</p>
        <Link to="/borrowers">{t`← BACK TO BORROWERS`}</Link>
      </RetroPanel>
    );
  }
  const b = borrowerQuery.data;
  return (
    <div className="flex flex-col gap-lg p-lg">
      <Link to="/borrowers" className="font-mono text-[14px] text-retro-ink">{t`← BORROWERS`}</Link>
      <h1 className="text-[24px] font-bold uppercase text-retro-ink">{b.name}</h1>
      {/* contact info grid */}
      <section aria-labelledby="active-loans-h2">
        <h2 id="active-loans-h2" className="text-[20px] font-bold uppercase">{t`ACTIVE LOANS`}</h2>
        <RetroEmptyState title={t`NO ACTIVE LOANS`} body={t`Loan data will be available soon.`} />
      </section>
      <section aria-labelledby="history-h2">
        <h2 id="history-h2" className="text-[20px] font-bold uppercase">{t`LOAN HISTORY`}</h2>
        <RetroEmptyState title={t`NO LOAN HISTORY`} body={t`Loan history will appear here once loans are wired.`} />
      </section>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Combined `DELETE` does soft archive | Separate `/archive`, `/restore`, `DELETE` endpoints | Phase 58 established category pattern (2026-04) | Phase 59 adopts same split — three distinct user intents map to three distinct HTTP verbs |
| Hand-managed `is_archived` client filter | Server `?archived=` query param | Phase 58 (categories) | Filter goes in the URL so queries are cacheable and URL-shareable |
| One fat mutation hook per entity | Five small mutation hooks (create/update/archive/restore/remove) | Phase 58 `useContainerMutations.ts` | Matches TanStack Query v5 idiom; each hook owns its toast copy |
| Toast via `alert()` | `useToast` retro provider | v2.0 | Consistent retro styling + auto-dismiss |

**Deprecated / should NOT be used in this phase:**
- Raw `fetch` — all HTTP goes through `@/lib/api` helpers (`get`, `post`, `patch`, `del`).
- `window.confirm()` / `alert()` — must use `RetroConfirmDialog` / toasts.
- Native `<dialog>` directly — wrap via `RetroDialog` / `RetroConfirmDialog` (already handles focus trap, backdrop, ESC).
- Global `fetch.then(..).catch` for errors — use TanStack `onError` + `HttpError` pattern.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Backend will be extended to add `/archive`, `/restore`, and a *real* `DELETE` + `archived` list filter. | Summary, Pattern 8, Pattern 9 | HIGH — if backend is frontend-only scope, D-02 and D-03 cannot be implemented as written. Plan must descope to soft-archive-only via current `DELETE` route, or entire phase is blocked on a separate backend PR. User must confirm. |
| A2 | "Fetch all (limit=100) + client group/toggle" is acceptable for v1; pagination not needed. | Pitfall 8 | LOW — if user wants pagination, wire `RetroPagination` (Phase 57) — small addition. |
| A3 | `RetroTable` should NOT be modified to support font overrides; per-cell `<span className="font-sans">` is preferred. | Pitfall 5 | LOW — alternative (extending RetroTable) adds ~10 lines; both work. |
| A4 | Borrower form fields: name (255 chars), email (255), phone (64), notes (1000) — mirror backend maxLength 255 on name; pick reasonable bounds for others. | Pattern 3 | LOW — backend has no enforced max on email/phone/notes currently; zod limits are UX. If user wants stricter bounds, adjust. |
| A5 | Two-stage archive-first dialog copies — "This will hide … from loan pickers" (D-02 CONTEXT copy verbatim) and "Permanently delete '{name}'? This cannot be undone." | Pattern 5, Specifics | LOW — CONTEXT already fixed copy. |
| A6 | Detail page shows borrower NAME, email, phone, notes metadata above the two loan sections. CONTEXT doesn't specify this explicitly but success criterion 4 requires the detail to "render" loan sections — a totally empty page fails success criterion intent. | Pattern 7, Example 4 | LOW — user may want a minimal page. Worth confirming what metadata goes on the detail page. |
| A7 | Boolean `archived` query param (rather than tri-state "active/archived/all") is sufficient. D-03 only needs two states: hide or include archived. | Pattern 9, Example 2 | LOW — tri-state gives archived-only filter; not needed by D-03 but trivial to add. |
| A8 | `BorrowerRepository.Delete` in Postgres needs a new `DELETE FROM warehouse.borrowers WHERE id = $1` SQL query. Current implementation runs `ArchiveBorrower` SQL. | Pitfall 3 | HIGH — if not fixed, "hard delete" never hard-deletes. |

If A1 or A8 are wrong (i.e., backend changes are out of scope for this phase), the planner MUST escalate to CONTEXT-discuss before producing plans.

## Open Questions (RESOLVED)

1. **Is the `archived` list filter in scope for the backend portion of this phase?**
   - What we know: D-03 mandates a client-facing "Show archived" toggle. The SQL filter is hard-coded.
   - What's unclear: Whether the orchestrator accepts a backend-side change as part of Phase 59 or requires a separate backend phase.
   - Recommendation: Include in Plan 59-01 (API foundation + backend hookup). Backend change is ~40 lines (handler input struct, service signature, repository method, SQL query + sqlc regen).
   - RESOLVED: Yes — included in Plan 59-01 (handler `Archived bool` param, SQL sqlc.narg optional filter, repository `includeArchived bool` method parameter, sqlc regen).

2. **Is adding `POST /archive`, `POST /restore`, and *true* hard-delete in scope for this phase?**
   - What we know: CONTEXT D-02 requires these three distinct actions in the UI. The handler currently exposes a single `DELETE` that actually soft-archives.
   - What's unclear: Same as Q1 — backend gating.
   - Recommendation: Include in Plan 59-01. Mirror `category/handler.go` exactly.
   - RESOLVED: Yes — included in Plan 59-01. `POST /borrowers/{id}/archive`, `POST /borrowers/{id}/restore`, and rewired `DELETE /borrowers/{id}` as true hard-delete (with `ErrHasActiveLoans` 400 guard now active).

3. **Tri-state vs boolean for `archived` list filter.**
   - What we know: D-03 needs "Show archived" toggle.
   - Recommendation: Boolean (default false). Keep API minimal. Extend to tri-state only if an "archived only" view ever ships.
   - RESOLVED: Boolean — `archived bool` query param (default false / omitted = active only). Implemented in Plan 59-01 handler + SQL.

4. **Does detail page show borrower metadata (name, email, phone, notes) above the loan sections?**
   - What we know: D-04 says two section headers for loans. No explicit mention of contact info display.
   - Recommendation: Yes — show metadata (name as page heading; email/phone/notes below). Otherwise detail page is visually empty except placeholders, which is poor UX. Surface as an assumption for user confirmation.
   - RESOLVED: Yes — Plan 59-04 includes name as `<h1>`, email/phone/notes in a retro metadata grid above the two empty-state loan sections.

5. **Should Edit also open for archived borrowers, or only Restore/Delete?**
   - What we know: CONTEXT doesn't specify.
   - Recommendation: Archived borrowers should only surface Restore + delete-permanently, not Edit. Editing a hidden record is confusing UX. Mirror taxonomy: archived nodes have Restore but no Edit button.
   - RESOLVED: No Edit on archived rows — Plan 59-04 row actions for archived borrowers are Restore + Delete Permanently only (mirrors `ContainersTab.tsx` archived row pattern).

6. **Pagination on list: `RetroPagination` wired or simple fetch-all?**
   - What we know: backend supports `page`/`limit`; no CONTEXT decision.
   - Recommendation: Fetch-all (limit=100, page=1) — mirrors taxonomy. Add pagination only if home inventories realistically exceed 100 borrowers.
   - RESOLVED: Fetch-all with `limit=100, page=1` — implemented in `useBorrowersList` hook in Plan 59-03.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bun | package install, test runner | ✓ | existing toolchain | npm |
| Node | build | ✓ | existing | — |
| React 19 | all components | ✓ | 19.2.5 | — |
| TypeScript 6 | typing | ✓ | ~6.0.2 | — |
| Tailwind 4 | styling | ✓ | ^4.2.2 | — |
| Vitest + Testing Library | tests | ✓ | 4.1.3 / 16.3.2 / user-event 14.6.1 | — |
| Go + huma/v2 | backend endpoint additions | ✓ | existing Go backend compiles today | — |
| sqlc | SQL codegen for new `DeleteBorrower` query | ✓ | existing infra (queries are already sqlc-generated) | Hand-rolled pgx if sqlc not available |
| PostgreSQL | backend test DB | ✓ | existing integration test setup (`borrower_repository_test.go`) | — |
| Phase 56 `@/lib/api` helpers | API client additions | ✓ | shipped | — |
| Phase 57 `@/components/retro` primitives | All UI | ✓ | shipped | — |
| Phase 58 `SlideOverPanel`, `ArchiveDeleteFlow` patterns | Reuse | ✓ | shipped | — |

**Missing with no fallback:** None.
**Missing with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (frontend) | vitest 4.1.3 + @testing-library/react 16.3.2 + @testing-library/user-event 14.6.1 |
| Framework (backend) | `go test` + testify + sqlc-generated + dockertest for repo tests |
| Config file (frontend) | `frontend2/vitest.config.*` (existing) |
| Quick run command (frontend) | `cd frontend2 && bun run test -- --run src/features/borrowers/__tests__/<file>` |
| Quick run command (backend) | `go test ./internal/domain/warehouse/borrower/...` |
| Full suite command (frontend) | `cd frontend2 && bun run test` |
| Full suite command (backend) | `go test ./...` |
| Lint | `cd frontend2 && bun run lint && bun run lint:imports` |
| Build | `cd frontend2 && bun run build` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| BORR-01 | List renders name + email + phone (when present); dimmed `—` when absent; archive toggle filters rows | integration | `bun run test -- --run src/features/borrowers/__tests__/BorrowersListPage.test.tsx` | ❌ Wave 0 |
| BORR-01 | Empty state: retro "no borrowers yet" panel with create button | unit | same file | ❌ Wave 0 |
| BORR-02 | Create: open panel → fill name → submit → row appears; optional fields accepted; required name rejects empty | integration | `BorrowerForm.test.tsx` + `BorrowerPanel.test.tsx` | ❌ Wave 0 |
| BORR-03 | Edit: open panel on existing row → fields pre-populated → submit → row updates | integration | `BorrowerPanel.test.tsx` | ❌ Wave 0 |
| BORR-04 | Archive: confirm dialog → ARCHIVE → row muted with badge, Restore action visible | integration | `BorrowerArchiveDeleteFlow.test.tsx` + `BorrowersListPage.test.tsx` | ❌ Wave 0 |
| BORR-04 | Hard-delete: "delete permanently" link → danger dialog → DELETE; 400 with active loans → error toast, row remains | integration | `BorrowerArchiveDeleteFlow.test.tsx` (mock 400) | ❌ Wave 0 |
| BORR-04 | Backend: `DELETE /borrowers/{id}` returns 400 when active loans exist | Go integration | `go test ./internal/domain/warehouse/borrower/... -run TestBorrowerHandler_Delete_ActiveLoans` | ❌ Wave 0 |
| BORR-04 | Backend: `POST /borrowers/{id}/archive` soft-archives regardless of loans | Go handler | same dir | ❌ Wave 0 |
| BORR-04 | Backend: `POST /borrowers/{id}/restore` flips `is_archived` to false | Go handler | same dir | ❌ Wave 0 |
| BORR-05 | Detail page renders name + contact metadata + 2 section headers + 2 empty-state panels | integration | `BorrowerDetailPage.test.tsx` | ❌ Wave 0 |
| BORR-05 | Detail page 404 state for missing id | integration | same file | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `bun run test -- --run src/features/borrowers` + `go test ./internal/domain/warehouse/borrower/...` (if backend changed)
- **Per plan merge:** `cd frontend2 && bun run test && bun run lint && bun run build` + `go test ./...`
- **Phase gate:** Full suite green, lingui catalogs compile (`bun run i18n:extract` adds no unextracted keys), retro barrel unchanged, `check-forbidden-imports.mjs` passes.

### Wave 0 Gaps

- [ ] `frontend2/src/features/borrowers/__tests__/BorrowerForm.test.tsx` — schema errors, optional-field coercion, submit payload shape
- [ ] `frontend2/src/features/borrowers/__tests__/BorrowerPanel.test.tsx` — create vs edit mode, dirty-guard, successful mutation closes panel
- [ ] `frontend2/src/features/borrowers/__tests__/BorrowerArchiveDeleteFlow.test.tsx` — primary ARCHIVE, secondary-link → hard-delete, 400 short-circuit + toast
- [ ] `frontend2/src/features/borrowers/__tests__/BorrowersListPage.test.tsx` — loading, error, empty, populated, archived toggle, row actions
- [ ] `frontend2/src/features/borrowers/__tests__/BorrowerDetailPage.test.tsx` — loading, 404, populated-with-empty-loan-sections
- [ ] `frontend2/src/features/borrowers/__tests__/fixtures.ts` — `makeBorrower`, `renderWithProviders` (mirror taxonomy's fixtures)
- [ ] `frontend2/src/lib/api/__tests__/queryKeys.test.ts` — already covers `borrowerKeys`; no change needed (unless new params tuple alters shape)
- [ ] `backend/internal/domain/warehouse/borrower/handler_test.go` — extend with archive/restore/delete-with-loans cases
- [ ] `backend/internal/infra/postgres/borrower_repository_test.go` — add true `Delete` (hard) + `Archive` (soft, separate method) repo tests
- [ ] SQL: add `DeleteBorrower` query via sqlc; regen generated file

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | inherited | `RequireAuth` wrapper in `routes/index.tsx`; workspace + user threaded via `AuthContext` |
| V3 Session Management | inherited | Phase 56 foundation; no changes |
| V4 Access Control | **yes** | Every endpoint asserts `workspaceID` via `appMiddleware.GetWorkspaceID(ctx)`; new archive/restore/delete endpoints MUST do the same |
| V5 Input Validation | **yes** | Frontend zod schema (UX); backend huma validation (authoritative, via `minLength`/`format` struct tags on input body) |
| V6 Cryptography | no | No crypto in scope |
| V7 Error Handling | **yes** | `HttpError` class maps 400 active-loans to user-safe toast; no server stack traces leaked client-side |
| V8 Data Protection | partial | Borrower PII (name, email, phone, notes) stays workspace-scoped; no broadcast to other workspaces |
| V13 API & Web Services | **yes** | Every new backend endpoint under `/workspaces/{wsId}/borrowers/...`; 3 existing huma-managed endpoints show the auth+workspace pattern to copy |

### Known Threat Patterns for {React + Go/huma + Postgres}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Borrower name/email rendered in dialog body (reflected content) | Tampering / XSS | React auto-escapes `{b.name}`; never use `dangerouslySetInnerHTML`. Lingui interpolations are safe by default. |
| SQL injection via list filter | Tampering | Use sqlc-generated parameterized queries; avoid string concat on `archived` filter (branch via `CASE` or two distinct queries). |
| Cross-workspace borrower access | Info Disclosure | Every endpoint checks `workspaceID` from session context and includes it in `WHERE` clauses (verified pattern in existing handlers). |
| Soft-archive bypasses hard-delete | Authorization | BORR-04 active-loan guard MUST run on the hard-delete path. Backend integration test required. |
| Large notes field DoS | DoS | Frontend zod `max(1000)`; backend does not currently bound `notes` — consider adding `maxLength` in `CreateBorrowerInput.Body`. |
| Email format validation bypass | Tampering | Frontend zod `email()`; backend huma `format:"email"` (already present in `CreateBorrowerInput.Body.Email` per `handler.go:241`). |
| Workspace ID tampering via route param | Authorization | `workspaceID` comes from session middleware, not URL. Route `/workspaces/{wsId}/borrowers/...` URL wsId is ignored by handler — middleware extracts from context. [CITED: `handler.go:19-22`]. |
| Unauthorized archive/restore via missing auth | AuthN/AuthZ | New endpoints MUST call `appMiddleware.GetWorkspaceID` + `GetAuthUser` in first line; copy pattern from existing endpoints verbatim. |

## Project Constraints (from CLAUDE.md / STATE.md)

No `CLAUDE.md` exists at repo root. Applicable directives extracted from STATE.md v2.0/v2.1 decisions and in-code conventions:

- **No shadcn / no Radix / no headless UI libraries.** Hand-roll via `@/components/retro`. [v2.0 locked]
- **All retro imports MUST come from `@/components/retro` barrel.** [v2.0 locked — verified by reading `components/retro/index.ts`]
- **Lingui `t` macro on every user-visible string.** Both `en` and `et` catalogs must compile before checkpoint. [v2.0 project rule]
- **TanStack Query v5 for server state.** No raw `fetch` in components; all API calls through `@/lib/api` + `useQuery`/`useMutation`. [v2.1 locked]
- **react-hook-form + zod via `RetroFormField`.** Standard form substrate — `Controller`-for-all, no `register()`. [v2.1 locked via Phase 57 D-03]
- **Pre-build lint guard:** `bun run lint:imports` blocks `idb|serwist|offline|sync` imports. Phase 59 must not introduce any. [v2.1 CI decision]
- **Online-only for v2.1.** No offline/PWA. [v2.1 locked]
- **`forwardRef` + proper `ref` forwarding on every primitive.** Existing pattern.
- **All interactive controls: `min-height: 44px` (mobile hit target).** Row action buttons must comply; existing ContainersTab row pattern uses `min-h-[44px] lg:min-h-[36px]` responsive.
- **`font-mono` for IDs/badges/short-codes; `font-sans` for names/labels.** Override `RetroTable`'s default `font-mono` per Pitfall 5.
- **workspaceId read via `useAuth()` in hooks, never passed as prop.** Verified across all existing mutation hooks.
- **Events published on mutations (backend).** Existing handlers publish `borrower.created`, `borrower.updated`, `borrower.deleted`. New archive/restore endpoints SHOULD publish `borrower.archived` and `borrower.restored` events for consistency with category handler.
- **No new runtime dependencies in Phase 59.** All needed libraries are installed.

## Sources

### Primary (HIGH confidence — read in this session)
- `frontend2/src/lib/api/borrowers.ts` — existing typings + `borrowerKeys` factory
- `frontend2/src/lib/api/categories.ts` — archive/restore/remove API pattern to mirror
- `frontend2/src/lib/api/loans.ts` — `listForBorrower` exists; don't call in Phase 59 (D-04)
- `frontend2/src/lib/api.ts` — `HttpError` class + `get/post/patch/del` helpers
- `frontend2/src/lib/api/__tests__/queryKeys.test.ts` — borrowerKeys already tested
- `frontend2/src/features/taxonomy/panel/SlideOverPanel.tsx` — slide-over reference (focus mgmt, dirty guard, portal)
- `frontend2/src/features/taxonomy/panel/EntityPanel.tsx` — create/edit dual-mode reference
- `frontend2/src/features/taxonomy/actions/ArchiveDeleteFlow.tsx` — two-stage dialog reference (adapted: 400 vs 409)
- `frontend2/src/features/taxonomy/hooks/useContainerMutations.ts` — 5-hook mutation file shape
- `frontend2/src/features/taxonomy/hooks/useCategoryMutations.ts` — `HttpError.status === 409` error-branch pattern
- `frontend2/src/features/taxonomy/forms/schemas.ts` — zod pattern
- `frontend2/src/features/taxonomy/forms/CategoryForm.tsx` — empty-string→undefined coercion
- `frontend2/src/features/taxonomy/tabs/ContainersTab.tsx` — row action rendering + archived toggle + mute styling
- `frontend2/src/features/taxonomy/TaxonomyPage.tsx` — page layout
- `frontend2/src/components/retro/index.ts` — barrel (verified exports)
- `frontend2/src/components/retro/RetroTable.tsx` — default `font-mono` behavior
- `frontend2/src/components/retro/RetroEmptyState.tsx` — empty-state API
- `frontend2/src/components/retro/RetroConfirmDialog.tsx` — `secondaryLink` + `variant` props
- `frontend2/src/components/retro/RetroFormField.tsx` — Controller wrapper
- `frontend2/src/components/retro/RetroBadge.tsx` — ARCHIVED badge variant
- `frontend2/src/features/auth/AuthContext.tsx` — `useAuth().workspaceId`
- `frontend2/src/routes/index.tsx` — route registration pattern (AppShell + Outlet)
- `frontend2/package.json` — dependency versions [VERIFIED installed]
- `backend/internal/domain/warehouse/borrower/handler.go` — confirms only one `DELETE` route, calls `svc.Archive`, dead 400 branch
- `backend/internal/domain/warehouse/borrower/service.go` — `Archive`, `Restore`, `Delete(hard)` exist; `Delete` checks `HasActiveLoans`
- `backend/internal/domain/warehouse/borrower/repository.go` — `Delete`, `HasActiveLoans`, `FindByWorkspace` methods
- `backend/internal/domain/warehouse/borrower/errors.go` — `ErrHasActiveLoans`
- `backend/internal/infra/postgres/borrower_repository.go` — `Delete` wraps `ArchiveBorrower` (bug / gap)
- `backend/internal/infra/queries/borrowers.sql.go` — `listBorrowers` has hard-coded `AND is_archived = false`
- `backend/internal/domain/warehouse/category/handler.go` — canonical `POST /archive`, `POST /restore`, `DELETE` pattern
- `.planning/phases/57-retro-form-primitives/57-RESEARCH.md` — form-substrate decisions
- `.planning/phases/58-taxonomy-categories-locations-containers/58-CONTEXT.md` — archive-first dialog spec
- `.planning/phases/58-taxonomy-categories-locations-containers/58-RESEARCH.md` — adjacent-phase patterns

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — BORR-01..05 original wording
- `.planning/STATE.md` — v2.0/v2.1 locked decisions
- reactrouter.com/en/main — route ranking (v7)
- tanstack.com/query/latest — mutation + invalidation patterns
- w3.org/WAI/ARIA/apg/patterns/dialog — confirm dialog accessibility (already encoded in `RetroDialog`)

### Tertiary (LOW confidence)
- None — every claim was either verified in-repo or is a code-shape suggestion marked as such.

## Metadata

**Confidence breakdown:**
- Frontend patterns: HIGH — three adjacent phases shipped with verified parallel code
- Frontend stack versions: HIGH — verified against `frontend2/package.json` (installed, not npm registry, because dependencies are locked via the shipped project)
- Backend API surface: HIGH — read all handler/service/repository/query files for borrowers; identified three concrete gaps
- CONTEXT feasibility: **MEDIUM** — D-02 and D-03 require backend changes not yet made; whether those changes are in-scope for Phase 59 depends on user/orchestrator decision (Open Qs 1 & 2)
- Security: HIGH — standard patterns, inherited from existing handlers
- Test strategy: HIGH — Wave 0 gaps enumerated against adjacent-phase test files

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (30 days; everything cited is shipped code or stable decisions)
