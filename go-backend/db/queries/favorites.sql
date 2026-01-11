-- name: GetFavorite :one
SELECT * FROM warehouse.favorites WHERE id = $1;

-- name: CreateFavorite :one
INSERT INTO warehouse.favorites (id, user_id, workspace_id, favorite_type, item_id, location_id, container_id)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: DeleteFavorite :exec
DELETE FROM warehouse.favorites WHERE id = $1 AND user_id = $2;

-- name: DeleteFavoriteByTarget :exec
DELETE FROM warehouse.favorites
WHERE user_id = $1 AND workspace_id = $2 AND favorite_type = $3
  AND ((favorite_type = 'ITEM' AND item_id = $4)
    OR (favorite_type = 'LOCATION' AND location_id = $4)
    OR (favorite_type = 'CONTAINER' AND container_id = $4));

-- name: ListFavoritesByUser :many
SELECT * FROM warehouse.favorites
WHERE user_id = $1 AND workspace_id = $2
ORDER BY created_at DESC;

-- name: GetFavoriteItems :many
SELECT f.id as favorite_id, f.created_at as favorited_at, i.*
FROM warehouse.favorites f
JOIN warehouse.items i ON f.item_id = i.id
WHERE f.user_id = $1 AND f.workspace_id = $2 AND f.favorite_type = 'ITEM'
ORDER BY f.created_at DESC;

-- name: IsFavorite :one
SELECT EXISTS(
    SELECT 1 FROM warehouse.favorites
    WHERE user_id = $1 AND workspace_id = $2 AND favorite_type = $3
      AND ((favorite_type = 'ITEM' AND item_id = $4)
        OR (favorite_type = 'LOCATION' AND location_id = $4)
        OR (favorite_type = 'CONTAINER' AND container_id = $4))
);
