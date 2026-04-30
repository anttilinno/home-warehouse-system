# Phase 47: Completion Workflow and Polish - Research

**Researched:** 2026-03-14
**Domain:** Quick Capture session summary, Needs Review filter chip, item detail badge + action, i18n
**Confidence:** HIGH

## Summary

Phase 47 is the final piece of the v1.9 Quick Capture milestone. It adds UI polish to close the capture-to-completion loop. The backend already supports everything needed: `needs_review` is a boolean column on items, `GET /workspaces/{id}/items?needs_review=true` returns needing-review items (implemented in Phase 43), and `PATCH /workspaces/{id}/items/{id}` with `needs_review: false` marks an item as reviewed. No backend changes are required.

The work is entirely frontend: (1) a session summary screen/modal shown when the user taps "Done" from quick capture, (2) a "Needs Review" quick-filter chip in the items list, (3) a "Needs Review" badge + "Mark as Reviewed" button on item detail, and (4) translations for all new strings in English, Estonian, and Russian. The codebase patterns for each of these already exist — session summary is analogous to the existing toast/count display; the filter chip follows the `useFilters` + `FilterBar` pattern; the badge follows the existing archived/pending badge pattern; and translations follow the strict `messages/*.json` + `useTranslations()` pattern.

All new work is client-side React/TypeScript with no new npm dependencies (project-wide constraint from v1.9 research). The items list already has client-side filter logic in `filteredItems` memo. The item detail page already uses `itemsApi` for reads and updates.

**Primary recommendation:** Split into two plans — Plan 01: session summary on quick-capture + Needs Review filter chip in items list. Plan 02: Needs Review badge + Mark as Reviewed on item detail + translations sweep.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COMP-04 | User sees session summary when ending quick capture (count + thumbnails) | `BatchCaptureContext` already has `captureCount` and `incrementCaptureCount`. Photos are in the `photos` state in `QuickCapturePage`. The "Done" button already navigates to `/dashboard/items` via `router.push`. Summary is a modal/sheet shown before navigation, displaying `captureCount` and thumbnail previews of the current in-memory `photos` array. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-intl | (project version) | `useTranslations()` hook for i18n strings | Project-wide i18n standard; all existing UI strings use this pattern |
| next/navigation `useRouter` | (project version) | Navigate after session summary dismissal | Already used in `QuickCapturePage` |
| Radix UI / shadcn Dialog or Sheet | (project version) | Session summary overlay UI | Both `Dialog` and `Sheet` already in project; `Sheet` side="bottom" used for batch settings sheets |
| `itemsApi.update()` (internal) | n/a | `PATCH` item to set `needs_review: false` | Already used in items list and item detail for updates |
| `useFilters` hook (internal) | n/a | Add "Needs Review" boolean filter chip to items list | Already used in `ItemsPage` for categories/brands/warranty/insurance filters |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Lucide icons | (project version) | `CheckCircle`, `ClipboardList`, or similar for "Needs Review" badge | All icons already from Lucide in this project |
| `Badge` component (shadcn) | (project version) | "Needs Review" badge on item detail | Already used for "Archived", "Pending", short_code badges |
| `toast` (sonner) | (project version) | Success feedback on "Mark as Reviewed" | Already used throughout items list and item detail |
| Vitest | (project version) | Unit test for filter logic if needed | Existing test infra at `frontend/vitest.config.ts` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bottom Sheet for session summary | Full-screen Dialog | Sheet side="bottom" is more mobile-friendly; consistent with batch settings sheets already in quick-capture page |
| Client-side `needs_review` filter (no API call) | New API call `GET items?needs_review=true` | The items list already fetches all items and filters client-side; adding a boolean client-side filter is the same pattern as warranty/insurance filters. However, for large catalogs a dedicated API call would be more accurate. Given items list uses infinite scroll, the cleanest approach is to add `needs_review=true` as a query param to `itemsApi.list()` — triggering a fresh fetch. This is consistent with how `showArchived` changes the filter and triggers a refetch. |
| Standalone "Needs Review" toggle button | Filter chip via `useFilters` | Filter chip via `addFilter` is the existing pattern; keeps filter state consistent with other filters and saved filter sets |

**Installation:**
```bash
# No new packages. Zero new dependencies.
```

