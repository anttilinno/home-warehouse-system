-- name: GetCompany :one
SELECT * FROM warehouse.companies
WHERE id = $1 AND workspace_id = $2;

-- name: GetCompanyByName :one
SELECT * FROM warehouse.companies
WHERE workspace_id = $1 AND name = $2;

-- name: CreateCompany :one
INSERT INTO warehouse.companies (id, workspace_id, name, website, notes)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateCompany :one
UPDATE warehouse.companies
SET name = $2, website = $3, notes = $4, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ArchiveCompany :exec
UPDATE warehouse.companies
SET is_archived = true, updated_at = now()
WHERE id = $1;

-- name: RestoreCompany :exec
UPDATE warehouse.companies
SET is_archived = false, updated_at = now()
WHERE id = $1;

-- name: ListCompanies :many
SELECT * FROM warehouse.companies
WHERE workspace_id = $1 AND is_archived = false
ORDER BY name
LIMIT $2 OFFSET $3;

-- name: CompanyNameExists :one
SELECT EXISTS(
    SELECT 1 FROM warehouse.companies
    WHERE workspace_id = $1 AND name = $2 AND is_archived = false
);

-- name: DeleteCompany :exec
DELETE FROM warehouse.companies WHERE id = $1;
