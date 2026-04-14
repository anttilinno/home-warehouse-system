# Architecture Patterns — v2.1 Items, Loans & Scanning Integration

**Domain:** `/frontend2` feature-parity build-out (online-only, retro UI)
**Researched:** 2026-04-14
**Confidence:** HIGH (verified against live source)

## Executive Summary

`/frontend2` is a clean Vite + React 19 + React Router v7 SPA with a **feature-folder** layout under `src/features/<feature>/` and a centralized `src/lib/api.ts` fetch client. Four feature folders (`items/`, `loans/`, `scan/`, plus new `categories/` and `locations/`) already exist as stub pages. The v2.1 work is therefore **additive**: fill in the existing feature folders, extend `api.ts` with typed per-entity modules, add nested routes, and reuse the existing retro component library plus `@yudiel/react-qr-scanner`.

There is **no** IndexedDB layer, no SyncManager, no offline queue, no react-query — all server reads/writes go through `api.ts` directly. New feature code should follow that same thin pattern: local component state + `useEffect` fetch, or small custom hooks (e.g., `useItems()`), returning data from `api.ts` methods.

The scanner from `/frontend` (`components/scanner/barcode-scanner.tsx`) uses `@yudiel/react-qr-scanner` which is already a documented project dependency. It **cannot drop in as-is** — it imports `next/dynamic`, shadcn `@/components/ui/*`, and `lucide-react`, none of which exist in frontend2. It must be ported to retro components and a static `import()` wrapper.

## Existing Architecture (as of 2026-04-14)

### Layout

```
frontend2/src/
├── App.tsx                 # AuthProvider, ToastProvider, I18nProvider, router
├── main.tsx
├── routes/index.tsx        # AppRoutes -- <Routes> tree (NOT file-based)
├── lib/
│   ├── api.ts              # request/get/post/patch/del + HttpError + refresh
│   ├── types.ts            # User, Session, Workspace, DashboardStats...
│   └── i18n.ts
├── components/
│   ├── layout/             # AppShell, ErrorBoundaryPage, sidebar, topbar
│   └── retro/              # RetroButton, Panel, Input, Card, Dialog, Table,
│                           #  Tabs, Badge, Toast, HazardStripe (barrel index.ts)
├── features/
│   ├── auth/               # RequireAuth, AuthContext, AuthPage, callback
│   ├── dashboard/          # DashboardPage + StatPanel + ActivityFeed + cards
│   ├── items/              # stub ItemsPage
│   ├── loans/              # stub LoansPage
│   ├── scan/               # stub ScanPage
│   ├── settings/           # 8 subpages
│   └── setup/
├── pages/DemoPage.tsx
├── hooks/
└── styles/
```

### Router (important: NOT file-based)

Despite the prompt's claim, routing is **declarative `<Routes>/<Route>`** in `routes/index.tsx`. Authenticated routes are nested under `<Route element={<RequireAuth><AppShell/></RequireAuth>} errorElement={<ErrorBoundaryPage/>}>`. New routes must be registered here.

### API Client

`lib/api.ts` exports:
- `get<T>(path)`, `post<T>(path, body?)`, `patch<T>(path, body)`, `del<T>(path)`
- `HttpError` with `status` + `message` (use `err.status === 404/409/...`)
- Transparent 401 → `/auth/refresh` retry (single-flight `refreshPromise`)
- Always `credentials: "include"`, JSON-only (no multipart helper yet)
- BASE_URL = `/api` (Vite dev proxy)

There is **no** per-entity typed module yet — all entity types live in `lib/types.ts`. v2.1 should introduce `lib/api/<entity>.ts` modules that wrap `get/post/patch/del` with typed helpers.

### Retro Component Library

`components/retro/index.ts` exports: `RetroButton`, `RetroPanel`, `RetroInput`, `RetroCard`, `RetroDialog` (+ `RetroDialogHandle`), `RetroTable`, `RetroTabs`, `RetroBadge`, `HazardStripe`, `ToastProvider`, `useToast`.

