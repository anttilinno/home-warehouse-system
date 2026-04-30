# Architecture Patterns — v2.2 Scanning & FAB Integration

**Domain:** `/frontend2` scanner + mobile FAB build-out (online-only, retro UI)
**Researched:** 2026-04-18
**Confidence:** HIGH (verified against live source in `frontend2/`, `frontend/`, and `backend/`)

## Executive Summary

v2.2 is **purely additive** on top of the v2.1 `/frontend2` architecture: one new `src/features/scan/` subtree, one new global `FloatingActionButton` overlay mounted in `AppShell`, one new `lib/scanner/` module ported from legacy, and three thin hooks (`useCameraStream` is not needed — the `@yudiel/react-qr-scanner` `Scanner` component owns the stream). No structural refactor, no offline layer, no new framework — online SPA with TanStack Query remains.

**Two assumptions in the research prompt require correction:**

1. **There is NO `/api/items?barcode=<code>` lookup endpoint.** Grepped the backend: `FindByBarcode` exists in the repository layer but is never registered as an HTTP route. The canonical warehouse-item lookup for a scanned code is `GET /api/workspaces/{wsId}/items?search={code}&limit=1` — the existing list endpoint already does FTS over `name`, `sku`, and `barcode` (see `handler.go:583`, search query doc string). No new HTTP endpoint is required; add a thin `itemsApi.lookupByBarcode(wsId, code)` helper that wraps the list call.

2. **The existing `/api/barcode/{barcode}` endpoint is NOT a warehouse lookup** — it's an external product metadata lookup (OpenFoodFacts + OpenProductsDB fallback) that returns `{ name, brand, category, image_url, found }`. It's useful as a **prefill source** for the "item not found → create" flow, not for finding an existing warehouse item. Both endpoints should be wired, but they serve different steps of the scan-action funnel.

Scan events primarily flow to **local component state** in `ScanPage` (the scanned code is an ephemeral UI concern), with TanStack Query handling the actual lookup via `useQuery` so the result is cached (a rescan of the same code is instant). Scan history is localStorage (port verbatim from `frontend/lib/scanner/scan-history.ts`, 10-entry rolling, key `hws-scan-history`). No cache invalidation is required for the scan itself — only for downstream mutations triggered by the post-scan action menu (create, loan, return), which already have their own invalidation hooks from v2.1.

