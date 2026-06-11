# Frontend Audit — `frontend/` (Next.js App Router PWA)

Date: 2026-06-11. Scope: security, data layer, state/architecture, performance, plus sweeps for test quality, i18n coverage, dead code, and accessibility. `frontend2/` excluded by request. All paths relative to `frontend/`.

A note up front that frames many findings: **the codebase has two competing API access patterns** — the same-origin `/api` proxy (`lib/api/client.ts` + `app/api/[...path]/route.ts`) and ~15 places that fetch `process.env.NEXT_PUBLIC_API_URL` directly cross-origin with a Bearer token from localStorage. Several security and correctness issues below are consequences of this split.

## Top 5 priorities

1. **CSRF guard + path sanitation in `app/api/[...path]/route.ts`** (1.3, 1.4) — small change, biggest exposure.
2. **Purge SW caches + IndexedDB on logout, scope offline data to user/workspace** (1.5, 1.6, 1.11).
3. **Unify API base on `/api` proxy; remove token-in-URL SSE and localStorage token** (2.1, 1.2, 1.1).
4. **Fix refetch race + SSE refetch storm in `useInfiniteScroll`/items page** (2.2, 2.5).
5. **Persist resolved temp-IDs across sync runs and stop 409 hot-looping** in `SyncManager` (2.4).

---

## 1. Security

### 1.1 [HIGH] Auth token stored in localStorage (XSS-exfiltratable), used everywhere

`lib/api/client.ts:26-41`:

```ts
constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Load token from localStorage if available (client-side only)
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("auth_token");
    }
}
setToken(token: string | null) { ... localStorage.setItem("auth_token", token); ... }
```

The comment at `client.ts:58-59` says "cookies are now the primary auth mechanism" and `credentials: "include"` is sent, but the localStorage token is still written on every login (`lib/api/auth.ts:85`, `:92`, `:169`), attached as `Authorization: Bearer` on every request, read directly by `components/providers/theme-provider.tsx:11-13`, `lib/api/item-photos.ts:116`, `lib/api/importexport.ts`, and used by SSE (1.2). Any XSS gives full account takeover with a long-lived token.

Fix: since cookie auth exists and the `/api` proxy forwards cookies, drop localStorage token storage entirely (HttpOnly cookies only); replace `hasToken` gating in `auth-context.tsx:33` with a `/users/me` probe.

### 1.2 [HIGH] Bearer token leaked in SSE URL query string

`lib/contexts/sse-context.tsx:114-118`:

```ts
let url = `${process.env.NEXT_PUBLIC_API_URL}/workspaces/${currentWorkspace.id}/sse`;
const token = apiClient.getToken();
if (token) {
  url += `?token=${encodeURIComponent(token)}`;
}
```

The access token ends up in backend access logs, reverse-proxy logs, and any intermediary. Fix: connect via the same-origin `/api` proxy so the HttpOnly cookie authenticates the EventSource; delete the query-param fallback. (Note: the catch-all proxy buffers `res.arrayBuffer()`, which breaks streaming — an SSE pass-through must stream `res.body`.)

### 1.3 [HIGH] CSRF: cookie-authenticated mutating endpoints with no CSRF defense

`grep -rni csrf` across the frontend returns **zero hits**. All mutations go through `fetch(..., { credentials: "include" })` (`client.ts:71`, `sync-manager.ts:469`) and the server proxy `app/api/[...path]/route.ts` forwards *all* cookies to the backend for POST/PATCH/DELETE with **no Origin/Referer check and no CSRF token** (`route.ts:27-36`).

Fix: in the proxy route, reject mutating methods whose `Origin`/`Sec-Fetch-Site` is not same-origin; or implement a double-submit CSRF token. A ~10-line change covering every cookie-auth path at once. (Pairs with backend F17.)

### 1.4 [MEDIUM] `app/api/[...path]/route.ts` — unrestricted reverse proxy to the backend

```ts
const joinedPath = path.join("/");
const backendUrl = `${API_URL}/${joinedPath}${search}`;
```

- Not an open proxy / no SSRF to arbitrary hosts (host pinned to `INTERNAL_API_URL`) — good.
- But **no path allowlist**: every backend route reachable on the Docker network address becomes internet-exposed through the frontend origin.
- Path segments not sanitized — a literal `..` segment survives and is normalized by `fetch` (`/api/foo/../admin` → `${API_URL}/admin`).
- Forwards all cookies and `Authorization` blindly; does not forward `X-Forwarded-For`, so backend session IP logging records the Next server's IP.

