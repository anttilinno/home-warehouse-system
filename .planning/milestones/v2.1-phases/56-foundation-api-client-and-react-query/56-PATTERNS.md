# Phase 56: Foundation — API Client & React Query - Pattern Map

**Mapped:** 2026-04-15
**Files analyzed:** 13 (11 new, 2 modified)
**Analogs found:** 11 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend2/src/lib/api.ts` (MODIFIED) | utility (HTTP client) | request-response | self (extend) | self |
| `frontend2/src/lib/queryClient.ts` | config (singleton) | — | `frontend2/src/lib/i18n.ts` | role-match |
| `frontend2/src/lib/api/items.ts` | api-module | CRUD + list-params | `frontend2/src/lib/api.ts` (helpers) + `features/dashboard/DashboardPage.tsx:29` (usage) | partial |
| `frontend2/src/lib/api/itemPhotos.ts` | api-module | file-I/O (multipart) + CRUD | `frontend2/src/lib/api/items.ts` (sibling, this phase) | role-match |
| `frontend2/src/lib/api/loans.ts` | api-module | CRUD | `frontend2/src/lib/api/items.ts` (sibling) | exact |
| `frontend2/src/lib/api/borrowers.ts` | api-module | CRUD | `frontend2/src/lib/api/items.ts` (sibling) | exact |
| `frontend2/src/lib/api/categories.ts` | api-module | CRUD (tree) | `frontend2/src/lib/api/items.ts` (sibling) | exact |
| `frontend2/src/lib/api/locations.ts` | api-module | CRUD | `frontend2/src/lib/api/items.ts` (sibling) | exact |
| `frontend2/src/lib/api/containers.ts` | api-module | CRUD | `frontend2/src/lib/api/items.ts` (sibling) | exact |
| `frontend2/src/lib/api/index.ts` (optional) | barrel | — | none | no analog |
| `frontend2/src/App.tsx` (MODIFIED) | provider wiring | — | self | self |
| `frontend2/src/pages/ApiDemoPage.tsx` | page component | request-response | `frontend2/src/features/dashboard/DashboardPage.tsx` | exact |
| `frontend2/src/routes/index.tsx` (MODIFIED) | route config | — | self (`/demo` route at line 51) | self |
| `scripts/check-forbidden-imports.mjs` | build-tier script | batch (file scan) | none in repo | no analog |

## Pattern Assignments

### `frontend2/src/lib/api.ts` — add `postMultipart<T>` (MODIFIED, role: utility, request-response)

**Analog:** self — mirror the existing `post()` helper at lines 111-116 while routing through `request()` after it is taught to detect `FormData`.

**Existing helper shape** (lines 107-127):
```typescript
export function get<T>(endpoint: string): Promise<T> {
  return request<T>(endpoint, { method: "GET" });
}

export function post<T>(endpoint: string, data?: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
}

export function patch<T>(endpoint: string, data: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function del<T = void>(endpoint: string): Promise<T> {
  return request<T>(endpoint, { method: "DELETE" });
}
```

**Required change inside `request()`** (lines 67-74) — strip the default `Content-Type` when body is `FormData` so the browser can set its multipart boundary:
```typescript
const isFormData = options.body instanceof FormData;
const headers: Record<string, string> = {
  ...(isFormData ? {} : { "Content-Type": "application/json" }),
  ...(options.headers as Record<string, string>),
};
```

**New helper to add** (sibling to `post`):
```typescript
export function postMultipart<T>(endpoint: string, form: FormData): Promise<T> {
  return request<T>(endpoint, { method: "POST", body: form });
}
```

The 401→refresh retry path at lines 82-101 is inherited automatically; do not duplicate it.

---

### `frontend2/src/lib/queryClient.ts` (NEW, role: config, singleton)

**Analog:** `frontend2/src/lib/i18n.ts` — a module-level singleton exported by name, constructed with configuration options. Match that shape.

**Pattern to copy:** named const export, no class wrapper, no default export.

**Core pattern** (RESEARCH.md Pattern 1):
```typescript
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});
```

---

### `frontend2/src/lib/api/items.ts` (NEW, role: api-module, CRUD + pagination) — CANONICAL EXAMPLE

**Analog:** `frontend2/src/lib/api.ts` (for delegation pattern) + `AuthContext.tsx:43-46` (for URL shape with workspace).

**Imports pattern** (follow `AuthContext.tsx:9` — `@/` alias, typed destructured helpers):
```typescript
import { get, post, patch, del } from "@/lib/api";
```

**URL construction pattern** (mirrors `AuthContext.tsx:46` and `DashboardPage.tsx:29`):
```typescript
// AuthContext.tsx:46
const wsRes = await get<WorkspaceListResponse>("/workspaces");

// DashboardPage.tsx:29
get<DashboardStats>(`/workspaces/${workspaceId}/analytics/dashboard`)
```
Apply as: `const base = (wsId: string) => \`/workspaces/${wsId}/items\`;`

