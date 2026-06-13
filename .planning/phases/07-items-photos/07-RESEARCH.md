# Phase 7: Items + Photos - Research

**Researched:** 2026-06-13
**Domain:** React 19 + TanStack Query v5 CRUD feature over a Go/huma backend; client-side image pipeline; multipart upload; URL-driven list state with react-router 7
**Confidence:** HIGH (backend contracts read from source AND verified live; frontend2 + legacy structure read directly)

## Summary

Phase 7 builds the full items feature for `frontend2`: a paginated/filterable/sortable list, item detail with photo gallery + loan panels + labels, create/edit forms, archive/delete lifecycle, the photo pipeline (upload/gallery/lightbox/primary/caption/reorder/bulk/zip/dup-check), and the `lookupByBarcode` helper. Every backend contract needed is **already shipped** — this is a pure frontend integration phase. There are **zero new backend changes** and **zero new npm dependencies** required.

The backend item-list contract is narrower than the CONTEXT's filter wishlist: it supports `search`, `category_id`, `archived`, `sort` (name|sku|created_at|updated_at), `sort_dir`, `page`, `limit` — but there is **NO `location_id` filter** on `GET /items`. The list envelope is `{items, total, page, total_pages}` (plus a Huma-injected `$schema` field the frontend ignores). The photo endpoints split across **two route families**: Huma-typed JSON routes (list/get/set-primary/caption/reorder/delete) AND raw Chi handlers for multipart upload, file serving, and bulk ops (bulk-delete/bulk-caption/zip-download/check-duplicate). Backend accepts **only JPEG/PNG/WebP — NOT HEIC** (server-side validation rejects it); the client must constrain the accept-list and convert/reject HEIC before upload.

**Two load-bearing pitfalls dominate this phase:** (1) `PhotoResponse.url`/`thumbnail_url` and `ItemResponse.primary_photo_*_url` are **absolute `http://localhost:8080/...` URLs** (built from `cfg.BackendURL`) that do **NOT** carry the `/api` prefix and therefore **bypass the Vite proxy** — the frontend must rewrite them to relative `/api/workspaces/...` paths or `<img>` requests will hit the wrong origin / break auth. (2) Canvas `drawImage` resize (the legacy compression path) **drops EXIF orientation**, so portrait phone photos render sideways unless orientation is handled — and the legacy `image.ts` does NOT handle it, so the CONTEXT's "EXIF rotation" ask is an *addition*, not a port.

**Primary recommendation:** Build a typed `itemsApi`/`photosApi` module layer over the existing `api.ts` helpers (add a `put` and a blob-fetch helper — both currently missing). Port legacy `compressImage` (lib-free canvas) and ADD EXIF orientation handling. Drive all list state through `useSearchParams`. Rewrite absolute photo URLs to `/api`-relative at the API boundary. Port the lib-free `useBulkSelection`/`useSavedFilters` hooks. Re-add `lookupByBarcode` (404→null, `encodeURIComponent`) — it did NOT survive the frontend2 wipe.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Item list pagination/filter/sort | API / Backend | Browser (URL params) | Server owns `total`/`total_pages`; URL params mirror state for deep-link |
| Item search (FTS) | API / Backend | — | `search` covers name/SKU/barcode; barcode-exact needs the dedicated endpoint |
| Barcode exact lookup | API / Backend | Browser (404→null map) | `GET /items/by-barcode/{code}`; FTS does NOT index barcode |
| Photo storage + thumbnails | API / Backend | — | Server stores + generates thumbnails (async `thumbnail_status`) |
| Image resize/compress | Browser / Client | — | Canvas `toBlob` before upload; reduces bytes over the wire |
| EXIF orientation correction | Browser / Client | — | Canvas drops EXIF; client must bake rotation in before upload |
| Duplicate detection | API / Backend | Browser (warning dialog) | Server hashes + compares; client renders the proceed/cancel dialog |
| Zip download | API / Backend | Browser (blob → anchor) | Server streams `application/zip`; client triggers download |
| Bulk selection state | Browser / Client | — | Ephemeral UI state (`Set<id>`); no server round-trip |
| Saved filter presets | Browser / Client (localStorage) | — | Legacy stores presets in `localStorage`, not the DB |
| CSV export | API / Backend | Browser (blob → anchor) | `GET /export/item?format=csv` exists; client triggers download |
| List/detail cache invalidation | Browser / Client (SSE→TanStack) | API (SSE publish) | Phase 6 SSE map already routes `item`/`item_photo` events |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | v5 (installed) | Server-state cache, query keys, invalidation | Already the project SSOT; SSE map keys to it |
| `react-router` | v7 library mode (installed) | Routing + `useSearchParams` for URL-driven list state | Already wired; AP-1 library mode |
| `react-hook-form` | (verify installed) | Form state for create/edit | CONTEXT locks "RHF+zod" |
| `zod` | (verify installed) | Form validation schemas | CONTEXT locks "RHF+zod" |
| `@lingui/react` | (installed) | i18n `<Trans>`/`useLingui` | Existing pattern in DashboardPage |

