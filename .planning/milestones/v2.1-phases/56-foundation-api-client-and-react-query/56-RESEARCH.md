# Phase 56: Foundation — API Client & React Query - Research

**Researched:** 2026-04-15
**Domain:** TanStack Query v5 integration on top of an existing fetch wrapper, typed per-entity API modules, multipart helper, CI import guard
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 Workspace ID Strategy:** Entity API modules do NOT receive `workspaceId` as a parameter. React Query hooks (not the raw API functions) read `workspaceId` from `useAuth().workspaceId` (already provided by `AuthContext`). API module functions are pure `(endpoint, params) -> Promise<T>` calls; the hook layer threads in the workspace ID. No Zustand store needed.
- **D-02 Entity Type Placement:** TypeScript interfaces for each entity (Item, ItemPhoto, Loan, Borrower, Category, Location, Container) live co-located with their API functions inside `lib/api/items.ts`, `lib/api/loans.ts`, etc. Each file exports both the types and the API functions. `lib/types.ts` keeps only existing domain-agnostic types — no new entity types are added there.
- **D-03 Query Key Design:** Each entity module exports a `queryKeys` factory object following the TK-dodo hierarchical pattern (`all`, `lists()`, `list(params)`, `details()`, `detail(id)`). Downstream phases invalidate `<entity>Keys.all` after mutations. All key factories are exported from `lib/api/` so CRUD phases import them directly.
- **D-04 Smoke Test Form:** Verification is a visible `/api-demo` developer route (public, no auth, like `/demo`). It renders a React Query-powered list fetch against one real endpoint showing explicit loading / success / error states. Route registered in the router. No Vitest integration test required for this phase.
- **D-05 CI Guard:** A CI grep guard (added to CI config or a lint/build step) fails the build if any file under `frontend2/src/**` imports `idb`, `serwist`, or any module matching `*offline*` or `*sync*`. Enforces "no offline carry-over from v1" for v2.1.

### Claude's Discretion

- TanStack Query major version (v5 preferred — current major)
- React Query Devtools mounting approach (lazy import in dev only, `import.meta.env.DEV`)
- Exact `QueryClient` `staleTime` / `retry` defaults (sensible defaults, tuneable per-entity later)
- Whether to add a barrel `lib/api/index.ts` re-exporting all entity modules
- `/api-demo` route styling (minimal, functional — retro components optional)
- CI guard implementation detail (Vite plugin, pre-commit hook, or CI step)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

This phase is pure infrastructure — it does NOT carry user-facing REQ-IDs. Its outputs unblock every CRUD phase in v2.1 (57–63).

| Success Criterion (from ROADMAP) | Research Support |
|----|------------------|
| SC-1 `QueryClientProvider` wraps `App.tsx`, Devtools in dev | "Standard Stack" (TanStack Query v5 install), "Pattern 1: Provider wiring", "Pattern 2: Devtools lazy import" |
| SC-2 `lib/api/` contains typed per-entity modules (items, itemPhotos, loans, borrowers, categories, locations, containers) with list/get/create/update/delete | "Architecture Patterns → Per-Entity Module Shape", "Backend Endpoint Map" |
| SC-3 `lib/api.ts` gains a `postMultipart<T>` helper | "Pattern 3: postMultipart helper" |
| SC-4 `/api-demo` dev route shows loading/success/error from a real list endpoint via React Query | "Pattern 4: /api-demo smoke page" |
| SC-5 CI grep guard blocks imports of `idb`, `serwist`, `*offline*`, `*sync*` from `frontend2/src/**` | "Pattern 5: CI grep guard" |
</phase_requirements>

## Summary

This phase is narrow, well-scoped, and low-risk. It adds TanStack Query v5 on top of the already-working `frontend2/src/lib/api.ts` fetch wrapper (which already handles JSON, `credentials: include`, 401→refresh retry, and a typed `HttpError`). The raw API functions stay thin (delegate to existing `get/post/patch/del`); the hook layer (introduced in later phases 57–63) threads in `workspaceId` from `AuthContext`.

The backend exposes all entity endpoints nested under `/api/workspaces/{workspace_id}/...` (confirmed in `backend/internal/api/router.go:357` — `r.Route("/workspaces/{workspace_id}", ...)` wraps every per-entity `huma.Get/Post/...` registration that uses relative paths like `/items`, `/borrowers`, `/loans`, `/categories`, `/locations`, `/containers`). The photo upload is a standalone non-Huma Chi handler that parses multipart form data (10 MB max) — this is what `postMultipart<T>` must target.

TanStack Query v5 (current stable: **5.99.0**, verified via `npm view @tanstack/react-query version`) has a small, stable API surface: one `QueryClient`, one `<QueryClientProvider>`, query keys as `readonly` tuples, `useQuery`/`useMutation`, and `queryClient.invalidateQueries({ queryKey })`. The TK-dodo "Effective React Query Keys" factory pattern already matches D-03 verbatim. Devtools ship separately (`@tanstack/react-query-devtools`, same 5.99.0).

