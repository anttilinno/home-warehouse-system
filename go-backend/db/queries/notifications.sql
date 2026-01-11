-- name: GetNotification :one
SELECT * FROM auth.notifications WHERE id = $1 AND user_id = $2;

-- name: CreateNotification :one
INSERT INTO auth.notifications (id, user_id, workspace_id, notification_type, title, message, metadata)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListNotificationsByUser :many
SELECT * FROM auth.notifications
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListUnreadNotifications :many
SELECT * FROM auth.notifications
WHERE user_id = $1 AND is_read = false
ORDER BY created_at DESC;

-- name: MarkNotificationAsRead :exec
UPDATE auth.notifications
SET is_read = true, read_at = now()
WHERE id = $1 AND user_id = $2;

-- name: MarkAllNotificationsAsRead :exec
UPDATE auth.notifications
SET is_read = true, read_at = now()
WHERE user_id = $1 AND is_read = false;

-- name: GetUnreadCount :one
SELECT COUNT(*) FROM auth.notifications
WHERE user_id = $1 AND is_read = false;

-- name: CountNotificationsByUser :one
SELECT COUNT(*) FROM auth.notifications
WHERE user_id = $1;
