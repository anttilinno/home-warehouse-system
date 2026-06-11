-- migrate:up

-- Recurring Maintenance Schedules (ROADMAP "Recurring Maintenance Schedules").
-- Models "HVAC filter every 3 months" style cadences per inventory entry.
-- Completing a schedule writes a COMPLETED repair_logs row and advances
-- next_due (see internal/domain/warehouse/maintenance).

-- Notification type used by the maintenance reminder job.
ALTER TYPE auth.notification_type_enum ADD VALUE IF NOT EXISTS 'MAINTENANCE_DUE';

CREATE TABLE warehouse.maintenance_schedules (
    id uuid DEFAULT uuidv7() NOT NULL,
    workspace_id uuid NOT NULL,
    inventory_id uuid NOT NULL,
    title character varying(200) NOT NULL,
    notes text,
    interval_days integer NOT NULL,
    next_due date NOT NULL,
    last_completed_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT maintenance_schedules_pkey PRIMARY KEY (id),
    CONSTRAINT uq_maintenance_schedules_ws_id UNIQUE (workspace_id, id),
    CONSTRAINT chk_maintenance_schedules_interval_positive CHECK (interval_days > 0)
);

COMMENT ON TABLE warehouse.maintenance_schedules IS 'Recurring maintenance cadences per inventory entry. Completion writes a repair_logs row and advances next_due.';
COMMENT ON COLUMN warehouse.maintenance_schedules.interval_days IS 'Cadence in days between maintenance occurrences. Must be positive.';
COMMENT ON COLUMN warehouse.maintenance_schedules.next_due IS 'Date the next maintenance is due. Advanced on completion: max(today, next_due + interval_days).';
COMMENT ON COLUMN warehouse.maintenance_schedules.last_completed_at IS 'Timestamp of the most recent completion. NULL until first completed.';

ALTER TABLE ONLY warehouse.maintenance_schedules
    ADD CONSTRAINT maintenance_schedules_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;

-- Composite FK per the 005 tenancy pattern (UNIQUE (workspace_id, id) on the
-- parent makes cross-tenant references impossible).
ALTER TABLE ONLY warehouse.maintenance_schedules
    ADD CONSTRAINT maintenance_schedules_inventory_fk FOREIGN KEY (workspace_id, inventory_id) REFERENCES warehouse.inventory(workspace_id, id) ON DELETE CASCADE;

CREATE INDEX ix_maintenance_schedules_ws_next_due ON warehouse.maintenance_schedules USING btree (workspace_id, next_due);

CREATE INDEX ix_maintenance_schedules_ws_inventory ON warehouse.maintenance_schedules USING btree (workspace_id, inventory_id);

-- migrate:down

DROP TABLE warehouse.maintenance_schedules;
-- The MAINTENANCE_DUE enum value cannot be removed (PostgreSQL limitation);
-- it is harmless if unused.
