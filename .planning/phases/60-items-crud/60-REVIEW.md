---
phase: 60-items-crud
reviewed: 2026-04-16T14:22:08Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - backend/db/queries/items.sql
  - backend/internal/domain/warehouse/item/handler.go
  - backend/internal/domain/warehouse/item/service.go
  - backend/internal/domain/warehouse/item/repository.go
  - backend/internal/infra/postgres/item_repository.go
  - backend/internal/domain/warehouse/item/handler_test.go
  - backend/internal/domain/warehouse/item/service_test.go
  - frontend2/src/lib/api/items.ts
  - frontend2/src/features/items/forms/schemas.ts
  - frontend2/src/features/items/hooks/useItemMutations.ts
  - frontend2/src/features/items/hooks/useItemsList.ts
  - frontend2/src/features/items/hooks/useCategoryNameMap.ts
  - frontend2/src/features/items/forms/ItemForm.tsx
  - frontend2/src/features/items/panel/ItemPanel.tsx
  - frontend2/src/features/items/actions/ItemArchiveDeleteFlow.tsx
  - frontend2/src/features/items/filters/ItemsFilterBar.tsx
  - frontend2/src/features/items/filters/useItemsListQueryParams.ts
  - frontend2/src/features/items/ItemsListPage.tsx
  - frontend2/src/features/items/ItemDetailPage.tsx
  - frontend2/src/routes/index.tsx
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 60: Code Review Report

**Reviewed:** 2026-04-16T14:22:08Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 60 delivers items CRUD: a Go backend domain (handler, service, repository, SQL queries) and a React frontend (API client, mutations, list page, detail page, panel, filter bar, archive/delete flow). The architecture closely mirrors the Phase 59 borrower pattern. Overall quality is high — tests are thorough, workspace isolation is consistently enforced, and the cross-cutting concerns (SKU collision toast, Pitfall 8 page-reset, Pitfall 9 stale-detail removal) are all addressed.

Four warnings and three info items were found. No critical security or data-loss issues.

---

## Warnings

### WR-01: `Save` silently discards the restore operation (is_archived flip false → false)

**File:** `backend/internal/infra/postgres/item_repository.go:48-78`

**Issue:** `Save` dispatches to `ArchiveItem` only when `itemArchived && !existingArchived` (true → archived). The mirror case — `!itemArchived && existingArchived` (i.e. a restore, archived → active) — falls through to the generic `UpdateItem` path. `UpdateItem` does NOT set `is_archived`; looking at the SQL it only updates name/description/category/brand/…/needs_review. This means `Restore()` calls `item.Restore()` (sets `isArchived=false`), then `repo.Save(item)`, but `UpdateItem` never writes `is_archived = false` to the database. The item stays archived in Postgres.

The `RestoreItem` SQL query exists (`SET is_archived = false`) and is correctly defined but is never called via `Save`. It is also not called anywhere else in the repository.

```go
// Current code — restore path silently falls through to UpdateItem
if itemArchived && !existingArchived {
    err = r.queries.ArchiveItem(ctx, i.ID())
    return err
}
// MISSING: the inverse case is never handled
_, err = r.queries.UpdateItem(ctx, ...)  // does not touch is_archived
return err
```

**Fix:** Add the restore branch before the generic update:

```go
existingArchived := existing.IsArchived != nil && *existing.IsArchived
itemArchived    := i.IsArchived() != nil && *i.IsArchived()

if itemArchived && !existingArchived {
    return r.queries.ArchiveItem(ctx, i.ID())
}
if !itemArchived && existingArchived {
    return r.queries.RestoreItem(ctx, i.ID())
}
// fall through to generic field update
```

---

### WR-02: `FindByWorkspace` returns `len(items)` as the total count, not a true DB count

**File:** `backend/internal/infra/postgres/item_repository.go:183`

**Issue:** `FindByWorkspace` (used by `Service.List`) returns `len(items)` — the number of rows on the current page — as the `total` parameter instead of a real `COUNT(*)`. For any workspace with more items than the page size, the returned total equals `limit` rather than the actual item count. The handler uses this total to compute `TotalPages`, so pagination on the `/items` list (legacy, non-filtered path) is permanently broken for large datasets. `FindByWorkspaceFiltered` and `FindNeedingReview` both do this correctly with a separate `COUNT` query.

```go
// Current — wrong: returns page size, not true total
return items, len(items), nil
```

**Fix:** Issue a `CountItemsFiltered` (or a dedicated count query) before returning:

```go
// Option A: add a CountItems SQL query equivalent to ListItems's WHERE clause
// and call it here.

// Option B (simplest stopgap): acknowledge in a comment that List is
// only used internally/by legacy callers and document the limitation.
// The handler currently routes all public requests through ListFiltered,
// so the user-facing impact is limited to the ?needs_review=false branch
// which already goes through ListFiltered.
```

Note: the handler in `handler.go` routes public list requests to `ListFiltered` (not `List`), so this bug is not currently exercised by any live request path. However, `ServiceInterface.List` is part of the public interface and its documented contract (returning `int` total) is violated.

---

### WR-03: `rand.Read` error is silently discarded in `generateShortCode`

**File:** `backend/internal/domain/warehouse/item/service.go:19`

