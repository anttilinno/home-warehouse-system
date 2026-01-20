-- migrate:up

-- Push subscriptions for web push notifications
CREATE TABLE auth.push_subscriptions (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, endpoint)
);

COMMENT ON TABLE auth.push_subscriptions IS
'Web Push API subscriptions for sending push notifications to user devices.';

COMMENT ON COLUMN auth.push_subscriptions.endpoint IS
'The push service URL where messages should be sent.';

COMMENT ON COLUMN auth.push_subscriptions.p256dh IS
'The client public key for message encryption (P-256 curve, base64 encoded).';

COMMENT ON COLUMN auth.push_subscriptions.auth IS
'The authentication secret for message encryption (base64 encoded).';

COMMENT ON COLUMN auth.push_subscriptions.user_agent IS
'User agent string to identify the device/browser.';

CREATE INDEX ix_push_subscriptions_user ON auth.push_subscriptions(user_id);
CREATE INDEX ix_push_subscriptions_endpoint ON auth.push_subscriptions(endpoint);

-- migrate:down

DROP TABLE IF EXISTS auth.push_subscriptions;