**Version verification (run before planning the forms plan):**
```bash
cd frontend2 && grep -E '"(react-hook-form|zod|@hookform/resolvers)"' package.json
```
`[ASSUMED]` RHF + zod are installed — CONTEXT references them as locked and legacy used them (`itemCreateSchema`, `edit-item-wizard.tsx`), but they were NOT confirmed present in `frontend2/package.json` this session. **The planner must verify and add an install task if missing** (see Assumptions Log A1).

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| native `FormData` | browser | Multipart photo upload | Locked — no upload library (api.ts `postMultipart` already exists) |
| native `<canvas>` | browser | Resize/compress before upload | Locked — port lib-free `compressImage` |
| native `URL.createObjectURL` | browser | Pre-upload preview / blob download | Legacy `createImagePreview`/`revokeImagePreview` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canvas resize | `browser-image-compression` lib | Rejected — CONTEXT locks no-deps; legacy proved canvas suffices |
| Manual EXIF read | `exifr` / `blueimp-load-image` | Could simplify orientation, but violates no-deps lock; prefer `createImageBitmap(blob, { imageOrientation: "from-image" })` (native, zero-dep) |
| Client HEIC convert | `heic2any` lib | Rejected — no-deps lock; instead constrain accept-list and reject HEIC with a clear message (server rejects it anyway) |

**Installation:** No new packages required (pending RHF/zod verification above).

## Package Legitimacy Audit

No new external packages are installed by this phase. All functionality uses native browser APIs (`FormData`, `<canvas>`, `URL`, `createImageBitmap`) plus already-installed dependencies (`@tanstack/react-query`, `react-router`, `@lingui/*`, and — pending verification — `react-hook-form`/`zod`). **slopcheck N/A — zero new installs.**

If the RHF/zod verification turns up a missing dependency, the planner must gate that single install behind a `checkpoint:human-verify` task and run the Package Legitimacy Gate against it before adding it.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────┐
  URL (?q&category&        │  ItemsListPage                          │
   archived&sort&page) ───▶│   useSearchParams ──► query params      │
                          │   useQuery(["items", wsId, params])      │
                          │   useBulkSelection (Set<id>)             │
                          │   useSavedFilters (localStorage presets) │
                          └───────────┬─────────────────────────────┘
                                      │ get<ItemListResponse>
                                      ▼
   itemsApi / photosApi  ──►  api.ts (get/post/put/patch/del/postMultipart)
        │                          │  BASE_URL="/api"  credentials:"include"
        │                          ▼
        │                   Vite proxy /api → :8080 (REWRITE strips /api)
        │                          ▼
        │                   ┌──────────────────────────────────────┐
        │                   │ Backend (huma + chi)                 │
        │  list/CRUD ──────▶│  GET/POST/PATCH/DELETE /items        │ (huma JSON)
        │  by-barcode ─────▶│  GET /items/by-barcode/{code}       │
        │  labels ─────────▶│  GET/POST/DELETE /items/{id}/labels │
        │  loans (RO) ─────▶│  GET /items/{item_id}/loans         │
        │  photo JSON ─────▶│  list/primary/caption/reorder/del   │ (huma JSON)
        │  upload ─────────▶│  POST /items/{id}/photos  (chi/mp)  │ (raw chi)
        │  bulk/zip/dup ───▶│  bulk-delete/caption/download/dup   │ (raw chi)
        │  serve ──────────▶│  /items/{id}/photos/{pid}[/thumbnail]│ (raw chi)
        │  export ─────────▶│  GET /export/item?format=csv        │ (huma)
        └───────────────────┴──────────────────────────────────────┘
                                      ▲
   SSE (item.*, item_photo.*) ────────┘  Phase 6 invalidationMap → invalidate
                                          ["items"|"loans"], prefix-match
