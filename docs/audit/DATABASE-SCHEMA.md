# Database Schema Audit — home-warehouse-system

Date: 2026-06-11. Sources examined: `backend/db/schema.sql` (3,251 ln), `db/schema.sql` (3,248 ln), `backend/db/migrations/001_initial_schema.sql` (1,189 ln, sole migration), all 30 files in `backend/db/queries/`, `docker/postgres/init-staging.sql`, `sqlc.yaml`, `.mise.toml`, git history.

Part A lists defects in the current schema. Part B proposes radical redesigns (breaking changes explicitly in scope).

**Top 5 by severity:** (1) A1 stale-canonical drift + missing 002–012 lineage, (2) A2 cross-tenant FKs structurally allowed, (3) A3 unscoped UPDATE/DELETE queries, (4) A4 barcode non-unique + loan race + user-deletion FK deadlock, (5) A5 sync without idempotency or conflict detection.

---

## (A) Defects in Current Schema

### A1. Drift — the "canonical" file is the stale one — **CRITICAL**

The three schema sources disagree, and the direction of truth is inverted from what's assumed:

- `backend/db/migrations/001_initial_schema.sql` is a **consolidated** migration (commit `f3a1bf5` "consolidate migrations") containing `needs_review BOOLEAN DEFAULT false` on `warehouse.items` (line 487). It is what `mise` actually runs (`dbmate -d backend/db/migrations up`) and what sqlc compiles against (`sqlc.yaml: schema: "db/migrations/"`).
- `db/schema.sql` (root) is the **dbmate-maintained dump** of the post-consolidation DB: PG 18.3, `schema_migrations` = `('001')` only, **has** `items.needs_review`.
- `backend/db/schema.sql` is a **stale pre-consolidation dump**: PG 18.1, records versions `('001')…('012')` for migration files that **no longer exist in the repo**, and **lacks** `items.needs_review` — while `queries/items.sql` actively queries it:

  ```sql
  -- name: ListItemsNeedingReview :many
  WHERE workspace_id = $1 AND needs_review = true AND is_archived = false
  ```

  Anyone treating `backend/db/schema.sql` as canonical builds a DB that breaks sqlc-generated code. Delete it or regenerate it; keep exactly one dump.
- Commit `f3a1bf5` claims "add cross-workspace FK guards" — **no such guards exist in any schema artifact** (no composite FKs, no validation triggers). Either they were app-layer only or lost in consolidation.

### A2. Tenant isolation — cross-tenant FK corruption is structurally possible — **CRITICAL**

Every child FK references bare `id`, so a row in workspace A can legally point at a parent in workspace B:

```sql
ALTER TABLE ONLY warehouse.inventory
    ADD CONSTRAINT inventory_item_id_fkey FOREIGN KEY (item_id) REFERENCES warehouse.items(id) ON DELETE CASCADE;
```

