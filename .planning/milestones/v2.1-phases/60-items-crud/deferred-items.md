## Deferred items - Phase 60-01

- backend/internal/domain/warehouse/pendingchange/service_test.go: MockBorrowerRepository missing Create method (pre-existing failure on base commit 1b84a45, not introduced by Phase 60). Out of scope — tracked for a future repair.

## Deferred items - Phase 60 code review advisories (IN-01, IN-02, IN-03)

These were surfaced as Info findings during the Phase 60 code review and are deferred to a future polish phase.

- **IN-01 — SQL workspace_id guard (defense-in-depth):** `UpdateItem`, `ArchiveItem`, `RestoreItem`, and `DeleteItem` SQL queries have no `workspace_id` predicate. Currently safe because the service layer enforces workspace ownership before any repo call, but adding `AND workspace_id = $N` at the SQL level would provide defence-in-depth and make each query self-guarding against future service-layer mistakes.
  - Files: `backend/db/queries/items.sql`, `backend/internal/infra/queries/items.sql.go` (regenerate after SQL change)

- **IN-02 — Category list hard-coded `limit: 100`:** `useCategoryNameMap`, `ItemsFilterBar`, and `ItemForm` all request categories with `limit: 100`. Workspaces with 100+ categories get silent truncation with no error indication in the UI.
  - Fix options: (a) paginate / fetch-all loop in `useCategoryNameMap`; (b) raise limit to a safe ceiling (e.g., 500) with a server-side cap; (c) add a warning when `data.total > 100`.
  - Files: `frontend2/src/features/items/hooks/useCategoryNameMap.ts`, `frontend2/src/features/items/filters/ItemsFilterBar.tsx`, `frontend2/src/features/items/forms/ItemForm.tsx`

- **IN-03 — Edit-mode detection via `!!defaultValues?.name`:** `ItemForm` infers edit vs. create mode by checking whether `defaultValues.name` is truthy. This would misfire if an item ever had an empty name (currently prevented by the API's `minLength:1` constraint, but not structurally safe). A more robust approach is an explicit `mode: "create" | "edit"` prop.
  - File: `frontend2/src/features/items/forms/ItemForm.tsx`
