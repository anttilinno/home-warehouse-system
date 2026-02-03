-- name: CreateSession :one
-- Creates a new session record when user logs in
INSERT INTO auth.user_sessions (
    user_id, refresh_token_hash, device_info, ip_address, user_agent, expires_at
) VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetSessionByTokenHash :one
-- Finds a session by its refresh token hash (for token validation)
SELECT * FROM auth.user_sessions
WHERE refresh_token_hash = $1 AND expires_at > now();

-- name: GetUserSessions :many
-- Lists all active sessions for a user (for session management UI)
SELECT id, user_id, device_info, ip_address, last_active_at, created_at
FROM auth.user_sessions
WHERE user_id = $1 AND expires_at > now()
ORDER BY last_active_at DESC;

-- name: UpdateSessionActivity :exec
-- Updates session's last_active_at and refresh_token_hash on token refresh
UPDATE auth.user_sessions
SET last_active_at = now(), refresh_token_hash = $2
WHERE id = $1;

-- name: DeleteSession :exec
-- Deletes a specific session (for individual session revocation)
DELETE FROM auth.user_sessions WHERE id = $1 AND user_id = $2;

-- name: DeleteAllSessionsExceptCurrent :exec
-- Deletes all sessions except the specified one (for "logout all others")
DELETE FROM auth.user_sessions
WHERE user_id = $1 AND id != $2;

-- name: DeleteAllUserSessions :exec
-- Deletes all sessions for a user (for password change with revoke option)
DELETE FROM auth.user_sessions WHERE user_id = $1;

-- name: DeleteExpiredSessions :exec
-- Cleanup job: removes expired sessions
DELETE FROM auth.user_sessions WHERE expires_at < now();

-- name: CountUserSessions :one
-- Counts active sessions for a user (for session limit enforcement)
SELECT COUNT(*) FROM auth.user_sessions
WHERE user_id = $1 AND expires_at > now();
