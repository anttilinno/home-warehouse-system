-- name: GetOAuthAccountByProviderAndID :one
SELECT id, user_id, provider, provider_user_id, email, display_name, avatar_url, created_at, updated_at
FROM auth.user_oauth_accounts
WHERE provider = $1 AND provider_user_id = $2;

-- name: ListOAuthAccountsByUser :many
SELECT id, user_id, provider, provider_user_id, email, display_name, avatar_url, created_at, updated_at
FROM auth.user_oauth_accounts
WHERE user_id = $1
ORDER BY created_at;

-- name: CreateOAuthAccount :one
INSERT INTO auth.user_oauth_accounts (user_id, provider, provider_user_id, email, display_name, avatar_url)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, user_id, provider, provider_user_id, email, display_name, avatar_url, created_at, updated_at;

-- name: DeleteOAuthAccountByProvider :exec
DELETE FROM auth.user_oauth_accounts
WHERE user_id = $1 AND provider = $2;

-- name: CountOAuthAccountsByUser :one
SELECT COUNT(*) FROM auth.user_oauth_accounts WHERE user_id = $1;
