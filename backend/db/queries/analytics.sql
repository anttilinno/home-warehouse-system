-- Analytics Queries
-- These queries provide dashboard statistics and analytics for workspaces

-- name: GetDashboardStats :one
SELECT
    (SELECT COUNT(*) FROM warehouse.items it WHERE it.workspace_id = sqlc.arg(workspace_id) AND it.is_archived = false)::int as total_items,
    (SELECT COUNT(*) FROM warehouse.inventory inv WHERE inv.workspace_id = sqlc.arg(workspace_id) AND inv.is_archived = false)::int as total_inventory,
    (SELECT COUNT(*) FROM warehouse.locations loc WHERE loc.workspace_id = sqlc.arg(workspace_id) AND loc.is_archived = false)::int as total_locations,
    (SELECT COUNT(*) FROM warehouse.containers con WHERE con.workspace_id = sqlc.arg(workspace_id) AND con.is_archived = false)::int as total_containers,
    (SELECT COUNT(*) FROM warehouse.loans ln WHERE ln.workspace_id = sqlc.arg(workspace_id) AND ln.returned_at IS NULL)::int as active_loans,
    (SELECT COUNT(*) FROM warehouse.loans ln2 WHERE ln2.workspace_id = sqlc.arg(workspace_id) AND ln2.returned_at IS NULL AND ln2.due_date < CURRENT_DATE)::int as overdue_loans,
    (SELECT COUNT(*) FROM (
        SELECT i.id
        FROM warehouse.items i
        LEFT JOIN warehouse.inventory inven ON i.id = inven.item_id AND inven.is_archived = false
        WHERE i.workspace_id = sqlc.arg(workspace_id) AND i.is_archived = false AND i.min_stock_level > 0
        GROUP BY i.id, i.min_stock_level
        HAVING COALESCE(SUM(inven.quantity), 0) < i.min_stock_level
    ) low_stock)::int as low_stock_items,
    (SELECT COUNT(*) FROM warehouse.categories cat WHERE cat.workspace_id = sqlc.arg(workspace_id) AND cat.is_archived = false)::int as total_categories,
    (SELECT COUNT(*) FROM warehouse.borrowers bor WHERE bor.workspace_id = sqlc.arg(workspace_id) AND bor.is_archived = false)::int as total_borrowers;

-- name: GetCategoryStats :many
SELECT
    c.id,
    c.name,
    COUNT(DISTINCT i.id)::int as item_count,
    COUNT(inv.id)::int as inventory_count,
    COALESCE(SUM(inv.purchase_price), 0)::int as total_value
FROM warehouse.categories c
LEFT JOIN warehouse.items i ON i.category_id = c.id AND i.is_archived = false
LEFT JOIN warehouse.inventory inv ON inv.item_id = i.id AND inv.is_archived = false
WHERE c.workspace_id = $1 AND c.is_archived = false
GROUP BY c.id, c.name
ORDER BY item_count DESC
LIMIT $2;

-- name: GetLoanStats :one
SELECT
    COUNT(*)::int as total_loans,
    COUNT(*) FILTER (WHERE returned_at IS NULL)::int as active_loans,
    COUNT(*) FILTER (WHERE returned_at IS NOT NULL)::int as returned_loans,
    COUNT(*) FILTER (WHERE returned_at IS NULL AND due_date < CURRENT_DATE)::int as overdue_loans
FROM warehouse.loans
WHERE workspace_id = $1;

-- name: GetInventoryValueByLocation :many
SELECT
    l.id,
    l.name,
    COUNT(inv.id)::int as item_count,
    COALESCE(SUM(inv.quantity), 0)::int as total_quantity,
    COALESCE(SUM(COALESCE(inv.purchase_price, 0) * inv.quantity), 0)::int as total_value
FROM warehouse.locations l
LEFT JOIN warehouse.inventory inv ON inv.location_id = l.id AND inv.is_archived = false
WHERE l.workspace_id = $1 AND l.is_archived = false
GROUP BY l.id, l.name
ORDER BY total_value DESC
LIMIT $2;

-- name: GetRecentActivity :many
SELECT
    id,
    workspace_id,
    user_id,
    action,
    entity_type,
    entity_id,
    entity_name,
    changes,
    metadata,
    created_at
FROM warehouse.activity_log
WHERE workspace_id = $1
ORDER BY created_at DESC
LIMIT $2;

-- name: GetItemsByCondition :many
SELECT
    inv.condition,
    COUNT(*)::int as count
FROM warehouse.inventory inv
WHERE inv.workspace_id = $1 AND inv.is_archived = false AND inv.condition IS NOT NULL
GROUP BY inv.condition
ORDER BY count DESC;

-- name: GetItemsByStatus :many
SELECT
    inv.status,
    COUNT(*)::int as count
FROM warehouse.inventory inv
WHERE inv.workspace_id = $1 AND inv.is_archived = false AND inv.status IS NOT NULL
GROUP BY inv.status
ORDER BY count DESC;

-- name: GetTopBorrowers :many
SELECT
    b.id,
    b.name,
    b.email,
    COUNT(l.id)::int as total_loans,
    COUNT(*) FILTER (WHERE l.returned_at IS NULL)::int as active_loans
FROM warehouse.borrowers b
LEFT JOIN warehouse.loans l ON l.borrower_id = b.id
WHERE b.workspace_id = $1 AND b.is_archived = false
GROUP BY b.id, b.name, b.email
ORDER BY total_loans DESC
LIMIT $2;

-- name: GetMonthlyLoanActivity :many
SELECT
    DATE_TRUNC('month', loaned_at)::date as month,
    COUNT(*)::int as loans_created,
    COUNT(*) FILTER (WHERE returned_at IS NOT NULL)::int as loans_returned
FROM warehouse.loans
WHERE workspace_id = $1
  AND loaned_at >= $2
GROUP BY DATE_TRUNC('month', loaned_at)
ORDER BY month ASC;
