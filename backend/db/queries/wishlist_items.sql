-- name: GetWishlistItem :one
SELECT * FROM warehouse.wishlist_items
WHERE id = $1 AND workspace_id = $2;

-- name: CreateWishlistItem :one
INSERT INTO warehouse.wishlist_items (
    id, workspace_id, name, notes, url, price_estimate, currency_code,
    priority, desired_category_id, status, acquired_item_id, created_by
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING *;

-- name: UpdateWishlistItem :one
-- Full-row update used by the repository Save path. status and
-- acquired_item_id are included so the acquire flow (status -> 'acquired'
-- plus the link back to the created item) persists through the same query.
UPDATE warehouse.wishlist_items
SET name = $3,
    notes = $4,
    url = $5,
    price_estimate = $6,
    currency_code = $7,
    priority = $8,
    desired_category_id = $9,
    status = $10,
    acquired_item_id = $11,
    updated_at = now()
WHERE id = $1 AND workspace_id = $2
RETURNING *;

-- name: DeleteWishlistItem :exec
DELETE FROM warehouse.wishlist_items
WHERE id = $1 AND workspace_id = $2;

-- name: ListWishlistItemsByWorkspace :many
-- Optional status filter; sorted by priority (1 = highest first), newest
-- first within a priority. Uses the (workspace_id, status, priority) index
-- when a status is given.
SELECT * FROM warehouse.wishlist_items
WHERE workspace_id = $1
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status')::text)
ORDER BY priority, created_at DESC, id
LIMIT $2 OFFSET $3;

-- name: CountWishlistItemsByWorkspace :one
SELECT COUNT(*) FROM warehouse.wishlist_items
WHERE workspace_id = $1
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status')::text);
