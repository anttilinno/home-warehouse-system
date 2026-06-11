-- migrate:up

-- Shortlink Registry (ROADMAP "Shortlink Registry (s.go hardening)", audit
-- docs/audit/DATABASE-SCHEMA.md B5).
--
-- Codes used to live only as per-table short_code columns with per-workspace
-- uniqueness, so GET /r/{code} scanned 3 tables x N workspaces and the same
-- code could exist in several workspaces (hence the resolver's multi-match
-- branch). This registry makes resolution one PK lookup and collisions
-- impossible. The per-table short_code columns stay as denormalized display
-- values; row triggers keep the registry in sync in the same transaction as
-- every entity write.

CREATE TABLE warehouse.short_codes (
    code text NOT NULL,
    workspace_id uuid NOT NULL,
    entity_type warehouse.favorite_type_enum NOT NULL,
    entity_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT short_codes_pkey PRIMARY KEY (code),
    CONSTRAINT chk_short_codes_code CHECK (code ~ '^[A-Za-z0-9]{4,12}$'),
    CONSTRAINT uq_short_codes_entity UNIQUE (workspace_id, entity_type, entity_id)
);

COMMENT ON TABLE warehouse.short_codes IS 'Global registry of QR shortlink codes (s.go/<code>). One row per item/location/container; code is globally unique. Maintained by warehouse.short_codes_sync() row triggers; the entity short_code columns are denormalized display copies.';
COMMENT ON COLUMN warehouse.short_codes.entity_type IS 'Owning entity table: ITEM, LOCATION, or CONTAINER (reuses favorite_type_enum).';

ALTER TABLE ONLY warehouse.short_codes
    ADD CONSTRAINT short_codes_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;

