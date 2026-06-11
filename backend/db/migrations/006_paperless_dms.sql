-- migrate:up

-- DMS Migration: Docspell -> Paperless-ngx (docs/ROADMAP.md "DMS Migration").
-- Docspell was never wired to the app (schema only), so this is a clean
-- repoint: the external-document link on attachments becomes generic
-- (external_doc_id + dms_type, future multi-DMS) and the per-workspace
-- settings table is reshaped for Paperless token auth.

-- 1) Attachments: rename the external-doc link and add a DMS discriminator.
ALTER TABLE warehouse.attachments
    RENAME COLUMN docspell_item_id TO external_doc_id;

ALTER TABLE warehouse.attachments
    ADD COLUMN dms_type text;

-- Any pre-existing external references were Docspell-shaped stubs; repoint
-- them at the only supported DMS so the pairing constraint below holds.
UPDATE warehouse.attachments
SET dms_type = 'paperless'
WHERE external_doc_id IS NOT NULL;

ALTER TABLE warehouse.attachments
    ADD CONSTRAINT chk_attachments_dms_type CHECK (dms_type IN ('paperless'));

-- external_doc_id and dms_type must be set together (NULL-paired).
ALTER TABLE warehouse.attachments
    ADD CONSTRAINT chk_attachments_external_doc_pair
        CHECK ((external_doc_id IS NULL) = (dms_type IS NULL));

-- The "either file_id or external doc id" semantics carry over: the renamed
-- column keeps attachments_has_reference valid (pg rewrites the constraint
-- expression on column rename). The partial index follows the rename too;
-- rename it for greppability.
ALTER INDEX warehouse.ix_attachments_docspell RENAME TO ix_attachments_external_doc;

COMMENT ON COLUMN warehouse.attachments.external_doc_id IS 'Reference to a document in an external DMS (see dms_type). When set, the document is managed externally and file_id may be NULL.';
COMMENT ON COLUMN warehouse.attachments.dms_type IS 'External DMS holding external_doc_id. Currently only ''paperless'' (Paperless-ngx). NULL when the attachment has no external document.';

-- 2) Settings: workspace_docspell_settings -> workspace_paperless_settings.
-- Paperless-ngx uses base_url + API token; there is no collective/username.
ALTER TABLE auth.workspace_docspell_settings
    RENAME TO workspace_paperless_settings;

ALTER TABLE auth.workspace_paperless_settings
    DROP COLUMN collective_name,
    DROP COLUMN username;

ALTER TABLE auth.workspace_paperless_settings
    RENAME COLUMN password_encrypted TO api_token_encrypted;

ALTER TABLE auth.workspace_paperless_settings
    RENAME CONSTRAINT workspace_docspell_settings_pkey TO workspace_paperless_settings_pkey;
ALTER TABLE auth.workspace_paperless_settings
    RENAME CONSTRAINT workspace_docspell_settings_workspace_id_key TO workspace_paperless_settings_workspace_id_key;
ALTER TABLE auth.workspace_paperless_settings
    RENAME CONSTRAINT workspace_docspell_settings_workspace_id_fkey TO workspace_paperless_settings_workspace_id_fkey;

COMMENT ON TABLE auth.workspace_paperless_settings IS 'Per-workspace Paperless-ngx integration configuration. Each workspace can connect to a different Paperless instance.';
COMMENT ON COLUMN auth.workspace_paperless_settings.api_token_encrypted IS 'Paperless-ngx API token, encrypted at the application layer (AES-256-GCM keyed from PAPERLESS_TOKEN_KEY).';

-- migrate:down

ALTER TABLE auth.workspace_paperless_settings
    RENAME CONSTRAINT workspace_paperless_settings_pkey TO workspace_docspell_settings_pkey;
ALTER TABLE auth.workspace_paperless_settings
    RENAME CONSTRAINT workspace_paperless_settings_workspace_id_key TO workspace_docspell_settings_workspace_id_key;
ALTER TABLE auth.workspace_paperless_settings
    RENAME CONSTRAINT workspace_paperless_settings_workspace_id_fkey TO workspace_docspell_settings_workspace_id_fkey;

ALTER TABLE auth.workspace_paperless_settings
    RENAME COLUMN api_token_encrypted TO password_encrypted;

ALTER TABLE auth.workspace_paperless_settings
    ADD COLUMN collective_name character varying(100) NOT NULL DEFAULT '',
    ADD COLUMN username character varying(100) NOT NULL DEFAULT '';
ALTER TABLE auth.workspace_paperless_settings
    ALTER COLUMN collective_name DROP DEFAULT,
    ALTER COLUMN username DROP DEFAULT;

ALTER TABLE auth.workspace_paperless_settings
    RENAME TO workspace_docspell_settings;

COMMENT ON TABLE auth.workspace_docspell_settings IS 'Per-workspace Docspell integration configuration. Each workspace can connect to a different Docspell instance.';

ALTER INDEX warehouse.ix_attachments_external_doc RENAME TO ix_attachments_docspell;

ALTER TABLE warehouse.attachments
    DROP CONSTRAINT chk_attachments_external_doc_pair;
ALTER TABLE warehouse.attachments
    DROP CONSTRAINT chk_attachments_dms_type;
ALTER TABLE warehouse.attachments
    DROP COLUMN dms_type;
ALTER TABLE warehouse.attachments
    RENAME COLUMN external_doc_id TO docspell_item_id;

COMMENT ON COLUMN warehouse.attachments.docspell_item_id IS 'Reference to Docspell item ID. When set, document is managed by Docspell and file_id may be NULL.';