## Architecture Patterns

### Recommended Project Structure

```
frontend/
├── app/[locale]/(dashboard)/dashboard/items/quick-capture/
│   └── page.tsx                        # MODIFY: session summary before "Done" navigation
├── app/[locale]/(dashboard)/dashboard/items/
│   └── page.tsx                        # MODIFY: add needs_review filter chip + client-side filter
├── app/[locale]/(dashboard)/dashboard/items/[id]/
│   └── page.tsx                        # MODIFY: add Needs Review badge + Mark as Reviewed button
├── lib/api/
│   └── items.ts                        # MODIFY: add needs_review param to list()
└── messages/
    ├── en.json                          # MODIFY: add session summary + needs-review strings
    ├── et.json                          # MODIFY: same keys in Estonian
    └── ru.json                          # MODIFY: same keys in Russian
```

### Pattern 1: Session Summary Sheet (COMP-04)

**What:** When user taps "Done" (currently `router.push("/dashboard/items")`), intercept the tap, show a bottom sheet with captured count and photo thumbnails, then navigate after the user dismisses.

**When to use:** User has captured at least 1 item (`captureCount > 0`). If `captureCount === 0`, navigate immediately without showing the summary.

**Key data available at summary time:**
- `captureCount` from `useBatchCapture()` — total items saved this session
- `photos` state in `QuickCapturePage` — current item's in-progress photos (may be empty after last save-reset)
- Individual item's captured photos are already cleared from the `photos` state after each save (the save flow calls `setPhotos([])` and revokes object URLs). So by the time the user taps "Done", the `photos` array represents the unsaved photos of the current in-progress item — not all session photos.

**Important implication:** The session summary cannot show thumbnails of previously captured items from the in-memory `photos` state. Three options:
1. **Track thumbnail URLs** in `BatchCaptureProvider` — store a list of preview URLs (one per captured item) when `incrementCaptureCount()` is called.
2. **Read from IndexedDB** — query `quickCapturePhotos` by all tempIds captured in the session. Complex and async.
3. **Show count only, no thumbnails** — the success criteria says "count AND thumbnails" but thumbnails are the hard part.

**Recommended approach:** Extend `BatchCaptureContext` with a `sessionThumbnails: string[]` array. When `storePhoto()` creates an object URL for each photo, pass the blob URL into `incrementCaptureCount` (or add a separate `addSessionThumbnail(url: string)` method). Since `captureCount` already tracks the count, adding thumbnail tracking to the same context is the natural extension.

However, object URLs are revoked in the save flow (`photos.forEach(p => URL.revokeObjectURL(p.preview))`). To avoid showing revoked URLs in the summary, either: (a) keep a copy of the last blob for each item's first photo before revoking, or (b) create a **separate** object URL for summary display purposes that is revoked after summary is dismissed.

**Cleanest pattern:** In `handleSave()`, after capturing `photos` but before revoking object URLs, create a summary thumbnail from `photos[0].blob` using `URL.createObjectURL()` and call `addSessionThumbnail(thumbnailUrl)`. Revoke summary thumbnails when the session summary is dismissed (sheet close handler).

```typescript
// In BatchCaptureProvider (addition)
const [sessionThumbnails, setSessionThumbnails] = useState<string[]>([]);

const addSessionThumbnail = useCallback((url: string) => {
  setSessionThumbnails(prev => [...prev, url]);
}, []);

const clearSessionThumbnails = useCallback(() => {
  sessionThumbnails.forEach(url => URL.revokeObjectURL(url));
  setSessionThumbnails([]);
}, [sessionThumbnails]);
```

```typescript
// In QuickCapturePage.handleSave() — before setPhotos([]) and revokeObjectURL loop:
if (photos[0]) {
  const summaryThumb = URL.createObjectURL(photos[0].blob);
  addSessionThumbnail(summaryThumb);
}
// existing revoke + reset...
```

```typescript
// In QuickCapturePage — replace the "Done" button handler:
const handleDone = useCallback(() => {
  if (captureCount > 0) {
    setSummaryOpen(true);  // show summary sheet
  } else {
    router.push("/dashboard/items");
  }
}, [captureCount, router]);

// Summary sheet dismiss:
const handleDismissSummary = () => {
  clearSessionThumbnails();
  resetSettings(); // existing: resets category/location + count
  router.push("/dashboard/items");
};
```

