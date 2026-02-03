-- name: GetUserByID :one
SELECT id, email, full_name, password_hash, is_active, is_superuser, date_format, language, theme, avatar_path, created_at, updated_at
FROM auth.users
WHERE id = $1;

-- name: GetUserByEmail :one
SELECT id, email, full_name, password_hash, is_active, is_superuser, date_format, language, theme, avatar_path, created_at, updated_at
FROM auth.users
WHERE email = $1;

-- name: CreateUser :one
INSERT INTO auth.users (id, email, full_name, password_hash, is_active, is_superuser, date_format, language, theme, avatar_path, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING *;

-- name: UpdateUser :one
UPDATE auth.users
SET full_name = $2, updated_at = now()
WHERE id = $1
RETURNING id, email, full_name, password_hash, is_active, is_superuser, date_format, language, theme, avatar_path, created_at, updated_at;

-- name: UpdateUserPassword :exec
UPDATE auth.users
SET password_hash = $2, updated_at = now()
WHERE id = $1;

-- name: UpdateUserPreferences :one
UPDATE auth.users
SET date_format = $2, language = $3, theme = $4, updated_at = now()
WHERE id = $1
RETURNING id, email, full_name, password_hash, is_active, is_superuser, date_format, language, theme, avatar_path, created_at, updated_at;

-- name: DeactivateUser :exec
UPDATE auth.users
SET is_active = false, updated_at = now()
WHERE id = $1;

-- name: ListUsers :many
SELECT id, email, full_name, password_hash, is_active, is_superuser, date_format, language, theme, avatar_path, created_at, updated_at
FROM auth.users
WHERE is_active = true
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountActiveUsers :one
SELECT COUNT(*) FROM auth.users WHERE is_active = true;

-- name: UserExistsByEmail :one
SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = $1);

-- name: DeleteUser :exec
DELETE FROM auth.users WHERE id = $1;

-- name: UpdateUserAvatar :one
UPDATE auth.users
SET avatar_path = $2, updated_at = now()
WHERE id = $1
RETURNING id, email, full_name, password_hash, is_active, is_superuser, date_format, language, theme, avatar_path, created_at, updated_at;

-- name: UpdateUserEmail :one
UPDATE auth.users
SET email = $2, updated_at = now()
WHERE id = $1
RETURNING id, email, full_name, password_hash, is_active, is_superuser, date_format, language, theme, avatar_path, created_at, updated_at;
