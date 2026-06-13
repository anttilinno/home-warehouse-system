import { z } from "zod";

// Phase 10b Plan 01 — RHF+zod create/edit schema for the maintenance schedule
// form. Mirrors features/loans/schema.ts conventions: one ALWAYS-ON schema;
// optional string fields default to "" for meaningful RHF dirtyFields tracking.
//
// interval_days is the cadence (>= 1, integer); next_due is the next service
// date (YYYY-MM-DD, the <input type="date"> value). The server is authoritative
// (T-10b-VAL) — these refinements are convenience guards only.

export const maintenanceFormSchema = z.object({
  // Required title.
  title: z.string().min(1, { message: "Title is required." }),
  // Required cadence (whole days, >= 1).
  interval_days: z
    .number({ message: "Interval must be at least 1 day." })
    .int({ message: "Interval must be at least 1 day." })
    .min(1, { message: "Interval must be at least 1 day." }),
  // Required next-due date (YYYY-MM-DD).
  next_due: z.string().min(1, { message: "Next due date is required." }),
  // Optional free-text notes.
  notes: z.string().optional().default(""),
});

// The RESOLVED (output) shape after zod transforms.
export type MaintenanceFormValues = z.infer<typeof maintenanceFormSchema>;

// The INPUT shape RHF holds before resolution.
export type MaintenanceFormInput = z.input<typeof maintenanceFormSchema>;
