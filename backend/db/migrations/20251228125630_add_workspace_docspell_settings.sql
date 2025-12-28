-- migrate:up

-- Docspell settings table for per-workspace configuration
CREATE TABLE auth.workspace_docspell_settings (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE UNIQUE,
    base_url VARCHAR(500) NOT NULL,
    collective_name VARCHAR(100) NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_encrypted TEXT NOT NULL,
    sync_tags_enabled BOOLEAN DEFAULT false,
    is_enabled BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE auth.workspace_docspell_settings IS
'Per-workspace Docspell integration configuration. Each workspace can connect to a different Docspell instance.';

COMMENT ON COLUMN auth.workspace_docspell_settings.password_encrypted IS
'Encrypted password for Docspell authentication. Encrypted at application layer using Fernet.';

COMMENT ON COLUMN auth.workspace_docspell_settings.collective_name IS
'Docspell collective name - equivalent to a tenant/organization in Docspell.';

CREATE INDEX ix_workspace_docspell_settings_workspace ON auth.workspace_docspell_settings(workspace_id);

-- migrate:down

DROP TABLE IF EXISTS auth.workspace_docspell_settings;