```

**Photo `<img>` URL flow (CRITICAL):** backend emits `url`/`thumbnail_url` as ABSOLUTE
`http://localhost:8080/workspaces/...`. The frontend MUST rewrite these to relative
`/api/workspaces/...` (or construct them itself from ids) so the request goes through the
Vite proxy + carries the auth cookie same-origin. See Pitfall 1.

### Recommended Project Structure
```
frontend2/src/
├── features/items/
│   ├── ItemsListPage.tsx        # list + filters + bulk bar + export
│   ├── ItemDetailPage.tsx       # fields + gallery + loan panels + labels + inventory STUB
│   ├── ItemFormPage.tsx         # /items/new + /items/:id/edit (RHF+zod)
│   ├── components/
│   │   ├── PhotoGallery.tsx     # grid + set-primary + reorder
│   │   ├── PhotoLightbox.tsx    # modal-stack ESC + arrow nav
│   │   ├── PhotoUpload.tsx      # FileInput → compress → dup-check → upload
│   │   ├── DuplicateWarningDialog.tsx
│   │   ├── LoanPanels.tsx       # active + history (read-only)
│   │   ├── ItemLabels.tsx       # attach/detach (read-only label list)
│   │   └── InventoryPanelStub.tsx  # placeholder slot for 7b
│   ├── hooks/
│   │   ├── useBulkSelection.ts  # ported lib-free
│   │   └── useSavedFilters.ts   # ported lib-free (localStorage)
│   └── schema.ts                # zod item create/edit schemas
├── lib/api/
│   ├── items.ts                 # itemsApi (incl. lookupByBarcode)
│   └── photos.ts                # photosApi (multipart, bulk, blob)
└── lib/utils/image.ts           # ported compressImage + ADDED EXIF orientation
```

### Pattern 1: URL-driven list state (react-router 7 `useSearchParams`)
**What:** The list's filter/sort/page state lives in the URL query string — single source of truth, deep-linkable, back-button-friendly.
**When to use:** ITEM-01 list page.
```tsx
// Source: react-router v7 useSearchParams [CITED: reactrouter.com/api/hooks/useSearchParams]
const [params, setParams] = useSearchParams();
const q = params.get("q") ?? "";
const category = params.get("category") ?? "";
const archived = params.get("archived") === "true";
const sort = params.get("sort") ?? "name";
const page = Number(params.get("page") ?? "1");

const queryParams = { search: q, category_id: category, archived, sort, page, limit: 25 };
const items = useQuery({
  queryKey: ["items", wsId, queryParams],   // Phase 6 contract: ["items", wsId, ...rest]
  queryFn: () => get<ItemListResponse>(`/workspaces/${wsId}/items?${toQS(queryParams)}`),
  enabled: !!wsId,
});

// Update one param without clobbering the rest; reset page on filter change:
function setParam(key: string, val: string) {
  setParams((prev) => {
    const next = new URLSearchParams(prev);
    val ? next.set(key, val) : next.delete(key);
    if (key !== "page") next.set("page", "1");
    return next;
  });
}
```
**NOTE:** backend has NO `location_id` filter on `/items`. CONTEXT's "filter chips (category/location/archived)" must DROP the location chip OR the planner accepts a stub that filters client-side only (not recommended — pagination breaks). Recommend: ship category + archived chips this phase; flag location as a deferred/open question.

### Pattern 2: Photo URL rewrite at the API boundary
**What:** Normalize the backend's absolute photo URLs to proxy-relative before they reach `<img>`.
```ts
// Backend emits http://localhost:8080/workspaces/... (cfg.BackendURL). Strip the
// origin so the browser hits /api/workspaces/... (Vite proxy + same-origin cookie).
function toProxyUrl(absolute: string): string {
  // robust: drop scheme+host, keep path; then prefix with /api
  try {
    const u = new URL(absolute);
    return `/api${u.pathname}${u.search}`;
  } catch {
    return absolute; // already relative
  }
}
```
Apply in `photosApi` mappers to `url`/`thumbnail_url`, and in `itemsApi` to
`primary_photo_thumbnail_url`/`primary_photo_url`. (Alternatively, ignore the backend
URLs entirely and construct `/api/workspaces/${wsId}/items/${itemId}/photos/${photoId}[/thumbnail]`
from ids — the route shape is stable per `router.go`.)

