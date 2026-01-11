-- Delta Sync Queries
-- These queries support PWA offline synchronization by returning records modified since a given timestamp

-- name: ListItemsModifiedSince :many
SELECT * FROM warehouse.items
WHERE workspace_id = $1 
  AND updated_at > $2
ORDER BY updated_at ASC
LIMIT $3;

-- name: ListLocationsModifiedSince :many
SELECT * FROM warehouse.locations
WHERE workspace_id = $1 
  AND updated_at > $2
ORDER BY updated_at ASC
LIMIT $3;

-- name: ListContainersModifiedSince :many
SELECT * FROM warehouse.containers
WHERE workspace_id = $1 
  AND updated_at > $2
ORDER BY updated_at ASC
LIMIT $3;

-- name: ListInventoryModifiedSince :many
SELECT * FROM warehouse.inventory
WHERE workspace_id = $1 
  AND updated_at > $2
ORDER BY updated_at ASC
LIMIT $3;

-- name: ListCategoriesModifiedSince :many
SELECT * FROM warehouse.categories
WHERE workspace_id = $1 
  AND updated_at > $2
ORDER BY updated_at ASC
LIMIT $3;

-- name: ListLabelsModifiedSince :many
SELECT * FROM warehouse.labels
WHERE workspace_id = $1 
  AND updated_at > $2
ORDER BY updated_at ASC
LIMIT $3;

-- name: ListCompaniesModifiedSince :many
SELECT * FROM warehouse.companies
WHERE workspace_id = $1 
  AND updated_at > $2
ORDER BY updated_at ASC
LIMIT $3;

-- name: ListBorrowersModifiedSince :many
SELECT * FROM warehouse.borrowers
WHERE workspace_id = $1 
  AND updated_at > $2
ORDER BY updated_at ASC
LIMIT $3;

-- name: ListLoansModifiedSince :many
SELECT * FROM warehouse.loans
WHERE workspace_id = $1 
  AND updated_at > $2
ORDER BY updated_at ASC
LIMIT $3;

-- name: ListDeletedRecordsModifiedSince :many
SELECT * FROM warehouse.deleted_records
WHERE workspace_id = $1 
  AND deleted_at > $2
ORDER BY deleted_at ASC
LIMIT $3;

-- name: CountItemsModifiedSince :one
SELECT COUNT(*)::int FROM warehouse.items
WHERE workspace_id = $1 AND updated_at > $2;

-- name: CountLocationsModifiedSince :one
SELECT COUNT(*)::int FROM warehouse.locations
WHERE workspace_id = $1 AND updated_at > $2;

-- name: CountContainersModifiedSince :one
SELECT COUNT(*)::int FROM warehouse.containers
WHERE workspace_id = $1 AND updated_at > $2;

-- name: CountInventoryModifiedSince :one
SELECT COUNT(*)::int FROM warehouse.inventory
WHERE workspace_id = $1 AND updated_at > $2;

-- name: CountCategoriesModifiedSince :one
SELECT COUNT(*)::int FROM warehouse.categories
WHERE workspace_id = $1 AND updated_at > $2;

-- name: CountLabelsModifiedSince :one
SELECT COUNT(*)::int FROM warehouse.labels
WHERE workspace_id = $1 AND updated_at > $2;