**Gaps for v2.1** (not yet in library, will need new retro components):
- `RetroSelect` / dropdown (needed for category/location pickers)
- `RetroTextarea` (notes/description)
- `RetroCheckbox` / `RetroRadio`
- `RetroFileInput` / photo uploader (multipart — see "API Client Extensions" below)
- `RetroDatePicker` (loan due dates) — may use native `<input type="date">` styled retro
- `RetroConfirmDialog` (delete/archive confirmations) — wrap `RetroDialog`
- `RetroEmptyState`
- `RetroPagination`

## Backend API Surface (already shipped, Huma/OpenAPI)

All endpoints below are live. Note: the backend uses **Huma** on top of Chi, producing OpenAPI-described routes. Source: `backend/internal/domain/warehouse/*/handler.go`.

### Items (`/api/items`)
- `GET /items` — list (with filters)
- `GET /items/search` — fuzzy search
- `GET /items/{id}`
- `GET /items/by-category/{category_id}`
- `POST /items` — create
- `PATCH /items/{id}` — update
- `POST /items/{id}/archive` / `POST /items/{id}/restore`
- `GET /items/{id}/labels`, `POST /items/{id}/labels/{label_id}`, `DELETE /items/{id}/labels/{label_id}`

### Item Photos (`/api/items/{item_id}/photos`)
- `POST` (multipart upload), `GET .../download`, `GET .../{photo_id}`, `GET .../{photo_id}/thumbnail`
- `POST .../bulk-delete`, `POST .../bulk-caption`, `POST .../check-duplicate`

### Loans (`/api/loans`)
- `GET /loans`, `GET /loans/active`, `GET /loans/overdue`
- `GET /loans/{id}`
- `POST /loans` — create
- `POST /loans/{id}/return`
- `PATCH /loans/{id}/extend`
- `GET /borrowers/{borrower_id}/loans`
- `GET /inventory/{inventory_id}/loans`

### Borrowers (`/api/borrowers`)
- `GET`, `GET /{id}`, `POST`, `PATCH /{id}`, `DELETE /{id}`, `GET /search`

### Categories (`/api/categories`)
- `GET`, `GET /root`, `GET /{id}`, `GET /{id}/children`, `GET /{id}/breadcrumb`
- `POST`, `PATCH /{id}`, `DELETE /{id}`
- `POST /{id}/archive`, `POST /{id}/restore`

### Locations (`/api/locations`)
- `GET`, `GET /{id}`, `GET /{id}/breadcrumb`, `GET /search`
- `POST`, `PATCH /{id}`, `DELETE /{id}`
- `POST /{id}/archive`, `POST /{id}/restore`

### Containers (`/api/containers`)
- `GET`, `GET /{id}`, `GET /search`
- `POST`, `PATCH /{id}`, `DELETE /{id}`
- `POST /{id}/archive`, `POST /{id}/restore`

## Recommended Architecture for v2.1

### Component Boundaries

| Layer | Responsibility | Location |
|-------|---------------|----------|
| Route page | URL binding, data fetching orchestration, layout | `features/<x>/<X>Page.tsx` |
| Feature components | Entity-specific UI (ItemCard, LoanForm) | `features/<x>/*.tsx` |
| Entity hook | `useItems()`, `useItem(id)`, `useLoans()` — fetch+local state | `features/<x>/hooks.ts` |
| API module | Typed wrappers around `api.ts` primitives | `lib/api/<entity>.ts` |
| Entity types | Interfaces for domain entities | `lib/api/<entity>.ts` (co-located) |
| Retro primitives | Generic UI atoms | `components/retro/*` |

### Data Flow

```
Route page  ->  useEntity() hook  ->  lib/api/<entity>.ts  ->  api.ts  ->  /api/<path>
                              <-  setState(data)      <-  typed response
```

No react-query, no SWR. Simple `useEffect + useState` with AbortController, or a tiny shared `useFetch<T>()` hook if the team prefers.

### Patterns to Follow

