-- migrate:up
CREATE TABLE auth.user_sessions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(64) NOT NULL,
    device_info VARCHAR(200),
    ip_address INET,
    user_agent TEXT,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for looking up sessions by user (for listing)
CREATE INDEX idx_user_sessions_user_id ON auth.user_sessions(user_id);

-- Index for looking up session by token hash (for validation)
CREATE INDEX idx_user_sessions_token_hash ON auth.user_sessions(refresh_token_hash);

-- Index for cleaning up expired sessions
CREATE INDEX idx_user_sessions_expires_at ON auth.user_sessions(expires_at);

COMMENT ON TABLE auth.user_sessions IS
'Tracks active user sessions for multi-device management and token revocation.';

COMMENT ON COLUMN auth.user_sessions.refresh_token_hash IS
'SHA-256 hash of the refresh token. Never store plain tokens.';

COMMENT ON COLUMN auth.user_sessions.device_info IS
'Human-readable device description parsed from user agent (e.g., Chrome on Windows).';

COMMENT ON COLUMN auth.user_sessions.ip_address IS
'Client IP address at login time.';

COMMENT ON COLUMN auth.user_sessions.last_active_at IS
'Updated on token refresh to track session activity.';

-- migrate:down
DROP TABLE IF EXISTS auth.user_sessions;