**Primary recommendation:** Install `@tanstack/react-query@^5` and `@tanstack/react-query-devtools@^5`, add one `QueryClient` singleton in `src/lib/queryClient.ts` with sensible defaults (`staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false`), wrap `AuthProvider > ToastProvider` inside `<QueryClientProvider>` in `App.tsx`, lazy-mount Devtools under `import.meta.env.DEV`. Add seven co-located entity modules that each export: `<Entity>` type, `<Entity>ListParams` type, pure async functions (`list/get/create/update/remove`), and a `<entity>Keys` factory. Add a `postMultipart<T>` sibling to `get/post/patch/del` in `lib/api.ts` (reusing the existing refresh-retry flow — **do not** set `Content-Type` manually for FormData). Implement CI guard as a tiny Node script (`scripts/check-forbidden-imports.mjs`) wired into `package.json` `prebuild` + Vitest config — no GitHub Actions workflow directory exists yet.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| TanStack Query cache / server state | Browser / Client (SPA) | — | `/frontend2` is a React Router v7 **library-mode SPA** (no SSR per v2.0 decision); all fetching happens in-browser. |
| `QueryClientProvider` wiring | Browser / Client | — | Mounted in `App.tsx` inside the browser bundle. |
| Typed entity API modules (`lib/api/*.ts`) | Browser / Client | — | They wrap `fetch` calls; run in-browser. |
| `postMultipart<T>` helper | Browser / Client | — | Uses the browser `FormData` + `fetch` API. |
| 401 refresh handling | Browser / Client | API / Backend (refresh endpoint) | Already implemented in `lib/api.ts`; entity modules inherit it. |
| Workspace ID resolution | Browser / Client (`AuthContext`) | API / Backend (returns workspace list on login) | `useAuth().workspaceId` is the single source. |
| `/api-demo` dev smoke route | Browser / Client | — | Rendered by React Router v7 as a public SPA route. |
| CI import guard | Build/CI tier | — | Runs during `bun run build` / CI via a small Node script. |
| Backend HTTP endpoints | API / Backend (Go + Huma) | Database | Already shipped; this phase consumes, not modifies. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | `^5.99.0` [VERIFIED: `npm view @tanstack/react-query version` → 5.99.0] | Server-state cache, query/mutation hooks, invalidation | De facto server-state library for React; v5 is the current major; it is what the v2.1 decision log already locked in. [CITED: tanstack.com/query/latest] |
| `@tanstack/react-query-devtools` | `^5.99.0` [VERIFIED: `npm view @tanstack/react-query-devtools version` → 5.99.0] | In-dev query inspection / cache visualisation | Official Devtools from the same team; ships as a separate package so production bundles exclude it. [CITED: tanstack.com/query/latest/docs/framework/react/devtools] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | — | `fetch`, `FormData`, `URLSearchParams` are built-in browser APIs. The existing `@/lib/api.ts` wrapper already handles auth/refresh. [VERIFIED: codebase `frontend2/src/lib/api.ts`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Query | SWR, RTK Query | Already locked out by v2.1 decision (see STATE.md "v2.1: TanStack Query for server state"). Not revisiting. |
| Lazy Devtools via `import.meta.env.DEV` | `NODE_ENV === 'production'` check | Vite uses `import.meta.env.DEV`; this is the idiomatic path for the existing stack. [CITED: vitejs.dev/guide/env-and-mode] |
| Separate `lib/queries/` hook directory | Co-locate hooks beside each entity module | Co-location matches D-02 and keeps a single surface per entity; but **hooks ship in phases 57+**, not this phase — this phase only ships raw API fns + `queryKeys`. |

**Installation:**

```bash
cd frontend2 && bun add @tanstack/react-query @tanstack/react-query-devtools
```

**Version verification (performed 2026-04-15):**

- `@tanstack/react-query` → `5.99.0`
- `@tanstack/react-query-devtools` → `5.99.0`

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────── Browser (SPA, frontend2) ──────────────────────────┐
│                                                                               │
│   App.tsx                                                                     │
│     │                                                                         │
│     ▼                                                                         │
│   <I18nProvider>                                                              │
│     └─<BrowserRouter>                                                         │
│         └─<QueryClientProvider client={queryClient}>   ◄── NEW in Phase 56    │
│             └─<AuthProvider>   (already provides workspaceId)                 │
│                 └─<ToastProvider>                                             │
│                     └─<AppRoutes />                                           │
│                         │                                                     │
│                         ├─ /api-demo  ◄── NEW dev smoke route (D-04)          │
│                         │     │                                               │
│                         │     └── useQuery(itemKeys.list({workspaceId}))      │
│                         │           │                                         │
│                         │           ▼                                         │
│                         │     lib/api/items.ts  items.list(workspaceId)       │
│                         │           │                                         │
│                         │           ▼                                         │
│                         │     lib/api.ts  get<ItemListResponse>(...)          │
│                         │           │  (JWT cookie + in-memory refresh tok)   │
│                         │           ▼                                         │
│                         └──── fetch('/api/workspaces/{wsId}/items?...') ──────┼──► Go backend
│                                                                               │    (Huma + Chi)
│         <ReactQueryDevtools />  ◄── mounted only when import.meta.env.DEV     │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

Build/CI tier (runs outside the browser):
  bun run build → prebuild → scripts/check-forbidden-imports.mjs → grep guard (D-05)
                                     │
                                     ▼
                            FAIL if any file under frontend2/src/** imports
                            idb, serwist, *offline*, *sync*
```

### Recommended Project Structure

```
frontend2/src/
├── lib/
│   ├── api.ts                    # existing; gains postMultipart<T> (SC-3)
│   ├── queryClient.ts            # NEW — QueryClient singleton + defaults
│   ├── types.ts                  # unchanged (domain-agnostic types only, per D-02)
│   └── api/                      # NEW — per-entity modules
│       ├── index.ts              # optional barrel (Claude's discretion)
│       ├── items.ts              # Item type + fns + itemKeys
│       ├── itemPhotos.ts         # ItemPhoto type + fns (+ postMultipart usage in P61)
│       ├── loans.ts              # Loan type + fns + loanKeys
│       ├── borrowers.ts          # Borrower type + fns + borrowerKeys
│       ├── categories.ts         # Category type + fns + categoryKeys
│       ├── locations.ts          # Location type + fns + locationKeys
│       └── containers.ts         # Container type + fns + containerKeys
├── routes/
│   └── index.tsx                 # add public /api-demo route (D-04)
├── pages/
│   └── ApiDemoPage.tsx           # NEW — loading/success/error smoke page
├── App.tsx                       # add QueryClientProvider + lazy Devtools
└── ...
scripts/
└── check-forbidden-imports.mjs   # NEW — CI grep guard (D-05)
```

### Backend Endpoint Map (what the entity modules must target)

All endpoints are registered under `r.Route("/workspaces/{workspace_id}", ...)` in `backend/internal/api/router.go:357`, reached at `/api/workspaces/{wsId}/...` (the BASE_URL `/api` prefix is already in `lib/api.ts:3`).

[VERIFIED: codebase grep of `huma.(Get|Post|Patch|Delete)` in `backend/internal/domain/warehouse/`]

| Entity | List | Get | Create | Update | Delete / Archive |
|---|---|---|---|---|---|
| items | `GET /items?page&limit&needs_review` | `GET /items/{id}` | `POST /items` | `PATCH /items/{id}` | `POST /items/{id}/archive` + `POST /items/{id}/restore` + no hard-delete exposed |
| borrowers | `GET /borrowers` | `GET /borrowers/{id}` | `POST /borrowers` | `PATCH /borrowers/{id}` | `DELETE /borrowers/{id}` |
| categories | `GET /categories` (+ `/categories/root`, `/categories/{id}/children`, `/categories/{id}/breadcrumb`) | `GET /categories/{id}` | `POST /categories` | `PATCH /categories/{id}` | `POST /categories/{id}/archive` / `restore` + `DELETE /categories/{id}` |
| locations | `GET /locations` (+ `/locations/{id}/breadcrumb`, `/locations/search`) | `GET /locations/{id}` | `POST /locations` | `PATCH /locations/{id}` | archive/restore + `DELETE` |
| containers | `GET /containers` | `GET /containers/{id}` | `POST /containers` | `PATCH /containers/{id}` | archive/restore + `DELETE` |
| loans | `GET /loans` (+ `/loans/active`, `/loans/overdue`, `/borrowers/{borrower_id}/loans`) | `GET /loans/{id}` | `POST /loans` | `PATCH /loans/{id}/extend` | `POST /loans/{id}/return` (no delete) |
| itemPhotos | `GET /items/{item_id}/photos/list` | `GET /photos/{id}` | **Chi multipart upload handler** (non-Huma, `RegisterUploadHandler`, 10 MB max) — target of `postMultipart<T>` | — | `DELETE /photos/{id}` |

**Items list envelope** (verified from `item/handler.go:443`):

```json
{ "items": [...], "total": 123, "page": 1, "total_pages": 3 }
```

This matches the STATE.md pending todo "Resolve pagination envelope per endpoint" — **for items the envelope is fixed to `{items,total,page,total_pages}` with `page`+`limit` query params**. Other entities may differ; entity-module typings should reflect each handler's actual response type rather than assume uniformity. [VERIFIED: `backend/internal/domain/warehouse/item/handler.go:443-448`]

### Pattern 1: QueryClient + Provider wiring

**What:** One `QueryClient` instance, wrapped around the app near the root.
**When to use:** Always, exactly once, as high in the tree as you need access — but **below** any provider it depends on (none, in our case) and **above** any consumer.

```ts
// Source: https://tanstack.com/query/latest/docs/framework/react/quick-start
// frontend2/src/lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,             // 30s — tuneable per-entity later
      gcTime: 5 * 60_000,            // 5m
      retry: 1,                      // one automatic retry
      refetchOnWindowFocus: false,   // retro SPA, not a dashboard
    },
    mutations: {
      retry: 0,
    },
  },
});
```

```tsx
// frontend2/src/App.tsx — insertion point shown; other providers unchanged
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

// ...
return (
  <I18nProvider i18n={i18n}>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
        {import.meta.env.DEV && <DevtoolsLazy />}
      </QueryClientProvider>
    </BrowserRouter>
  </I18nProvider>
);
```

### Pattern 2: Devtools lazy import (dev-only)

```tsx
// Source: https://tanstack.com/query/latest/docs/framework/react/devtools (production bundle guidance)
import { lazy, Suspense } from "react";

const ReactQueryDevtools = lazy(() =>
  import("@tanstack/react-query-devtools").then((m) => ({ default: m.ReactQueryDevtools }))
);

function DevtoolsLazy() {
  return (
    <Suspense fallback={null}>
      <ReactQueryDevtools initialIsOpen={false} />
    </Suspense>
  );
}
```

Guarding with `import.meta.env.DEV` ensures Vite tree-shakes the import entirely in production builds. [CITED: vitejs.dev/guide/env-and-mode — "import.meta.env.DEV is always the opposite of import.meta.env.PROD"]

### Pattern 3: `postMultipart<T>` helper

**What:** Browser-native multipart POST that participates in the existing 401→refresh retry flow.
**When to use:** Exclusively for file uploads (photos in phase 61). Every other mutation uses `post`.

Critical rules (from experience and MDN):

1. **Never set `Content-Type`** when the body is a `FormData`. The browser sets it to `multipart/form-data; boundary=...` automatically. Setting it manually breaks the boundary. [CITED: developer.mozilla.org/en-US/docs/Web/API/FormData — "Do not explicitly set the Content-Type header"]
2. `credentials: "include"` must be kept (same as `request()`).
3. Reuse the existing `request()` path if possible; at minimum factor out the refresh retry so multipart inherits it.

```ts
// Source: MDN FormData + existing request() pattern in lib/api.ts
// lib/api.ts additions (sketch — planner to finalise; note refresh-retry MUST be preserved)
export async function postMultipart<T>(endpoint: string, form: FormData): Promise<T> {
  // IMPORTANT: do NOT set Content-Type — browser must pick the multipart boundary
  return request<T>(endpoint, { method: "POST", body: form, headers: {} });
}
```

**Implementation note for planner:** The current `request<T>()` helper sets `"Content-Type": "application/json"` unconditionally (`lib/api.ts:72`). `postMultipart` must route through a variant that omits that default when the body is `FormData` — either (a) refactor `request()` to detect `body instanceof FormData` and strip the default, or (b) duplicate the minimal refresh-retry skeleton in `postMultipart`. Option (a) is cleaner and has lower duplication.

### Pattern 4: `/api-demo` smoke page

**What:** Minimal public route that imports the new `itemsApi.list` (or a simpler endpoint like `/dashboard/stats` if items require auth) and renders loading/success/error states.

**Important:** `/api-demo` is listed under **public routes** (D-04), sibling to `/demo`. Most warehouse endpoints require auth and a workspace. The smoke page has two sensible options:

- **Option A (simpler, matches D-04):** Target a **public** endpoint if one exists. As of today every `/workspaces/{wsId}/*` endpoint requires the JWT cookie + resolved workspace, so a truly "public, no-auth" query against a real list endpoint will 401. **Recommendation:** keep `/api-demo` public for reachability (like `/demo`) but either (1) do the real fetch only when the user is signed in (fall back to an explanatory panel otherwise), or (2) target `/api/auth/me` or similar (which 401s cleanly when not signed in, still demonstrating the error state).
- **Option B (strict smoke):** Put `/api-demo` behind `RequireAuth` — demonstrates the happy path against a real workspace endpoint. Costs one small deviation from D-04's "public like /demo" wording.

Planner should raise this with the user if ambiguous. Default to **Option A**, targeting `/users/me` for success, forcing a path to show error, and using the absent `workspaceId` case for the empty-state copy from UI-SPEC.

Minimal shape (all strings via Lingui `t` per UI-SPEC):

```tsx
// Source: tanstack.com/query/latest/docs/framework/react/guides/queries
import { useQuery } from "@tanstack/react-query";
import { itemsApi, itemKeys } from "@/lib/api/items";
import { useAuth } from "@/features/auth/AuthContext";

export function ApiDemoPage() {
  const { workspaceId } = useAuth();
  const query = useQuery({
    queryKey: itemKeys.list({ page: 1, limit: 10 }),
    queryFn: () => itemsApi.list(workspaceId!, { page: 1, limit: 10 }),
    enabled: !!workspaceId,
  });
  if (query.isPending) return <p>{/* t`Loading data from API…` */}</p>;
  if (query.isError)   return <RetryPanel onRetry={() => query.refetch()} />;
  if (query.data.items.length === 0) return <EmptyState />;
  return <SuccessList items={query.data.items} />;
}
```

### Pattern 5: CI grep guard (D-05)

**Context:** `.github/workflows/` does **not currently exist** in this repo (verified `ls`). The guard cannot be "added to the existing CI workflow" because there is no workflow yet.

**Recommendation:** Implement as a tiny Node script wired to `bun run build` via `package.json prebuild`, so it runs in every local build and in whatever CI is eventually added. Also surface it as an npm script (`lint:imports`) so it can be invoked independently.

```js
// scripts/check-forbidden-imports.mjs
// Source: authored for this phase — uses Node's built-in fs + a plain regex scan
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "frontend2/src";
// D-05: idb, serwist, any *offline* or *sync* module
const FORBIDDEN = /from\s+['"]([^'"]*\b(idb|serwist|[A-Za-z0-9._/-]*offline[A-Za-z0-9._/-]*|[A-Za-z0-9._/-]*sync[A-Za-z0-9._/-]*)[^'"]*)['"]/;

function walk(dir) { /* recurse, yield .ts/.tsx */ }

let offenders = [];
for (const file of walk(ROOT)) {
  const src = readFileSync(file, "utf8");
  const m = src.match(FORBIDDEN);
  if (m) offenders.push(`${file}: imports ${m[1]}`);
}
if (offenders.length) {
  console.error("Forbidden imports detected (Phase 56 D-05):\n" + offenders.join("\n"));
  process.exit(1);
}
```

```json
// frontend2/package.json — scripts additions
{
  "scripts": {
    "lint:imports": "node scripts/check-forbidden-imports.mjs",
    "prebuild": "bun run lint:imports"
  }
}
```

**False-positive risk:** A greedy `*sync*` pattern will also match legitimate words like `asynchronous`, `synchronize`, or TanStack Query's own `useSyncExternalStore` shim if referenced. Mitigate by matching only on **module specifiers** (text inside `from '…'`), not arbitrary identifiers — the regex above does exactly that. The planner should add a test (a fixture file with `import ... from "idb"`) to prove the guard fails the build, plus a passing fixture to prove it does not false-positive on `@tanstack/react-query`.

### Per-Entity Module Shape (canonical example)

```ts
// Source: pattern from tanstack.com (useQuery/useMutation) + tkdodo.eu/blog/effective-react-query-keys
// frontend2/src/lib/api/items.ts
import { get, post, patch, del } from "@/lib/api";

export interface Item {
  id: string;
  workspace_id: string;
  sku: string;
  name: string;
  description?: string | null;
  category_id?: string | null;
  // ... see backend ItemResponse for the full field list
  created_at: string;
  updated_at: string;
}

export interface ItemListResponse {
  items: Item[];
  total: number;
  page: number;
  total_pages: number;
}

export interface ItemListParams {
  page?: number;
  limit?: number;
  needs_review?: boolean;
}

export interface CreateItemInput { /* mirrors backend CreateItemInput.Body */ }
export interface UpdateItemInput { /* mirrors backend UpdateItemInput.Body */ }

const base = (wsId: string) => `/workspaces/${wsId}/items`;

export const itemsApi = {
  list:   (wsId: string, params: ItemListParams = {}) =>
            get<ItemListResponse>(`${base(wsId)}${toQuery(params)}`),
  get:    (wsId: string, id: string) => get<Item>(`${base(wsId)}/${id}`),
  create: (wsId: string, body: CreateItemInput) => post<Item>(base(wsId), body),
  update: (wsId: string, id: string, body: UpdateItemInput) => patch<Item>(`${base(wsId)}/${id}`, body),
  archive:  (wsId: string, id: string) => post<void>(`${base(wsId)}/${id}/archive`),
  restore:  (wsId: string, id: string) => post<void>(`${base(wsId)}/${id}/restore`),
};

export const itemKeys = {
  all: ["items"] as const,
  lists: () => [...itemKeys.all, "list"] as const,
  list: (params: ItemListParams) => [...itemKeys.lists(), params] as const,
  details: () => [...itemKeys.all, "detail"] as const,
  detail: (id: string) => [...itemKeys.details(), id] as const,
};

function toQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}
```

**Notes for the planner:**

- Success Criterion 2 uses the word *"delete"* but the items API has no hard-delete — the contract is archive/restore. Name the functions honestly (`archive`/`restore`), not a synthetic `remove()`. Loans use `return` (the past-tense verb, not an HTTP DELETE). Document each entity's lifecycle verbs in its module JSDoc.
- The naming `itemsApi.list` is deliberately an object method rather than a free `listItems` function. Importing `itemsApi.list` reads fluently in hooks (`() => itemsApi.list(wsId, params)`) and avoids a proliferation of `listItems`, `listLoans`, `listBorrowers` at module scope.
- Key factories are exported as `itemKeys`, `loanKeys`, `borrowerKeys`, etc. — matching D-03 verbatim.

### Anti-Patterns to Avoid

- **Do not reimplement fetch in entity modules.** Always delegate to `get/post/patch/del`/`postMultipart` in `lib/api.ts` so refresh-retry stays in one place.
- **Do not put entity types in `lib/types.ts`.** D-02 forbids it.
- **Do not accept `workspaceId` as a default parameter inside API functions.** D-01 says the hook layer threads it in; API fns are pure.
- **Do not set `Content-Type` when body is FormData.** Breaks boundary auto-generation.
- **Do not create a new `QueryClient` inside a component.** It goes in `lib/queryClient.ts` as a module-level singleton.
- **Do not initialise Devtools eagerly.** Lazy-load under `import.meta.env.DEV` so it's tree-shaken from prod bundles.
- **Do not put query keys as plain arrays ad-hoc** (e.g. `useQuery({ queryKey: ["items", id] })`). Always go through the factory so invalidation stays correct. [CITED: tkdodo.eu/blog/effective-react-query-keys]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Server-state cache / dedupe / invalidation | Custom hook with `useState + useEffect + fetch` | `@tanstack/react-query` | Stale-while-revalidate, dedupe, retry, cancellation, devtools — all free. |
| Cache key scheme | Manual string concat (`"items-" + id`) | TK-dodo factory (`itemKeys.detail(id)`) | Hierarchical invalidation (`invalidateQueries({queryKey: itemKeys.all})`) only works when keys are nested arrays. |
| Multipart upload boundary | Manual `Content-Type: multipart/form-data; boundary=xxx` construction | Browser `FormData` + `fetch` without `Content-Type` | Browser handles RFC 7578 boundaries; manual attempts leak boundary mismatches. |
| JWT refresh-on-401 | Rebuild in `postMultipart` | Factor shared retry out of existing `request()` | Already works in `request()`; duplicating is a consistency bug waiting to happen. |
| Env-gated dev tooling | `process.env.NODE_ENV` string checks | `import.meta.env.DEV` | Vite's idiomatic build-time constant; reliably tree-shaken. |

**Key insight:** Phase 56 is almost entirely *wiring*. The only novel code is the `postMultipart` helper, the CI grep script, and the `/api-demo` page. Everything else is configuration of well-understood libraries.

## Runtime State Inventory

Not applicable — this phase is greenfield module additions only. No renames, no migrations, no existing storage to update.

## Common Pitfalls

### Pitfall 1: `postMultipart` accidentally sends `Content-Type: application/json`
**What goes wrong:** Backend responds 400 "invalid multipart boundary" / "mime: no media type".
**Why it happens:** `request()` in `lib/api.ts` currently spreads `{ "Content-Type": "application/json", ...options.headers }`, and if `postMultipart` delegates through `request()` naively, the JSON header wins over `undefined`.
**How to avoid:** Refactor `request()` to check `body instanceof FormData` and omit the JSON default in that case; the browser's default `Content-Type` (with boundary) will be preserved.
**Warning signs:** Backend returns HTTP 400 with a boundary-related message; browser DevTools Network tab shows `Content-Type: application/json` on a request whose body is `FormData`.

### Pitfall 2: Query keys drift from factory, breaking invalidation
**What goes wrong:** `invalidateQueries({ queryKey: itemKeys.all })` doesn't actually clear a list because someone typed `queryKey: ["items", { ...params }]` by hand, skipping the `"list"` segment.
**Why it happens:** Developers read too-quickly-worded Query docs, forget the factory exists.
**How to avoid:** Export **only** `itemKeys` from `lib/api/items.ts` (no free-standing arrays). CR checklist: grep for `queryKey: [` in PRs and flag anything that isn't `itemKeys.X`.
**Warning signs:** List UIs "don't refresh" after mutations that clearly succeeded server-side.

### Pitfall 3: `/api-demo` targets an auth-required endpoint while being "public"
**What goes wrong:** UI-SPEC success-state copy ("Data loaded") never renders because the fetch always 401s for anonymous users.
**Why it happens:** Every `/workspaces/{wsId}/*` endpoint needs JWT + workspace context (verified in `backend/internal/api/middleware/workspace_test.go`).
**How to avoid:** Use `enabled: !!workspaceId` on the `useQuery`, and fall back to a clear "Sign in to try a real fetch" panel when anonymous; or put `/api-demo` behind `RequireAuth`. Raise with user if unclear.
**Warning signs:** Smoke page always shows the error state.

### Pitfall 4: CI grep guard false-positives on `useSyncExternalStore` / `asynchronous`
**What goes wrong:** Build fails on a legitimate React API import or word in a comment.
**Why it happens:** Naïve `grep -E 'sync|offline'` matches identifiers and comments.
**How to avoid:** Only scan module specifiers — text inside `from '…'` / `import('…')`. Add a positive fixture (imports `@tanstack/react-query`) to a CI test that proves the guard is silent on known-safe imports.
**Warning signs:** Guard rejects a file that has no `import … from "<forbidden>"` line.

### Pitfall 5: `QueryClient` mounted above `AuthProvider` but Devtools below it — inverted
**What goes wrong:** Devtools work but components can't call `useAuth()` at provider wiring time if `useAuth()` is used outside `AuthProvider`.
**Why it happens:** Careless nesting during the `App.tsx` edit.
**How to avoid:** Keep provider order as `I18nProvider > BrowserRouter > QueryClientProvider > AuthProvider > ToastProvider`. React Query has no dependencies on Auth; Auth has no dependency on Query for Phase 56 (hooks introduced in 57+).

### Pitfall 6: Items "delete" expectation vs. archive reality
**What goes wrong:** Planner writes `itemsApi.delete()` to satisfy SC-2 literal wording; downstream CRUD phase calls it; backend has no `DELETE /items/{id}` route.
**Why it happens:** Success Criterion 2 says "list/get/create/update/delete" but the items domain uses archive/restore lifecycle.
**How to avoid:** Per-entity module exposes the actual verbs the backend supports. Document the lifecycle in JSDoc. Flag this divergence in the plan so the user can confirm.

## Code Examples

### Defining the `QueryClient`
```ts
// Source: https://tanstack.com/query/latest/docs/framework/react/quick-start
import { QueryClient } from "@tanstack/react-query";
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});
```

### Providing the client
```tsx
// Source: https://tanstack.com/query/latest/docs/framework/react/reference/QueryClientProvider
import { QueryClientProvider } from "@tanstack/react-query";
<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
```

### Using a query (for /api-demo)
```tsx
// Source: https://tanstack.com/query/latest/docs/framework/react/guides/queries
const q = useQuery({ queryKey: itemKeys.list(params), queryFn: () => itemsApi.list(wsId, params), enabled: !!wsId });
```

### Key factory (TK-dodo pattern)
```ts
// Source: https://tkdodo.eu/blog/effective-react-query-keys
export const itemKeys = {
  all: ["items"] as const,
  lists: () => [...itemKeys.all, "list"] as const,
  list: (p: ItemListParams) => [...itemKeys.lists(), p] as const,
  details: () => [...itemKeys.all, "detail"] as const,
  detail: (id: string) => [...itemKeys.details(), id] as const,
};
```

### Multipart upload (future use in Phase 61)
```ts
// Source: MDN FormData — no explicit Content-Type
const form = new FormData();
form.append("file", file);
form.append("item_id", itemId);
await postMultipart<ItemPhoto>(`/workspaces/${wsId}/items/${itemId}/photos`, form);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useEffect + fetch + useState` data loading | TanStack Query v5 `useQuery` | v5 released 2023-10 | Concurrent-React-safe, dedupe, retry, cache built-in. |
| `QueryCache.find(queryKey)` sync | Object-form APIs: `queryClient.invalidateQueries({ queryKey })` | v5 (breaking) | All invalidation/mutation APIs take an options object in v5; no positional `queryKey` args. [CITED: tanstack.com/query/v5 migration guide] |
| Plain array `['items', id]` keys | Hierarchical const-array factories | Post-2022 (TK-dodo popularised) | Enables `invalidateQueries({queryKey: itemKeys.all})` to match every nested list/detail key. |
| `process.env.NODE_ENV` checks in Vite | `import.meta.env.DEV` | Vite 2+ | Correctly static-replaced at build time; tree-shakable. |

**Deprecated / outdated:**
- React Query v4 positional APIs (`invalidateQueries(queryKey)`, `useQuery(key, fn, options)`) — replaced by object-form in v5.
- `idb`, `serwist`, anything `*offline*` / `*sync*` — explicitly forbidden in v2.1 by D-05.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `staleTime: 30_000, retry: 1, refetchOnWindowFocus: false` are "sensible defaults" for this app | Pattern 1 | LOW — these are per-query overridable later; only affects default UX. Planner/user should feel free to tune. |
| A2 | `/api-demo` public wording (D-04) is compatible with hitting an auth-required endpoint via `enabled: !!workspaceId` + anonymous fallback panel | Pattern 4 / Pitfall 3 | MEDIUM — if the user insists `/api-demo` must be reachable and produce a live success state without login, the planner must either put it behind `RequireAuth` or target a truly public endpoint. Raise before planning locks. |
| A3 | No existing `.github/workflows/` means the CI guard is best wired via `package.json prebuild` rather than a GitHub Actions step | Pattern 5 | LOW — if CI is added later, the same script can be invoked as `bun run lint:imports` from the workflow. |
| A4 | SC-2's "delete" is satisfied by archive/restore for items and return for loans (no hard-delete endpoints exist for those entities) | Per-Entity Module Shape + Pitfall 6 | LOW — backend code confirms no hard-delete routes for items/loans; borrowers/categories/locations/containers DO have `DELETE`. Planner should document per-entity verbs. |
| A5 | The `itemsApi` object-method naming (vs. free functions `listItems`) is the preferred export shape | Per-Entity Module Shape | LOW — cosmetic; if user/planner prefers free functions, switch globally before phase 57. |
| A6 | Refactoring `request()` in `lib/api.ts` to detect `FormData` is preferable to duplicating refresh-retry logic in `postMultipart` | Pattern 3 | LOW — both work; refactor is simply cleaner. If the planner prefers an isolated helper, document the duplication risk. |

## Open Questions

1. **`/api-demo` endpoint target.**
   - What we know: D-04 says public (like `/demo`); all entity endpoints require auth + workspace; UI-SPEC specifies loading/success/error/empty/retry states.
   - What's unclear: whether the success state must render for an anonymous visitor.
   - Recommendation: default to Option A (public route, `enabled: !!workspaceId`, anonymous fallback panel). Planner should open this in the plan and confirm with user if they want Option B instead.

2. **Pagination envelope uniformity.**
   - What we know: items return `{items,total,page,total_pages}`; STATE.md flags pagination-envelope resolution as a pending todo.
   - What's unclear: whether every other entity list follows the same envelope or returns a bare array.
   - Recommendation: each entity's TS interface mirrors that entity's actual Go response (don't force a uniform envelope). The planner should spot-check `borrower/handler.go`, `loan/handler.go`, etc., when writing the typings.

3. **CI guard execution surface.**
   - What we know: no `.github/workflows/` exists today; `prebuild` is the only globally-invoked hook.
   - What's unclear: whether a future CI integration also needs a standalone workflow file.
   - Recommendation: ship the script + `prebuild` wiring now; leave a TODO that a GitHub Actions workflow can call `bun run lint:imports` when CI is introduced (likely a later phase).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bun` | `bun add` / `bun run dev` | ✓ (assumed — already used throughout v2.0) | — | `npm install` works too |
| `@tanstack/react-query` | Core | to be installed | 5.99.0 latest | — |
| `@tanstack/react-query-devtools` | Dev | to be installed | 5.99.0 latest | — |
| Go backend on `/api` | `/api-demo` live smoke | Expected | — | Without it, smoke page stays in error state (which is itself a valid demonstrated state). |
| `.github/workflows/` | CI grep guard "on CI" | ✗ (directory absent) | — | Wire via `package.json prebuild` instead (Pattern 5). |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `.github/workflows/` — use `prebuild` hook.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.3` + `@testing-library/react` `^16.3.2` + `jsdom` `^29.0.2` [VERIFIED: `frontend2/package.json`] |
| Config file | `frontend2/vitest.config.ts` (exists from v2.0; confirm) |
| Quick run command | `cd frontend2 && bun run test -- <pattern>` |
| Full suite command | `cd frontend2 && bun run test` |

### Phase Requirements → Test Map
This phase's SC map to infrastructure checks, not user-facing behaviour tests. D-04 explicitly **does not require** a Vitest integration test — the `/api-demo` route is the smoke. Recommended supplementary automated checks:

| SC | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|--------------|
| SC-1 | `QueryClientProvider` present in rendered `<App />` tree | unit (RTL render + react-query `useIsFetching()` sanity) | `bun run test App.test.tsx` | Wave 0 gap |
| SC-2 | Each `lib/api/<entity>.ts` exports expected fns + key factory | unit (import and assert shape) | `bun run test lib/api/__tests__/*.test.ts` | Wave 0 gap |
| SC-3 | `postMultipart` sends a `FormData` body and no explicit `Content-Type: application/json` | unit (mock `fetch`, inspect call) | `bun run test lib/api.test.ts -t postMultipart` | Wave 0 gap |
| SC-4 | `/api-demo` renders loading → success OR loading → error depending on mock | integration (RTL + `msw` optional) | Manual (D-04 waives automated) | Manual smoke |
| SC-5 | CI guard fails on a fixture that imports `idb` and passes on a fixture that imports `@tanstack/react-query` | unit (spawn the Node script, assert exit codes) | `bun run test scripts/check-forbidden-imports.test.mjs` | Wave 0 gap |

### Sampling Rate
- **Per task commit:** `bun run test -- <touched module>`
- **Per wave merge:** `cd frontend2 && bun run test && bun run lint:imports`
- **Phase gate:** `bun run build` (runs `prebuild` → `lint:imports` → `tsc -b && vite build`) + full Vitest green.

### Wave 0 Gaps
- [ ] `frontend2/src/lib/__tests__/api.postMultipart.test.ts` — covers SC-3
- [ ] `frontend2/src/lib/api/__tests__/entity-shape.test.ts` — asserts each entity module exports the agreed surface (SC-2)
- [ ] `scripts/__tests__/check-forbidden-imports.test.mjs` — positive/negative fixtures (SC-5)
- [ ] `frontend2/src/__tests__/App.queryProvider.test.tsx` — renders `<App />` and asserts React Query context is available (SC-1)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes (inherited) | Existing JWT HttpOnly-cookie + in-memory refresh-token flow in `lib/api.ts` — unchanged by this phase. |
| V3 Session Management | yes (inherited) | Same — `request()` retries once on 401 via `doRefresh()`. `postMultipart` must inherit this. |
| V4 Access Control | no (inherited) | Enforced server-side via workspace middleware; not touched here. |
| V5 Input Validation | partial | Entity TS types document the contract, but **runtime validation is server-side**. No client-side zod yet in this phase (Phase 57 adds `react-hook-form + zod` per v2.1 decisions). Planner: do **not** pre-empt phase 57 by adding zod here. |
| V6 Cryptography | no | No new crypto introduced. |

### Known Threat Patterns for {React SPA + JSON API}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via unescaped API response rendered in demo | Tampering | React auto-escapes; never `dangerouslySetInnerHTML` API text in `/api-demo`. |
| CSRF on mutations | Spoofing | Backend uses `credentials: include` with SameSite cookies; no change here. |
| Token leakage via Devtools | Info Disclosure | Devtools is dev-only; gate via `import.meta.env.DEV` and lazy import (Pattern 2). |
| Multipart DoS (oversized upload) | DoS | Backend enforces 10 MB in `RegisterUploadHandler`; client will add pre-upload size check in phase 61. Not in scope here. |
| Forbidden-import bypass (sneaking `idb`) | Supply-chain governance | D-05 grep guard in `prebuild`. |

## Sources

### Primary (HIGH confidence)
- Codebase — `frontend2/src/lib/api.ts`, `frontend2/src/App.tsx`, `frontend2/src/routes/index.tsx`, `frontend2/src/features/auth/AuthContext.tsx`, `frontend2/src/lib/types.ts`, `frontend2/package.json`
- Codebase — `backend/internal/api/router.go:357` (the `/workspaces/{workspace_id}` Chi subroute wrapping all entity handlers)
- Codebase — `backend/internal/domain/warehouse/item/handler.go`, `.../borrower/handler.go`, `.../loan/handler.go`, `.../category/handler.go`, `.../location/handler.go`, `.../container/handler.go`, `.../itemphoto/handler.go`
- npm registry — `npm view @tanstack/react-query version` → 5.99.0; `npm view @tanstack/react-query-devtools version` → 5.99.0 (2026-04-15)
- TanStack Query docs — https://tanstack.com/query/latest/docs/framework/react/quick-start
- TanStack Query docs — https://tanstack.com/query/latest/docs/framework/react/devtools
- MDN `FormData` — https://developer.mozilla.org/en-US/docs/Web/API/FormData

### Secondary (MEDIUM confidence)
- TK-dodo "Effective React Query Keys" — https://tkdodo.eu/blog/effective-react-query-keys (widely-cited community pattern, referenced verbatim by D-03)
- Vite env docs — https://vitejs.dev/guide/env-and-mode

### Tertiary (LOW confidence)
- None — every claim above is verified against the codebase or an official source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via npm registry today.
- Architecture: HIGH — existing app structure fully read; insertion points are mechanical.
- Pitfalls: HIGH — all six drawn from the codebase shape and well-documented TanStack/MDN behaviour.

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (30 days — TanStack Query v5 is stable; major changes unlikely within the window).
