# Phase 56: Foundation — API Client & React Query - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Install TanStack Query, wrap `App.tsx` with `QueryClientProvider`, create typed per-entity API modules in `lib/api/` (items, itemPhotos, loans, borrowers, categories, locations, containers), add a `postMultipart<T>` helper to `lib/api.ts`, and validate the setup with a visible `/api-demo` developer route. No user-facing features. This phase is pure infrastructure that unblocks all v2.1 CRUD phases (57–63).

</domain>

<decisions>
## Implementation Decisions

### Workspace ID Strategy
- **D-01:** Entity API modules do NOT receive `workspaceId` as a parameter. Instead, React Query hooks (not the raw API functions) read `workspaceId` from `useAuth().workspaceId` (already available in `AuthContext`). The API module functions are pure `(endpoint, params) → Promise<T>` calls; the hook layer threads in the workspace ID. No Zustand store needed — `AuthContext` already has it.

### Entity Type Placement
- **D-02:** TypeScript interfaces for each entity (Item, ItemPhoto, Loan, Borrower, Category, Location, Container) live co-located with their API functions inside `lib/api/items.ts`, `lib/api/loans.ts`, etc. Each file exports both the types and the API functions. `lib/types.ts` keeps only the existing domain-agnostic types (User, Workspace, DashboardStats, ApiError, etc.) — no new entity types added there.

### Query Key Design
- **D-03:** Each entity module exports a `queryKeys` factory object following the TK-dodo pattern:
  ```ts
  export const itemKeys = {
    all: ['items'] as const,
    lists: () => [...itemKeys.all, 'list'] as const,
    list: (params: ItemListParams) => [...itemKeys.lists(), params] as const,
    details: () => [...itemKeys.all, 'detail'] as const,
    detail: (id: string) => [...itemKeys.details(), id] as const,
  }
  ```
  Downstream phases invalidate `itemKeys.all` after mutations to clear all item queries. All query key factories must be exported from `lib/api/` so CRUD phases import them directly.

### Smoke Test Form
- **D-04:** Verification is a visible `/api-demo` developer route (public, no auth required like `/demo`). It renders a React Query-powered list fetch for one real endpoint (e.g., items or dashboard stats), showing explicit loading, success (data rendered), and error states. Route is added to the router as a dev-only page alongside `/demo`. No Vitest integration test needed for this phase.

### CI Guard
- **D-05:** A CI grep guard (added to CI config or a lint/build step) fails the build if any file under `frontend2/src/**` imports `idb`, `serwist`, or any module matching `*offline*` or `*sync*`. This enforces the "no offline carry-over from v1" constraint for v2.1.

### Claude's Discretion
- TanStack Query version (v5 preferred — current major at time of phase execution)
- React Query Devtools mounting approach (lazy import in dev only, `process.env.NODE_ENV`)
- Exact `QueryClient` stale time and retry defaults (sensible defaults; can be tuned per-entity later)
- Whether to add a barrel `lib/api/index.ts` re-exporting all entity modules
- `/api-demo` route styling (minimal, functional — retro components optional)
- CI guard implementation detail (Vite plugin, a pre-commit hook, or a CI step)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing API Foundation
- `frontend2/src/lib/api.ts` — Existing `get`, `post`, `patch`, `del` helpers with JWT refresh logic. Entity modules build on top of these — do NOT reimplment fetch logic.
- `frontend2/src/lib/types.ts` — Existing domain types (User, Workspace, DashboardStats, etc.). Do not add entity types here.
- `frontend2/src/features/auth/AuthContext.tsx` — `useAuth().workspaceId` is how hooks get the current workspace ID. Already resolved from the personal workspace on login.

### Backend API Shape (for typing entity modules)
- `backend/internal/domain/warehouse/item/handler.go` — Item list/get/create/update/delete endpoint shapes
- `backend/internal/domain/warehouse/item/entity.go` — Item entity fields
- `backend/internal/api/router.go` — Route registration confirming /workspaces/{id}/{entity} URL pattern

### Project Context
- `.planning/REQUIREMENTS.md` — v2.1 requirements (ITEM, LOAN, BORR, TAX entities) that these API modules must serve
- `.planning/phases/48-project-scaffold/48-CONTEXT.md` — Directory layout decisions (D-01 through D-08)
- `.planning/phases/49-auth-api-client/49-CONTEXT.md` — Auth and API client decisions (JWT, HttpOnly cookies, refresh flow)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/api.ts` `get/post/patch/del` helpers — All entity API functions delegate to these. No new fetch logic needed.
- `AuthContext.tsx` `workspaceId` — Already resolved on login; hooks use `useAuth().workspaceId` to build entity URLs like `/workspaces/${workspaceId}/items`.
- `frontend2/src/routes/index.tsx` — Add `/api-demo` route here alongside the existing `/demo` route.

### Established Patterns
- TypeScript strict mode — Entity types must be fully typed (no `any`)
- `@/` path alias for `frontend2/src/` — All imports use this
- Lingui `t` macro for any user-visible strings (even dev pages)
- TanStack Query not yet installed — `bun add @tanstack/react-query @tanstack/react-query-devtools` needed

### Integration Points
- `App.tsx` — `QueryClientProvider` wraps existing `AuthProvider > ToastProvider` stack
- `frontend2/src/routes/index.tsx` — `/api-demo` public route added alongside `/demo`

</code_context>

<specifics>
## Specific Ideas

- Query key factory pattern should follow TK-dodo's blog post structure (hierarchical const arrays with factory functions)
- `postMultipart<T>` helper belongs in `lib/api.ts` alongside existing `get/post/patch/del` — not in the entity module files

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 56-foundation-api-client-and-react-query*
*Context gathered: 2026-04-15*
