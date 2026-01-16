-- Export Queries
-- These queries support bulk export operations for all entity types

-- name: ListAllItems :many
SELECT * FROM warehouse.items
WHERE workspace_id = $1 
  AND (sqlc.arg(include_archived)::boolean OR is_archived = false)
ORDER BY name;

-- name: ListAllLocations :many
SELECT * FROM warehouse.locations
WHERE workspace_id = $1 
  AND (sqlc.arg(include_archived)::boolean OR is_archived = false)
ORDER BY name;

-- name: ListAllCategories :many
SELECT * FROM warehouse.categories
WHERE workspace_id = $1 
  AND (sqlc.arg(include_archived)::boolean OR is_archived = false)
ORDER BY name;

-- name: ListAllContainers :many
SELECT * FROM warehouse.containers
WHERE workspace_id = $1 
  AND (sqlc.arg(include_archived)::boolean OR is_archived = false)
ORDER BY name;

-- name: ListAllLabels :many
SELECT * FROM warehouse.labels
WHERE workspace_id = $1 
  AND (sqlc.arg(include_archived)::boolean OR is_archived = false)
ORDER BY name;

-- name: ListAllCompanies :many
SELECT * FROM warehouse.companies
WHERE workspace_id = $1 
  AND (sqlc.arg(include_archived)::boolean OR is_archived = false)
ORDER BY name;

-- name: ListAllBorrowers :many
SELECT * FROM warehouse.borrowers
WHERE workspace_id = $1 
  AND (sqlc.arg(include_archived)::boolean OR is_archived = false)
ORDER BY name;

-- name: GetCategoryByName :one
SELECT * FROM warehouse.categories
WHERE workspace_id = $1 AND name = $2 AND is_archived = false
LIMIT 1;

-- name: GetLocationByName :one
SELECT * FROM warehouse.locations
WHERE workspace_id = $1 AND name = $2 AND is_archived = false
LIMIT 1;

-- name: ListAllInventory :many
SELECT * FROM warehouse.inventory
WHERE workspace_id = $1
ORDER BY created_at;

-- name: ListAllLoans :many
SELECT * FROM warehouse.loans
WHERE workspace_id = $1
ORDER BY loaned_at;

-- name: ListAllAttachments :many
SELECT a.* FROM warehouse.attachments a
JOIN warehouse.items i ON a.item_id = i.id
WHERE i.workspace_id = $1
ORDER BY a.created_at;

-- name: CreateWorkspaceExport :exec
INSERT INTO auth.workspace_exports (
    id,
    workspace_id,
    exported_by,
    format,
    record_counts,
    file_size_bytes,
    created_at
) VALUES (
    $1, $2, $3, $4, $5, $6, NOW()
);

-- name: ListWorkspaceExports :many
SELECT * FROM auth.workspace_exports
WHERE workspace_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListAllCategoriesIncludingArchived :many
SELECT * FROM warehouse.categories
WHERE workspace_id = $1
ORDER BY created_at;

-- name: ListAllLabelsIncludingArchived :many
SELECT * FROM warehouse.labels
WHERE workspace_id = $1
ORDER BY created_at;

-- name: ListAllCompaniesIncludingArchived :many
SELECT * FROM warehouse.companies
WHERE workspace_id = $1
ORDER BY created_at;

-- name: ListAllLocationsIncludingArchived :many
SELECT * FROM warehouse.locations
WHERE workspace_id = $1
ORDER BY created_at;

-- name: ListAllBorrowersIncludingArchived :many
SELECT * FROM warehouse.borrowers
WHERE workspace_id = $1
ORDER BY created_at;

-- name: ListAllItemsIncludingArchived :many
SELECT * FROM warehouse.items
WHERE workspace_id = $1
ORDER BY created_at;

-- name: ListAllContainersIncludingArchived :many
SELECT * FROM warehouse.containers
WHERE workspace_id = $1
ORDER BY created_at;
