# Offline PWA v2 — Gap-Closure Plan (detailed, execution-ready)

Status: in-progress (2026-07-04). Builds on branch `feat/offline-first-pwa`
(commits `7f3544fb` frontend + `b50806b8` backend idempotency). Every phase is
independently shippable, ordered by field-use value. Phases A/B/D/E are
execution-ready. Phase C's premise changed on code inspection — see the
**CORRECTION** in that section; it is HELD pending a decision.

## What already ships (do NOT rebuild)

- **App shell offline**: `vite-plugin-pwa` in `frontend/vite.config.ts` —
  precache (JS/CSS/HTML/icons) + navigation fallback, OAuth paths denylisted.
- **Data offline**: TanStack Query cache persisted to IndexedDB
  (`src/lib/offline/persister.ts`, `PersistQueryClientProvider` in
  `src/App.tsx`, maxAge 7d, buster `"v1"`, logout purges).
- **Offline creates** for item/container/location:
  `src/lib/offline/mutationDefaults.ts` (keyed defaults, serial
  `scope:{id:"offline-writes"}` FIFO, Idempotency-Key header), client-generated
  final `short_code` (`shortCode.ts`), optimistic list insert in the hooks
  (`useItemFormMutations.ts`, `useContainerMutations.ts`,
  `useLocationMutations.ts`).
- **Backend dedup**: migration 008 `warehouse.idempotency_keys`; the three
  create services check-then-store; integration-tested.
- **Reconnect**: `useResumeOnReconnect.ts` — session probe via `["workspaces"]`
  fetch, then `resumePausedMutations()`; re-login resume in
  Login/Callback/Register; sync toast; pending badge; scan OFFLINE banner.

## Constraints (carry into every phase)

- Mutation defaults are the ONLY code that runs on a post-reload replay —
  hooks' onMutate/onError/onSuccess do NOT fire. Anything a replay needs must
  live in `registerMutationDefaults`.
- `short_code` is printed on physical labels → final at creation, never
  remapped. Server `id` is the only temp identifier.
- Involuntary auth expiry must never drop the queue; only deliberate logout
  purges.
- Frontend gates (must pass before "done"): `bun run format:check`,
  `bunx biome lint --diagnostic-level=error`, `bun run typecheck` (or `tsc`),
  `bun run lint:complexity` (≤15), `bun run lint:dup`, `bun run lint:dead`
  (knip). Backend: `golangci-lint run --new-from-merge-base=origin/master`.
- Vitest has `fake-indexeddb` in `src/test/setup.ts`. Toast engine is sonner;
  `retroToast` (`@/components/retro`) is callable outside React components.

## Verified code facts (use these exact shapes)

- `retroToast` re-exports sonner's `toast` from
  `src/components/retro/feedback/retroToast.ts`, re-exported through
  `@/components/retro`. `.error(msg, opts?)`, `.success(msg, {id}?)`,
  `.loading(msg)`. Importable in non-React modules.
- `i18n` singleton: `import { i18n } from "@/lib/i18n"`. For a marked string in
  a non-component module use the Lingui macro:
  `import { msg } from "@lingui/core/macro"; i18n._(msg\`...\`)`. If the macro
  fights extraction/tsc, fall back to a plain English string and mark it
  `// ponytail: rarely-seen replay-failure toast, en-only for v2`.
- Item type (`src/lib/types.ts:158`): has `id`, `short_code` (required),
  `barcode?`, `name`, `workspace_id`, timestamps.
- List cache shape is `ItemListResponse` = `{ items: Item[]; total; page; … }`
  keyed under `["items", wsId, params]` (prefix `["items", wsId]`).
- `itemsApi.lookupByBarcode(wsId, code)` (`src/lib/api/items.ts:98`) is the
  ONLY online barcode path and is **items-only** (404 → null). Offline local
  lookup mirrors that scope: items only, no containers/locations in v2.
