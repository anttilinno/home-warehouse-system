-- name: GetCategory :one
SELECT * FROM warehouse.categories
WHERE id = $1 AND workspace_id = $2;

-- name: CreateCategory :one
INSERT INTO warehouse.categories (id, workspace_id, name, parent_category_id, description)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateCategory :one
UPDATE warehouse.categories
SET name = $2, parent_category_id = $3, description = $4, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ArchiveCategory :exec
UPDATE warehouse.categories
SET is_archived = true, updated_at = now()
WHERE id = $1;

-- name: RestoreCategory :exec
UPDATE warehouse.categories
SET is_archived = false, updated_at = now()
WHERE id = $1;

-- name: ListCategories :many
SELECT * FROM warehouse.categories
WHERE workspace_id = $1 AND is_archived = false
ORDER BY name;

-- name: ListCategoriesByParent :many
SELECT * FROM warehouse.categories
WHERE workspace_id = $1 AND parent_category_id = $2 AND is_archived = false
ORDER BY name;

-- name: ListRootCategories :many
SELECT * FROM warehouse.categories
WHERE workspace_id = $1 AND parent_category_id IS NULL AND is_archived = false
ORDER BY name;

-- name: HasChildren :one
SELECT EXISTS(
    SELECT 1 FROM warehouse.categories
    WHERE parent_category_id = $1 AND is_archived = false
);

-- name: DeleteCategory :exec
DELETE FROM warehouse.categories WHERE id = $1;
