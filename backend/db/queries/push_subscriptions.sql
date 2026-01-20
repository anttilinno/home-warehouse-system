-- name: CreatePushSubscription :one
INSERT INTO auth.push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (user_id, endpoint) DO UPDATE SET
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    user_agent = EXCLUDED.user_agent,
    updated_at = now()
RETURNING *;

-- name: GetPushSubscription :one
SELECT * FROM auth.push_subscriptions WHERE id = $1;

-- name: GetPushSubscriptionByEndpoint :one
SELECT * FROM auth.push_subscriptions WHERE user_id = $1 AND endpoint = $2;

-- name: ListPushSubscriptionsByUser :many
SELECT * FROM auth.push_subscriptions WHERE user_id = $1 ORDER BY created_at DESC;

-- name: ListAllPushSubscriptions :many
SELECT * FROM auth.push_subscriptions ORDER BY created_at DESC;

-- name: DeletePushSubscription :exec
DELETE FROM auth.push_subscriptions WHERE id = $1;

-- name: DeletePushSubscriptionByEndpoint :exec
DELETE FROM auth.push_subscriptions WHERE user_id = $1 AND endpoint = $2;

-- name: DeleteAllPushSubscriptionsByUser :exec
DELETE FROM auth.push_subscriptions WHERE user_id = $1;

-- name: CountPushSubscriptionsByUser :one
SELECT COUNT(*) FROM auth.push_subscriptions WHERE user_id = $1;