**Issue:** `rand.Read(b)` in `generateShortCode` returns an error that is never checked. Since Go 1.20 `crypto/rand.Read` no longer returns errors on any supported platform, so this is not exploitable in practice. However, the silent discard is a code-quality issue that warrants a suppression comment or explicit `_` assignment to make the intent clear. In older Go versions (pre-1.20) this was a real error path.

```go
rand.Read(b)  // error silently discarded
```

**Fix:** Explicitly discard with a comment, or panic (since the only way this fails on modern Go is if the OS PRNG is broken, which is catastrophic):

```go
if _, err := rand.Read(b); err != nil {
    panic("crypto/rand unavailable: " + err.Error())
}
```

---

### WR-04: `deleteMutation` in `ItemsListPage` does not navigate away after delete from list

**File:** `frontend2/src/features/items/ItemsListPage.tsx:89`

**Issue:** `useDeleteItem` is called without the `onAfterDelete` callback on the list page. `ItemDetailPage` correctly provides `onAfterDelete: () => navigate("/items")` to avoid re-rendering the stale detail. On the list page there is no navigation concern, but `useDeleteItem` in `useItemMutations.ts` already calls `qc.removeQueries({ queryKey: itemKeys.detail(id) })` followed by `qc.invalidateQueries({ queryKey: itemKeys.all })` — this is correct.

The actual issue is more subtle: the `deleteMutation` is constructed once at the top of the component (`const deleteMutation = useDeleteItem()`) but the `archiveTarget` state it closes over will always be the value at the time the `onSuccess` callback runs. For delete, `id` is passed via `mutateAsync(archiveTarget.id)` in the `onDelete` prop — the `id` argument flows through to `onSuccess(_void, id)` in the hook, so the cache removal uses the correct ID. This is fine.

However, after a successful delete from the list page, `archiveTarget` is never reset to `null`. The `ItemArchiveDeleteFlow` calls `archiveFlowRef.current?.close()` internally on success, but `archiveTarget` state remains pointing to the just-deleted item until the next `handleArchiveClick`. This is harmless because the flow ref closes the dialog, but if the flow's `nodeName` prop is re-read before `archiveTarget` updates, it shows the deleted item's name for a brief moment. More importantly, the `ItemArchiveDeleteFlow` is always rendered (outside the `items.length > 0` guard), so it reads `archiveTarget?.name ?? ""` on every render — a stale value is fine but could briefly show a wrong name in the dialogs if a user rapidly clicks archive on different items before the first mutation completes.

**Fix:** Reset `archiveTarget` after the delete/archive flow completes by passing a cleanup callback:

```tsx
const deleteMutation = useDeleteItem({
  onAfterDelete: () => setArchiveTarget(null),
});
// and in handleArchive (via ItemArchiveDeleteFlow's onArchive prop):
onArchive={() =>
  archiveTarget
    ? archiveMutation.mutateAsync(archiveTarget.id).then(() => setArchiveTarget(null))
    : Promise.resolve()
}
```

---

## Info

### IN-01: `UpdateItem` SQL does not guard `workspace_id`

**File:** `backend/db/queries/items.sql:27-35`

**Issue:** `UpdateItem` filters only on `id` (`WHERE id = $1`) with no `workspace_id` guard. The service guards workspace ownership via `GetByID(ctx, id, workspaceID)` before calling `Save`, so this is not currently exploitable. However, if the service layer is ever bypassed or the check is accidentally removed, `UpdateItem` could update an item belonging to a different workspace if given the correct item UUID.

The `ArchiveItem`, `RestoreItem`, and `DeleteItem` queries share the same pattern (no `workspace_id` in WHERE).

**Fix:** Add `AND workspace_id = $N` to `UpdateItem`, `ArchiveItem`, `RestoreItem`, and `DeleteItem`. The service-layer guard is defence in depth; the SQL-layer guard is the authoritative ownership check.

---

### IN-02: `useCategoryNameMap` fetches up to 100 categories; silent truncation for large workspaces

**File:** `frontend2/src/features/items/hooks/useCategoryNameMap.ts:23`

**Issue:** The hook hard-codes `limit: 100`. Workspaces with more than 100 categories will silently get an incomplete map — category names will show "—" for items whose category falls beyond the first 100 alphabetically. There is no pagination or indication of truncation.

**Fix:** Either increase the limit to a safe ceiling (500 or 1000, consistent with what other list pages use for reference data), or implement a dedicated "list all" endpoint that returns all categories without pagination. The same limit appears in `ItemsFilterBar.tsx:45` and `ItemForm.tsx:79`.

---

### IN-03: `isEditMode` detection in `ItemForm` uses `!!defaultValues?.name` which misidentifies unnamed items

**File:** `frontend2/src/features/items/forms/ItemForm.tsx:106`

**Issue:** `const isEditMode = !!defaultValues?.name` uses the presence of a non-empty `name` field to detect edit mode. If an item's name were somehow empty (e.g. data migrated from an external system), the form would incorrectly switch to create-mode behaviour (`autoFocus` on the name field). The correct signal is the mode prop or the item ID, not the name value.

This is currently benign because the backend enforces `minLength: 1` on name (both at the API and domain level), so an empty-named item cannot be created through the normal flow. It is still a fragile heuristic.

**Fix:** Pass an explicit `mode?: "create" | "edit"` prop to `ItemForm` and use that for the `autoFocus` check:

```tsx
const autoFocusName = (props.mode ?? "create") === "create";
```

---

_Reviewed: 2026-04-16T14:22:08Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
