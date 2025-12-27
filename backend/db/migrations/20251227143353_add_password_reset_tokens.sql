-- migrate:up
CREATE TABLE auth.password_reset_tokens (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX ix_password_reset_tokens_user ON auth.password_reset_tokens(user_id);
CREATE INDEX ix_password_reset_tokens_hash ON auth.password_reset_tokens(token_hash);

COMMENT ON TABLE auth.password_reset_tokens IS 'Password reset tokens with expiration and one-time use';

-- migrate:down
DROP TABLE auth.password_reset_tokens;