Fix: reject path segments containing `..`/empty/encoded slashes; optionally prefix-allowlist (`auth/`, `users/`, `workspaces/`, `export/`, `import/`); forward `X-Forwarded-For`.

### 1.5 [MEDIUM] Service worker caches authenticated API responses; never purged on logout

`app/sw.ts:26-37`: every authed GET (items, inventory, borrowers, sessions, `/users/me`) lands in Cache Storage `api-cache` (NetworkFirst), and item photos go into `item-photos-cache` with **CacheFirst** (`sw.ts:41-52` — effectively permanent). `authApi.logout` (`lib/api/auth.ts:95-106`) clears only the token and `workspace_id`; nothing deletes SW caches. On a shared device, the next user can read the previous user's full inventory from Cache Storage.

Cache-poisoning nuance: the matcher is origin-agnostic (`https?:\/\/.*\/api\/.*`), and opaque responses (`status === 0`) are explicitly **allowed** into photo caches (`sw.ts:47`, `:61`).

Fix: on logout, `caches.delete("api-cache")` + photo caches + `deleteDB()`. Scope the matcher to `self.location.origin`. Drop the `status === 0` allowance.

### 1.6 [MEDIUM] IndexedDB retains full inventory + queued mutations + photo blobs after logout

`lib/db/offline-db.ts` defines stores `items, inventory, locations, containers, categories, borrowers, loans, mutationQueue, conflictLog, formDrafts, quickCapturePhotos` (with photo blobs) plus the SW-private `PhotoUploadQueue` DB (`app/sw.ts:324-342`). None are touched by `logout()`. Consequences:

- Sensitive data (serial numbers, insured items, borrower names) persists for the next browser user; `navigator.storage.persist()` is requested (`offline-db.ts:22-38`) so the browser won't evict it.
- Stores are **not workspace- or user-scoped** (keyPath `id` only). If user B logs in on the same browser, `useOfflineData` (`lib/hooks/use-offline-data.ts:81-91`) renders **user A's cached items** until fresh fetch overwrites, and `mutationQueue` entries queued by user A are **replayed under user B's cookies** by `SyncManager.processQueue()` — cross-account data injection.

Fix: call `deleteDB()` + delete `PhotoUploadQueue` in `logout()`; store owning `userId`/`workspaceId` in `syncMeta` and nuke the DB on mismatch at login.

### 1.7 [MEDIUM] Client-only route protection; no server enforcement