### Pattern 3: Multipart upload with client compression + dup-check
```ts
// 1. validate accept-list (JPEG/PNG/WebP — NOT HEIC), size ≤ 10MB
// 2. compressImage(file) → canvas resize + EXIF orientation (see image.ts)
// 3. POST /items/{id}/photos/check-duplicate (FormData field "photo")
// 4. if has_duplicates → DuplicateWarningDialog (proceed/cancel)
// 5. on proceed: postMultipart(`/workspaces/${wsId}/items/${id}/photos`, form)
const form = new FormData();
form.append("photo", compressedFile);          // field name MUST be "photo"
if (caption) form.append("caption", caption);   // optional FormValue
const photo = await postMultipart<PhotoResponse>(`/workspaces/${wsId}/items/${id}/photos`, form);
```

### Pattern 4: Blob download (zip + CSV) — anchor click
```ts
// api.ts has no blob helper — add one, OR fetch directly with credentials.
async function downloadBlob(endpoint: string, filename: string) {
  const res = await fetch(`/api${endpoint}`, { credentials: "include" });
  if (!res.ok) throw new HttpError(res.status, "download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
// zip:  downloadBlob(`/workspaces/${wsId}/items/${id}/photos/download`, `photos-${id}.zip`)
// zip selected: append ?ids=uuid1,uuid2
// csv:  downloadBlob(`/workspaces/${wsId}/export/item?format=csv`, `item_export.csv`)
```

### Anti-Patterns to Avoid
- **Rendering `<img src={photo.url}>` directly:** absolute backend URL bypasses the proxy → broken images / cross-origin cookie miss. Always rewrite (Pattern 2).
- **Canvas resize without EXIF handling:** portrait photos upload sideways. Use `createImageBitmap(blob, { imageOrientation: "from-image" })` before `drawImage`, or read EXIF orientation and rotate.
- **Adding an uppercase `ITEM` key to the SSE map:** the dispatcher lowercases — map keys are lowercase only (`item`, `item_photo`). Do not register new keys; `item`/`item_photo`/`loan` already route.
- **Sending cleared string fields as omitted on PATCH:** backend PATCH treats omitted (`undefined`) as UNCHANGED and `""` as CLEAR. To clear a field the form must send `""` explicitly (Pitfall 4).
- **Using `exact: true` invalidation:** Phase 6 contract relies on default prefix-match; `["items", wsId]` must invalidate `["items", wsId, {filters}]` and `["items", wsId, "detail", id]`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache invalidation on mutations | Manual refetch loops | `queryClient.invalidateQueries({ queryKey: ["items", wsId] })` | Prefix-match covers list+detail; SSE already wired |
| List state persistence | Custom state store | `useSearchParams` (URL) | Deep-link + back-button for free |
| Multipart boundary handling | Manual `Content-Type` | `postMultipart` (api.ts) | Browser sets boundary; api.ts already omits the header for FormData |
| Duplicate detection | Client-side hashing | `POST .../photos/check-duplicate` | Server owns perceptual hash + similarity |
| Thumbnail generation | Client thumbnails | Server `thumbnail_status` + `/thumbnail` URL | Async server pipeline; poll/await `complete` |
| Image orientation | Manual matrix math | `createImageBitmap(blob, {imageOrientation:"from-image"})` | Native, zero-dep, handles all 8 EXIF orientations |
| Bulk selection + saved filters | New invention | Port legacy `useBulkSelection`/`useSavedFilters` | Both are lib-free, already proven |

**Key insight:** Nearly everything photo/list-related is already solved server-side or by a native browser API. The only genuinely custom code is the thin `itemsApi`/`photosApi` mappers (including the URL rewrite) and the EXIF-aware compress.

## Common Pitfalls

### Pitfall 1: Absolute photo URLs bypass the Vite proxy (LOAD-BEARING)
**What goes wrong:** `<img>` requests go to `http://localhost:8080/workspaces/...` directly instead of `/api/...`, breaking in dev (cross-origin, no proxy rewrite) and risking the auth cookie not being sent.
**Why it happens:** `photoURLGenerator` in `router.go` builds URLs from `cfg.BackendURL` (default `http://localhost:8080`), NOT the frontend `/api` prefix. [VERIFIED: backend/internal/api/router.go:481-488, backend/internal/config/config.go:141]
**How to avoid:** Rewrite `url`/`thumbnail_url`/`primary_photo_*_url` to `/api/{path}` at the API mapper boundary (Pattern 2), or construct from ids.
**Warning signs:** Broken image icons in dev; network tab shows requests to `:8080` not `:5173`.

