# Phase 10 Taxonomy — Backend Fix Summary

Three confirmed backend (Go) bugs blocking Phase 10 taxonomy parity (category
archive, container-filtered inventory, label edit) fixed in an isolated
worktree. Each fix mirrors the already-correct `ItemRepository.Save` pattern.

- **Branch:** `fix/10-backend-taxonomy`
- **Worktree:** `/home/antti/Repos/Misc/home-warehouse-system/.wt/10-fix`
- **Base SHA:** `724d6462f4282db12c9c9a20b611c042e5ee2fd3` (HEAD of `v3.0-frontend2-parity`)

## Fixes

### BUG 1 — Category archive dropped `is_archived`

`internal/infra/postgres/category_repository.go` `Save()` routed every
existing-entity write through `UpdateCategory`, whose SQL never touches
`is_archived`, so archive/restore were silently no-ops at the persistence
layer.

**Fix:** After fetching `existing`, branch on the archive-flag transition
(mirroring `item_repository.go`): `c.IsArchived() && !existing.IsArchived` →
`ArchiveCategory`; `!c.IsArchived() && existing.IsArchived` →
`RestoreCategory`; otherwise the existing `UpdateCategory` path, unchanged.
The ready-made `ArchiveCategory`/`RestoreCategory` sqlc queries were already
present and are now wired.

### BUG 3 — `PATCH /labels/{id}` → 400 duplicate key

`internal/infra/postgres/label_repository.go` `Save()` unconditionally called
`CreateLabel`, so any update (label edit) hit a duplicate-key violation, and
label archive/restore were also dead code.

**Fix:** Rebuilt `Save()` to mirror the category/item repos — `GetLabel` to
detect an existing row; if it exists, apply archive/restore transition
branches (`ArchiveLabel`/`RestoreLabel`) then fall through to `UpdateLabel`;
else `CreateLabel` (unchanged). This closes the edit 400 and the latent
archive/restore bug in one change.

### BUG 2 — `/inventory?container_id={id}` filter ignored

`internal/domain/warehouse/inventory/handler.go` `ListInventoryInput` declared
only `page`/`limit`, so the `container_id` query param never reached the
handler and the list was never narrowed.

**Fix:** Added `ContainerID string \`query:"container_id,omitempty"\`` to
`ListInventoryInput` and, in the `GET /inventory` handler, when the param is a
parseable UUID delegate to the existing `svc.ListByContainer` (the same path
used by `GET /inventory/by-container/{container_id}`), wrapping the result in
the standard `ListInventoryOutput` envelope; otherwise the existing paginated
`svc.List` path runs unchanged.

**Deviation (Rule 3 — blocking issue):** The original instruction suggested
`ContainerID *uuid.UUID \`query:"container_id"\``. Huma v2.34.1 panics at route
registration on a `*uuid.UUID` **query** param (`findParams` cannot resolve
pointer-to-uuid for query binding — only path params support `uuid.UUID`
directly). Switched to the codebase's established convention for optional UUID
query filters (`internal/domain/warehouse/item/handler.go` `CategoryID string
\`query:"category_id,omitempty"\``), parsing with `uuid.Parse` and silently
treating a malformed value as "no filter." Behavior is identical; the route now
registers without panicking.

## Tests added

- `category_repository_test.go` →
  `TestCategoryRepository_Save/archives_and_restores_existing_category`:
  save → archive → `FindByID` asserts `IsArchived()==true`, then restore
  round-trip asserts `IsArchived()==false`.
- `label_repository_test.go` →
  `TestLabelRepository_Save/updates_existing_label_without_duplicate-key_error`
  (save → mutate → Save again: no error, update reflected) and
  `.../archives_and_restores_existing_label` (archive/restore round-trip).
- `handler_test.go` →
  `TestInventoryHandler_List/container_id_filter_delegates_to_ListByContainer`:
  `?container_id=<uuid>` returns 200, asserts `ListByContainer` is called and
  the unfiltered `List` path is **not** (dedicated mock for isolation).

All new repo tests carry the existing `//go:build integration` tag and use the
`tests/testdb` + `tests/testfixtures` harness, matching the surrounding style.

## Gate results (run from `.wt/10-fix/backend`)

- `go build ./...` → **PASS** (exit 0)
- `go vet ./internal/domain/warehouse/... ./internal/infra/postgres/...` →
  **PASS** (exit 0)
- `gofmt -l` on all 6 edited files → clean
- `go test ./internal/domain/warehouse/...` (unit, no DB) → **PASS** — all
  packages ok; inventory package 0.224s including the new handler subtest.
- Integration (`-tags=integration`, `TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test`):
  - Targeted: `TestCategoryRepository_Save` (4 subtests) + `TestLabelRepository_Save`
    (4 subtests) → **PASS**.
  - Full postgres integration suite `./internal/infra/postgres/...` → **PASS**
    (23.9s) — no regressions.

## Scope

Backend only. No `.planning/*` (except this summary), `frontend2/*`, or
unrelated-domain files touched. Files changed:
`internal/infra/postgres/category_repository.go`,
`internal/infra/postgres/label_repository.go`,
`internal/domain/warehouse/inventory/handler.go`, plus the three test files.

No fixes left incomplete.