**Core CRUD pattern** (RESEARCH.md lines 399+; delegates to `lib/api.ts` helpers, keeps query-string building local):
```typescript
export const itemsApi = {
  list: (wsId: string, params: ItemListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.page)  qs.set("page",  String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.needs_review != null) qs.set("needs_review", String(params.needs_review));
    const suffix = qs.toString() ? `?${qs}` : "";
    return get<ItemListResponse>(`${base(wsId)}${suffix}`);
  },
  get:    (wsId: string, id: string)                  => get<Item>(`${base(wsId)}/${id}`),
  create: (wsId: string, input: CreateItemInput)      => post<Item>(base(wsId), input),
  update: (wsId: string, id: string, input: UpdateItemInput) => patch<Item>(`${base(wsId)}/${id}`, input),
  archive:(wsId: string, id: string)                  => post<void>(`${base(wsId)}/${id}/archive`),
  restore:(wsId: string, id: string)                  => post<void>(`${base(wsId)}/${id}/restore`),
};
```

**Type co-location** (per D-02 — types live in the same file; see existing `lib/types.ts` shape at lines 38-54 for field-naming conventions: snake_case preserved from backend, ISO strings for timestamps):
```typescript
export interface Item {
  id: string;
  workspace_id: string;
  sku: string;
  name: string;
  description?: string | null;
  category_id?: string | null;
  created_at: string;
  updated_at: string;
}
export interface ItemListResponse { items: Item[]; total: number; page: number; total_pages: number; }
export interface ItemListParams { page?: number; limit?: number; needs_review?: boolean; }
export interface CreateItemInput { /* mirror backend */ }
export interface UpdateItemInput { /* mirror backend */ }
```

**Query-key factory** (RESEARCH.md — TK-dodo pattern locked by D-03):
```typescript
export const itemKeys = {
  all: ["items"] as const,
  lists: () => [...itemKeys.all, "list"] as const,
  list: (params: ItemListParams) => [...itemKeys.lists(), params] as const,
  details: () => [...itemKeys.all, "detail"] as const,
  detail: (id: string) => [...itemKeys.details(), id] as const,
};
```

**Error handling:** None at this layer. `request()` in `lib/api.ts:103` already throws `HttpError`. Entity modules propagate.

---

### `frontend2/src/lib/api/itemPhotos.ts` (NEW, role: api-module, file-I/O)

**Analog:** `items.ts` (sibling, above) for CRUD + `lib/api.ts` `postMultipart` for upload.

**Special pattern — multipart upload** (target: `POST /items/{item_id}/photos` Chi handler, 10 MB max, per RESEARCH.md endpoint map):
```typescript
import { get, del, postMultipart } from "@/lib/api";

export const itemPhotosApi = {
  listForItem: (wsId: string, itemId: string) =>
    get<ItemPhoto[]>(`/workspaces/${wsId}/items/${itemId}/photos/list`),
  get:    (wsId: string, photoId: string) => get<ItemPhoto>(`/workspaces/${wsId}/photos/${photoId}`),
  upload: (wsId: string, itemId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return postMultipart<ItemPhoto>(`/workspaces/${wsId}/items/${itemId}/photos`, form);
  },
  remove: (wsId: string, photoId: string) => del(`/workspaces/${wsId}/photos/${photoId}`),
};
```

All other entity modules (`loans.ts`, `borrowers.ts`, `categories.ts`, `locations.ts`, `containers.ts`) copy `items.ts` structurally and swap URL segments per the RESEARCH.md "Backend Endpoint Map" table.

---

### `frontend2/src/App.tsx` (MODIFIED, role: provider wiring)

**Analog:** self — extend the existing provider stack at lines 23-33.

**Existing provider nesting** (lines 23-33):
```tsx
return (
  <I18nProvider i18n={i18n}>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </I18nProvider>
);
```

**Insertion point:** Wrap `AuthProvider` with `QueryClientProvider` (AuthContext consumes nothing from Query, but downstream hooks need Query above Auth consumers). Lazy-mount Devtools as a sibling under `import.meta.env.DEV`:
```tsx
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
```

`DevtoolsLazy` uses `React.lazy` + `Suspense` (RESEARCH.md Pattern 2) — no existing analog in this repo.

---

### `frontend2/src/pages/ApiDemoPage.tsx` (NEW, role: page component, request-response)

**Analog:** `frontend2/src/features/dashboard/DashboardPage.tsx` — same shape: reads `workspaceId` from `useAuth()`, guards with `!workspaceId`, renders loading/success/error states, uses retro components, all user-visible strings via `useLingui().t`.

**Imports pattern** (copy DashboardPage.tsx:1-9):
```typescript
import { useLingui } from "@lingui/react/macro";
import { useAuth } from "@/features/auth/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { itemsApi, itemKeys } from "@/lib/api/items";
import { RetroPanel } from "@/components/retro";
```

