-- name: GetBorrower :one
SELECT * FROM warehouse.borrowers
WHERE id = $1 AND workspace_id = $2;

-- name: CreateBorrower :one
INSERT INTO warehouse.borrowers (id, workspace_id, name, email, phone, notes)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: UpdateBorrower :one
UPDATE warehouse.borrowers
SET name = $2, email = $3, phone = $4, notes = $5, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ArchiveBorrower :exec
UPDATE warehouse.borrowers
SET is_archived = true, updated_at = now()
WHERE id = $1;

-- name: RestoreBorrower :exec
UPDATE warehouse.borrowers
SET is_archived = false, updated_at = now()
WHERE id = $1;

-- name: ListBorrowers :many
SELECT * FROM warehouse.borrowers
WHERE workspace_id = $1 AND is_archived = false
ORDER BY name
LIMIT $2 OFFSET $3;

-- name: HasActiveLoans :one
SELECT EXISTS(
    SELECT 1 FROM warehouse.loans
    WHERE borrower_id = $1 AND returned_at IS NULL
);
