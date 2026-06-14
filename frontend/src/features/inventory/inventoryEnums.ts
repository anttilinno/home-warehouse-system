import type { StatusPillVariant } from "@/components/retro/feedback/StatusPill";
import type { Condition, InventoryStatus } from "@/lib/types";

// Phase 7b Plan 01 Task 1 — Condition/InventoryStatus → StatusPill variant +
// Title-Case display-label maps, plus ordered arrays for form select options.
//
// Mapping is the UI-SPEC §"Status + condition → StatusPill variant mapping" (R6)
// VERBATIM: pastel fills carry ink text (the four shipped variants — no new
// tokens). Display copy is Title Case per the Copywriting display rows; the
// Title-Case word inside the pill is the non-color signal (AA / color-blind).
//
// The Record key types are the full enum unions, so omitting any member is a
// COMPILE error (no undefined lookups at runtime).

export const CONDITION_VARIANT: Record<Condition, StatusPillVariant> = {
  NEW: "ok",
  EXCELLENT: "ok",
  GOOD: "info",
  FAIR: "warn",
  POOR: "warn",
  DAMAGED: "danger",
  FOR_REPAIR: "danger",
};

export const STATUS_VARIANT: Record<InventoryStatus, StatusPillVariant> = {
  AVAILABLE: "ok",
  IN_USE: "info",
  RESERVED: "info",
  ON_LOAN: "info",
  IN_TRANSIT: "warn",
  DISPOSED: "danger",
  MISSING: "danger",
};

export const CONDITION_LABEL: Record<Condition, string> = {
  NEW: "New",
  EXCELLENT: "Excellent",
  GOOD: "Good",
  FAIR: "Fair",
  POOR: "Poor",
  DAMAGED: "Damaged",
  FOR_REPAIR: "For repair",
};

export const STATUS_LABEL: Record<InventoryStatus, string> = {
  AVAILABLE: "Available",
  IN_USE: "In use",
  RESERVED: "Reserved",
  ON_LOAN: "On loan",
  IN_TRANSIT: "In transit",
  DISPOSED: "Disposed",
  MISSING: "Missing",
};

// Ordered arrays for <select> options — order matches entity.go (07b-RESEARCH).
export const CONDITIONS: Condition[] = [
  "NEW",
  "EXCELLENT",
  "GOOD",
  "FAIR",
  "POOR",
  "DAMAGED",
  "FOR_REPAIR",
];

export const STATUSES: InventoryStatus[] = [
  "AVAILABLE",
  "IN_USE",
  "RESERVED",
  "ON_LOAN",
  "IN_TRANSIT",
  "DISPOSED",
  "MISSING",
];
