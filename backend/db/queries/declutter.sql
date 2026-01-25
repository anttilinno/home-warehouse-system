-- Declutter Assistant Queries
-- These queries support the declutter feature for identifying unused inventory

-- name: ListUnusedInventory :many
-- Lists inventory items unused for specified threshold days
-- Supports grouping by category or location for organized display
SELECT
    inv.id,
    inv.workspace_id,
    inv.item_id,
    inv.location_id,
    inv.container_id,
    inv.quantity,
    inv.condition,
    inv.status,
    inv.purchase_price,
    inv.currency_code,
    inv.last_used_at,
    inv.created_at,
    inv.updated_at,
    it.name as item_name,
    it.sku as item_sku,
    l.name as location_name,
    c.name as category_name,
    c.id as category_id,
    EXTRACT(DAY FROM (NOW() - COALESCE(inv.last_used_at, inv.created_at)))::int as days_unused
FROM warehouse.inventory inv
JOIN warehouse.items it ON inv.item_id = it.id
JOIN warehouse.locations l ON inv.location_id = l.id
LEFT JOIN warehouse.categories c ON it.category_id = c.id
WHERE inv.workspace_id = $1
  AND inv.is_archived = false
  AND COALESCE(inv.last_used_at, inv.created_at) < NOW() - make_interval(days => $2)
ORDER BY
    CASE WHEN sqlc.arg(group_by)::text = 'category' THEN c.name END NULLS LAST,
    CASE WHEN sqlc.arg(group_by)::text = 'location' THEN l.name END NULLS LAST,
    days_unused DESC
LIMIT $3 OFFSET $4;

-- name: CountUnusedInventory :one
-- Counts total unused inventory for pagination
SELECT COUNT(*)::int as total
FROM warehouse.inventory inv
WHERE inv.workspace_id = $1
  AND inv.is_archived = false
  AND COALESCE(inv.last_used_at, inv.created_at) < NOW() - make_interval(days => $2);

-- name: MarkInventoryUsed :one
-- Atomically updates last_used_at to current time
UPDATE warehouse.inventory
SET last_used_at = NOW(), updated_at = NOW()
WHERE id = $1 AND workspace_id = $2
RETURNING *;

-- name: GetUnusedInventoryCounts :one
-- Returns summary counts for different thresholds (90/180/365 days)
-- Used for dashboard summary display
SELECT
    COUNT(*) FILTER (WHERE COALESCE(last_used_at, created_at) < NOW() - interval '90 days')::int as unused_90,
    COUNT(*) FILTER (WHERE COALESCE(last_used_at, created_at) < NOW() - interval '180 days')::int as unused_180,
    COUNT(*) FILTER (WHERE COALESCE(last_used_at, created_at) < NOW() - interval '365 days')::int as unused_365,
    COALESCE(SUM(purchase_price) FILTER (WHERE COALESCE(last_used_at, created_at) < NOW() - interval '90 days'), 0)::bigint as value_90,
    COALESCE(SUM(purchase_price) FILTER (WHERE COALESCE(last_used_at, created_at) < NOW() - interval '180 days'), 0)::bigint as value_180,
    COALESCE(SUM(purchase_price) FILTER (WHERE COALESCE(last_used_at, created_at) < NOW() - interval '365 days'), 0)::bigint as value_365
FROM warehouse.inventory
WHERE workspace_id = $1 AND is_archived = false;

-- name: GetMaxInventoryValue :one
-- Returns the maximum purchase price in workspace for percentile calculation
SELECT COALESCE(MAX(purchase_price), 0)::int as max_value
FROM warehouse.inventory
WHERE workspace_id = $1 AND is_archived = false;
