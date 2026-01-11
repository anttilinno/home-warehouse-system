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