**Auth/guard pattern** (copy DashboardPage.tsx:13-22):
```typescript
const { workspaceId, isLoading } = useAuth();
if (isLoading) return null;
```

**Core pattern** — swap DashboardPage.tsx's `useEffect + get()` at lines 25-40 for `useQuery`:
```typescript
const query = useQuery({
  queryKey: itemKeys.list({ page: 1, limit: 10 }),
  queryFn: () => itemsApi.list(workspaceId!, { page: 1, limit: 10 }),
  enabled: !!workspaceId,
});
if (query.isPending) return <LoadingPanel />;
if (query.isError)   return <ErrorPanel onRetry={() => query.refetch()} error={query.error} />;
return <ItemListPanel items={query.data.items} />;
```

**Styling pattern** (copy DashboardPage.tsx:45-66 — `p-lg flex flex-col gap-xl`, retro panels, no new design system elements).

---

### `frontend2/src/routes/index.tsx` (MODIFIED, role: route config)

**Analog:** self — the `/demo` route at line 51 is the exact pattern for a public, no-auth smoke page.

**Existing pattern** (line 51):
```tsx
<Route path="/demo" element={<DemoPage />} />
```

**Insertion point:** Add sibling route beside `/demo` in the "Public routes" block (lines 48-51):
```tsx
<Route path="/api-demo" element={<ApiDemoPage />} />
```

Import at top mirrors line 6 (`import { DemoPage } from "@/pages/DemoPage";`).

---

### `scripts/check-forbidden-imports.mjs` (NEW, role: build-tier script)

**No analog** — no `scripts/` directory exists in the repo; no `.github/workflows/` either (verified by `ls`). Use RESEARCH.md Pattern 5 verbatim.

**Wiring:** add to `frontend2/package.json`:
```json
"scripts": {
  "lint:imports": "node ../scripts/check-forbidden-imports.mjs",
  "prebuild": "bun run lint:imports"
}
```

Planner should decide script location (`scripts/` at repo root vs `frontend2/scripts/`) — recommend repo root so future backend guards can live alongside.

## Shared Patterns

### Path Aliases & Imports
**Source:** any current file — every file uses `@/` for `frontend2/src/`.
**Apply to:** all new files in `frontend2/src/**`.
```typescript
import { get, post, patch, del } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
```

### User-Visible Strings
**Source:** `frontend2/src/routes/index.tsx:24` and `features/dashboard/DashboardPage.tsx:12,49`.
**Apply to:** `ApiDemoPage.tsx` only (API modules have no user-visible strings).
```typescript
const { t } = useLingui();
// ...
<h1>{t`API CLIENT DIAGNOSTIC`}</h1>
```

### HTTP Error Propagation
**Source:** `frontend2/src/lib/api.ts:5-13` (HttpError class) and `AuthContext.tsx:59` (typed `instanceof HttpError` branch).
**Apply to:** any consumer of the new API modules that needs to branch on status.
```typescript
if (err instanceof HttpError && (err.status === 401 || err.status === 403)) { /* ... */ }
```

### Workspace-scoped URLs
**Source:** `AuthContext.tsx:46` and `DashboardPage.tsx:29`.
**Apply to:** every entity API module.
```typescript
// Template: /workspaces/${wsId}/<entity>[/<id>[/<action>]]
const base = (wsId: string) => `/workspaces/${wsId}/items`;
```

### Workspace Guard in Components
**Source:** `DashboardPage.tsx:13-22, 42-43`.
**Apply to:** `ApiDemoPage.tsx`.
```typescript
const { workspaceId, isLoading } = useAuth();
if (isLoading) return null;
if (!workspaceId) return <EmptyOrExplanatoryPanel />;
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `frontend2/src/lib/api/index.ts` | barrel | — | No existing barrel files under `lib/`; Claude's discretion (D-02). If created, use trivial re-exports. |
| `scripts/check-forbidden-imports.mjs` | build-tier script | batch file scan | No existing `scripts/` dir or CI workflows; use RESEARCH.md Pattern 5 verbatim. |
| `DevtoolsLazy` component (inside `App.tsx` or its own file) | lazy-loaded provider | — | No existing `React.lazy` usage in the codebase; use RESEARCH.md Pattern 2. |

## Metadata

**Analog search scope:** `frontend2/src/lib/**`, `frontend2/src/features/**`, `frontend2/src/pages/**`, `frontend2/src/routes/**`, repo-root `scripts/`, `.github/workflows/`.
**Files scanned:** ~20 (targeted reads of api.ts, App.tsx, routes/index.tsx, types.ts, AuthContext.tsx, DashboardPage.tsx, DemoPage.tsx; directory listings for auth/, dashboard/, items/, lib/, pages/).
**Pattern extraction date:** 2026-04-15