- Scan flow: `ScanPage.tsx` → `useScanResolve.ts` owns a
  `useQuery(["item-by-barcode", wsId, code])`. Default `networkMode:"online"`
  means offline the queryFn NEVER runs → `status:"pending"`,
  `fetchStatus:"paused"`. `bannerStatus()` in `ScanPage.tsx` maps that to
  `"offline"`. Banner + `QuickActionMenu` both read `lookup.data`.
- `ScanResultBanner` (`src/components/scan/ScanResultBanner.tsx`) status union:
  `"loading" | "match" | "not-found" | "error" | "offline"`; props include
  `status`, `code`, `item`, `onOpenActions`, `onRetry`.
- Optimistic temp item id is `crypto.randomUUID()` (a UUID —
  NOT distinguishable from a real id today). See `useItemFormMutations.ts`
  onMutate. Phase C needs a tag; see that section.
- `useLogout.ts` already calls `purgePersistedCache()` in the `finally` — the
  Phase D cache-clear goes right beside it.

---

## Phase A — Queue durability (tiny; do first)

### A1. Request persistent storage
New file `src/lib/offline/persistStorage.ts`:

```ts
// Ask the browser to make IndexedDB persistent so storage-pressure eviction
// can't silently delete the paused offline-write queue (lost field data).
// Best-effort: unsupported/denied is fine — the queue still works, it's just
// evictable. Fire once at boot.
export async function requestPersistentStorage(): Promise<void> {
  try {
    const granted = await navigator.storage?.persist?.();
    if (granted !== undefined) {
      console.debug(`[offline] persistent storage: ${granted}`);
    }
  } catch {
    // no-op: never block boot on a storage-permission probe
  }
}
```

Call it once from the boot path — `src/main.tsx` (after `loadCatalog`) or
`App.tsx` module scope beside `registerMutationDefaults()`. Do NOT await in a
way that delays first render. No test needed (trivial, guarded).

### A2. Precache fonts
In the `workbox` block of `frontend/vite.config.ts` add:

```ts
globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
```

Rationale: verified against a real `dist/` build — the precache manifest today
covers all JS/CSS/HTML/icons (every lazy route works offline after one visit)
but NONE of the 60 IBM Plex font files. woff2-only (~1 MB, 30 files); skip
legacy `.woff` (woff2-capable browsers never request it). Every dist file is
under the workbox 2 MB per-file cap.
Verify: `bun run build` then `grep -c woff2 dist/sw.js` → ≥ 30.

### A3. Surface replay failures
Problem: a queued create that fails on drain with a 4xx AFTER a reload fails
silently — the hook's `onError` isn't mounted, and the default's `onSettled`
invalidate refetches so the optimistic row just vanishes with no message.

Fix in `src/lib/offline/mutationDefaults.ts`: add an `onError` to EACH of the
three `setMutationDefaults` blocks. Keep the existing `onSettled` invalidate.

```ts
onError: (_err, vars) => {
  const name = (vars.body?.name as string | undefined) ?? "item"; // entity word per default
  retroToast.error(i18n._(msg`Couldn't sync “${name}” — it may have been removed.`));
},
```

Use the entity word per default (item / container / location). Import
`retroToast` from `@/components/retro`, `i18n` from `@/lib/i18n`, `msg` from
`@lingui/core/macro`. No retry UI, no failed-writes screen (YAGNI).

Acceptance test (`mutationDefaults.test.tsx` or a new sibling): register
defaults against a local QueryClient, seed a paused itemCreate mutation whose
mutationFn rejects with a mocked 409/HttpError, resume, assert `retroToast.error`
was called (spy on the sonner module or on `retroToast`) and the
`["items", wsId]` queries were invalidated.

---

## Phase B — Offline scan lookup from cache (frontend only; high field value)

Today scanning a KNOWN code offline shows the OFFLINE "add anyway" banner even
though the item is already in a persisted list cache. Resolve it locally.

### B1. Pure lookup fn
New file `src/lib/offline/localBarcodeLookup.ts`:

```ts
import type { QueryClient } from "@tanstack/react-query";
import type { Item, ItemListResponse } from "@/lib/types";