### Pitfall 2: HEIC is rejected server-side
**What goes wrong:** CONTEXT/REQUIREMENTS say "JPEG/PNG/HEIC", but the backend's `AllowedMimeTypes` is `{image/jpeg, image/png, image/webp}` — HEIC uploads return 400 "invalid file type: only JPEG, PNG, and WebP".
**Why it happens:** [VERIFIED: backend/internal/domain/warehouse/itemphoto/entity.go:42-45, handler.go:699]
**How to avoid:** Constrain the `<FileInput accept>` to `image/jpeg,image/png,image/webp`. If a HEIC file is selected, either reject with a clear message OR client-convert (no-dep conversion is impractical — recommend reject-with-message this phase, note HEIC convert as deferred). Update the visible accept-list copy to drop "HEIC".
**Warning signs:** iPhone-default-camera uploads 400ing.

### Pitfall 3: Canvas resize drops EXIF orientation
**What goes wrong:** Phone portrait photos appear rotated 90° after upload because canvas `drawImage` ignores EXIF orientation.
**Why it happens:** Legacy `compressImage` (frontend/lib/utils/image.ts:142) does a plain `ctx.drawImage` with no orientation handling. [VERIFIED: legacy image.ts read this session]
**How to avoid:** Use `createImageBitmap(file, { imageOrientation: "from-image" })` to get an already-oriented bitmap, then `drawImage` that. This is the ADDITION the CONTEXT asks for (it is NOT in the legacy port).
**Warning signs:** Uploaded photos sideways only for some source devices.

### Pitfall 4: PATCH merge semantics (omitted = unchanged, "" = clear)
**What goes wrong:** Edit form clears a field, sends `undefined`, backend keeps the old value — user thinks the clear failed.
**Why it happens:** Backend merges PATCH over current state: nil pointer = unchanged, `""` = NULL, for `*string` fields only. `*bool`/`*uuid` have no clear path. [VERIFIED: backend/internal/domain/warehouse/item/handler.go:46-68, 383-420]
**How to avoid:** Form submit must send `""` (not omit) for intentionally-cleared string fields. For category/purchased_from (uuid) clearing is impossible via PATCH — disable "clear" in the UI or note the limitation.
**Warning signs:** "I cleared the description but it came back."

### Pitfall 5: `lookupByBarcode` did NOT survive the frontend2 wipe
**What goes wrong:** Assuming the Phase 65 helper exists; it does not — `grep by-barcode|lookupByBarcode|itemsApi` in `frontend2/src` returns nothing. [VERIFIED: grep this session]
**Why it happens:** frontend2 was rebuilt from scratch; the helper lived in the wiped v2.2 tree (and never existed in legacy `frontend/`).
**How to avoid:** Re-add per the locked pattern: `GET /items/by-barcode/${encodeURIComponent(code)}`, map 404 → `null` (catch `HttpError` with `status === 404`), case-sensitive exact match (no client normalization). The backend integration test (`handler_integration_test.go`, `-tags=integration`) guards the server side — do NOT touch it; it stays green.
**Warning signs:** Phase 11 scan flow has no helper to call.

### Pitfall 6: api.ts is missing `put` and a blob helper
**What goes wrong:** Set-primary (`PUT /photos/{id}/primary`), caption (`PUT /photos/{id}/caption`), and reorder (`PUT /items/{id}/photos/order`) need a `put`; zip + CSV need a blob fetch. api.ts exports only get/post/postMultipart/patch/del. [VERIFIED: api.ts read this session]
**How to avoid:** Add `export function put<T>(endpoint, data)` mirroring `patch`, and a `downloadBlob` helper (Pattern 4). Keep the locked invariants (credentials:"include", 401 single-flight refresh, FormData header omission).
**Warning signs:** TypeScript error — no `put` export.

### Pitfall 7: `$schema` field in every huma list envelope
**What goes wrong:** Strict TS types or response assertions trip over the extra `$schema` key huma injects. [VERIFIED live: list envelope keys `['$schema','items','total','page','total_pages']`]
**How to avoid:** Type responses with the fields you read; don't assert exact key sets. Harmless to ignore.