**Pattern 1: Typed API module per entity**
```ts
// lib/api/items.ts
import { get, post, patch, del } from "@/lib/api";
export interface Item { id: string; name: string; sku: string; /* ... */ }
export interface ItemListResponse { items: Item[]; total: number; }
export const itemsApi = {
  list: (params?: ListParams) => get<ItemListResponse>(`/items${qs(params)}`),
  get:  (id: string) => get<{ item: Item }>(`/items/${id}`),
  create: (body: CreateItemBody) => post<{ item: Item }>("/items", body),
  update: (id: string, body: Partial<Item>) => patch<{ item: Item }>(`/items/${id}`, body),
  archive: (id: string) => post<void>(`/items/${id}/archive`),
};
```

**Pattern 2: Feature-scoped hook**
```ts
// features/items/hooks.ts
export function useItems(filters: Filters) {
  const [data, setData] = useState<ItemListResponse | null>(null);
  const [error, setError] = useState<HttpError | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const ac = new AbortController();
    itemsApi.list(filters).then(setData).catch(setError).finally(() => setLoading(false));
    return () => ac.abort();
  }, [JSON.stringify(filters)]);
  return { data, error, loading };
}
```

**Pattern 3: Nested routes for detail views**
```tsx
<Route path="items" element={<ItemsPage />} />
<Route path="items/new" element={<ItemEditPage mode="create" />} />
<Route path="items/:id" element={<ItemDetailPage />} />
<Route path="items/:id/edit" element={<ItemEditPage mode="edit" />} />
```

**Pattern 4: Multipart photo upload helper**
Add to `lib/api.ts`:
```ts
export async function postMultipart<T>(endpoint: string, form: FormData): Promise<T> {
  // same refresh logic, but no JSON Content-Type (browser sets boundary)
}
```

### Anti-Patterns to Avoid

- **Do not** re-introduce IndexedDB / SyncManager / offline queue (explicitly out of scope per PROJECT.md v2.1).
- **Do not** mix `api.ts` calls with Next.js primitives (`next/dynamic`, `next/image`) when porting components from `/frontend`.
- **Do not** place entity types in `lib/types.ts` — co-locate them in `lib/api/<entity>.ts` to keep `types.ts` for cross-cutting concerns.
- **Do not** add react-query yet — the current dashboard/settings pattern is simpler and the online-only scope makes caching overhead unjustified. Revisit if hook boilerplate proliferates.
- **Do not** gate the scanner route behind `<RequireAuth>` without ensuring the `<AppShell>` does not remount the scanner on every nav (iOS PWA camera permission resets — see Pitfall S-01).

## Barcode Scanner Integration Assessment

### Can `@yudiel/react-qr-scanner` drop in as-is?

**No — but the dependency itself is fine.** The library is listed as a v2.0 project decision, is active, ZXing-based, and React 19-compatible. It works in Vite with a standard dynamic `import()`.

The existing `frontend/components/scanner/barcode-scanner.tsx` has **three frontend1-specific coupling points** that prevent straight copy-paste:

1. `import dynamic from "next/dynamic"` — Next.js only. Replace with `React.lazy(() => import("@yudiel/react-qr-scanner").then(m => ({ default: m.Scanner })))` wrapped in `<Suspense>`.
2. `import { Button } from "@/components/ui/button"` and `@/components/ui/alert` — shadcn. Replace with `RetroButton` and a hazard-striped `RetroPanel` for errors.
3. `lucide-react` icons (`Flashlight`, `Camera`, etc.) — `/frontend2` does not currently declare lucide-react. Either add the dep (~40KB tree-shaken) or render text/ASCII glyphs consistent with the retro theme (`[◉]`, `[>>]`). **Recommendation:** add `lucide-react` — it's already in the v2.0 ecosystem and tree-shakes well.

### Install additions required

```bash
cd frontend2
npm install @yudiel/react-qr-scanner@^2.5.1 barcode-detector lucide-react
```

(`barcode-detector` is the polyfill imported by the existing `lib/scanner/` module in frontend1; port that module too.)

### iOS PWA camera permission — critical constraint (carried from v1.3)

The camera permission resets on page navigation in iOS PWAs. The v1.3 pattern mandates a **single-page scan flow** where the `Scanner` component stays mounted across states and uses its `paused` prop. For frontend2:

- `/scan` route renders a long-lived `ScanPage` with the `Scanner` always mounted.
- Post-scan "quick action menu" (View / Create / Loan / Move) must render **over** the scanner, not navigate away, until the user explicitly leaves.
- When navigating away, warn the user once that returning will re-prompt permission (match v1.3 UX).