// Scan every cached ["items", wsId, …] list page for an item whose short_code
// or barcode matches `code`. Pure over cache data — no network. Mirrors the
// online itemsApi.lookupByBarcode scope (items only). First match wins;
// de-dupe is implicit (return on first hit).
export function findCachedItemByCode(
  client: QueryClient,
  wsId: string,
  code: string,
): Item | null {
  if (!wsId || !code) return null;
  const entries = client.getQueriesData<ItemListResponse>({
    queryKey: ["items", wsId],
  });
  for (const [, data] of entries) {
    const items = data?.items;
    if (!Array.isArray(items)) continue;
    const hit = items.find(
      (it) => it.short_code === code || it.barcode === code,
    );
    if (hit) return hit;
  }
  return null;
}
```

Unit test: seed a QueryClient with `["items", "ws-1", {}]` →
`{ items: [{ short_code: "ABCD1234", … }], total: 1 }`; assert match by
short_code, match by barcode, miss returns null, empty/wrong-shape caches don't
throw.

### B2. Wire into ScanPage
In `src/features/scan/ScanPage.tsx`:

- `import { useQueryClient } from "@tanstack/react-query"` and
  `findCachedItemByCode`; `import { useWorkspace }` for wsId (or read it from
  where the page already has it — check; if not present, `useWorkspace()`).
- Compute an offline hit ONLY when offline and a code is in flight:

```ts
const queryClient = useQueryClient();
const { currentWorkspaceId } = useWorkspace();
const offlineHit = useMemo(
  () =>
    !isOnline && banner?.code
      ? findCachedItemByCode(queryClient, currentWorkspaceId ?? "", banner.code)
      : null,
  [isOnline, banner?.code, queryClient, currentWorkspaceId],
);
const effectiveItem = lookup.data ?? offlineHit;
const status: ScanBannerStatus = offlineHit
  ? "match"
  : bannerStatus(lookup.status, lookup.data, isOnline, lookup.fetchStatus);