### Pattern 2: "Needs Review" Filter Chip in Items List

**What:** A dedicated "Needs Review" toggle button (or auto-applied filter chip) that, when active, fetches only items with `needs_review=true` from the server.

**How the existing filter system works:**
- `useFilters()` manages a `Map<string, Filter>` — adding a filter with `key: "needsReview", type: "boolean", value: true` creates a chip in `FilterBar`.
- The `filteredItems` memo applies client-side filter logic by calling `getFilter("needsReview")`.
- The `useInfiniteScroll` hook fetches items via `itemsApi.list()`. Currently it does not pass `needs_review` to the API.

**Two approaches:**
1. **Client-side only** — Add `needs_review` check to the `filteredItems` memo. Simple, consistent with warranty/insurance filters. Problem: only filters among already-fetched items. If the user has 500+ items, many needing review won't be visible until scrolled to.
2. **Server-side filter** — Pass `needs_review=true` to `itemsApi.list()`. Requires changing the `fetchFunction` in `useInfiniteScroll` to accept the filter, and re-triggering the scroll when the filter changes.

**Given the items list already uses infinite scroll with server-side pagination, client-side filtering is inherently incomplete for needs_review.** The backend already has `ListNeedingReview` (Phase 43). The correct approach is server-side.

**Recommended:** Add `needsReview?: boolean` to the `itemsApi.list()` params. Add it as a `dependency` to the `useInfiniteScroll` call so the list refetches when the filter toggles. Add a quick-access "Needs Review" button near the filter bar (same row as "Active/Archived" toggle) — when clicked, it adds/removes the `needsReview` filter from `useFilters` AND triggers a fresh fetch with `needs_review=true`.

```typescript
// items.ts list():
list: async (workspaceId, params) => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append("page", params.page.toString());
  if (params?.limit) queryParams.append("limit", params.limit.toString());
  if (params?.needs_review) queryParams.append("needs_review", "true");
  // ...
}
```

```typescript
// items/page.tsx — add needsReview state:
const [showNeedsReview, setShowNeedsReview] = useState(false);

// Pass to useInfiniteScroll fetchFunction and add as dependency:
useInfiniteScroll({
  fetchFunction: async (page) => {
    return await itemsApi.list(workspaceId, {
      page,
      limit: 50,
      needs_review: showNeedsReview || undefined,
    });
  },
  dependencies: [workspaceId, showNeedsReview],
  // ...
})
```

Note: `showNeedsReview` should be mutually exclusive with `showArchived` — archived items with `needs_review=true` are unlikely to matter, and the backend `ListNeedingReview` filters non-archived items.

### Pattern 3: "Needs Review" Badge + Mark as Reviewed on Item Detail

**What:** On the item detail page, if `item.needs_review === true`, show a prominent banner/badge and a "Mark as Reviewed" button. Clicking the button calls `itemsApi.update(workspaceId, itemId, { needs_review: false })` and reloads the item.

**Current item detail state:** The item detail page (`app/.../items/[id]/page.tsx`) already:
- Loads item via `loadItem()` / `itemsApi.get()`
- Responds to SSE `item.updated` events by calling `loadItem()` again
- Shows action buttons (Edit, Archive) in the header
- Shows badges for "Archived" status

**Implementation:** Add a conditional banner between the header and the main content grid when `item.needs_review === true`:

```typescript
{item.needs_review && (
  <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
      <ClipboardList className="h-4 w-4" />
      <span className="text-sm font-medium">{t("needsReview")}</span>
    </div>
    <Button
      size="sm"
      variant="outline"
      onClick={handleMarkAsReviewed}
      disabled={isMarkingReviewed}
    >
      {isMarkingReviewed ? t("marking") : t("markAsReviewed")}
    </Button>
  </div>
)}
```

```typescript
const handleMarkAsReviewed = async () => {
  if (!item || !workspaceId) return;
  setIsMarkingReviewed(true);
  try {
    await itemsApi.update(workspaceId, item.id, { needs_review: false });
    toast.success(t("markedAsReviewed"));
    loadItem(); // refresh
  } catch {
    toast.error(t("markReviewedFailed"));
  } finally {
    setIsMarkingReviewed(false);
  }
};
```

