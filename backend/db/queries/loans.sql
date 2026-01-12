-- name: GetLoan :one
SELECT * FROM warehouse.loans
WHERE id = $1 AND workspace_id = $2;

-- name: CreateLoan :one
INSERT INTO warehouse.loans (id, workspace_id, inventory_id, borrower_id, quantity, loaned_at, due_date, notes)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: ReturnLoan :one
UPDATE warehouse.loans
SET returned_at = now(), updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ExtendLoanDueDate :one
UPDATE warehouse.loans
SET due_date = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ListLoansByWorkspace :many
SELECT * FROM warehouse.loans
WHERE workspace_id = $1
ORDER BY loaned_at DESC
LIMIT $2 OFFSET $3;

-- name: ListLoansByBorrower :many
SELECT * FROM warehouse.loans
WHERE workspace_id = $1 AND borrower_id = $2
ORDER BY loaned_at DESC
LIMIT $3 OFFSET $4;

-- name: ListLoansByInventory :many
SELECT * FROM warehouse.loans
WHERE workspace_id = $1 AND inventory_id = $2
ORDER BY loaned_at DESC;

-- name: ListActiveLoans :many
SELECT * FROM warehouse.loans
WHERE workspace_id = $1 AND returned_at IS NULL
ORDER BY due_date ASC NULLS LAST;

-- name: ListOverdueLoans :many
SELECT * FROM warehouse.loans
WHERE workspace_id = $1 AND returned_at IS NULL AND due_date < now()
ORDER BY due_date ASC;

-- name: GetActiveLoanForInventory :one
SELECT * FROM warehouse.loans
WHERE inventory_id = $1 AND returned_at IS NULL;

-- name: GetLoanWithDetails :one
SELECT l.*,
       i.quantity as inventory_quantity, i.status as inventory_status,
       it.name as item_name, it.sku,
       b.name as borrower_name, b.email as borrower_email
FROM warehouse.loans l
JOIN warehouse.inventory i ON l.inventory_id = i.id
JOIN warehouse.items it ON i.item_id = it.id
JOIN warehouse.borrowers b ON l.borrower_id = b.id
WHERE l.id = $1 AND l.workspace_id = $2;

-- name: ListActiveLoansWithDetails :many
SELECT l.*,
       i.quantity as inventory_quantity,
       it.name as item_name, it.sku,
       b.name as borrower_name, b.email as borrower_email,
       loc.name as location_name
FROM warehouse.loans l
JOIN warehouse.inventory i ON l.inventory_id = i.id
JOIN warehouse.items it ON i.item_id = it.id
JOIN warehouse.borrowers b ON l.borrower_id = b.id
JOIN warehouse.locations loc ON i.location_id = loc.id
WHERE l.workspace_id = $1 AND l.returned_at IS NULL
ORDER BY l.due_date ASC NULLS LAST
LIMIT $2 OFFSET $3;

-- name: GetTotalLoanedQuantity :one
SELECT COALESCE(SUM(quantity), 0)::int as total
FROM warehouse.loans
WHERE inventory_id = $1 AND returned_at IS NULL;

-- name: ListLoansNeedingReminder :many
-- Lists loans that are due within the specified date and have borrowers with email addresses.
-- Used by the background job to send reminder notifications.
SELECT l.id, l.workspace_id, l.due_date, l.quantity, l.notes,
       b.id as borrower_id, b.name as borrower_name, b.email as borrower_email,
       it.name as item_name, it.sku
FROM warehouse.loans l
JOIN warehouse.borrowers b ON l.borrower_id = b.id
JOIN warehouse.inventory inv ON l.inventory_id = inv.id
JOIN warehouse.items it ON inv.item_id = it.id
WHERE l.returned_at IS NULL 
  AND l.due_date <= $1 
  AND b.email IS NOT NULL
ORDER BY l.due_date ASC;