The legacy scanner at `frontend/components/scanner/barcode-scanner.tsx` cannot drop in: it imports `next/dynamic`, `@/components/ui/*` (shadcn), and `lucide-react` — none of those exist in `frontend2`. It must be re-themed around the retro library (`RetroPanel` error state, `RetroButton` torch toggle) with `React.lazy` replacing `next/dynamic`. The auxiliary modules (`init-polyfill.ts`, `feedback.ts`, `scan-history.ts`, `types.ts`) port verbatim after a one-line edit (remove `"use client"` directives — Vite doesn't need them).

The FAB ports cleanly from `frontend/components/fab/floating-action-button.tsx` **if `motion` is added as a dep**; it already uses motion v12.27. Alternatively, re-implement with Tailwind CSS transitions — the animation surface is small (stagger open/close, rotate `+`) and avoiding `motion` saves ~60 KB gzipped. **Recommendation:** re-implement without `motion`. The retro aesthetic favors sharp, mechanical transitions; `motion`'s spring physics work against the design language.

## Existing Architecture (as of 2026-04-18, post-v2.1)

### Layout — what's actually on disk

```
frontend2/src/
├── App.tsx                        # QueryClientProvider > AuthProvider > ToastProvider > I18nProvider > Router
├── main.tsx
├── routes/index.tsx               # 17 routes under <AppShell>, <ScanPage> at /scan (stub)
├── lib/
│   ├── api.ts                     # get/post/patch/put/del + postMultipart + HttpError + 401 refresh (single-flight)
│   ├── api/
│   │   ├── index.ts               # barrel: items, itemPhotos, loans, borrowers, categories, locations, containers
│   │   ├── items.ts               # workspace-scoped: /workspaces/{wsId}/items; itemKeys query-key factory
│   │   ├── itemPhotos.ts          # multipart upload
│   │   ├── loans.ts / borrowers.ts / categories.ts / locations.ts / containers.ts / inventory.ts
│   │   └── __tests__
│   ├── types.ts                   # cross-cutting types (User, Session, Workspace, ApiError)
│   └── i18n.ts
├── components/
│   ├── layout/                    # AppShell, ErrorBoundaryPage, Sidebar, TopBar, LoadingBar, useRouteLoading
│   └── retro/                     # 19 retro atoms — barrel index.ts (see Component Inventory below)
├── features/
│   ├── auth/                      # AuthContext (workspaceId!), RequireAuth, AuthPage, AuthCallbackPage
│   ├── dashboard/                 # DashboardPage + QuickActionCards → /items /scan /loans
│   ├── items/                     # ItemsListPage, ItemDetailPage, ItemForm, ItemPanel, photos/, filters/, hooks/
│   ├── loans/                     # LoansListPage + tabs (Active/Overdue/History)
│   ├── borrowers/                 # BorrowersListPage, BorrowerDetailPage
│   ├── taxonomy/                  # TaxonomyPage (categories + locations + containers unified)
│   ├── scan/                      # ScanPage (STUB — "PAGE UNDER CONSTRUCTION")
│   ├── settings/                  # 8 subpages
│   └── setup/
├── pages/DemoPage.tsx, ApiDemoPage.tsx
├── hooks/                         # EMPTY directory
└── styles/
```

### Key facts verified against source

- **Router is declarative `<Routes>/<Route>`**, not file-based. `/scan` already registered at `routes/index.tsx:85` as a stub inside the authenticated `<AppShell>` block.
- **TanStack Query is the data layer** (`@tanstack/react-query@5`). Every entity has a `xxxKeys` query-key factory exported from `lib/api/<entity>.ts`. Mutations invalidate broadly: `useItemMutations.ts` does `qc.invalidateQueries({ queryKey: itemKeys.all })` on every create/update/archive. Pattern is clear and proven.
- **Workspace-scoped paths**: every API client function takes `wsId` as first arg and targets `/api/workspaces/{wsId}/{entity}`. `useAuth().workspaceId` must be non-null before calling; use TanStack Query's `enabled: !!workspaceId` guard (see `useItemsList.ts`).
- **Retro library is comprehensive** (`src/components/retro/index.ts` exports 19 components). Unlike at v2.1 start, `RetroSelect`, `RetroTextarea`, `RetroCheckbox`, `RetroFileInput`, `RetroCombobox`, `RetroFormField`, `RetroConfirmDialog`, `RetroEmptyState`, `RetroPagination`, `RetroBadge`, and `ToastProvider/useToast` are all present. **No new retro atoms are required for v2.2.**
- **`lib/api.ts` already exposes `postMultipart`** (line 119) — added during v2.1 for photo uploads. Camera-captured photos flowing from a "scan → create → add photo" deep-link reuse it directly.
- **CI grep guard** (`scripts/check-forbidden-imports.mjs`): blocks any `frontend2/src/**` import whose specifier is exactly `idb` / `serwist` / `@serwist/*`, or whose specifier contains `offline` or `sync` (case-insensitive substring, both `from` and `import()` forms). This constrains file/module names inside the scanner module — e.g. **avoid naming anything `scan-sync.ts`** (would trip the `sync` substring rule). Safe alternatives: `scan-history.ts`, `scan-lookup.ts`, `scan-feedback.ts`.
- **AuthContext token-clear is 401/403 only** (`AuthContext.tsx:61`) — other errors (404 not found, 500, network) do not log the user out. Scanner "item not found" for a UPC that doesn't exist in the workspace manifests as a 200 with empty `items[]`, not a 4xx, so this is moot; the handling lives in the lookup hook.

### Backend endpoints v2.2 uses (all live, workspace-scoped unless noted)

| Purpose | Method + Path | Notes |
|---|---|---|
| Lookup scanned code in workspace | `GET /api/workspaces/{wsId}/items?search={code}&limit=1` | **Canonical.** FTS over name/SKU/barcode. `total > 0` means hit; first `items[0]` is the match candidate. |
| External product prefill | `GET /api/barcode/{barcode}` | OpenFoodFacts + OpenProductsDB. Returns `{ barcode, name, brand, category, image_url, found }`. **Public, no auth required** (see `router.go:319`). Length constrained to 8–14 chars — QR codes and non-numeric codes bypass this. |
| Create item (post-scan) | `POST /api/workspaces/{wsId}/items` | Already wired via `useCreateItem()` in `hooks/useItemMutations.ts`. |
| Create loan (post-scan) | `POST /api/workspaces/{wsId}/loans` | Already wired. |
| Search borrowers (loan picker) | `GET /api/workspaces/{wsId}/borrowers/search?q=` | Already wired. |

**No new backend endpoints are required for v2.2.** The "prep item" in `STATE.md` — *confirm canonical barcode-lookup endpoint* — is now answered: use the existing search param on the list endpoint.

## Answers to the Specific Questions

### Q1 — Camera component placement

**Recommendation: new `src/components/scan/` module + `src/features/scan/`, NOT `components/retro/`.**

Two concerns cleanly split:

```
src/components/scan/           # generic, reusable, retro-themed scan primitives
├── BarcodeScanner.tsx          # camera + overlay (renders @yudiel/react-qr-scanner Scanner)
├── ScanErrorPanel.tsx          # retro-styled error state (permission denied, lib-load fail, no camera)
├── ScanOverlay.tsx             # torch toggle + scanning pulse + reticle
├── ManualBarcodeEntry.tsx      # RetroInput fallback for when camera is unavailable
└── index.ts                    # barrel export

src/features/scan/              # scan-flow orchestration (route-level)
├── ScanPage.tsx                # single-page flow: mount BarcodeScanner, handle lookup, show action menu
├── QuickActionMenu.tsx         # post-scan action sheet (View/Loan/Move/Repair/Create)
├── ScanHistoryList.tsx         # renders last-10 from localStorage
├── hooks/
│   ├── useScanLookup.ts        # useQuery wrapping itemsApi.lookupByBarcode
│   ├── useScanFeedback.ts      # beep + vibrate + audio context init
│   └── useScanHistory.ts       # localStorage read/write with React state sync
└── __tests__
```

**Why not extend `retro/`:** The retro barrel is for **generic UI atoms** (`RetroButton`, `RetroPanel`, `RetroInput`). A barcode scanner is a domain concept with a camera lifecycle — it belongs with feature components. The retro barrel already has 19 entries; adding `RetroScanner` dilutes its purpose and creates a circular tension (a "retro scanner" has to style things like reticle pulses that are not retro primitives).

**Why split `components/scan/` from `features/scan/`:** The `BarcodeScanner` and `ManualBarcodeEntry` are **reused** by `features/loans/LoanCreateForm` (scan an item into the loan picker) and `features/items/QuickCapture` (scan to prefill SKU). Generic scan primitives need a home outside `features/scan/`. Legacy precedent: `frontend/components/scanner/` was separate from any `features/` folder for the same reason.

**Naming note:** the module path is `src/components/scan/` (singular, matches `frontend/components/scanner/` rename rationale — shorter, consistent with the feature folder). The **exported class-level component** is `BarcodeScanner` (matches legacy, clearer than `RetroScanner`).

### Q2 — State management: scan events

**Three-tier split — no context, no global store.**

| State | Lifetime | Home |
|---|---|---|
| "Is scanner active / paused" | Session (while on `/scan` or within a modal) | Local `useState` in `ScanPage` / consumer |
| Current scanned code + detected format | Per-scan, replaced on each hit | Local `useState` in `ScanPage` |
| Lookup result (`item | not-found | external-product`) | Cached across scans of the same code | **TanStack Query**: `useQuery({ queryKey: scanKeys.lookup(code), queryFn: () => itemsApi.lookupByBarcode(wsId, code), enabled: !!code })` |
| Scan history (last 10) | Persistent across sessions | `localStorage` key `hws-scan-history`, mirrored in React state via `useScanHistory()` |
| Post-scan navigation intent | Transient, consumed on navigate | URL search params (`/items/:id?from=scan`, `/loans/new?itemId=...`) |

**Do NOT create a `ScanContext`.** React Context is the wrong tool when the state is already funneled through a single page (`ScanPage`) or passed as prop (to `LoanCreateForm` as `initialItemId`). A context would add rerender blast radius and is unnecessary for the shallow consumer tree.

**Do NOT invalidate `itemKeys` on scan.** A scan is a read-only event — nothing changed in the warehouse. Invalidation would force a refetch of the items list, wasting a request. The only scan flows that trigger cache invalidation are **downstream mutations** (create item, create loan), which already invalidate correctly via v2.1 mutation hooks.

**"Last scanned barcode" lives in `useScanHistory()`'s first entry** — not a separate piece of state. The hook exposes `{ history, addScan, clearHistory, lastScan }` and is consumed by both `ScanPage` (for recent-scans list rendering) and any other consumer that wants to display "last scanned" (e.g., loan create form breadcrumb). Single source of truth, reactive across tabs via the `storage` event (optional enhancement; v1.3 did not do this).

**Scan-result query key factory** (new, add to `lib/api/items.ts` or a new `lib/api/scan.ts`):

```ts
export const scanKeys = {
  all: ["scan"] as const,
  lookup: (code: string) => [...scanKeys.all, "lookup", code] as const,
  external: (code: string) => [...scanKeys.all, "external", code] as const,
};
```

`staleTime: Infinity` is reasonable for scan lookups within a session — the user is unlikely to add/remove the same barcode in the middle of a scan session, and if they do, the "refresh" action on the action menu can call `qc.invalidateQueries({ queryKey: scanKeys.lookup(code) })`.

### Q3 — API integration points

**What's already there:**

| Need | Existing surface | Action |
|---|---|---|
| Find warehouse item by code | `itemsApi.list(wsId, { search, limit: 1 })` | Wrap: `itemsApi.lookupByBarcode(wsId, code)` returning `Item | null` |
| External product metadata | `GET /api/barcode/{barcode}` (no workspace scope, public) | **New** tiny client `scanApi.lookupExternal(code)` in `lib/api/scan.ts` |
| Create item with barcode prefill | `itemsApi.create()` + `useCreateItem()` | No change — `CreateItemInput.barcode` is already accepted |
| Create loan with scanned item | `loansApi.create()` + existing create flow | Pass `initialItemId` via URL param or form state |

**New API client additions** (minimal diff):

```ts
// lib/api/items.ts — ADD to itemsApi
lookupByBarcode: async (wsId: string, code: string): Promise<Item | null> => {
  const res = await get<ItemListResponse>(
    `${base(wsId)}?search=${encodeURIComponent(code)}&limit=1`
  );
  // Exact-match guard: FTS can match partial/near matches.
  // Prefer exact barcode match, fall back to first result if none.
  const exact = res.items.find(i => i.barcode === code);
  return exact ?? (res.items.length > 0 ? res.items[0] : null);
},
```

```ts
// lib/api/scan.ts — NEW file, ~40 LOC
import { get } from "@/lib/api";

export interface ExternalProduct {
  barcode: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  image_url?: string | null;
  found: boolean;
}

export const scanApi = {
  // Note: public endpoint, no workspace scope. 8–14 char numeric barcodes only
  // (Huma enforces minLength/maxLength); QR codes and alphanumeric fail gracefully with 422.
  lookupExternal: (code: string) =>
    get<ExternalProduct>(`/barcode/${encodeURIComponent(code)}`),
};

export const scanKeys = {
  all: ["scan"] as const,
  lookup: (code: string) => [...scanKeys.all, "lookup", code] as const,
  external: (code: string) => [...scanKeys.all, "external", code] as const,
};
```

Add `export * from "./scan";` to `lib/api/index.ts`.

**Scan history localStorage namespace:**

- **Key:** `hws-scan-history` (verbatim from legacy — avoids namespace drift across workspaces and preserves history if the user resets auth).
- **Value shape:** `ScanHistoryEntry[]` as defined in `frontend/lib/scanner/types.ts` (port verbatim). Max 10 entries. Dedupe on `code`.
- **Not per-workspace-scoped:** Legacy decision; rationale is that scan history is a **local UI convenience**, not workspace data. If a user switches workspaces, the history is still "my last 10 scans" regardless. Acceptable since `entityId` lookups will miss when the entity belongs to a different workspace — the UI just shows "not found" on re-click.
- **Storage quota:** 10 entries × ~200 bytes = ~2 KB. No pressure.

**No `IDBDatabase`, no `idb` import, no offline store.** Scan history is localStorage-only.

### Q4 — Route changes

**One new standalone route, no modal-over-route.**

Current state (verified): `/scan` exists as a stub route at `routes/index.tsx:85`. Just replace the stub body.

**Final route layout** (diff from v2.1):

```
  <Route path="scan" element={<ScanPage />} />
+ <Route path="scan/new-item" element={<ItemCreatePage mode="scan-prefill" />} />  // optional, see note
```

**Why no modal-over-route for scan:**
- iOS PWA camera permission persists across **remounts within the same document**, not across navigations. A modal-based scanner avoids navigation — good — but so does a single-route flow if we keep the `BarcodeScanner` mounted and use its `paused` prop to freeze the camera while the action menu overlays.
- A dedicated `/scan` route is **deep-linkable** (scan shortcut on the home screen, PWA install) and URL-bookmark-friendly.
- A modal would fight the retro design language (which leans on full-screen panels rather than overlay dialogs). Existing `RetroDialog` is not full-screen and not designed for a viewport-filling camera surface.

**Why a single route (not `/scan` + `/scan/result`):**
- The action menu overlays the paused scanner on the same page. Navigating to `/scan/result` would unmount `BarcodeScanner` → iOS re-prompts camera permission on back-nav (v1.3 D-01 confirms).
- State is ephemeral enough for component-local `useState`; URL-encoding the scanned code offers no user value.

**Optional sub-route `/scan/new-item`:** if the "item not found → create" flow wants its own URL (so a user can refresh without re-scanning), render `ItemCreatePage` with prefilled `barcode` from a URL search param: `/scan/new-item?barcode=0123456789012&name=Prefilled+Name`. Defer this to the roadmap — v1.3 did not have it; the `/scan` → inline action sheet → navigate to `/items/new?barcode=...` pattern is sufficient.

### Q5 — FAB positioning

**Global overlay in `AppShell`, with `useFABActions()` context-aware hook.**

**Where it mounts:**
```tsx
// components/layout/AppShell.tsx — ADD one line inside the main content column
<main id="main-content" className="p-lg"><Outlet /></main>
<FloatingActionButton actions={fabActions} />   // {/* fixed position, mobile-only */}
```

**Why global, not per-route:**
- Repeating `<FloatingActionButton />` in every page component is error-prone (easy to forget) and bloats each page.
- The legacy app did this exactly (`dashboard-shell.tsx:124` mounts FAB once at the shell level, actions come from `useFABActions()`).
- Context-awareness lives in `useFABActions()`, which reads `useLocation()` and returns route-specific `FABAction[]`. This keeps AppShell dumb.
- An empty `actions` array hides the FAB (legacy guard: `{fabActions.length > 0 && <FloatingActionButton ... />}`). Same pattern in v2.2.

**`useFABActions()` — the context-switching hook** (new, `src/components/fab/useFABActions.tsx`):

```ts
// Ported from frontend/lib/hooks/use-fab-actions.tsx with path/router adjustments
export function useFABActions(): FABAction[] {
  const location = useLocation();
  const navigate = useNavigate();

  return useMemo(() => {
    const scan:     FABAction = { id: "scan",      label: t`Scan`,          onClick: () => navigate("/scan") };
    const addItem:  FABAction = { id: "add-item",  label: t`Add item`,      onClick: () => navigate("/items?new=1") };
    const quickCap: FABAction = { id: "capture",   label: t`Quick capture`, onClick: () => navigate("/items?capture=1") };
    const newLoan:  FABAction = { id: "new-loan",  label: t`New loan`,      onClick: () => navigate("/loans?new=1") };

    // Hide FAB on pages that own their own primary action or where it'd overlap UI
    if (location.pathname === "/scan") return [];
    if (location.pathname.startsWith("/settings")) return [];
    if (location.pathname === "/auth" || location.pathname === "/setup") return [];

    // Items routes: Quick Capture first, Add, Scan
    if (location.pathname === "/items" || location.pathname.startsWith("/items/")) {
      return [quickCap, addItem, scan];
    }
    // Loans routes: New loan first, Scan
    if (location.pathname === "/loans" || location.pathname.startsWith("/loans/")) {
      return [newLoan, scan];
    }
    // Default (Dashboard, Borrowers, Taxonomy): Scan, Add Item, New Loan
    return [scan, addItem, newLoan];
  }, [location.pathname, navigate]);
}
```

**Icon source:** FAB actions need icons. Options:
- **Option A:** Add `lucide-react` dep (matches legacy, tree-shakes to ~5 KB for ~8 icons). Consistent icon set.
- **Option B:** Render ASCII glyphs in retro font (`[◉]` scan, `[+]` add, `[>>]` loan). Matches retro aesthetic. Avoids dep.
- **Recommendation:** Option B for v2.2. The retro design doesn't use line-icon sets elsewhere; introducing `lucide-react` only for the FAB creates a stylistic one-off. The `BarcodeScanner` overlay (torch, close) can use the same ASCII glyphs. Revisit if a second feature needs a broader icon set.

**Mobile-only visibility:** `className="fixed bottom-4 right-4 z-50 md:hidden"` — ported verbatim from legacy. FAB never appears on desktop (`md:` breakpoint). Desktop users have sidebar + top-bar actions.

**Safe-area insets:** iOS home-bar gesture area. Add `bottom: max(1rem, env(safe-area-inset-bottom))` — legacy did not do this and users report the FAB clipping on iPhone 13+; fixable now as a small a11y win.

### Q6 — Integration with existing pages

**Three integration points. All thin; no refactor of existing pages.**

**6.1 — Item detail page (`ItemDetailPage`):**

Not directly touched. The "scanned barcode → navigate to detail" flow is:
1. `ScanPage` performs `useScanLookup(code)` → gets `Item` → shows action menu.
2. User taps "View" in action menu → `navigate(`/items/${item.id}`)`.
3. `ItemDetailPage` loads normally via `useItem(id)` — no awareness of scan origin needed.

Optional: pass a `?from=scan` query param to show a "scanned from code XXX" breadcrumb / back-to-scan button. Low-value polish, defer to later.

**6.2 — Loan create form:**

Currently, loan creation lives in `features/loans/` (exact form component inferred from v2.1 — not yet inspected, but the pattern is established). **Two integration modes:**

**Mode A (scan-triggered from FAB on loans page):** user taps Scan from within a loan flow → `ScanPage` opens → on Item hit, action menu shows "Loan this item" → `navigate('/loans/new?itemId=' + item.id)` → `LoanCreateForm` reads the query param and prefills the item picker.

**Mode B (scanner embedded in loan form):** loan form has an inline "Scan item" button that mounts the shared `<BarcodeScanner>` in a `RetroDialog` or in-panel section. On hit, calls `setItemId(item.id)` and dismisses. This is the more flexible pattern but requires dialog-shaped scanner UX.

**Recommendation:** **Mode A for v2.2.** Simpler, reuses the single-page scan flow, and the iOS PWA camera constraint is easier to satisfy. Mode B can follow if usage data shows friction. Add `initialItemId` support to `LoanCreateForm` by reading `useSearchParams().get("itemId")` and passing into the form's default values.

**6.3 — Quick Capture (SKU autofill):**

Quick Capture in `/frontend2` is itself a v2.2 feature (listed under "Quick capture flow in `/frontend2`" in PROJECT.md v2.2 target features) — the legacy `/frontend` had it. Two paths:

- If Quick Capture is built **before** the scanner integration phase: add a "Scan to prefill" button that opens `/scan` and returns to Quick Capture via navigation state (`navigate('/scan?return=/capture')`; `ScanPage` parses `return` param and navigates back with `?scannedBarcode=...` on success).
- If Quick Capture is built **with** the scanner integration phase: embed `<BarcodeScanner>` directly (following Mode B above) — since Quick Capture is itself a camera-first page already; mounting one more camera-using component is architectural consistency.

**Recommendation:** build Quick Capture to **embed** `BarcodeScanner` inline (Mode B), because Quick Capture's core UX is "camera open at all times" — the user shouldn't navigate away to scan. This is consistent with legacy.

### Q7 — Error boundaries

**No new `ScanErrorBoundary` React component needed.** The existing `ErrorBoundaryPage` (attached to the `AppShell` route at `routes/index.tsx:76`) catches any thrown error from anywhere in the authenticated tree. Scan-specific errors are **render-time conditional UI**, not boundary-level.

**Error sources and handling:**

| Error source | Detected by | Handler | UI |
|---|---|---|---|
| Camera permission denied | `onError` callback from `@yudiel/react-qr-scanner` Scanner, error.name === "NotAllowedError" | `BarcodeScanner` local state (`permissionDenied`) | Render `ScanErrorPanel` with retro hazard-striped panel; "Retry" button triggers `location.reload()` on iOS |
| No camera available | `navigator.mediaDevices.getUserMedia` pre-check; fails with NotFoundError | `BarcodeScanner` init path | `ScanErrorPanel` with "No camera detected. Use manual entry:" and `<ManualBarcodeEntry>` below |
| Barcode polyfill load failure | `initBarcodePolyfill()` throws | `BarcodeScanner` init path | `ScanErrorPanel` "Scanner unavailable" + manual entry |
| Scanner lib load failure (dynamic import) | `React.lazy` throws in Suspense | Suspense boundary in `ScanPage` | Retro loading spinner for success; retro error panel for failure. Use error boundary **inline** to Suspense, not a new class. |
| Network fail during `itemsApi.lookupByBarcode` | `useQuery` error state | Consumer (`ScanPage`) branches on `lookupQuery.isError` | Toast via `useToast()` ("Lookup failed, try again") + retain current UI |
| 404 item not found | Query returns `null` (empty `items[]`) | Consumer branches on `data === null` | Show "not found" action menu with "Create item with barcode XXX" |
| 401 auth expiry during lookup | `HttpError` bubbled by `api.ts` after refresh attempt fails | `AuthContext` clears token → `RequireAuth` redirects to `/auth` | Covered; no scan-specific handling. |

**Pattern for the error UI:** a small `ScanErrorPanel.tsx` component takes `{ title, message, action? }` and renders inside a `RetroPanel` with `HazardStripe`. Re-used across the three scanner error states. This is a **standard retro pattern**, not a React error boundary.

**Dynamic import Suspense boundary:** wrap the `Scanner` usage in `<Suspense fallback={<ScannerLoading />}>`. Error within Suspense's child propagates to the nearest error boundary; `ErrorBoundaryPage` at the shell level catches it. If UX demands a scan-specific error UI rather than the full-page boundary, add a **feature-scoped `ErrorBoundary`** (React 19 native component via `<ErrorBoundary>` or the existing `react-router` v7 `errorElement` at the `/scan` route). For v2.2, rely on the shell boundary — the scanner is rarely the cause of a crash that merits special UI.

### Q8 — Build order recommendations

**Dependency-first, outward from primitives.** Nine focused phases, none of which block the others for more than one step.

1. **Foundation: polyfill + feedback + types port** — no UI. Port `lib/scanner/{init-polyfill,feedback,types,scan-history}.ts` from legacy. Remove `"use client"` directives. Add unit tests (feedback beep → mock AudioContext; scan-history → mock localStorage).
   - **Delivers:** `src/lib/scanner/` ready for consumers.
   - **No deps outside `frontend2/package.json` yet.**

2. **API: scan client module + items.ts lookup helper** — no UI. Add `lib/api/scan.ts` (external lookup), add `lookupByBarcode` to `itemsApi`, add `scanKeys` factory. Unit tests with fetch mocks.
   - **Delivers:** data layer for the scan flow. Gates **everything downstream**.

3. **Install scanner dep** — `npm install @yudiel/react-qr-scanner@^2.5.1 barcode-detector`. Confirm React 19 peerDep resolves (verified from `frontend/bun.lock`: peerDeps are `react ^17 || ^18 || ^19` — compatible).
   - **Acceptance:** `bun run build` passes; CI grep guard stays green.

4. **Scanner primitive: `components/scan/BarcodeScanner.tsx`** — retro-themed Scanner wrapper. `React.lazy` around `@yudiel/react-qr-scanner`. Props mirror legacy (`onScan`, `onError`, `paused`, `formats`, `className`). Include torch toggle + Android flashlight detection + permission-denied handling. Pair with `ScanErrorPanel` and `ManualBarcodeEntry`.
   - **Depends on:** Step 1 (polyfill).
   - **Testable:** Vitest with mocked `@yudiel/react-qr-scanner` module (see Q9).

5. **Hooks: `useScanHistory`, `useScanLookup`, `useScanFeedback`** — thin wrappers. `useScanHistory` syncs localStorage to React state with a `storage` event listener for cross-tab. `useScanLookup(code)` is `useQuery` over `itemsApi.lookupByBarcode` + `scanApi.lookupExternal` chained. `useScanFeedback` wraps `playSuccessBeep` + `triggerHaptic` + audio context init.
   - **Depends on:** Steps 1 and 2.

6. **Scan page: `features/scan/ScanPage.tsx` + `QuickActionMenu.tsx` + `ScanHistoryList.tsx`** — full scan flow wiring. Replace the stub.
   - **Depends on:** Steps 4 and 5.
   - **Acceptance:** `/scan` route scans a code, shows action menu, navigates on action select.

7. **FAB component + hook: `components/fab/FloatingActionButton.tsx` + `useFABActions.tsx`** — retro-themed FAB (CSS transitions, no motion lib) + route-aware actions. Mount in `AppShell` behind `md:hidden` + `fabActions.length > 0` guard.
   - **Depends on:** Step 6 (so the FAB's `scan` action goes somewhere real) — but can be built in parallel with Step 6 if the `/scan` stub remains; just wire the action.
   - **Acceptance:** tap FAB on mobile viewport; radial menu opens; tap Scan; navigate to `/scan`.

8. **Integrations: loan create prefill + quick capture embed** — add `initialItemId` support to `LoanCreateForm` (read `?itemId` param); add inline scanner or scan-then-return to Quick Capture (depending on Mode A/B decision).
   - **Depends on:** Steps 4 (for embedded Mode B) or Step 6 (for navigate-based Mode A).

9. **Stabilization slice (debt closure)** — in parallel throughout: VERIFICATION.md backfill, /demo sign-off, Nyquist validation, pendingchange handler.go unit tests, waitForTimeout cleanup. See Section "Debt Closure" below.

**Dependency graph:**

```
[1 lib/scanner port] ──┐
[2 lib/api/scan + items.lookupByBarcode] ──┐
                                            ├──> [5 hooks] ──> [6 ScanPage] ──> [8 integrations]
[3 install @yudiel] ──> [4 BarcodeScanner] ─┘                         │
                                                                       └──> [7 FAB + useFABActions]
[9 debt closure] — runs concurrently with all phases
```

**Critical path length:** Steps 1 → 2 → 4 → 5 → 6 → 8. Roughly 6 sequential plans. Steps 3, 7, 9 parallelize.

### Q9 — Testing surface

**Vitest is the existing runner** (`frontend2/package.json`). Three levels:

**9.1 — Unit tests (Vitest + @testing-library/react):**

- `lib/scanner/scan-history.test.ts`: mock `localStorage` via `vi.spyOn(localStorage, "setItem")`; test dedup, overflow, formatScanTime. Port legacy tests verbatim.
- `lib/scanner/feedback.test.ts`: mock `AudioContext` via `vi.stubGlobal("AudioContext", class { createOscillator()... })`; test playBeep, playSuccessBeep, triggerHaptic no-op on missing `navigator.vibrate`. Port legacy.
- `lib/api/scan.test.ts`: mock `fetch` for `/api/barcode/{code}`; test success, 422 (out-of-range code length), 500. Same pattern as existing `lib/api/itemPhotos.test.ts`.
- `features/scan/hooks/useScanLookup.test.ts`: TanStack Query test harness (wrap in `QueryClientProvider`); test hit → `Item`, miss → `null`, external fallback.

**9.2 — Component tests (mocked camera):**

- **Mock `@yudiel/react-qr-scanner`** at module level: `vi.mock("@yudiel/react-qr-scanner", () => ({ Scanner: (props) => <div data-testid="mock-scanner" onClick={() => props.onScan([{ rawValue: "0123456789012", format: "ean_13" }])} /> }))`. The legacy `BarcodeScanner.test.tsx` (frontend1) already does this — 18 tests pass in v1.4. Port them.
- **Mock `navigator.mediaDevices.getUserMedia`** for permission paths: `vi.spyOn(navigator.mediaDevices, "getUserMedia").mockRejectedValueOnce(new DOMException("Permission denied", "NotAllowedError"))`.
- **ScanPage test**: render inside `QueryClientProvider` + `MemoryRouter`; simulate `onScan` from the mock; assert action menu appears with correct entity-type actions.
- **FAB test**: render `<AppShell>`-like tree with a fake route; assert FAB button visible on mobile viewport (`window.matchMedia` stub), actions match current pathname.

**9.3 — E2E (Playwright — optional for v2.2):**

**Camera in Playwright is limited.** Options:
- **Mock-based**: launch browser with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` flags (Chromium only). Plays a sine-wave/silent image. Usable for permission-granted path but doesn't feed an actual barcode to the detector.
- **Fake barcode stream**: feed a pre-recorded `.y4m` video file via `--use-file-for-fake-video-capture=path/to/barcode.y4m`. Requires video with a visible barcode. Moderate setup cost; most reliable E2E of the full capture→decode→lookup flow.
- **Manual entry path**: drive the `ManualBarcodeEntry` fallback. Much simpler; exercises lookup + action-menu logic without camera. **Recommended for v2.2 E2E.**

**Recommendation for v2.2 testing:** comprehensive Vitest unit + component coverage (18+ scanner tests, 28+ FAB tests — matches v1.4 legacy coverage numbers for parity). E2E via manual-entry path only for v2.2; defer fake-camera E2E to a later milestone given Playwright complexity and the minimal marginal assurance over component tests.

**Test file locations:**
```
src/components/scan/__tests__/BarcodeScanner.test.tsx
src/components/scan/__tests__/ManualBarcodeEntry.test.tsx
src/components/scan/__tests__/ScanErrorPanel.test.tsx
src/components/fab/__tests__/FloatingActionButton.test.tsx
src/components/fab/__tests__/useFABActions.test.tsx
src/features/scan/__tests__/ScanPage.test.tsx
src/features/scan/__tests__/QuickActionMenu.test.tsx
src/features/scan/hooks/__tests__/useScanLookup.test.ts
src/features/scan/hooks/__tests__/useScanHistory.test.ts
src/features/scan/hooks/__tests__/useScanFeedback.test.ts
src/lib/scanner/__tests__/{scan-history,feedback,init-polyfill}.test.ts
src/lib/api/__tests__/scan.test.ts
src/lib/api/__tests__/items.lookupByBarcode.test.ts
```

## Component Boundaries

| Layer | Responsibility | Location | Reuses |
|---|---|---|---|
| Route page | URL binding, scan flow orchestration | `features/scan/ScanPage.tsx` | `components/scan/*`, hooks |
| Feature components | Scan-flow UI (action menu, history list) | `features/scan/*.tsx` | retro, scan primitives |
| Feature hooks | TanStack Query wrappers, localStorage I/O, feedback | `features/scan/hooks/*.ts` | `lib/api/*`, `lib/scanner/*` |
| Scan primitives | BarcodeScanner, ManualEntry, ScanErrorPanel | `components/scan/*.tsx` | retro atoms, `@yudiel/react-qr-scanner` |
| FAB primitive | FloatingActionButton (generic) | `components/fab/*.tsx` | retro atoms |
| Route-aware FAB config | `useFABActions()` | `components/fab/useFABActions.tsx` | `react-router` |
| API module | Scan lookup clients + query keys | `lib/api/scan.ts` | `lib/api.ts` primitives |
| Scanner support | polyfill, feedback, history, types | `lib/scanner/*.ts` | — (pure TS) |
| Retro atoms | Generic UI (RetroButton, RetroPanel, etc.) | `components/retro/*` | — |

## Data Flow

**Happy path — scan a barcode, view item:**

```
User approaches viewfinder
        |
        v
<BarcodeScanner paused={false}>         mounted once in ScanPage, never unmounted
        |
        v (onScan callback fires)
ScanPage.handleScan(result)
        |
        v  -- setLastCode(code)          local useState
        |  -- useScanFeedback().trigger()  beep + vibrate
        |  -- useScanHistory().addScan()   localStorage rolling 10
        |  -- setScannerPaused(true)       pauses camera, keeps component mounted
        v
useScanLookup(code)  -- TanStack Query
        |
        v  workspace lookup: GET /api/workspaces/{ws}/items?search={code}&limit=1
        |
        +-- hit (Item):        <QuickActionMenu match={{ type: "item", entity }}>
        |
        +-- miss (null):       external lookup: GET /api/barcode/{code} (if numeric)
        |                           |
        |                           +-- external hit: <QuickActionMenu match={{ type: "external", product }}>
        |                           +-- external miss: <QuickActionMenu match={{ type: "not_found", code }}>
        |
        v (user picks "View")
navigate(`/items/${item.id}`)
        |
        v
ItemDetailPage loads normally (no scan awareness)
```

**Pitfall-flagged path — "not found → create":**

```
User picks "Create with barcode"
        |
        v
navigate(`/items/new?barcode=${code}`) OR open ItemForm modal with prefilled defaults
        |
        v
ItemForm reads ?barcode param → defaultValues.barcode = code
                               → defaultValues.name = external.name (if external hit)
        |
        v
useCreateItem() mutation → POST /api/workspaces/{ws}/items
        |
        v (onSuccess)
qc.invalidateQueries(itemKeys.all) → items list refetches
qc.invalidateQueries(scanKeys.lookup(code)) → next rescan sees the new item
navigate(`/items/${created.id}`)
```

## Patterns to Follow

**Pattern 1 — Scanner stays mounted, camera pauses via prop**
```tsx
// ScanPage.tsx — MUST follow this pattern on iOS PWA
<BarcodeScanner
  onScan={handleScan}
  onError={handleError}
  paused={lookupActive || !!selectedResult}  // pause on hit, resume on dismiss
/>
```

**Pattern 2 — TanStack Query for lookup, local state for transient UI**
```tsx
const [code, setCode] = useState<string>("");
const lookupQuery = useQuery({
  queryKey: scanKeys.lookup(code),
  queryFn: () => itemsApi.lookupByBarcode(workspaceId!, code),
  enabled: !!code && !!workspaceId,
  staleTime: 30_000,  // within a scan session, a cache hit is fine
});
```

**Pattern 3 — Retro-themed error panel, no new React class for errors**
```tsx
{permissionDenied && (
  <RetroPanel showHazardStripe title={t`CAMERA ACCESS DENIED`}>
    <p className="text-retro-ink">{t`Grant camera permission in browser settings.`}</p>
    <RetroButton onClick={() => location.reload()}>{t`RETRY`}</RetroButton>
  </RetroPanel>
)}
```

**Pattern 4 — FAB hidden on pages that own the primary action**
```ts
// useFABActions — return [] to hide FAB entirely
if (location.pathname === "/scan") return [];
if (location.pathname.startsWith("/settings")) return [];
```

**Pattern 5 — localStorage key namespacing (user-facing keys get the `hws-` prefix)**
```ts
const SCAN_HISTORY_KEY = "hws-scan-history";  // legacy-consistent; do NOT use `offline-` / `sync-` prefixes (CI grep guard)
```

## Anti-Patterns to Avoid

**AP-1 — Don't wrap `@yudiel/react-qr-scanner` in a React Context.** The library already owns the camera stream internally; providing `MediaStream` via Context is redundant and creates rerender cascades.

**AP-2 — Don't navigate away from `/scan` for the action menu.** iOS PWA camera permission resets on navigation. The menu MUST overlay the paused `BarcodeScanner`, not replace it.

**AP-3 — Don't invalidate `itemKeys` on scan.** The scan is a read; invalidation wastes a request.

**AP-4 — Don't store scan results in IndexedDB or write a `ScanDatabase` class.** Scan history is 10 entries × small objects = localStorage territory. Any `idb` import trips the CI grep guard.

**AP-5 — Don't re-invent the FAB radial math.** Port the polar-coordinate `getActionPosition(index, radius, startAngle, arcAngle)` from legacy. It is correct and has tests.

**AP-6 — Don't make the FAB a `fixed` element inside each page.** Mount once in `AppShell`. Duplicate mounts create overlay z-index wars and double listeners.

**AP-7 — Don't use `motion` just for the FAB stagger.** CSS `transition-delay` + transforms is sufficient. Adding `motion` (~60 KB gzipped) for three animations is disproportionate.

**AP-8 — Don't name modules with `sync` or `offline` substrings anywhere under `src/`.** CI grep guard (`scripts/check-forbidden-imports.mjs`) blocks any specifier containing those (case-insensitive). This applies to **import specifiers**, so as long as your file is imported with a path like `@/lib/scanner/scan-history`, the filename `scan-history.ts` is fine. But `scan-sync-helper.ts` imported as `from "./scan-sync-helper"` **would fail the build**.

**AP-9 — Don't forget safe-area-inset-bottom on the FAB.** iPhone 13+ home-bar gesture area will clip a bottom-right FAB positioned with plain `bottom-4`. Use `bottom: max(1rem, env(safe-area-inset-bottom))`.

**AP-10 — Don't conflate "barcode on an item" with "short_code on an entity".** The legacy `lookupByShortCode` checks both item.short_code AND item.barcode AND container.short_code AND location.short_code. For v2.2 backend-search-based lookup, the FTS `search` param covers name/SKU/barcode on items only. Containers and locations are not reachable via this search. **Decision for v2.2: scope the `/scan` lookup to items only.** If a container/location short_code is scanned, the user sees "not found" and can create a new item with that code. Legacy's multi-entity lookup relied on IndexedDB full-entity fetch — online-only cannot replicate it without a new backend endpoint, which is out of v2.2 scope.

## Scalability Considerations

| Concern | v2.2 baseline | Growth plan |
|---|---|---|
| Scan latency on slow network | `useQuery` + `staleTime: 30s` caches within a session. First scan of unique code: ~200–500ms (local LAN backend). | If frequent scans against the same code dominate, bump `staleTime` further or add a `placeholderData` for optimistic UI. |
| Scan history growth | Capped at 10 entries (~2 KB) | Legacy cap is correct; don't grow. |
| External lookup reliability | OpenFoodFacts + OpenProductsDB can be slow (external). 10s timeout on backend side. | Acceptable — external prefill is a convenience, not required; UI shows "no product info" on timeout and proceeds to item-create form unpopulated. |
| FAB on large actions list | `getActionPosition` supports N items across an arc. Beyond 5, visual crowding. | Cap at 4 per route in `useFABActions` (matches legacy). |
| Camera memory on long `/scan` session | WebRTC `MediaStream` holds ~2–10 MB. Resumed stream doesn't leak. | Not observed in legacy; Chrome dev-tools memory tab is the debug path if reports emerge. |

## Pitfalls Flagged (new to v2.2 beyond v2.1 S-01..S-05)

**S2.2-01 — Backend `barcode` length constraint.** `GET /api/barcode/{barcode}` enforces `minLength:8 maxLength:14` via Huma validation. A QR code payload, alphanumeric short_code, or truncated scan fails with 422. The external-lookup hook **must** be gated by `/^\d{8,14}$/.test(code)` before calling, else we generate noise and confusing errors. Warehouse lookup via `?search=` has no length constraint and handles any scanned payload.

**S2.2-02 — Scan history not workspace-scoped.** Intentional (legacy decision). If users switch workspaces, clicking a history entry whose `entityId` points to another workspace returns 404/empty. Display-only consequence: gracefully degrade to "not found" re-lookup; don't crash.

**S2.2-03 — External barcode lookup is unauthenticated.** `GET /api/barcode/{barcode}` is registered as public (`router.go:319` — "Register barcode lookup (public, no auth required)"). Implication: no workspace awareness, no rate limit per user, shared across all tenants. Present concern is low (external cached by backend), but a malicious client could flood this endpoint. Flag for backend consideration — not v2.2 blocker.

**S2.2-04 — `@yudiel/react-qr-scanner` dynamic import under Vite.** The legacy uses `next/dynamic` with `ssr: false`. Vite has no SSR concern, so `React.lazy(() => import("@yudiel/react-qr-scanner").then(m => ({ default: m.Scanner })))` works. One gotcha: the library's bundle may tree-shake poorly, meaning lazy-loading saves little. Verify with `bun run build --analyze` in Step 3; if the scanner adds < 30 KB gzipped, statically import it and skip Suspense.

**S2.2-05 — Torch detection side-effect.** The legacy `checkTorchSupport()` starts a real `getUserMedia` stream to inspect `getCapabilities().torch`, then stops it. On iOS this can trigger a **second permission prompt** after the Scanner library already prompted. **Fix:** skip `checkTorchSupport` on iOS (legacy already does this: `if (isIOS) return false`). On Android, consider doing torch detection via the stream the Scanner component already owns (may require `Scanner` ref; library API not documented here, investigate in Step 4).

**S2.2-06 — FAB z-index collision with mobile drawer.** `AppShell` mobile drawer uses `z-20` (backdrop) and `z-30` (panel). Legacy FAB uses `z-50`. FAB at `z-50` **stays on top of the open drawer** — unintuitive. Hide FAB when drawer is open: `className={... (drawerOpen ? "hidden" : "")}` or mount FAB outside the drawer's parent so it's behind by default.

**S2.2-07 — React Router `errorElement` scope.** The `ErrorBoundaryPage` is attached at the `AppShell` route level. A throw in `ScanPage` loses the sidebar and shows a bare retro error page. If scan-specific recovery UI is desired (e.g., "scanner crashed; back to dashboard"), attach a per-route `errorElement` to `/scan`. Defer — current coarse boundary is acceptable.

## New vs Modified Files (summary)

### Modified
- `src/routes/index.tsx` — no change required; `/scan` route already registered.
- `src/components/layout/AppShell.tsx` — **one line**: mount `<FloatingActionButton />` inside the main column.
- `src/lib/api/index.ts` — **one line**: add `export * from "./scan"`.
- `src/lib/api/items.ts` — add `lookupByBarcode` helper (~10 LOC).
- `frontend2/package.json` — add `@yudiel/react-qr-scanner@^2.5.1`, `barcode-detector`. **Do not** add `lucide-react` or `motion` (per Q5, Q7).

### New (ordered by build step)
- **Step 1:** `src/lib/scanner/{init-polyfill.ts, feedback.ts, scan-history.ts, scan-lookup.ts (optional, see AP-10), types.ts, index.ts}` + `__tests__/`
- **Step 2:** `src/lib/api/scan.ts` + `src/lib/api/__tests__/scan.test.ts`
- **Step 4:** `src/components/scan/{BarcodeScanner.tsx, ScanErrorPanel.tsx, ScanOverlay.tsx, ManualBarcodeEntry.tsx, index.ts}` + `__tests__/`
- **Step 5:** `src/features/scan/hooks/{useScanLookup.ts, useScanFeedback.ts, useScanHistory.ts}` + `__tests__/`
- **Step 6:** `src/features/scan/{ScanPage.tsx, QuickActionMenu.tsx, ScanHistoryList.tsx}` (replace stub) + `__tests__/`
- **Step 7:** `src/components/fab/{FloatingActionButton.tsx, FABActionItem.tsx, useFABActions.tsx, index.ts}` + `__tests__/`

**Total diff shape:** ~14 new files in `src/components/`, ~6 new files in `src/features/scan/`, ~6 new files in `src/lib/`, ~28 test files. No changes to `retro/` barrel. No changes to existing features beyond small hooks/routes wiring (Step 8).

## Debt Closure — Stabilization Architecture Touches

These items are hygiene/debt, not architectural — but each has a small architectural touch:

| Item | Architectural implication |
|---|---|
| VERIFICATION.md backfill for v2.1 phases 58/59/60 | None — documentation only. |
| Sign off 8 unsigned `/demo` checkpoints for Phase 57 retro primitives | Exercise `src/pages/DemoPage.tsx` harness; confirm retro components are wired to demo routes. No new code. |
| Nyquist retroactive validation for v1.9 phases 43–47 | No architecture touch; runs `/gsd:validate-phase` tooling against already-shipped legacy code. |
| **pendingchange handler.go unit tests (57.3% → ≥80%)** | **New test scaffolding in `backend/internal/domain/warehouse/pendingchange/`.** Requires extracting dependencies behind interfaces (same pattern as v1.4 `WorkspaceBackupQueries` and `ServiceInterface`) so handler functions can be unit-tested with mocked repo. Functional-options-pattern factories from v1.4 are available (`backend/internal/testutil/factory/`). No new external packages. |
| **jobs ProcessTask unit tests (20.1% → actionable baseline)** | **Interface extraction** of task-processor dependencies (DB, Asynq client) to enable mocking. Architectural constraint flagged in v1.4: ProcessTask methods require database integration. A `ProcessorDeps` interface + constructor injection unblocks meaningful unit tests. |
| Remove 56 `waitForTimeout` calls across 24 E2E files | Event-driven wait helpers (`waitForURL`, `waitForSelector` with network-idle alternative `domcontentloaded`). Codebase already has the pattern (v1.4); apply mechanically. |
| Adopt orphaned Go test factories | Refactor Phase 23/24 integration tests to use `testutil/factory/` — same-package rename, no new code. |
| Fix 4 pre-existing Vitest failures (`frontend/lib/api/__tests__/client.test.ts`, `use-offline-mutation.test.ts`) | Localized test fixes in **legacy `/frontend`** — explicitly out of `frontend2/` grep-guard scope. These tests exist to maintain the legacy code until deprecation; no `frontend2/` changes. |

**Summary touch-points:** only the backend coverage items (pendingchange, jobs) require new Go production code (interface extraction for mock-ability). The rest are test-only or doc-only.

## Sources

- **Backend (HIGH):**
  - `backend/internal/domain/barcode/{handler,service}.go` — confirmed external-only lookup, no workspace search
  - `backend/internal/domain/warehouse/item/{handler.go (lines 56, 583), repository.go (line 28)}` — confirmed `FindByBarcode` is repository-only; `/items` list endpoint does FTS over name/SKU/barcode
  - `backend/internal/api/router.go:319` — confirmed `/api/barcode/{barcode}` is public
- **Frontend2 current state (HIGH):**
  - `frontend2/src/routes/index.tsx` — confirmed declarative `<Routes>`, `/scan` stub registered
  - `frontend2/src/components/retro/index.ts` — 19 retro atoms already exported (no new ones needed)
  - `frontend2/src/lib/api.ts` — `postMultipart` present; 401 refresh single-flight pattern
  - `frontend2/src/lib/api/items.ts` — workspace-scoped `itemsApi`; `itemKeys` query-key factory
  - `frontend2/src/features/items/hooks/useItemsList.ts` — canonical `useQuery` pattern with `useAuth().workspaceId`
  - `frontend2/src/features/items/hooks/useItemMutations.ts` — canonical invalidation pattern
  - `frontend2/src/components/layout/AppShell.tsx` — confirmed shell layout, mobile drawer z-index (20/30)
  - `frontend2/src/features/auth/AuthContext.tsx` — HttpError 401/403 token-clear only
  - `frontend2/package.json` — confirmed deps; `motion`, `lucide-react`, `@yudiel/react-qr-scanner` NOT installed
  - `scripts/check-forbidden-imports.mjs` — CI grep guard rules (exact `idb`/`serwist`, substring `offline`/`sync`)
- **Legacy `/frontend` reference patterns (HIGH):**
  - `frontend/components/scanner/{barcode-scanner,quick-action-menu}.tsx` — legacy scanner component and action menu (to port + retheme)
  - `frontend/lib/scanner/{init-polyfill,feedback,scan-history,scan-lookup,types}.ts` — port verbatim (minus `"use client"`, minus IndexedDB in `scan-lookup`)
  - `frontend/components/fab/floating-action-button.tsx` — FAB polar-coordinate math
  - `frontend/lib/hooks/use-fab-actions.tsx` — route-aware FAB actions pattern
- **Project docs (HIGH):**
  - `.planning/PROJECT.md` v2.2 scope, Decisions, Tech Debt
  - `.planning/STATE.md` — confirms defining-requirements state and prep items
  - `.planning/research/ARCHITECTURE_MOBILE_UX.md` v1.3 — ported patterns (iOS PWA camera, Fuse.js offline, progressive forms) — only the iOS PWA scanner constraint still applies for v2.2
- **Dependency compatibility (MEDIUM):**
  - `frontend/bun.lock:767` — `@yudiel/react-qr-scanner@2.5.1` declares `react ^17 || ^18 || ^19` peer; React 19.2.5 in `frontend2` satisfies.