Note: `ItemUpdate` in `frontend/lib/types/items.ts` already includes `needs_review?: boolean`. No type changes needed.

Note: `itemsApi` only has `update()` not a dedicated `markAsReviewed()`. Use `itemsApi.update()` directly with `{ needs_review: false }`. Do not add a separate API method.

### Pattern 4: i18n Translation Pattern

**How the project handles i18n:**
- Three locale files: `messages/en.json`, `messages/et.json`, `messages/ru.json`
- All UI strings go in locale files; no hardcoded English strings in components
- Components use `const t = useTranslations("namespace")` where namespace maps to a top-level key in the JSON
- New strings for quick capture go in the existing `"quickCapture"` namespace
- New strings for item detail go in the existing `"items"` namespace (already has extensive keys)

**Strings needed for Phase 47:**

For session summary (in `"quickCapture"` namespace):
```json
"sessionSummary": "Session Complete",
"sessionSummaryDescription": "{count} {count, plural, one {item} other {items}} captured",
"sessionSummaryContinue": "Go to Items",
"sessionSummaryCapture": "Capture More"
```

For Needs Review filter chip (in `"items"` namespace or a new `"needsReview"` sub-key):
```json
"needsReview": "Needs Review",
"markAsReviewed": "Mark as Reviewed",
"marking": "Marking...",
"markedAsReviewed": "Item marked as reviewed",
"markReviewedFailed": "Failed to mark as reviewed"
```

**All three locale files must be updated simultaneously.** Never leave a key missing in et.json or ru.json — next-intl will fall back to the message key string, not the English fallback.

### Anti-Patterns to Avoid

- **Storing photo blobs in context** — context re-renders cause performance issues with large blobs. Store only lightweight thumbnail URLs (object URLs) for display.
- **Not revoking object URLs** — the project already has a three-location revoke pattern. Session thumbnail URLs must also be revoked (on dismiss, on unmount of the provider).
- **Hardcoding English strings** — every visible string must go through `useTranslations()`. The items list and item detail pages already have some hardcoded strings (e.g., "Add Item", "Item Catalog") but Phase 47 must not add more.
- **Client-side-only needs_review filter** — incorrect for paginated lists. Must pass `needs_review=true` to the API and trigger a fresh fetch.
- **Calling `itemsApi.markAsReviewed()`** — no such method exists. Use `itemsApi.update(workspaceId, id, { needs_review: false })`.
- **Showing session summary when captureCount is 0** — confusing empty state. Navigate directly if nothing was captured.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session summary overlay | Custom positioned div | Radix Sheet (side="bottom") | Already in project; handles focus trap, backdrop, a11y |
| Object URL lifecycle | Manual tracking | Revoke in sheet `onOpenChange(false)` + provider unmount | Pattern already established in photo strip revoke logic |
| Filter chip display | Custom chip component | `useFilters` + `FilterBar` | Already handles display value, remove button, clear-all |
| "Needs Review" API call | Custom fetch | `itemsApi.update(wsId, id, { needs_review: false })` | Already typed; handles auth via apiClient |
| Server-side needs_review filter | Custom fetch | `itemsApi.list(wsId, { needs_review: true })` + `needs_review` query param | Backend already has this via `ListNeedingReview` |
| i18n plural forms | Custom pluralization | next-intl ICU message format `{count, plural, one {...} other {...}}` | Already used in `capturedCount: "{count} captured"` |

## Common Pitfalls

### Pitfall 1: Object URL Revocation for Session Thumbnails
**What goes wrong:** Session thumbnails are created as `URL.createObjectURL(blob)` and stored in context. If they are not revoked, they leak memory for the duration of the browser session.
**Why it happens:** The existing `photos` array object URLs are revoked in three places (removal, save-reset, unmount). Session thumbnails need their own revocation trigger: when the summary sheet closes and when `BatchCaptureProvider` unmounts.
**How to avoid:** Add `clearSessionThumbnails()` to `BatchCaptureProvider` that calls `URL.revokeObjectURL()` on each thumbnail. Call it in the sheet's `onOpenChange(false)` callback before navigating, and in the provider's cleanup `useEffect`.
**Warning signs:** Memory usage growing after repeated quick-capture sessions.