Same for `containers.location_id`, `loans.inventory_id/borrower_id`, `items.category_id/purchased_from`, `categories.parent_category_id`, `locations.parent_location`, `repair_logs.inventory_id`, `inventory_movements.*`, `attachments.file_id`. Nothing in the DB prevents `inventory(workspace_id=A, item_id→item in B)`. The integration test in CLAUDE.md guards exactly this class of bug (Pitfall #5) — at the *query* layer only. The workspace-restore import bug (BACKEND-SECURITY F6) exploits exactly this gap today.

Tables with **no `workspace_id` at all** (tenant scoping only via joins): `warehouse.attachments` (see BACKEND-SECURITY F1), `warehouse.item_labels`, `warehouse.container_tags`. Worse:

```sql
ALTER TABLE ONLY warehouse.container_tags
    ADD CONSTRAINT container_tags_tag_value_key UNIQUE (tag_value);  -- GLOBAL uniqueness
```

One tenant's RFID/NFC tag value blocks every other tenant's, and the unique-violation error leaks cross-tenant existence.

### A3. Tenant scoping holes in live queries — **HIGH**

Mutations that skip `workspace_id` (any authenticated caller who learns a UUID can hit cross-tenant rows unless every handler re-checks):

- `items.sql`: `UpdateItem … WHERE id = $1`, `ArchiveItem/RestoreItem WHERE id = $1`, `DeleteItem WHERE id = $1`
- `inventory.sql` lines 19–48: five UPDATE/DELETE statements `WHERE id = $1` only
- `attachments.sql`: `GetFile/DeleteFile/GetAttachment/DeleteAttachment WHERE id = $1`; `SetPrimaryAttachment WHERE item_id = $1`
- `movements.sql`: `ListMovementsByInventory WHERE m.inventory_id = $1`
- `favorites.sql`: `GetFavorite WHERE id = $1`
- `pending_changes.sql`: `GetPendingChangeByID`, `UpdatePendingChangeStatus`, `DeletePendingChange`, `ListPendingChangesByEntity` — all unscoped. The approval pipeline's review action itself is unscoped by workspace.

Most are protected by service-layer pre-checks today (verified for the warehouse domain except attachments), but the protection lives in 30 query files' calling conventions, not the data layer. RLS (B2) converts these from "potential cross-tenant write" into "0 rows affected".

### A4. Integrity gaps — **HIGH**

- **`items.barcode` not unique** — only `CREATE INDEX ix_items_barcode … (workspace_id, barcode) WHERE barcode IS NOT NULL` (non-unique), yet `GetItemByBarcode :one` assumes one row. Duplicate barcode in a workspace makes the scan endpoint nondeterministic/error.
- **Loans contradiction**: `CREATE UNIQUE INDEX ix_loans_active_inventory ON loans (inventory_id) WHERE returned_at IS NULL` allows only one active loan per inventory row, while `validate_loan_quantity()` carefully `SUM`s multiple active loans — dead logic. Also the trigger reads `inventory.quantity` **without `FOR UPDATE`** → TOCTOU race lets concurrent loans oversubscribe stock.
- **User deletion is blocked** (GDPR): `item_photos.uploaded_by`, `repair_photos.uploaded_by`, `import_jobs.user_id` have FKs with **no ON DELETE action** on NOT NULL columns. `DeleteUser` in `users.sql` raises FK violations for any user who ever uploaded a photo.
- **No cycle protection** on `categories.parent_category_id` / `locations.parent_location` self-FKs — a 2-node cycle makes recursive tree queries spin.
- **`auth.users.email`** is `UNIQUE` but case-sensitive varchar — `Foo@x.com` and `foo@x.com` are two accounts. Not `citext`, no `lower()` unique index.
- **Token tables**: `user_sessions.refresh_token_hash` and `password_reset_tokens.token_hash` are only plain-indexed, not UNIQUE.
- **`deleted_records`** (sync tombstones) has no `UNIQUE (workspace_id, entity_type, entity_id)` — duplicate tombstones possible.
- **Nullability/CHECK inconsistencies**: `items.is_archived/is_insured`, `notifications.is_read`, `users.is_active/is_superuser` are nullable booleans while every other table uses `NOT NULL`; `inventory.purchase_price`/`repair_logs.cost` (cents) have no `>= 0` CHECK; `currency_code` no `char_length = 3` CHECK; `labels.color varchar(7)` no hex CHECK; `item_photos.width/height/file_size` no positivity CHECK; no per-item uniqueness on `(item_id, display_order)`.
- Cargo-cult constraints duplicating NOT NULL:

  ```sql
  CONSTRAINT import_errors_import_job_id_idx_check CHECK ((import_job_id IS NOT NULL))
  ```

- **`favorites`** polymorphic nullable-FK trio (`item_id/location_id/container_id` + type discriminator + 3 partial uniques) — works, but nothing forces the *other two* columns to be NULL (a row can be `favorite_type='ITEM'` with a `container_id` set too).

### A5. Sync / pending_changes design — **HIGH**

- **No idempotency key** on `pending_changes` — an offline client retrying a POST creates duplicate change requests; nothing like `UNIQUE (workspace_id, client_change_id)`. (Frontend sends `Idempotency-Key` UUIDv7 headers — the schema has nowhere to store them.)
- **No conflict detection**: `payload jsonb` carries the full desired state with no `base_version`/`expected_updated_at`, so approval blindly last-writes-wins over concurrent edits.
- **`entity_type varchar(50)` free text** while `activity_log`/`deleted_records` use `warehouse.activity_entity_enum` — three representations of the same concept.
- Delta sync (`sync.sql`) keys on `updated_at > $2` with **no updated_at trigger** — every code path must remember `SET updated_at = now()`; any forgotten path silently never syncs. Timestamp cursors also miss rows committed out of order (two commits in the same ms / long transactions); no monotonic cursor.
- Approved pending changes are hard-`DELETE`d or left forever — no retention story.

### A6. Indexes — redundant, missing, and cross-tenant — **MEDIUM**

Redundant (leading-column duplicates of UNIQUE constraints or composites):

- `ix_items_workspace` ⊂ `items_workspace_id_sku_key`; `ix_containers_workspace` ⊂ `uq_containers_workspace_short_code`; `ix_locations_workspace` ⊂ `uq_locations_workspace_short_code`; `ix_workspace_docspell_settings_workspace` duplicates `…_workspace_id_key UNIQUE`; `ix_loans_inventory_id` largely covered by `ix_loans_active_inventory` + `ix_loans_outstanding`; `ix_categories_workspace` ⊂ `ix_categories_active`.

Useless global indexes (every query is workspace-scoped; these index across tenants):

- `ix_items_name`, `ix_containers_name`, `ix_locations_name`, `ix_categories_name`, `ix_companies_name`.

Missing:

- `activity_log (workspace_id, created_at DESC)` — `ListActivityByWorkspace` orders by `created_at DESC` per workspace but only has separate `(workspace_id)` and `(created_at DESC)` indexes.
- `inventory_movements (workspace_id, created_at DESC)` — same pattern; also nothing serves `ListMovementsByLocation`'s `(from_location_id = $2 OR to_location_id = $2)`.
- `notifications (user_id, created_at DESC)` composite for the list query.

### A7. Types & defaults — **MEDIUM**

- **UUID strategy split**: everything uses `uuidv7()` (good, index-local) except `import_jobs`/`import_errors` use `gen_random_uuid()` (v4) — random-write index pattern on the two highest-churn append tables of the import path.
- All timestamps are `timestamptz` ✔; money is integer cents ✔ — but queries `SUM(purchase_price)` into "value" with mixed `currency_code` per row — **summing cents across currencies** in `GetUnusedInventoryCounts`/`GetCategoryStats` is numerically wrong the moment a second currency appears.
- `varchar(N)` everywhere with arbitrary limits (`varchar(8)` short_code, `varchar(5)` separator) vs Postgres idiom `text + CHECK`. Mixed `DEFAULT now()` vs `DEFAULT CURRENT_TIMESTAMP` cosmetics.
- FTS is hardcoded `'english'` in all four search-vector implementations, yet `users.language` advertises `en, fi, de`. Finnish/Estonian item names get English stemming.
- Three different FTS mechanisms: generated column (items), plain trigger (locations/containers), weighted trigger (borrowers). One concept, three implementations.

### A8. Soft delete — split-brain pattern — **MEDIUM**

Two coexisting deletion systems: `is_archived` flags (8 tables + `v_archived_records` view) **and** hard delete + `deleted_records` tombstones for sync. Queries are mostly disciplined (`WHERE is_archived = false`), but:

- `attachments`, `files`, `item_photos`, `loans`, `inventory_movements`, `pending_changes` have no `is_archived` — inconsistent entity coverage.
- `sync.sql` `ListItemsModifiedSince` returns archived rows too (correct for sync, accidental if a client treats them as live — no `is_archived` discriminator documented in the cursor protocol).
- Hard `DELETE` queries exist alongside archive queries for the same tables (`DeleteItem`, `DeleteLabel`, `DeleteContainer`…), so "deleted" means two different things for one entity, and only the hard path writes tombstones (app-dependent).

### A9. Append-only tables: no partitioning/retention — **LOW today, MEDIUM at growth**

`activity_log`, `inventory_movements`, `deleted_records`, `auth.notifications`, `workspace_exports` grow forever; cleanup exists only as opt-in queries (`CleanupOldActivity`, `CleanupOldDeletedRecords`) with no scheduled caller in the DB. Partitioning is overkill at home scale, but retention should be declared (see B7).

### A10. Migration hygiene — **HIGH**

- History was **squashed into 001** while two schema dumps still reference the 002–012 lineage — any environment that already applied 001–012 of the *old* lineage now disagrees with a fresh 001-consolidated install (`schema_migrations` content differs).
- `-- migrate:down` is `DROP SCHEMA … CASCADE` — the "down" migration destroys all data; effectively irreversible.
- `docker/postgres/init-staging.sql` creates `warehouse_staging` but no migration/seed wiring is visible — staging schema state depends on someone remembering to run dbmate against it.

---

## (B) Radical Redesign Proposals

### B1. Composite-key tenancy: make cross-tenant corruption *unrepresentable*

Give every tenant-owned parent a `UNIQUE (workspace_id, id)` and make every child FK composite. Breaking, mechanical, and worth it — the DB then proves tenant isolation instead of 30 query files re-asserting it.

```sql
ALTER TABLE warehouse.items      ADD CONSTRAINT uq_items_ws_id      UNIQUE (workspace_id, id);
ALTER TABLE warehouse.locations  ADD CONSTRAINT uq_locations_ws_id  UNIQUE (workspace_id, id);
ALTER TABLE warehouse.containers ADD CONSTRAINT uq_containers_ws_id UNIQUE (workspace_id, id);
ALTER TABLE warehouse.borrowers  ADD CONSTRAINT uq_borrowers_ws_id  UNIQUE (workspace_id, id);
ALTER TABLE warehouse.inventory  ADD CONSTRAINT uq_inventory_ws_id  UNIQUE (workspace_id, id);
ALTER TABLE warehouse.categories ADD CONSTRAINT uq_categories_ws_id UNIQUE (workspace_id, id);

-- children: drop single-column FKs, add composite ones
ALTER TABLE warehouse.inventory
  DROP CONSTRAINT inventory_item_id_fkey,
  ADD  CONSTRAINT inventory_item_fk     FOREIGN KEY (workspace_id, item_id)
       REFERENCES warehouse.items (workspace_id, id) ON DELETE CASCADE,
  DROP CONSTRAINT inventory_location_id_fkey,
  ADD  CONSTRAINT inventory_location_fk FOREIGN KEY (workspace_id, location_id)
       REFERENCES warehouse.locations (workspace_id, id) ON DELETE RESTRICT,
  DROP CONSTRAINT inventory_container_id_fkey,
  ADD  CONSTRAINT inventory_container_fk FOREIGN KEY (workspace_id, container_id)
       REFERENCES warehouse.containers (workspace_id, id) ON DELETE SET NULL (container_id);

ALTER TABLE warehouse.loans
  ADD CONSTRAINT loans_inventory_fk FOREIGN KEY (workspace_id, inventory_id)
      REFERENCES warehouse.inventory (workspace_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT loans_borrower_fk  FOREIGN KEY (workspace_id, borrower_id)
      REFERENCES warehouse.borrowers (workspace_id, id) ON DELETE RESTRICT;
```

Apply the same to `containers→locations`, `items→categories/companies`, `repair_logs→inventory`, `inventory_movements→*`, self-FKs on categories/locations (composite self-reference also kills cross-tenant parenting). Add `workspace_id` to `attachments`, `item_labels`, `container_tags`, then:

```sql
ALTER TABLE warehouse.container_tags
  DROP CONSTRAINT container_tags_tag_value_key,
  ADD  CONSTRAINT uq_container_tags_ws_value UNIQUE (workspace_id, tag_type, tag_value);
```

Notes:

- `ON DELETE SET NULL (container_id)` (PG 15+ column list) — required so composite FKs don't null out `workspace_id`.
- Use `RESTRICT` for location deletes — today `inventory_location_id_fkey … ON DELETE CASCADE` **deletes inventory rows when a location is deleted**, which is arguably a data-loss bug already.

**Migration strategy:** purely additive first (`CREATE UNIQUE INDEX CONCURRENTLY` + `ADD CONSTRAINT … USING INDEX`), then add composite FKs `NOT VALID` → `VALIDATE CONSTRAINT` (catches any existing cross-tenant rows!), then drop old FKs. Zero rewrite, brief locks only. sqlc queries unchanged (FK columns already exist).
**Tradeoff:** ~20 extra unique indexes (small tables, negligible), more verbose DDL. In exchange, A2 disappears as a bug class.

### B2. Row-Level Security as the second seatbelt

Every observed query already filters `workspace_id = $1` or `user_id = $1`, so RLS is drop-in feasible with pgx by setting a GUC per request/transaction:

```sql
ALTER TABLE warehouse.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse.items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON warehouse.items
  USING (workspace_id = current_setting('app.workspace_id')::uuid);
-- repeat for all warehouse.* tables; auth.notifications etc. keyed on app.user_id
```

Go side: `tx.Exec(ctx, "SELECT set_config('app.workspace_id', $1, true)", wsID)` at the start of each request transaction; connect as a non-superuser, non-`BYPASSRLS` role. This converts every A3 unscoped query from "cross-tenant write" into "0 rows affected." Index scans are unaffected — the policy predicate matches the existing composite indexes.

**Tradeoff:** all queries must run inside a transaction with the GUC set (middleware change); background jobs (thumbnailer, reminders, cleanup) need a maintenance role or per-workspace iteration. Keep the explicit `WHERE workspace_id` clauses anyway — RLS is the seatbelt, not the steering.

### B3. One inventory ledger instead of mutable quantity + side tables

Radical normalization of `inventory.quantity` / `loans` / `inventory_movements` / `last_used_at` into an append-only event ledger; current quantity becomes derived state:

```sql
CREATE TYPE warehouse.stock_event_type AS ENUM
  ('RECEIVE','MOVE','ADJUST','LOAN_OUT','LOAN_RETURN','DISPOSE','USE');

CREATE TABLE warehouse.stock_events (
    id            uuid PRIMARY KEY DEFAULT uuidv7(),
    workspace_id  uuid NOT NULL,
    inventory_id  uuid NOT NULL,
    event_type    warehouse.stock_event_type NOT NULL,
    quantity_delta integer NOT NULL CHECK (quantity_delta <> 0),
    location_id   uuid,           -- destination for MOVE/RECEIVE
    container_id  uuid,
    loan_id       uuid,           -- set for LOAN_OUT/LOAN_RETURN
    actor_id      uuid,
    occurred_at   timestamptz NOT NULL DEFAULT now(),
    note          text,
    FOREIGN KEY (workspace_id, inventory_id) REFERENCES warehouse.inventory (workspace_id, id) ON DELETE CASCADE
);

-- derived, trigger-maintained, race-free under the row lock the trigger takes:
ALTER TABLE warehouse.inventory
  ADD COLUMN on_hand   integer NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  ADD COLUMN on_loan   integer NOT NULL DEFAULT 0 CHECK (on_loan >= 0 AND on_loan <= on_hand);
```

Trigger on `stock_events` does `UPDATE inventory SET on_hand = on_hand + delta … WHERE id = NEW.inventory_id` — the UPDATE itself serializes concurrent loans (fixes the A4 TOCTOU race for free), the CHECK enforces non-oversubscription, and movements/declutter (`USE` events replace `last_used_at`)/loan history all come from one table. `loans` shrinks to the agreement (borrower, due_date, returned_at); quantities live in the ledger. Decide explicitly whether multiple concurrent loans per inventory row are allowed and delete either the unique partial index or the SUM trigger.

**Tradeoff:** biggest behavioral change in this list; repos for loans/movements/declutter rewritten. Backfill: synthesize one `RECEIVE` event per inventory row at migration time, convert `inventory_movements` and unreturned `loans` to events. Skip this if you only want safety fixes — but it is the honest model for an inventory system, and it makes the activity timeline trivially complete.

### B4. Sync done right: monotonic cursor + idempotent intents

```sql
-- one global change feed (replaces 16 per-table updated_at scans)
CREATE TABLE warehouse.change_log (
    seq          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id uuid NOT NULL,
    entity_type  warehouse.activity_entity_enum NOT NULL,
    entity_id    uuid NOT NULL,
    op           char(1) NOT NULL CHECK (op IN ('I','U','D')),
    at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON warehouse.change_log (workspace_id, seq);
```

Populate via per-table `AFTER INSERT/UPDATE/DELETE` triggers (also auto-bump `updated_at` via a shared `moddatetime`-style trigger so A5's "forgot updated_at" bug class dies). Clients sync with `WHERE workspace_id=$1 AND seq > $2 ORDER BY seq LIMIT $3` — a single monotonic cursor replaces 9 timestamp cursors, subsumes `deleted_records` (op='D' rows are the tombstones; drop the table).

```sql
ALTER TABLE warehouse.pending_changes
  ADD COLUMN client_change_id uuid NOT NULL,                       -- idempotency key
  ADD COLUMN base_updated_at  timestamptz,                         -- optimistic concurrency token
  ADD CONSTRAINT uq_pending_changes_idem UNIQUE (workspace_id, client_change_id),
  ALTER COLUMN entity_type TYPE warehouse.activity_entity_enum
    USING upper(entity_type)::warehouse.activity_entity_enum;
```

Approval applies only if `entity.updated_at = base_updated_at`, else marks status `conflict` (add to enum). Retried offline POSTs become upserts on the idempotency key. (The frontend already generates UUIDv7 idempotency keys per mutation — this gives them a home.)

**Tradeoff:** ~10 small triggers; `change_log` needs retention (delete `seq` older than the oldest plausible client, e.g. 90 days, after which clients full-resync). The identity `seq` has theoretical commit-order gaps under concurrency — acceptable at this write volume; if not, use a transactional sequence table.

### B5. Identity & uniqueness hardening

```sql
CREATE EXTENSION IF NOT EXISTS citext;
ALTER TABLE auth.users          ALTER COLUMN email TYPE citext;    -- case-insensitive unique
ALTER TABLE warehouse.borrowers ALTER COLUMN email TYPE citext;

DROP INDEX warehouse.ix_items_barcode;
CREATE UNIQUE INDEX uq_items_ws_barcode ON warehouse.items (workspace_id, barcode)
  WHERE barcode IS NOT NULL AND is_archived = false;               -- scanner determinism

ALTER TABLE auth.user_sessions          ADD CONSTRAINT uq_sessions_token UNIQUE (refresh_token_hash);
ALTER TABLE auth.password_reset_tokens  ADD CONSTRAINT uq_prt_token      UNIQUE (token_hash);

-- shortlink resolver (s.go/<hash>): global short codes need a global registry, not 3 per-table indexes
CREATE TABLE warehouse.short_codes (
    code         text PRIMARY KEY CHECK (code ~ '^[A-Za-z0-9]{4,12}$'),
    workspace_id uuid NOT NULL,
    entity_type  warehouse.favorite_type_enum NOT NULL,            -- ITEM/LOCATION/CONTAINER
    entity_id    uuid NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, entity_type, entity_id)
);
```

The `short_codes` registry makes `GET /r/{code}` one PK lookup instead of "search all workspaces across three tables" (see the shortlink resolver design memo), guarantees global uniqueness, and lets items/locations/containers drop their `short_code` columns + 3 unique constraints + 3 global indexes.

Fix user deletion: `item_photos.uploaded_by` / `repair_photos.uploaded_by` → nullable + `ON DELETE SET NULL`; `import_jobs.user_id` → `ON DELETE CASCADE` (jobs are user-private). Add cycle guards on the two tree tables (simple `CHECK (parent_category_id <> id)` plus a depth-limited trigger, or move to `ltree` paths if hierarchy queries grow).

### B6. Normalize the four photo/file systems into one media model

Today: `files`+`attachments` (items, with Docspell split-brain), `item_photos` (17 columns of thumbnail pipeline), `repair_photos` (clone of item_photos), `repair_attachments` (clone of attachments). Radical version:

```sql
CREATE TABLE warehouse.media (
    id            uuid PRIMARY KEY DEFAULT uuidv7(),
    workspace_id  uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    kind          text NOT NULL CHECK (kind IN ('image','document')),
    original_name text NOT NULL,
    mime_type     text NOT NULL,
    size_bytes    bigint NOT NULL CHECK (size_bytes > 0),
    checksum      text NOT NULL,
    storage_key   text NOT NULL,
    width         integer CHECK (width > 0),
    height        integer CHECK (height > 0),
    perceptual_hash bigint,
    thumbnails    jsonb NOT NULL DEFAULT '{}',   -- {"150":"path","400":"path","800":"path","status":"complete","attempts":1}
    docspell_item_id text,
    uploaded_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, checksum)              -- dedup per tenant
);

CREATE TABLE warehouse.media_links (             -- replaces attachments, item_photos linkage, repair_*
    media_id     uuid NOT NULL REFERENCES warehouse.media(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL,
    owner_type   text NOT NULL CHECK (owner_type IN ('item','repair_log','user_avatar')),
    owner_id     uuid NOT NULL,
    role         warehouse.attachment_type_enum NOT NULL,     -- PHOTO/MANUAL/RECEIPT/…
    phase        warehouse.repair_photo_type_enum,            -- BEFORE/DURING/AFTER, NULL unless repair
    display_order integer NOT NULL DEFAULT 0,
    is_primary   boolean NOT NULL DEFAULT false,
    caption      text,
    PRIMARY KEY (owner_type, owner_id, media_id)
);
CREATE UNIQUE INDEX uq_media_primary ON warehouse.media_links (owner_type, owner_id) WHERE is_primary;
```

The thumbnail pipeline columns collapse into `thumbnails` jsonb (pipeline state, not relational data — the one place jsonb earns its keep). One worker queue, one dedup index, one primary-photo rule. This also retires the unscoped `attachments` table at the root of BACKEND-SECURITY F1.

**Tradeoff:** the polymorphic `owner_type/owner_id` forgoes FK enforcement to items/repairs — acceptable for media (orphans are cleanable), or split `media_links` into two tiny tables for hard FKs. Migration is a four-way `INSERT…SELECT` plus file-path-preserving backfill; doable offline in seconds at home scale.

### B7. Housekeeping bundle (cheap, do regardless)

```sql
-- normalize booleans
ALTER TABLE warehouse.items ALTER COLUMN is_archived SET NOT NULL, ALTER COLUMN is_archived SET DEFAULT false;
ALTER TABLE warehouse.items ALTER COLUMN is_insured  SET NOT NULL;
ALTER TABLE auth.users  ALTER COLUMN is_active SET NOT NULL, ALTER COLUMN is_superuser SET NOT NULL;
ALTER TABLE auth.notifications ALTER COLUMN is_read SET NOT NULL;

-- money & enum-ish guards
ALTER TABLE warehouse.inventory   ADD CONSTRAINT chk_price_nonneg CHECK (purchase_price IS NULL OR purchase_price >= 0),
                                  ADD CONSTRAINT chk_currency CHECK (currency_code ~ '^[A-Z]{3}$');
ALTER TABLE warehouse.repair_logs ADD CONSTRAINT chk_cost_nonneg  CHECK (cost IS NULL OR cost >= 0);
ALTER TABLE warehouse.labels      ADD CONSTRAINT chk_color_hex    CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$');

-- index diet
DROP INDEX warehouse.ix_items_workspace, warehouse.ix_containers_workspace, warehouse.ix_locations_workspace,
           warehouse.ix_categories_workspace, warehouse.ix_items_name, warehouse.ix_containers_name,
           warehouse.ix_locations_name, warehouse.ix_categories_name, warehouse.ix_companies_name,
           auth.ix_workspace_docspell_settings_workspace;
CREATE INDEX ix_activity_ws_created ON warehouse.activity_log (workspace_id, created_at DESC);
CREATE INDEX ix_movements_ws_created ON warehouse.inventory_movements (workspace_id, created_at DESC);
CREATE INDEX ix_notifications_user_created ON auth.notifications (user_id, created_at DESC);

-- consistency: one FTS mechanism (generated columns) with per-workspace language
ALTER TABLE auth.workspaces ADD COLUMN fts_language regconfig NOT NULL DEFAULT 'simple';
-- then regenerate location/container/borrower vectors as GENERATED columns
-- ('simple' is language-neutral; or join workspace config in the trigger)

-- UUID consistency
ALTER TABLE warehouse.import_jobs   ALTER COLUMN id SET DEFAULT uuidv7();
ALTER TABLE warehouse.import_errors ALTER COLUMN id SET DEFAULT uuidv7();

-- drop cargo-cult checks
ALTER TABLE warehouse.import_errors DROP CONSTRAINT import_errors_import_job_id_idx_check;
ALTER TABLE warehouse.import_jobs   DROP CONSTRAINT import_jobs_workspace_id_idx_check;
```

Plus:

- Declare retention as scheduled jobs (pg_cron or app ticker): activity_log/change_log 365d, read notifications 90d, expired sessions/reset tokens daily, import_jobs 30d.
- Multi-currency: either pin one currency per workspace (`workspaces.currency_code` + drop per-row currency) or make every SUM group by currency — current analytics silently mixes currencies.

### B8. Migration & repo hygiene strategy

1. Delete `backend/db/schema.sql`; make root `db/schema.sql` the single dbmate-generated artifact (it already is operationally) and add a CI step: `dbmate up` into a scratch DB + `sqlc vet`/`sqlc generate --diff` so schema/queries can never drift again (this would have caught `needs_review`).
2. For environments still carrying `schema_migrations` 001–012: ship a one-off reconciliation (`DELETE FROM schema_migrations WHERE version <> '001'`) after verifying structural identity; document it.
3. New work as small forward-only migrations (002, 003, …); never re-squash applied history. Use `NOT VALID`+`VALIDATE`, `CREATE INDEX CONCURRENTLY`, and column-list `SET NULL` patterns above.
4. Order of operations for the radical set: **B7 → B5 → B1 → B2** are independent and low-risk (a weekend); **B4** next (sync clients must adopt the cursor); **B6** and **B3** are feature-sized projects — do them only with their respective feature milestones (media pipeline rework; loans/declutter rework).