-- Backfill from the three entity tables, oldest entity first. Collision
-- policy: on a duplicate code across workspaces the oldest row (by the owning
-- entity's created_at) keeps the code; newer entities get a regenerated code
-- written back to their short_code column (items are additionally flagged
-- needs_review = true). Codes that do not satisfy the registry CHECK
-- (e.g. legacy hyphenated codes) are regenerated the same way.
DO $backfill$
DECLARE
    rec record;
    final_code text;
BEGIN
    FOR rec IN
        SELECT t.entity_type, t.id, t.workspace_id, t.short_code, t.created_at
          FROM (
            SELECT 'ITEM'::warehouse.favorite_type_enum AS entity_type,
                   id, workspace_id, short_code, created_at
              FROM warehouse.items
            UNION ALL
            SELECT 'LOCATION'::warehouse.favorite_type_enum,
                   id, workspace_id, short_code, created_at
              FROM warehouse.locations
            UNION ALL
            SELECT 'CONTAINER'::warehouse.favorite_type_enum,
                   id, workspace_id, short_code, created_at
              FROM warehouse.containers
          ) t
         ORDER BY t.created_at ASC NULLS LAST, t.id ASC
    LOOP
        final_code := rec.short_code;

        IF final_code IS NULL
           OR final_code !~ '^[A-Za-z0-9]{4,12}$'
           OR EXISTS (SELECT 1 FROM warehouse.short_codes sc WHERE sc.code = final_code) THEN
            LOOP
                final_code := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
                EXIT WHEN NOT EXISTS (SELECT 1 FROM warehouse.short_codes sc WHERE sc.code = final_code);
            END LOOP;

            RAISE NOTICE 'short_codes backfill: % % lost code % -> regenerated %',
                rec.entity_type, rec.id, rec.short_code, final_code;

            IF rec.entity_type = 'ITEM' THEN
                UPDATE warehouse.items
                   SET short_code = final_code, needs_review = true
                 WHERE id = rec.id;
            ELSIF rec.entity_type = 'LOCATION' THEN
                UPDATE warehouse.locations SET short_code = final_code WHERE id = rec.id;
            ELSE
                UPDATE warehouse.containers SET short_code = final_code WHERE id = rec.id;
            END IF;
        END IF;

        INSERT INTO warehouse.short_codes (code, workspace_id, entity_type, entity_id, created_at)
        VALUES (final_code, rec.workspace_id, rec.entity_type, rec.id, coalesce(rec.created_at, now()));
    END LOOP;
END
$backfill$;

-- Registry maintenance triggers: entity create / short_code change / delete
-- maintain the registry row in the same transaction. TG_ARGV[0] carries the
-- entity_type tag. Registered AFTER the backfill so the backfill's own column
-- rewrites do not double-fire.
CREATE FUNCTION warehouse.short_codes_sync() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    etype warehouse.favorite_type_enum := TG_ARGV[0]::warehouse.favorite_type_enum;
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO warehouse.short_codes (code, workspace_id, entity_type, entity_id)
        VALUES (NEW.short_code, NEW.workspace_id, etype, NEW.id);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.short_code IS DISTINCT FROM OLD.short_code THEN
            UPDATE warehouse.short_codes
               SET code = NEW.short_code
             WHERE workspace_id = OLD.workspace_id
               AND entity_type = etype
               AND entity_id = OLD.id;
            IF NOT FOUND THEN
                INSERT INTO warehouse.short_codes (code, workspace_id, entity_type, entity_id)
                VALUES (NEW.short_code, NEW.workspace_id, etype, NEW.id);
            END IF;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM warehouse.short_codes
         WHERE workspace_id = OLD.workspace_id
           AND entity_type = etype
           AND entity_id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_items_short_codes_sync
    AFTER INSERT OR DELETE OR UPDATE OF short_code ON warehouse.items
    FOR EACH ROW EXECUTE FUNCTION warehouse.short_codes_sync('ITEM');

CREATE TRIGGER trg_locations_short_codes_sync
    AFTER INSERT OR DELETE OR UPDATE OF short_code ON warehouse.locations
    FOR EACH ROW EXECUTE FUNCTION warehouse.short_codes_sync('LOCATION');

CREATE TRIGGER trg_containers_short_codes_sync
    AFTER INSERT OR DELETE OR UPDATE OF short_code ON warehouse.containers
    FOR EACH ROW EXECUTE FUNCTION warehouse.short_codes_sync('CONTAINER');

-- The registry is now authoritative for uniqueness and global resolution:
-- drop the 3 per-table per-workspace UNIQUE constraints and the 3 global
-- short_code indexes that existed only for the resolver's table scan.
ALTER TABLE ONLY warehouse.items DROP CONSTRAINT uq_items_workspace_short_code;
ALTER TABLE ONLY warehouse.containers DROP CONSTRAINT uq_containers_workspace_short_code;
ALTER TABLE ONLY warehouse.locations DROP CONSTRAINT uq_locations_workspace_short_code;

DROP INDEX warehouse.ix_items_short_code;
DROP INDEX warehouse.ix_containers_short_code;
DROP INDEX warehouse.ix_locations_short_code;

-- GetItemByShortCode / GetLocationByShortCode / GetContainerByShortCode (the
-- sync + batch flows' per-table lookups) still query (workspace_id,
-- short_code); keep a plain composite index per table for them.
CREATE INDEX ix_items_ws_short_code ON warehouse.items USING btree (workspace_id, short_code);
CREATE INDEX ix_containers_ws_short_code ON warehouse.containers USING btree (workspace_id, short_code);
CREATE INDEX ix_locations_ws_short_code ON warehouse.locations USING btree (workspace_id, short_code);

-- migrate:down

DROP TRIGGER trg_items_short_codes_sync ON warehouse.items;
DROP TRIGGER trg_locations_short_codes_sync ON warehouse.locations;
DROP TRIGGER trg_containers_short_codes_sync ON warehouse.containers;
DROP FUNCTION warehouse.short_codes_sync();
DROP TABLE warehouse.short_codes;

DROP INDEX warehouse.ix_items_ws_short_code;
DROP INDEX warehouse.ix_containers_ws_short_code;
DROP INDEX warehouse.ix_locations_ws_short_code;

ALTER TABLE ONLY warehouse.items
    ADD CONSTRAINT uq_items_workspace_short_code UNIQUE (workspace_id, short_code);
ALTER TABLE ONLY warehouse.containers
    ADD CONSTRAINT uq_containers_workspace_short_code UNIQUE (workspace_id, short_code);
ALTER TABLE ONLY warehouse.locations
    ADD CONSTRAINT uq_locations_workspace_short_code UNIQUE (workspace_id, short_code);

CREATE INDEX ix_items_short_code ON warehouse.items USING btree (short_code);
CREATE INDEX ix_containers_short_code ON warehouse.containers USING btree (short_code);
CREATE INDEX ix_locations_short_code ON warehouse.locations USING btree (short_code);