### Pitfall 2: Session Photos Array is Empty After Save-Reset
**What goes wrong:** Developer assumes `photos` state in `QuickCapturePage` holds all session photos. It does not — `setPhotos([])` clears it after each save. By "Done" time, `photos` is empty (or contains only the current unsaved item's photos).
**Why it happens:** The save-reset loop is the core UX. Photos are ephemeral per-item.
**How to avoid:** Capture the first photo's blob URL BEFORE the save-reset revokes it and store it in `BatchCaptureContext.sessionThumbnails`. Do this inside `handleSave()` after `storePhoto()` but before `photos.forEach(p => URL.revokeObjectURL(p.preview))`.
**Warning signs:** Session summary shows 0 thumbnails even though items were captured.

### Pitfall 3: Needs Review Filter and Infinite Scroll Refetch
**What goes wrong:** `showNeedsReview` state is toggled but the items list does not refetch — it continues showing the existing items because `dependencies` in `useInfiniteScroll` was not updated.
**Why it happens:** The `fetchFunction` is a closure that captures `showNeedsReview`, but `dependencies` must include `showNeedsReview` for the hook to reset and refetch.
**How to avoid:** Add `showNeedsReview` to the `dependencies` array in `useInfiniteScroll`. Confirm `useInfiniteScroll` supports re-triggering on dependency change (it does — confirmed in items page where it uses `[workspaceId]` as dependency).
**Warning signs:** Toggling "Needs Review" chip shows no change in items list.

### Pitfall 4: Missing Translation Keys in et.json or ru.json
**What goes wrong:** New strings added to `en.json` but not to `et.json` or `ru.json`. In Estonian/Russian locale, next-intl displays the raw message key instead of translated text.
**Why it happens:** Developer updates English and forgets the other two files.
**How to avoid:** Update all three files in the same task/commit. The session summary and needs-review strings are simple enough that translations can be provided immediately.
**Warning signs:** Estonian or Russian UI showing raw key strings like `"quickCapture.sessionSummary"`.

### Pitfall 5: ItemUpdate Type Does Not Include needs_review at itemsApi Level
**What goes wrong:** Developer tries to call `itemsApi.update(wsId, id, { needs_review: false })` and gets a TypeScript error.
**Why it happens:** Checking `ItemUpdate` — it already has `needs_review?: boolean` at line 69 of `frontend/lib/types/items.ts`. This is NOT a pitfall. But the `itemsApi.update()` function itself passes the entire `data` object to `apiClient.patch()`, so the field will be included. Confirmed safe.
**Warning signs:** If TypeScript complains, verify `ItemUpdate` includes `needs_review`.

### Pitfall 6: Needs Review Filter Conflicts with Show Archived Toggle
**What goes wrong:** User activates "Needs Review" filter and "Show Archived" at the same time. The `ListNeedingReview` backend endpoint filters non-archived items only. The combined state may produce confusing results.
**Why it happens:** The two boolean toggles are independent.
**How to avoid:** When `showNeedsReview` is toggled on, force `showArchived` to `false` (and vice versa). This matches the mutual exclusion of active/archived views that already exists conceptually.
**Warning signs:** UI showing archived + needs-review items that the backend would not return.

## Code Examples

### Session Thumbnail Tracking in BatchCaptureContext

```typescript
// Source: frontend/lib/contexts/batch-capture-context.tsx (additions)

const [sessionThumbnails, setSessionThumbnails] = useState<string[]>([]);

const addSessionThumbnail = useCallback((url: string) => {
  setSessionThumbnails(prev => [...prev, url]);
}, []);

const clearSessionThumbnails = useCallback(() => {
  setSessionThumbnails(prev => {
    prev.forEach(url => URL.revokeObjectURL(url));
    return [];
  });
}, []);

// Also reset in resetSettings():
const resetSettings = useCallback(() => {
  setSettings(DEFAULT_SETTINGS);
  setCaptureCount(0);
  setSessionThumbnails(prev => {
    prev.forEach(url => URL.revokeObjectURL(url));
    return [];
  });
}, []);

// Cleanup on unmount:
useEffect(() => {
  return () => {
    setSessionThumbnails(prev => {
      prev.forEach(url => URL.revokeObjectURL(url));
      return [];
    });
  };
}, []);
```

### Session Summary Sheet in QuickCapturePage

```typescript
// Source: frontend/app/.../quick-capture/page.tsx (additions)
const [summaryOpen, setSummaryOpen] = useState(false);

const handleDone = useCallback(() => {
  if (captureCount > 0) {
    setSummaryOpen(true);
  } else {
    router.push("/dashboard/items");
  }
}, [captureCount, router]);

const handleDismissSummary = useCallback(() => {
  setSummaryOpen(false);
  clearSessionThumbnails();
  resetSettings();
  router.push("/dashboard/items");
}, [clearSessionThumbnails, resetSettings, router]);

// In handleSave(), after storePhoto() calls but before the revoke loop:
if (photos[0]) {
  const summaryThumb = URL.createObjectURL(photos[0].blob);
  addSessionThumbnail(summaryThumb);
}
// existing: photos.forEach((p) => URL.revokeObjectURL(p.preview));

// Replace the "Done" button onClick:
// onClick={() => router.push("/dashboard/items")}
// becomes:
// onClick={handleDone}

// Session summary Sheet JSX:
<Sheet open={summaryOpen} onOpenChange={(open) => { if (!open) handleDismissSummary(); }}>
  <SheetContent side="bottom">
    <SheetHeader>
      <SheetTitle>{t("sessionSummary")}</SheetTitle>
    </SheetHeader>
    <div className="py-4">
      <p className="text-center text-lg font-semibold">
        {t("sessionSummaryDescription", { count: captureCount })}
      </p>
      {sessionThumbnails.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {sessionThumbnails.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className="h-16 w-16 rounded-md object-cover shrink-0"
            />
          ))}
        </div>
      )}
    </div>
    <div className="flex gap-2 pb-4">
      <Button variant="outline" className="flex-1" onClick={() => setSummaryOpen(false)}>
        {t("sessionSummaryCapture")}
      </Button>
      <Button className="flex-1" onClick={handleDismissSummary}>
        {t("sessionSummaryContinue")}
      </Button>
    </div>
  </SheetContent>
</Sheet>
```

### Needs Review API Param

```typescript
// Source: frontend/lib/api/items.ts (list function extension)
list: async (workspaceId, params) => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append("page", params.page.toString());
  if (params?.limit) queryParams.append("limit", params.limit.toString());
  if (params?.needs_review) queryParams.append("needs_review", "true");
  const url = `/workspaces/${workspaceId}/items${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  return apiClient.get<ItemListResponse>(url);
},
```

```typescript
// Source: frontend/lib/api/items.ts (list params type extension)
// Extend the params object in the function signature:
params?: { page?: number; limit?: number; needs_review?: boolean }
```

### Needs Review Toggle in Items List

```typescript
// Source: frontend/app/.../items/page.tsx (additions)
const [showNeedsReview, setShowNeedsReview] = useState(false);

// In useInfiniteScroll fetchFunction:
fetchFunction: async (page) => {
  if (!workspaceId) return { items: [], total: 0, page: 1, total_pages: 0 };
  return await itemsApi.list(workspaceId, {
    page,
    limit: 50,
    needs_review: showNeedsReview || undefined,
  });
},
dependencies: [workspaceId, showNeedsReview],

// Button in filter row (alongside existing "Active/Archived" button):
<Button
  variant={showNeedsReview ? "default" : "outline"}
  size="sm"
  onClick={() => {
    setShowNeedsReview(prev => !prev);
    if (!showNeedsReview) setShowArchived(false); // mutual exclusion
  }}
>
  <ClipboardList className="sm:mr-2 h-4 w-4" />
  <span className="hidden sm:inline">{t("needsReview")}</span>
</Button>
```

### Mark as Reviewed on Item Detail

```typescript
// Source: frontend/app/.../items/[id]/page.tsx (additions)
const [isMarkingReviewed, setIsMarkingReviewed] = useState(false);

const handleMarkAsReviewed = async () => {
  if (!item || !workspaceId) return;
  setIsMarkingReviewed(true);
  try {
    await itemsApi.update(workspaceId, item.id, { needs_review: false });
    toast.success(t("markedAsReviewed"));
    loadItem();
  } catch {
    toast.error(t("markReviewedFailed"));
  } finally {
    setIsMarkingReviewed(false);
  }
};

// Needs Review banner (placed after header, before the main content grid):
{item.needs_review && (
  <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
      <ClipboardList className="h-4 w-4" />
      <span className="text-sm font-medium">{t("needsReview")}</span>
    </div>
    <Button
      size="sm"
      variant="outline"
      onClick={handleMarkAsReviewed}
      disabled={isMarkingReviewed}
    >
      {isMarkingReviewed ? t("marking") : t("markAsReviewed")}
    </Button>
  </div>
)}
```

### i18n Strings to Add

All three locale files must receive these keys. Estonian and Russian translations are given below.

**en.json additions** (within `"quickCapture"` namespace):
```json
"sessionSummary": "Session Complete",
"sessionSummaryDescription": "{count} {count, plural, one {item} other {items}} captured",
"sessionSummaryContinue": "Go to Items",
"sessionSummaryCapture": "Capture More"
```

**en.json additions** (within `"items"` namespace — add as top-level keys in items object):
```json
"needsReview": "Needs Review",
"markAsReviewed": "Mark as Reviewed",
"marking": "Marking...",
"markedAsReviewed": "Marked as reviewed",
"markReviewedFailed": "Failed to mark as reviewed"
```

**et.json additions** (within `"quickCapture"` namespace):
```json
"sessionSummary": "Seanss lõpetatud",
"sessionSummaryDescription": "{count} {count, plural, one {ese} other {eset}} jäädvustatud",
"sessionSummaryContinue": "Mine esemete juurde",
"sessionSummaryCapture": "Jäädvusta veel"
```

**et.json additions** (within `"items"` namespace):
```json
"needsReview": "Vajab ülevaatust",
"markAsReviewed": "Märgi ülevaadatuks",
"marking": "Märkimine...",
"markedAsReviewed": "Märgitud ülevaadatuks",
"markReviewedFailed": "Ülevaadatuks märkimine ebaõnnestus"
```

**ru.json additions** (within `"quickCapture"` namespace):
```json
"sessionSummary": "Сеанс завершён",
"sessionSummaryDescription": "{count} {count, plural, one {предмет} few {предмета} other {предметов}} захвачено",
"sessionSummaryContinue": "Перейти к предметам",
"sessionSummaryCapture": "Захватить ещё"
```

**ru.json additions** (within `"items"` namespace):
```json
"needsReview": "Требует проверки",
"markAsReviewed": "Отметить как проверенное",
"marking": "Отмечаем...",
"markedAsReviewed": "Отмечено как проверенное",
"markReviewedFailed": "Не удалось отметить как проверенное"
```

Note: Russian pluralization uses ICU `{count, plural, one {предмет} few {предмета} other {предметов}}` which next-intl supports natively.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Navigate immediately on "Done" | Show session summary sheet first | Phase 47 | User sees confirmation of what was captured before leaving |
| No "Needs Review" filter in UI | "Needs Review" toggle button triggers server-side filter | Phase 47 | Users can focus on just quick-captured items awaiting details |
| Item detail shows no needs_review indicator | Amber banner with one-tap review action | Phase 47 | Completion workflow is self-contained on the item detail page |

**Deprecated/outdated:**
- Direct navigation in "Done" button `onClick` — replaced with `handleDone()` that conditionally shows summary.

## Open Questions

1. **Should session thumbnails be limited in display count?**
   - What we know: `captureCount` can be up to any number in a session. Showing 20+ thumbnails in the summary sheet could overflow.
   - What's unclear: Maximum practical session size.
   - Recommendation: Display up to 8 thumbnails in the summary, with "+ N more" text if `captureCount > 8`. Simple `sessionThumbnails.slice(0, 8)` with `captureCount - 8` remainder label.

2. **Should the "Needs Review" filter chip in items list be a persistent toggle or a filter via `useFilters`?**
   - What we know: `showArchived` is a separate boolean toggle (not via `useFilters`). `showNeedsReview` can follow the same pattern for consistency.
   - What's unclear: Whether saved filters should include "Needs Review" state.
   - Recommendation: Use a separate `showNeedsReview` boolean state (not via `useFilters`) to match the `showArchived` pattern exactly. This keeps saved filter compatibility unchanged.

3. **Does `itemsApi.update()` need to pass `needs_review: false` explicitly or can it be omitted?**
   - What we know: `ItemUpdate.needs_review` is `boolean | undefined`. Setting it to `false` explicitly clears the flag. Omitting it leaves the flag unchanged.
   - What's unclear: Nothing — must explicitly pass `false`.
   - Recommendation: Always pass `{ needs_review: false }` in `handleMarkAsReviewed`.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (project standard) |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `cd frontend && npx vitest run` |
| Full suite command | `cd frontend && npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMP-04 | Session summary shown when captureCount > 0 on "Done" | manual | Navigate through quick capture, save items, tap Done | N/A — UI behavior |
| COMP-04 | Session summary shows count of captured items | manual | Verify count display matches items saved | N/A — UI behavior |
| COMP-04 | Session summary shows thumbnails | manual | Verify thumbnails appear for each captured item | N/A — UI behavior |
| COMP-04 | "Needs Review" filter chip narrows items list | manual | Filter, verify only needs_review=true items shown | N/A — UI behavior |
| COMP-04 | "Mark as Reviewed" removes needs_review flag | manual | Tap button, verify banner disappears, API called | N/A — UI behavior |
| COMP-04 | All new strings translated in EN/ET/RU | automated (build check) | `cd frontend && npx tsc --noEmit` (type check messages keys) | N/A — JSON |

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run` (existing test suite)
- **Per wave merge:** `cd frontend && npx vitest run`
- **Phase gate:** Full suite green + manual walkthrough before `/gsd:verify-work`

### Wave 0 Gaps
None — no new test files are required. The phase changes are UI behavior changes (sheets, badges, buttons) that are not unit-testable without a browser environment. The existing suite (hooks, utils, sync) continues to cover the unchanged infrastructure.

## Sources

### Primary (HIGH confidence)
- Codebase: `frontend/app/.../items/quick-capture/page.tsx` — current "Done" button, `handleSave()` revoke pattern, `BatchCaptureProvider` usage
- Codebase: `frontend/lib/contexts/batch-capture-context.tsx` — `captureCount`, `incrementCaptureCount`, `resetSettings`, `sessionStorage` persistence
- Codebase: `frontend/app/.../items/page.tsx` — `useFilters`, `FilterBar`, `filterChips`, `showArchived` toggle pattern, `useInfiniteScroll` dependency array, `filteredItems` memo
- Codebase: `frontend/app/.../items/[id]/page.tsx` — `loadItem()`, `handleArchive()`, badge display patterns, `itemsApi.update()` usage
- Codebase: `frontend/lib/api/items.ts` — `list()` params, `update()` signature
- Codebase: `frontend/lib/types/items.ts` — `Item.needs_review`, `ItemUpdate.needs_review` (both confirmed present)
- Codebase: `frontend/lib/hooks/use-filters.ts` — `addFilter`, filter type shapes
- Codebase: `frontend/messages/en.json` — existing `"quickCapture"` namespace structure
- Codebase: `frontend/messages/et.json` — existing Estonian quick capture keys
- Codebase: `frontend/messages/ru.json` — existing Russian quick capture keys
- Codebase: `backend/internal/domain/warehouse/item/handler.go` — `ListItemsInput.NeedsReview bool` query param confirmed; `ListNeedingReview` service call confirmed
- Codebase: `backend/internal/domain/warehouse/item/service.go` — `ListNeedingReview` confirmed at line 209

### Secondary (MEDIUM confidence)
- Phase 43 RESEARCH.md (referenced in STATE.md) — confirms COMP-01/02/03 are complete, `needs_review` column established
- Phase 46 RESEARCH.md — confirms v1.9 constraint: zero new npm dependencies

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries and APIs verified in codebase
- Architecture: HIGH — all patterns derived from reading actual implementation
- Pitfalls: HIGH — derived from reading code (object URL revoke pattern, filteredItems memo scope, infinite scroll dependencies)
- i18n translations: MEDIUM — Estonian/Russian translations are best-effort; should be reviewed by a native speaker

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable — no external dependencies; all internal patterns)
