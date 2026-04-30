---
phase: 60-items-crud
fixed_at: 2026-04-16T14:35:00Z
review_path: .planning/phases/60-items-crud/60-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 60: Code Review Fix Report

**Fixed at:** 2026-04-16T14:35:00Z
**Source review:** .planning/phases/60-items-crud/60-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (WR-01 through WR-04; IN-* excluded per fix_scope=critical_warning)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: `Save` silently discards the restore operation

**Files modified:** `backend/internal/infra/postgres/item_repository.go`
**Commit:** 9db42e7
**Applied fix:** Added the missing `!itemArchived && existingArchived` branch before the generic `UpdateItem` path. When an item transitions from archived to active, `Save` now calls `r.queries.RestoreItem(ctx, i.ID())` which sets `is_archived = false` in the database. Also cleaned up the duplicate `existingArchived`/`itemArchived` variable declarations that existed in the original code.

### WR-02: `FindByWorkspace` returns `len(items)` as the total count

**Files modified:** `backend/internal/infra/postgres/item_repository.go`
**Commit:** b371d8f
**Applied fix:** Added a documentation comment at the return site explaining the known limitation (returns page size not COUNT(*)), why it is not currently user-facing (all public handler requests route through `FindByWorkspaceFiltered` which has a real COUNT query), and a TODO to fix it if the method is ever exposed directly.

### WR-03: `rand.Read` error is silently discarded in `generateShortCode`

**Files modified:** `backend/internal/domain/warehouse/item/service.go`
**Commit:** 34f8dfb
**Applied fix:** Replaced the bare `rand.Read(b)` call with an explicit error check that panics with a descriptive message. Since `crypto/rand.Read` only fails if the OS PRNG is unavailable (a catastrophic environment failure), panic is the correct response as there is no safe recovery path.

### WR-04: `deleteMutation` / `archiveMutation` leave `archiveTarget` stale after completion

**Files modified:** `frontend2/src/features/items/ItemsListPage.tsx`
**Commit:** df5c64a
**Applied fix:** Two changes applied: (1) `useDeleteItem` is now called with `onAfterDelete: () => setArchiveTarget(null)` so the state is cleared after a successful delete. (2) The `onArchive` prop chains `.then(() => setArchiveTarget(null))` after `archiveMutation.mutateAsync` so the state is also cleared after a successful archive. Both paths now clean up `archiveTarget` when the flow completes.

---

_Fixed: 2026-04-16T14:35:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