### Related additions to port

- `frontend/lib/scanner/` — polyfill init, `SUPPORTED_FORMATS`, torch detection (small, pure TS — port verbatim minus Next imports).
- Optional: audio beep (AudioContext) and `navigator.vibrate` haptics — trivial to re-implement without ios-haptics, which targets iOS 17.4+ only and is optional for v2.1 (online-only scope).

## New Routes (add to `routes/index.tsx`)

| Path | Component | Notes |
|------|-----------|-------|
| `/items` | `ItemsPage` | Exists as stub — fill in list view |
| `/items/new` | `ItemEditPage` | mode="create" |
| `/items/:id` | `ItemDetailPage` | Detail + photos + loan history |
| `/items/:id/edit` | `ItemEditPage` | mode="edit" |
| `/loans` | `LoansPage` | Exists as stub — tabs: Active / Overdue / History |
| `/loans/new` | `LoanCreatePage` | Borrower + item picker |
| `/loans/:id` | `LoanDetailPage` | Return / extend actions |
| `/scan` | `ScanPage` | Exists as stub — single-page scan flow |
| `/borrowers` | `BorrowersPage` | New feature folder |
| `/borrowers/:id` | `BorrowerDetailPage` | Loan history |
| `/categories` | `CategoriesPage` | Tree view w/ children/breadcrumb endpoints |
| `/locations` | `LocationsPage` | Tree view w/ containers nested |
| `/locations/:id/containers` | `ContainersPage` | Optional nested or tab-in-location |

Register all under the authenticated `<AppShell>` block, after `settings/data`.

## New vs Modified Files

### Modified
- `src/routes/index.tsx` — add 12+ routes
- `src/lib/api.ts` — add `postMultipart` helper; optionally split into `lib/api/client.ts` + `lib/api/<entity>.ts`
- `src/lib/types.ts` — keep cross-cutting types only; remove anything entity-specific as modules are introduced
- `src/components/retro/index.ts` — export new primitives
- `src/components/layout/AppShell.tsx` — add sidebar links (Items, Loans, Scan, Borrowers, Categories, Locations)
- `src/features/items/ItemsPage.tsx`, `loans/LoansPage.tsx`, `scan/ScanPage.tsx` — replace stubs
- `frontend2/package.json` — add `@yudiel/react-qr-scanner`, `barcode-detector`, `lucide-react`

### New
- `src/lib/api/items.ts`, `loans.ts`, `borrowers.ts`, `categories.ts`, `locations.ts`, `containers.ts`, `itemPhotos.ts`
- `src/lib/scanner/` — ported polyfill + format config
- `src/components/retro/RetroSelect.tsx`, `RetroTextarea.tsx`, `RetroCheckbox.tsx`, `RetroFileInput.tsx`, `RetroEmptyState.tsx`, `RetroPagination.tsx`, `RetroConfirmDialog.tsx`
- `src/components/BarcodeScanner/BarcodeScanner.tsx` — retro-themed port of frontend1 scanner
- `src/features/items/` — `ItemsPage.tsx`, `ItemEditPage.tsx`, `ItemDetailPage.tsx`, `ItemCard.tsx`, `ItemForm.tsx`, `ItemPhotoGallery.tsx`, `hooks.ts`
- `src/features/loans/` — `LoansPage.tsx`, `LoanCreatePage.tsx`, `LoanDetailPage.tsx`, `LoanForm.tsx`, `LoanStatusBadge.tsx`, `hooks.ts`
- `src/features/borrowers/` — `BorrowersPage.tsx`, `BorrowerDetailPage.tsx`, `BorrowerForm.tsx`, `hooks.ts`
- `src/features/categories/` — `CategoriesPage.tsx`, `CategoryTree.tsx`, `CategoryForm.tsx`, `hooks.ts`
- `src/features/locations/` — `LocationsPage.tsx`, `LocationTree.tsx`, `LocationForm.tsx`, `ContainerForm.tsx`, `hooks.ts`
- `src/features/scan/` — expanded `ScanPage.tsx`, `ScanActionMenu.tsx`, `hooks.ts`