## Runtime State Inventory

> N/A for greenfield feature work — this phase ADDS a frontend feature; it renames/migrates nothing. No stored data, live-service config, OS-registered state, secrets, or build artifacts carry an old identifier that this phase changes. **Verified: this is net-new `features/items/` code + a Sidebar `to` prop flip, not a rename.**

## Code Examples

### lookupByBarcode (re-add per locked pattern)
```ts
// Source: pattern locked in CONTEXT + STATE.md Phase 65; backend handler.go:192
import { get, HttpError } from "@/lib/api";
import type { Item } from "@/lib/types";

export async function lookupByBarcode(wsId: string, code: string): Promise<Item | null> {
  try {
    return await get<Item>(`/workspaces/${wsId}/items/by-barcode/${encodeURIComponent(code)}`);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return null;
    throw err;
  }
}
```

### EXIF-aware compress (port + addition)
```ts
// Source: port of legacy compressImage + ADDED createImageBitmap orientation
export async function compressImage(file: File, maxDim = 1600, quality = 0.85): Promise<File> {
  // createImageBitmap bakes EXIF orientation into the bitmap (native, zero-dep).
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas ctx");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob: Blob = await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), type, quality));
  return new File([blob], file.name, { type, lastModified: Date.now() });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual EXIF matrix / blueimp-load-image | `createImageBitmap(blob, {imageOrientation:"from-image"})` | Baseline since ~2022 (Chrome/FF/Safari) | Zero-dep orientation; verify Safari support if targeting older iOS |
| `react-router` data routers / loaders | Library mode + `useSearchParams` for list state | AP-1 (project decision) | List state in URL, no loader plumbing |
| localStorage Bearer tokens | cookie-JWT + `credentials:"include"` | v2.1 Pitfall #10 / AP-2 | Never send tokens in URLs; photo URLs must be same-origin |

**Deprecated/outdated:**
- HEIC in the accept-list (REQUIREMENTS/CONTEXT text): backend never accepted it. Update copy.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `react-hook-form` + `zod` are installed in frontend2 | Standard Stack | Forms plan needs an install task + slopcheck; LOW risk (legacy used them, CONTEXT locks them) |
| A2 | `createImageBitmap({imageOrientation})` is acceptable on the project's browser targets | Code Examples / Pitfall 3 | If targeting very old Safari (<15), need a fallback; MEDIUM — verify target matrix |
| A3 | No seeded item currently has a photo, so absolute-URL shape is inferred from `router.go` not a live response | Pitfall 1 | Shape is code-verified; risk only if config overrides `BACKEND_URL` in dev — LOW |

## Open Questions (RESOLVED)

<!-- RESOLVED 2026-06-13 (orchestrator): (1) Location filter chip DROPPED for v3.0 — no backend list param; category + archived chips only; Location stays as a display COLUMN; deliberate deviation noted (backend gap, revisit post-parity). (2) Active-loan panel = fetch /items/{id}/loans, partition client-side on is_active. (3) Photo reorder = move buttons (UI-SPEC concurs, dnd-kit declined). (A1) RHF 7.74 + zod 4.4.1 + @hookform/resolvers 5.2.2 CONFIRMED in package.json — no installs. ALSO BINDING: photo/primary URLs are absolute localhost:8080 — frontend MUST rewrite to /api-relative before <img>; EXIF via createImageBitmap({imageOrientation:'from-image'}) is an ADDITION not a port; HEIC NOT accepted server-side (jpeg/png/webp only — fix copy + accept list; REQUIREMENTS prose correction included in a plan task); api.ts gains additive put + blob helpers. -->

1. **`location_id` filter on the items list**
   - What we know: backend `GET /items` supports `search`, `category_id`, `archived`, `sort`, `sort_dir`, `page`, `limit` ONLY. No `location_id`. [VERIFIED: handler.go:683-692]
   - What's unclear: CONTEXT/ITEM-01 call for a location filter chip.
   - Recommendation: ship category + archived chips this phase; either drop the location chip or flag it as needing a backend `location_id` param (out of scope — frontend phase). Planner should pick "drop + note" to keep scope clean.

2. **Active-loan vs loan-history split on the detail page**
   - What we know: `GET /items/{item_id}/loans` returns ALL loans for the item (`{items:[...]}`); `LoanResponse` has `is_active`/`is_overdue`/`returned_at`. [VERIFIED: handler.go:485-562]
   - What's unclear: no separate "active loan" endpoint per item.
   - Recommendation: fetch once, partition client-side: active = `is_active === true`; history = the rest. Key `["loans", wsId, "by-item", itemId]`.

3. **Reorder UX (drag-drop) without a DnD lib**
   - What we know: `PUT /items/{id}/photos/order` takes an ordered `photo_ids[]` (all photos required, else 400). [VERIFIED: handler.go:170-202]
   - What's unclear: CONTEXT locks no new deps — native HTML5 drag-drop vs move-up/down buttons.
   - Recommendation: ship move-left/right (or up/down) buttons reordering the array, then PUT the full order. Native DnD is fragile cross-browser; buttons are a11y-safe and dep-free. Sketch 008 density rules apply.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Backend API (:8080) | All item/photo contracts | ✓ | live (seeder@test.local) | — |
| Postgres (:5432) | E2E + integration | ✓ | warehouse_dev | — |
| Vite dev (:5173) + `/api` rewrite | Frontend dev + E2E | ✓ | vite.config.ts:27-35 | — |
| `createImageBitmap` | EXIF compress | ✓ (modern browsers) | — | manual canvas (no orientation) — degraded |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** RHF/zod (A1) — if absent, add an install task.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (unit) + Playwright (E2E, chromium+firefox) |
| Config file | `frontend2/vitest.config.*` (verify) + `frontend2/playwright.config.ts` |
| Quick run command | `cd frontend2 && bun run test` (Vitest) |
| Full suite command | `cd frontend2 && bun run test` + `E2E_USER=seeder@test.local E2E_PASS=password123 bun run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ITEM-01 | List paginates/filters/sorts; URL params drive state | unit (MSW) | `bun run test src/features/items/ItemsListPage.test.tsx` | ❌ Wave 0 |
| ITEM-02 | Detail renders fields + gallery + loan panels | unit (MSW) | `bun run test src/features/items/ItemDetailPage.test.tsx` | ❌ Wave 0 |
| ITEM-03 | `/items/new?barcode=` prefills barcode | unit | same file | ❌ Wave 0 |
| ITEM-04 | Edit PATCH invalidates `["items", wsId]` | unit | `bun run test src/features/items/ItemFormPage.test.tsx` | ❌ Wave 0 |
| ITEM-05 | Archive hides; "show archived" reveals | E2E (live) | `bun run test:e2e items.spec.ts` | ❌ Wave 0 |
| ITEM-06 | Delete only when archived, type-to-confirm | unit + E2E | items spec | ❌ Wave 0 |
| ITEM-07 | Upload JPEG/PNG/WebP, ≤10MB, compress | unit (mock canvas) | photos test | ❌ Wave 0 |
| ITEM-08 | Gallery + lightbox arrow/ESC; set-primary; delete | unit | `PhotoGallery.test.tsx` / `PhotoLightbox.test.tsx` | ❌ Wave 0 |
| ITEM-09 | `lookupByBarcode` 404→null, encodeURIComponent | unit (MSW) | `lib/api/items.test.ts` | ❌ Wave 0 |
| ITEM-10 | `useShortcuts("items", [N|/|F])` registered | unit | ItemsListPage test | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend2 && bun run test <changed-file>` (< 30 s)
- **Per wave merge:** `cd frontend2 && bun run test` (full Vitest)
- **Phase gate:** full Vitest green + `bun run test:e2e items.spec.ts` green (live stack) before `/gsd:verify-work`. Backend `-tags=integration` item suite must stay green (G-65-01 guard).

### Wave 0 Gaps
- [ ] `src/lib/api/items.ts` + `items.test.ts` — covers ITEM-09 (404→null) and CRUD mappers
- [ ] `src/lib/api/photos.ts` — multipart + URL-rewrite mappers (Pitfall 1/2)
- [ ] MSW handlers for `/items`, `/items/:id`, `/items/:id/photos/list`, `/items/:id/loans`, `/labels`, `/items/by-barcode/:code` (append to `src/test/msw/handlers.ts`)
- [ ] `playwright/e2e/items.spec.ts` — create→list→detail→archive→filter→unarchive (CONTEXT specifics); photo upload via Playwright file fixture only if cheap, else unit+MSW
- [ ] Verify Vitest config + canvas/`createImageBitmap` mock strategy in jsdom (jsdom lacks canvas — mock `compressImage` or use a happy-dom/node-canvas shim)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | cookie-JWT via api.ts `credentials:"include"`; never tokens in URLs (photo URLs same-origin) |
| V3 Session Management | yes (inherited) | 401 single-flight refresh in api.ts |
| V4 Access Control | yes | Workspace scoping — every path is `/workspaces/{wsId}/...`; backend enforces tenant isolation (by-barcode `WHERE workspace_id=$1`) |
| V5 Input Validation | yes | zod schemas on forms; accept-list + 10MB cap on uploads (client + server) |
| V6 Cryptography | no | No client-side crypto; server owns photo hashing |

### Known Threat Patterns for React + Go/huma + multipart
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant item/photo access | Information Disclosure | Server `WHERE workspace_id=$1`; client always sends wsId — backend authoritative |
| Malicious upload (oversized/wrong-type) | DoS / Tampering | Client accept-list + size guard AND server `MaxFileSize`/`AllowedMimeTypes` (defense in depth) |
| XSS via user-supplied caption/filename | Tampering | React escapes by default; server sets `Content-Security-Policy: default-src 'none'` on served images |
| Zip-slip on download | Tampering | Server `sanitizeUploadFilename` already guards [VERIFIED: handler.go:489] |
| Stored-XSS image content | Tampering | Server serves with `Content-Security-Policy` + `Content-Disposition: inline; filename=` sanitized |

## Sources

### Primary (HIGH confidence)
- `backend/internal/domain/warehouse/item/handler.go` + `entity.go` — full item contract, list params, PATCH merge, label endpoints (read this session)
- `backend/internal/domain/warehouse/itemphoto/handler.go` + `dto.go` + `entity.go` — photo endpoints, MaxFileSize=10MB, AllowedMimeTypes {jpeg,png,webp}, field name "photo", bulk/zip/dup shapes (read this session)
- `backend/internal/api/router.go:446-552` — route mounting, `photoURLGenerator` (absolute BackendURL), importexport on wsAPI (read this session)
- `backend/internal/config/config.go:141` — `BACKEND_URL` default `http://localhost:8080`
- `backend/internal/domain/warehouse/loan/handler.go:485-562` — `GET /items/{item_id}/loans`, LoanResponse shape
- `backend/internal/domain/importexport/handler.go:114-159` — `GET /export/item?format=csv`, entity_type `item`
- `backend/internal/domain/warehouse/item/handler_integration_test.go` — G-65-01 guard (happy/404/cross-tenant)
- `frontend2/src/lib/api.ts` — helpers (get/post/postMultipart/patch/del; NO put/blob), locked invariants
- `frontend2/src/features/dashboard/DashboardPage.tsx` — canonical useQuery + useWorkspace + lingui pattern
- `frontend2/src/routes/index.tsx`, `Sidebar.tsx`, `vite.config.ts` — routing, disabled Items NavItem, `/api` rewrite
- `frontend2/docs/sse-invalidation-contract.md` — `["entityPlural", wsId, ...rest]` prefix rule; item/item_photo/loan rows already registered
- `frontend/lib/utils/image.ts`, `frontend/lib/api/items.ts`, `frontend/components/items/*`, `frontend/lib/hooks/use-{bulk-selection,saved-filters}.ts` — legacy STRUCTURE (lib-free compress, NO EXIF, localStorage presets)
- Live stack curls (2026-06-13): list envelope `{$schema,items,total,page,total_pages}`, total_pages computed, labels item shape

### Secondary (MEDIUM confidence)
- react-router v7 `useSearchParams` API [CITED: reactrouter.com/api/hooks/useSearchParams]

### Tertiary (LOW confidence)
- `createImageBitmap` browser-support breadth — verify against project target matrix (A2)

## Metadata

**Confidence breakdown:**
- Backend contracts: HIGH — read from source AND verified live
- Frontend integration points: HIGH — read frontend2 + legacy directly
- Image pipeline (EXIF): MEDIUM — native API is correct but browser-target breadth unverified
- RHF/zod availability: LOW — assumed installed, not confirmed (A1)

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (stable backend; revalidate if backend item/photo contracts change)