```

- Pass `effectiveItem` to `<ScanResultBanner item={…}>` and gate
  `QuickActionMenu` on `effectiveItem` (`status === "match" && actionsOpen &&
  effectiveItem`).
- Optional: add a `cached?: boolean` prop to `ScanResultBanner` and pass
  `cached={Boolean(offlineHit)}` to show a small "cached" hint on the match
  banner. Keep it tiny; skip if it pushes the banner over the complexity gate.

Watch the complexity gate: `ScanPage` is already dense. If adding this tips
`bun run lint:complexity` over 15, extract the offline-hit derivation into a
tiny `useOfflineBarcodeHit(isOnline, code)` hook in
`src/lib/offline/localBarcodeLookup.ts` (or a sibling) and call that.

Acceptance: unit test for `findCachedItemByCode`; component test — render
ScanPage offline with a seeded cache containing the scanned code, funnel the
code, assert the MATCH banner (not the OFFLINE banner) renders.

---

## Phase C — Offline inventory writes  ⚠️ HELD — premise corrected

**CORRECTION (found during code inspection):** the plan assumed "inventory
adjust needs idempotency." But `inventoryApi.updateQuantity`
(`PATCH /inventory/{id}/quantity`, body `{ quantity }`) is an **absolute set**,
not a delta — replaying it is naturally idempotent (set to N twice = N). So the
adjust path needs NO idempotency key; it only needs an offline mutation default
so the PATCH survives a reload, plus an optimistic quantity patch.

The genuinely non-idempotent offline inventory op is **`POST /inventory`**
(`inventoryApi.create` — creates a stock entry), which is the real analog of
the item/container/location creates and WOULD need migration-008-style
check-then-store.

Two independent sub-scopes result:

- **C-quantity (frontend-only, low risk):** keyed mutation default for
  `updateQuantity` in `mutationDefaults.ts` (`scope:{id:"offline-writes"}`,
  no idem key needed), optimistic quantity patch in
  `useInventoryMutations`/`useInventoryFormMutations`. `updateQuantity` takes no
  headers arg today and needs none. Dependent-write pitfall still applies: an
  adjust against an offline-CREATED item carries a temp id — block it while
  offline (option (a)).
- **C-create (backend + frontend):** add `Idempotency-Key` to `POST /inventory`
  (thread a `headers?` arg through `inventoryApi.create`, mirror the three
  existing create handlers + the `idempotency.Store` check-then-store,
  `entity_type = "inventory"`, new integration subtest), plus a keyed offline
  default + optimistic insert.

**Dependent-write tagging (applies to both):** the optimistic temp item id is
`crypto.randomUUID()` today — indistinguishable from a real id. To block
adjusts against not-yet-synced items, tag the temp id at mint in
`useItemFormMutations.ts` onMutate (e.g. `` `offline-${crypto.randomUUID()}` ``)
and treat an `offline-`-prefixed id as "syncs after the item is created". NOTE
this tag is display/gating only — it must never be sent to the backend; the
create body doesn't carry the id, so this is safe, but audit any code that
reads `item.id` for a request.

**Decision needed before executing C:** ship C-quantity only (frontend-only,
covers the "recount stock I already have" loop), C-create only, or both? Recommend
**C-quantity first** — it is the smaller, backend-free change and covers the
most common field action (recount an existing entry). C-create can follow.

Acceptance (C-quantity): frontend test — offline quantity PATCH queued +
optimistic quantity shown + survives a simulated reload; temp-id row's adjust
control is disabled offline.
Acceptance (C-create): backend integration test (same-key replay = one entry);
frontend queued-create test.

---

## Phase D — Thumbnail runtime cache (config-only)

Photos 404 offline even for cached items. Add a Workbox runtime route in the
`workbox` block of `frontend/vite.config.ts`:

```ts
runtimeCaching: [
  {
    urlPattern: ({ url }) =>
      /\/api\/workspaces\/.*\/photos\/.*\/thumbnail/.test(url.pathname),
    handler: "CacheFirst",
    options: {
      cacheName: "hws-thumbs",
      expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 3600, purgeOnQuotaError: true },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
],
```

Thumbnails ONLY — full-size photos and offline photo UPLOAD stay deferred.
Confirm the real thumbnail URL shape first: `src/lib/api/photos.ts` /
`items.ts` map photo URLs through `toProxyUrl` to `/api/workspaces/.../photos/
{id}/thumbnail` — match THAT path (adjust the regex to the actual segments).

**Security pitfall:** cached thumbnails are auth-cookie-gated at fetch time but
served from the SW cache without auth afterwards → on logout, clear this cache.
In `src/features/auth/useLogout.ts`, beside `await purgePersistedCache()`:

```ts
await caches.delete("hws-thumbs").catch(() => {});
```

(guard `typeof caches !== "undefined"` for jsdom tests).

Acceptance: manual — `bun run build && bun run preview`, load an item with a
photo online, go offline in DevTools, reload → thumbnail still renders; log out
→ confirm `hws-thumbs` cache is gone (Application ▸ Cache Storage).

---

## Phase E — Offline replay E2E spec

New `frontend/e2e/offline-replay.spec.ts` (Playwright), Chromium only
(`test.skip(browserName === "firefox", "SW + setOffline flaky on firefox")`).
Follows the CLAUDE.md auth contract (fill Email/Password, click `/^log in$/i`).

Flow:
1. Log in; navigate to the items list; wait for it to load (so the list cache
   is populated and the SW is active).
2. `await context.setOffline(true)`.
3. Create an item via the UI (open the item form, fill required fields — `sku`,
   `name` — submit). Assert the optimistic row appears in the list AND the
   pending-writes badge shows `1` (the TopBar N-pending badge).
4. `await page.reload()`. Assert the optimistic row AND the pending badge STILL
   show (this is the persistence contract — the paused mutation + patched cache
   were restored from IndexedDB).
5. `await context.setOffline(false)`. Assert the sync toast appears
   (`Synced.` / `Syncing … changes`) and that exactly ONE row for that item
   remains (the server row replaced the temp row — no duplicate).

Look up the real selectors first: the pending badge lives in
`src/components/layout/TopBar.tsx` (check for a `data-testid`); add one if
missing (small, allowed). Item form route + field labels: see
`src/features/items/ItemFormPage.tsx`. Keep it resilient — prefer role/label
selectors over CSS.

Note: an e2e `scan-lookup.spec.ts` already exists — do NOT touch it; this is a
separate replay spec.

---

### Cut line — explicitly NOT doing (and why)

- **Background Sync API**: no iOS support; `resumePausedMutations` on next app
  open already covers "closed the app before reconnect."
- **Offline updates/deletes for all entities**: field workflow is create +
  count. Broader edits need a conflict policy (LWW vs 412) — real design work.
- **Offline photo capture queue**: blobs in IDB + replayed multipart upload;
  heavy, quota-risky.
- **Temp-id remap / persisted id-map**: only needed for dependent writes;
  Phase C option (a) sidesteps it.
- **CACHE_BUSTER automation**: tying buster to a build hash wipes offline data
  on every deploy — worse than the manual bump.

## Execution log

- 2026-07-04: Phases A, B, D, E dispatched to Sonnet subagents (file-disjoint,
  parallel), all merged + gates green (tsc, 1213 vitest, biome, complexity,
  jscpd, knip, build). Phase C: **C-quantity SHIPPED** (offline recount —
  `MK.inventoryQuantity` default + wsId threaded into vars + optimistic patch
  survives reload; no temp-id guard needed since offline inventory *creation*
  isn't shipped). C-create still deferred.
- 2026-07-04: offline-replay E2E run against live stack (backend :8080 + PG +
  `vite preview` :5173 with an added `preview.proxy` — dev has no SW, and the
  reload-while-offline step needs the SW to serve the shell). Two REAL bugs
  surfaced and fixed:
  1. **Production i18n hashes**: the offline-PWA strings (7f3544fb) were never
     `lingui extract`ed, so the production build rendered message-id hashes
     (e.g. `iFzDOM` instead of `1 pending`). Fixed by re-running i18n:extract +
     compile (en catalog now carries them; et/ru untranslated as usual).
  2. **Offline reload lost the queued write** ([[project_offline_pwa_onlinemanager_boot]]):
     TanStack `onlineManager` inits `#online=true` and only flips on window
     online/offline *transitions*, so a cold/offline reload reported ONLINE →
     `PersistQueryClientProvider onSuccess → resumePausedMutations` drained the
     restored queue against a dead network and lost it. Fixed by seeding
     `onlineManager.setOnline(navigator.onLine)` at boot in App.tsx.
  Spec finalized: robust drain assertion (pending badge clears + search-pinned
  single row) instead of the racy sync toast; run-scoped item name so reruns
  don't 409 on the unique SKU. 2/2 stable.
- 2026-07-04: **C-create SHIPPED.** Backend: migration 009 adds INVENTORY to
  favorite_type_enum (idempotency_keys.entity_type); inventory service +
  handler read Idempotency-Key and check-then-store via the shared
  idempotency.Store (mirrors item/container/location); router injects the store;
  integration test (real Postgres) covers replay-dedup, no-key = two rows, and
  cross-workspace isolation. Frontend: inventoryApi.create takes headers;
  MK.inventoryCreate default (idem key + FIFO scope + replay toast + invalidate);
  useInventoryFormMutations create is now keyed with an optimistic list insert
  + a createEntry(values) wrapper. Dependent-write (offline inventory against an
  offline-CREATED item — a temp item_id) stays DEFERRED. All gates green;
  offline-replay E2E re-run green after the shared mutationDefaults change.
  First commit f150dfe9 (A/B/C-quantity/D/E + fixes); C-create is a follow-up
  commit.