## Suggested Build Order (Dependency-Aware)

1. **Foundation (Phase 1)** — API client split + entity type modules (no UI). Deliverables: `lib/api/*.ts` with full CRUD for items/loans/borrowers/categories/locations/containers, typed. Zero route changes. Unit tests for each module using fetch mocks.

2. **Retro primitives extension (Phase 2)** — `RetroSelect`, `RetroTextarea`, `RetroCheckbox`, `RetroFileInput`, `RetroEmptyState`, `RetroPagination`, `RetroConfirmDialog`. Add demo page entries. No feature work yet; unblocks all forms.

3. **Categories & Locations (Phase 3)** — tree views + CRUD. These are **prerequisites for items** (items require category_id + location_id). Simpler domain (flat-ish CRUD), good shakedown for the patterns. Include containers as a sub-resource of locations.

4. **Borrowers (Phase 4)** — simple CRUD. Prerequisite for loan creation. Small, low-risk. Can run in parallel with Phase 3 if staffing allows.

5. **Items CRUD (Phase 5)** — list (filters, pagination, search), detail, create/edit, archive/restore. Depends on categories + locations. Defer photos to Phase 6.

6. **Item photos (Phase 6)** — multipart upload via `postMultipart`, gallery, thumbnails, delete. Requires items pages to exist.

7. **Loans (Phase 7)** — active/overdue/history tabs, create flow (borrower picker + item picker), return, extend. Depends on items + borrowers.

8. **Barcode scanner (Phase 8)** — install deps, port scanner component and polyfill, implement single-page `/scan` flow, post-scan action menu (View → item detail; Create → new item pre-filled with SKU; Loan → loan create with item pre-selected). Depends on items and loans.

9. **Polish & nav (Phase 9)** — sidebar links, empty states, error boundaries per route, i18n catalog extraction. Verification phase.

**Rationale:** categories/locations before items because items require them as FKs; borrowers before loans; items before item-photos (server couples photos to item_id); items + loans before scanner (scanner's post-scan actions depend on both). Retro primitives early because every subsequent form uses them.

## Scalability Considerations

| Concern | Approach |
|---------|----------|
| Items list at 10k+ rows | Server-side pagination (backend `/items` already supports it); client uses `RetroPagination`. Avoid virtualization in v2.1. |
| Loan list growth | Filter by tab (active/overdue) — bounded by real-world loan counts (< few hundred). |
| Photo upload size | Rely on backend image processor (v1.2 shipped async thumbnails); client just POSTs. |
| Category tree depth | Use `/categories/{id}/children` lazy expansion rather than full tree fetch. |

## Pitfalls Flagged

- **S-01 — iOS PWA camera remount**: scanner must stay mounted. Single-page scan flow is non-negotiable (validated in v1.3).
- **S-02 — Multipart + JWT refresh**: the current `request<T>` sets `Content-Type: application/json` unconditionally. `postMultipart` must omit it so the browser can set the boundary. Also must replicate the 401 refresh path.
- **S-03 — HttpError status handling**: feature hooks must branch on `err.status` (404 → not-found UI, 409 → concurrency conflict UI, 422 → validation). No generic "something went wrong" toasts.
- **S-04 — Lucide bundle**: use named imports (`import { Camera } from "lucide-react"`) and rely on Vite tree-shaking; verify size in production build.
- **S-05 — Nested route errorElement**: `ErrorBoundaryPage` is attached at the AppShell level; per-feature routes should throw typed errors or provide their own boundaries for better UX.

## Sources

- `frontend2/src/lib/api.ts`, `routes/index.tsx`, `components/retro/index.ts`, `features/*/`, `lib/types.ts`, `package.json` (read 2026-04-14)
- Backend handlers: `backend/internal/domain/warehouse/{item,loan,borrower,category,location,container,itemphoto}/handler.go` (Huma/Chi routes verified)
- `frontend/components/scanner/barcode-scanner.tsx` and `frontend/package.json` (reference scanner, @yudiel/react-qr-scanner ^2.5.1)
- `.planning/PROJECT.md` v2.1 scope and key decisions (HIGH confidence — project-owned doc)