`proxy.ts` (Next 16's middleware file) is **only** next-intl. Auth gating lives solely in client components (`components/dashboard/dashboard-shell.tsx:43-47` `useEffect` redirect). The API enforces auth server-side, so normally an attacker only gets an empty shell — but combined with 1.5/1.6, an unauthenticated visitor on a shared device gets the dashboard shell **plus offline-cached data** with zero credential check.

Fix: check the `access_token` cookie in `proxy.ts` for `/{locale}/dashboard/*` and redirect to login; keep client check as UX fallback.

### 1.8 [MEDIUM] Photo proxy marks private images as publicly cacheable

`app/api/photos/[...path]/route.ts:52-57`:

```ts
return new NextResponse(body, {
  headers: {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
  },
});
```

Authenticated, workspace-private photos returned with `public, max-age=31536000` — shared/CDN/corporate caches may serve user A's photo to user B (URLs are guessable ID paths, no signature). Browser keeps them for a year after logout. Same `..` path-validation gap as 1.4.

Fix: `Cache-Control: private, max-age=...`; pass through backend `ETag`/`Last-Modified`.

### 1.9 [LOW] XSS surface — clean, with one caveat

- `dangerouslySetInnerHTML`: zero occurrences. User content rendered via JSX text nodes — auto-escaped.
- Photo URLs derived via `new URL(raw.url).pathname` → `/api/photos${pathname}` (`lib/api/item-photos.ts:21-29`) — `javascript:`/`data:` schemes can't survive. Caveat: the `catch { return backendUrl; }` fallback (`item-photos.ts:27`) returns the raw backend string when unparseable; return `undefined` instead.
- `sessionStorage` `oauth_return_to` → `router.replace(returnTo)` is same-origin-set and goes through Next's router — acceptable.

### 1.10 [LOW] `NEXT_PUBLIC_*` exposure — no secrets found

Only `NEXT_PUBLIC_API_URL` is referenced (non-secret). OAuth is code-exchange via backend; no client secret in bundle. `INTERNAL_API_URL` server-only. Clean.

### 1.11 [LOW] SW background photo-upload replay ignores auth context

`app/sw.ts:262-321`: `syncQueuedUploads()` replays queued POSTs with no `credentials` option (defaults `same-origin` — cross-origin uploads send no cookies and 401 forever, silently retrying), and never checks *who* is logged in (cross-user replay per 1.6). Also `self.addEventListener("online", ...)` on a ServiceWorkerGlobalScope rarely fires — the queue mostly only drains when a page is open.

---

## 2. Data Layer (`lib/api/`, `lib/sync/`, `lib/hooks/`)

### 2.1 [HIGH] Split-brain base URL: ~15 modules bypass the `/api` proxy, several break when `NEXT_PUBLIC_API_URL` is unset

`lib/api/client.ts` uses `/api` in the browser. Everything else hardcodes the env var, several **without fallback**, producing the literal string `"undefined/..."` when unset:

- `app/[locale]/(dashboard)/dashboard/items/page.tsx:539` — photo list fetch, no fallback.
- `lib/contexts/sse-context.tsx:114` — no fallback.
- `components/providers/theme-provider.tsx:14` and all 7 `components/settings/*-settings.tsx` preference PATCHes — no fallback.
- `lib/sync/sync-manager.ts:753`: `const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";` → offline mutations POST to `/workspaces/...` which the next-intl middleware rewrites (matcher excludes only `/api`), so **the entire offline sync queue silently fails** in proxy-only deployments.
- `lib/api/item-photos.ts`, `importexport.ts`, `workspace-backup.ts`, `repair-logs.ts`, `features/auth/components/social-login.tsx`, `components/settings/connected-accounts.tsx` — fall back to `http://localhost:8000`, i.e., cross-origin fetches depending on backend CORS + `SameSite=None` cookies, contradicting the proxy design stated in `client.ts:1-3`.

Fix: one exported `getApiBase()` (browser → `/api`, server → `INTERNAL_API_URL`) used by *every* fetch including `sync-manager.ts` and the SSE URL. Also collapses 1.2 and 1.5 origin-scoping.

### 2.2 [HIGH] `useInfiniteScroll.refetch` races: concurrent calls drop or duplicate pages

`lib/hooks/use-infinite-scroll.ts:195-203`:

```ts
const refetch = useCallback(async () => {
    const pagesToFetch = currentPage;
    setItems([]);
    for (let page = 1; page <= pagesToFetch; page++) {
      await fetchPage(page, true);
    }
}, [currentPage, fetchPage]);
```

Combined with `fetchPage`'s global guard (`:113-118` `if (isFetchingRef.current) return;`): a second `refetch` arriving while one is in flight has its `fetchPage` calls **silently no-op**, after it already did `setItems([])`. The items page calls `refetch()` from **every SSE event** (`items/page.tsx:612-626`) and from sync-completion (`:699`), so two near-simultaneous SSE events can leave the list empty, half-loaded, or duplicated. No AbortControllers anywhere in the data layer.

Fix: serialize refetches with an epoch counter (ignore stale-epoch responses); debounce SSE-triggered refetches (~300ms trailing). Better: apply SSE event payloads incrementally instead of refetching every loaded page sequentially (N pages × 50 = full re-download per event — a retry storm under bulk imports, where the backend emits an `item.created` per row).

### 2.3 [MEDIUM] `useOfflineData` writes state after unmount and can fight its own cache

`lib/hooks/use-offline-data.ts:93-108`: `fetchFreshData` does `setData/setIsStale/setError` without checking the `cancelled` flag (only checked *between* steps in `load`). Unmount mid-fetch → setState on unmounted component; workspace switch mid-fetch → previous workspace's data written into state **and** IndexedDB. `clearStore(store); putAll(store, fresh)` (`:96-97`) is not transactional — a crash between the two leaves the store empty. Also `fetchFn` is an effect dependency — callers passing inline closures re-trigger the whole effect each render; fragile undocumented contract.

### 2.4 [MEDIUM] Offline queue: idempotency keys good, but conflict/ordering gaps

Solid fundamentals (UUIDv7 `Idempotency-Key` header `sync-manager.ts:466`, FIFO ordering, Kahn topological sort for hierarchies, cascade failure, LWW + critical-field review in `conflict-resolver.ts`). Specific gaps:

- **Delete operations don't exist.** `buildApiUrl` only handles create→POST and update→PATCH (`sync-manager.ts:455`, `:756-760`). Offline deletes/archives aren't queueable — `handleArchive` (`items/page.tsx:963-979`) calls `itemsApi.archive` directly and just fails offline.
- **Critical conflicts hot-loop.** On a critical 409 the mutation resets to `"pending"` (`sync-manager.ts:629`) without incrementing `retries`; every queue pass (visibilitychange, online, any new mutation) re-sends it, logs a **duplicate conflictLog row each time** (`:632-640`), re-broadcasts `CONFLICT_NEEDS_REVIEW`. Needs a distinct `"needs-review"` status excluded from `getPendingMutations`.
- **Temp-ID resolution is per-run only.** `resolvedIds` lives inside one `processQueue` call (`:354`). If a parent create syncs in run 1 and the dependent child syncs in run 2, the temp ID is never rewritten → child permanently fails with a nonexistent UUID. Persist resolved IDs (e.g., in `syncMeta`).
- **Server-side conflict detection for item updates is effectively disabled.** `prepareSyncPayload` (`mutation-queue.ts:438-450`) only injects `updated_at` if `cachedUpdatedAt` was captured at queue time — but the items page never passes it (`items/page.tsx:921`, `use-offline-mutation.ts:114-121`); `enhanceMutationWithTimestamp` in `conflict-resolver.ts:435` exists but is never called.
- `shouldRetry` treats 401 as non-retryable → queued offline work needs manual retry after re-login.

### 2.5 [MEDIUM] Per-item photo N+1 fetch storm

`items/page.tsx:531-579` + effect at `:796-799`: every change of `sortedItems` fires `loadItemPhotos(visibleItemIds.slice(0,50))` → **50 parallel fetches**, one per item, no cache check (refetches IDs already in `itemPhotos`), no AbortController. Sorting or typing a search re-triggers all 50. Combined with SSE-induced refetches this is the biggest network hot spot.

Fix: backend bulk endpoint (or embed primary-photo URL in the item list response — `ListPrimaryByItemIDs` already exists backend-side); client: skip present IDs, abort on dep change.

### 2.6 [LOW] Error-handling inconsistency across the API layer

Three styles coexist: `apiClient.request` throwing with hard `window.location.href = "/login"` on 401 (`client.ts:76-84` — a background photo poll 401 yanks the user out of an unsaved form; `postForm` duplicates the block `:161-176`), raw `fetch` + ad-hoc checks (settings, importexport), and XHR with its own parser (`item-photos.ts:89-105`). Refresh-token retry is absent entirely despite the backend issuing one. Recommend one request wrapper with one 401 strategy (attempt refresh → then redirect).

---

## 3. State / Architecture

### 3.1 [HIGH] Giant client-side page components; `app/` is ~100% client-rendered

Verified line counts:

```
1828  dashboard/items/page.tsx
1771  dashboard/inventory/page.tsx
1380  dashboard/loans/page.tsx
1239  dashboard/containers/page.tsx
 994  dashboard/locations/page.tsx
 972  dashboard/borrowers/page.tsx
 968  dashboard/categories/page.tsx
```

Only 7 files under `app/` are server components — layouts and two trivial pages; **every dashboard page is `"use client"`** with all fetching in effects. `items/page.tsx` is one component owning: filters UI + state, saved filters, infinite scroll, virtualizer, SSE subscription, offline-mutation orchestration, optimistic state, photo loading, CSV import/export, bulk selection, keyboard shortcuts, a 240-line create/edit dialog, and the barcode scanner sheet — ~25 hooks in one closure. The 7 sibling pages are copy-paste variants of the same skeleton — a fix to e.g. the refetch race must be repeated 7×.

Fix (incremental): extract `ItemFormDialog`, `ItemsTable` (memoized rows), `useItemsPhotos`, SSE-refetch glue into shared modules; page becomes composition (~200 lines). A generic `EntityListPage` would deduplicate the 7 clones.

### 3.2 [MEDIUM] Context values rebuilt every render

`lib/contexts/auth-context.tsx:147-160`: context value object built without `useMemo` — every render of `AuthProvider` re-renders **all** consumers. Same in `SSEContext` (`sse-context.tsx:315-320`). Cheap fix: `useMemo`. Also `switchWorkspace` does `window.location.reload()` (`auth-context.tsx:124-131`) — combined with unscoped IndexedDB (1.6) it briefly shows the old workspace's cached entities after switching.

### 3.3 [MEDIUM] Client-side filtering/sorting over *partially loaded* server pages — wrong results

`items/page.tsx` fetches pages of 50 (`:590-604`) but applies search/category/brand/date filters (`:713-782`) and sorting client-side over only loaded pages. With 500 items, searching for an item on page 6 shows "No items found" until the user scrolls through 5 pages; column sort sorts only what's loaded; `totalItems` in the header (`:1125`) is the server total, contradicting the filtered view. Push search/sort to the server or fetch-all — currently an incoherent hybrid.

### 3.4–3.5 [LOW]

- Prop drilling contained; filter helpers typed `any` at `items/page.tsx:139-140`.
- `ItemsFilterControls` duplicates filter state locally (`items/page.tsx:149-152`) parallel to `useFilters` — clearing chips via `FilterBar` desyncs the popover checkboxes.

---

## 4. Performance

### 4.1 [MEDIUM] Recharts statically imported on the analytics page

`analytics/page.tsx:19` — recharts (+d3, ~100KB+ gz) in the page chunk. Wrap in `next/dynamic` with a skeleton, as already done correctly for `BarcodeScanner`/`PhotoUpload`/`CompactPhotoGrid` in `items/page.tsx:65-112`.

### 4.2 [MEDIUM] `next/image` configured but almost unused; thumbnails are raw `<img>`

`next.config.ts:25-38` sets up `images.remotePatterns`, 4 components use `next/image`, but the hottest path — list thumbnails — uses raw `<img>` (`items/page.tsx:1427`, `compact-photo-grid.tsx:75`, `quick-capture/page.tsx:531`, `photo-upload.tsx:549`, `repair-photo-upload.tsx:397/:542`, `inline-photo-capture.tsx:164`, `capture-photo-strip.tsx:45`, `lazy-image.tsx:66/:88`). The comment in `app/api/photos/route.ts:15` says the proxy exists so "next/image [can] optimize them as same-origin images" — never carried through. Also `package.json:91-93` puts `sharp` in `ignoreScripts` *and* `trustedDependencies` — verify sharp actually builds under bun, else `next/image` optimization silently degrades.

### 4.3–4.6 [LOW]

- Virtualization present on items page (`@tanstack/react-virtual`, correct usage); verify loans/containers/borrowers pages got the same treatment.
- Virtual rows not memoized; inline closures + IIFE per row (`items/page.tsx:1395-1440`) — extract memoized `<ItemRow>` to kill search-typing jank.
- Deps: **both `radix-ui` v1.4.3 monolith and 17 individual `@radix-ui/react-*` packages** — pick one to avoid duplicate primitives. `@types/papaparse` in `dependencies`. Two lockfiles (`bun.lock` + `package-lock.json`) — drift risk for Docker builds.
- `api-cache` has **no expiration plugin / maxEntries** — grows unboundedly with every distinct query-string URL. Add serwist `expiration: { maxEntries, maxAgeSeconds }` to all runtime caches.

---

## 5. Test Quality (vitest + Playwright)

- **27 unit test files.** Strong: `lib/sync/__tests__/sync-manager.test.ts` (1057 lines — locking, ordering, conflicts, topological sort), `use-offline-mutation.test.ts` (694 lines), `barcode-scanner.test.tsx` (485 lines), `csv-export.test.ts` (real edge cases). Weak: `lib/api/__tests__/items.test.ts` and similar only assert mock-was-called-with-URL — no behavior.
- **41 e2e spec files (7,392 lines)**, but heavy on presence-only assertions:
  - `expect(hasTable || hasEmpty).toBe(true)` patterns (`e2e/dashboard/items.spec.ts:18-21`) — tests visibility, not behavior.
  - **Conditional skips**: `if (initialCount > 0) {...}` in 10+ files (`approvals.spec.ts:61`) — tests silently pass when data is empty.
  - **20+ arbitrary `waitForTimeout(300-2000)`** calls (`offline-mutations.spec.ts:28`, `login.spec.ts:28,52`) — flake source; use event-based waits.
  - Offline specs Chromium-only (`test.skip(({browserName}) => browserName !== "chromium")`).
- **Missing e2e flows**: barcode scan → create item, conflict resolution, actual CSV import completion, approval/rejection action, photo upload, OAuth callback, settings changes, multi-user conflict.
- **Coverage thresholds commented out** (`vitest.config.ts:31-32` — "will be enforced after Phase 25").
- e2e auth setup hits the real backend with rate-limited auth endpoints (5/min) — CI flake risk documented but unhandled.

---

## 6. i18n

- **en.json: 1,083 keys. et.json: 933 (~150 missing). ru.json: 930 (~153 missing).** Missing clusters: `pendingChange.toast/banner`, `settings.account.*`, `dashboard.nav.groups.*`, `photos.gallery.view`. A few stale English-copy entries in both.
- **~45 files (~22% of components) contain hardcoded user-facing strings** bypassing i18n: toast messages (`items/page.tsx:894,955`, `loans/page.tsx:709,715,760`, `locations/page.tsx:449,560`, `borrowers/page.tsx:375,383`, `scan/page.tsx:110,121,158`), placeholders (`items/page.tsx:1144`, `locations/page.tsx:785,872`), aria-labels (`items/page.tsx:1317`, `header.tsx:125`), titles (`items/page.tsx:1813`, `analytics/page.tsx:228`).
- i18n infrastructure itself (routing, config, locales en/et/ru) is correctly set up — implementation is inconsistent, mainly in error/toast paths.

Recommendation: backfill the ~150 missing ET/RU keys; sweep hardcoded toasts/placeholders into message keys.

---

## 7. Dead Code / Duplication

- `components/pwa/install-banner.tsx` + `components/pwa/install-button.tsx` — exported but never imported (the active one is top-level `pwa-install-prompt.tsx`). Dead.
- **Two OAuth callback pages**: `app/[locale]/(auth)/callback/page.tsx` and `app/[locale]/(auth)/auth/callback/page.tsx` — backend redirects to `/auth/callback`, so one is likely dead. Consolidate.
- **Direct-fetch duplication**: 6 settings components + theme-provider + 3 import pages each re-implement fetch + auth header for `PATCH /users/me/preferences` etc. (see 2.1) — centralize.
- `e2e/scripts/generate-screenshots.ts` unused.
- Pet/cat mascot theming (`pets-hero.jpg`, `pet-mascots.tsx`, `paw-print.tsx`) is consistently used — intentional branding, not dead code.
- `eslint.config.mjs` — no disabled rules; clean.

---

## 8. Accessibility (quick pass)

- Click handlers are on proper interactive elements; dialogs all have `DialogTitle` (some `sr-only`, fine); login form validation signals with icons + text, not color-only. Mostly clean.
- Gaps: icon-only buttons with `title` attribute but no `aria-label` — `pending-changes-drawer.tsx:265-276` (Retry), `:280-291` (Cancel), `compact-photo-grid.tsx:81-93` (delete). `title` alone is not WCAG 2.1 AA sufficient.
- `e2e/accessibility/a11y.spec.ts` covers skip links, landmarks, focus trapping, labels, alt text, keyboard nav — good breadth. Missing: axe-core integration, automated contrast checks, ARIA live region testing.

---

## Checked and clean

- No `dangerouslySetInnerHTML`; JSX escaping throughout.
- No secrets in client bundle; OAuth code-exchange via backend.
- OAuth callback guards Strict-Mode double-execution; handles `error` param.
- Proxy host pinned server-side; `Set-Cookie` forwarding done correctly per-cookie.
- Mutation queue fundamentals (idempotency keys, backoff with jitter, TTL cleanup, retryable-status classification, topological sort, cascade failure) — well above average for a hand-rolled offline queue.
- SSE provider: single shared connection, capped backoff, visibility/online reconnect, callbacks in refs.
- Keyboard shortcuts respect input fields; next-intl wiring standard and correct for Next 16.
