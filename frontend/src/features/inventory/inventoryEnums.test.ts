import { describe, expect, it } from "vitest";
import type { Condition, InventoryStatus } from "@/lib/types";
import {
  CONDITION_LABEL,
  CONDITION_VARIANT,
  CONDITIONS,
  STATUS_LABEL,
  STATUS_VARIANT,
  STATUSES,
} from "./inventoryEnums";

// Phase 7b Plan 01 Task 1 — enum→pill maps. Mirrors the UI-SPEC §"Status +
// condition → StatusPill variant mapping" (R6) and the Copywriting display rows.
// Every enum member MUST resolve to a variant AND a Title-Case label (no
// undefined lookups), and the ordered arrays must list all members in
// entity.go order for the form selects.

const ALL_CONDITIONS: Condition[] = [
  "NEW",
  "EXCELLENT",
  "GOOD",
  "FAIR",
  "POOR",
  "DAMAGED",
  "FOR_REPAIR",
];
const ALL_STATUSES: InventoryStatus[] = [
  "AVAILABLE",
  "IN_USE",
  "RESERVED",
  "ON_LOAN",
  "IN_TRANSIT",
  "DISPOSED",
  "MISSING",
];

describe("CONDITION_VARIANT", () => {
  it("maps all 7 conditions to the UI-SPEC variant", () => {
    expect(CONDITION_VARIANT).toEqual({
      NEW: "ok",
      EXCELLENT: "ok",
      GOOD: "info",
      FAIR: "warn",
      POOR: "warn",
      DAMAGED: "danger",
      FOR_REPAIR: "danger",
    });
  });

  it("has no undefined lookups for any condition", () => {
    for (const c of ALL_CONDITIONS) {
      expect(CONDITION_VARIANT[c]).toBeDefined();
    }
  });
});

describe("STATUS_VARIANT", () => {
  it("maps all 7 statuses to the UI-SPEC variant", () => {
    expect(STATUS_VARIANT).toEqual({
      AVAILABLE: "ok",
      IN_USE: "info",
      RESERVED: "info",
      ON_LOAN: "info",
      IN_TRANSIT: "warn",
      DISPOSED: "danger",
      MISSING: "danger",
    });
  });

  it("has no undefined lookups for any status", () => {
    for (const s of ALL_STATUSES) {
      expect(STATUS_VARIANT[s]).toBeDefined();
    }
  });
});

describe("CONDITION_LABEL", () => {
  it("returns Title-Case display strings (multi-word underscores collapse)", () => {
    expect(CONDITION_LABEL).toEqual({
      NEW: "New",
      EXCELLENT: "Excellent",
      GOOD: "Good",
      FAIR: "Fair",
      POOR: "Poor",
      DAMAGED: "Damaged",
      FOR_REPAIR: "For repair",
    });
  });
});

describe("STATUS_LABEL", () => {
  it("returns Title-Case display strings (ON_LOAN→On loan, IN_TRANSIT→In transit)", () => {
    expect(STATUS_LABEL).toEqual({
      AVAILABLE: "Available",
      IN_USE: "In use",
      RESERVED: "Reserved",
      ON_LOAN: "On loan",
      IN_TRANSIT: "In transit",
      DISPOSED: "Disposed",
      MISSING: "Missing",
    });
  });
});

describe("ordered arrays", () => {
  it("CONDITIONS lists all 7 members in entity.go order", () => {
    expect(CONDITIONS).toEqual(ALL_CONDITIONS);
  });

  it("STATUSES lists all 7 members in entity.go order", () => {
    expect(STATUSES).toEqual(ALL_STATUSES);
  });

  it("every array member has a label and a variant entry", () => {
    for (const c of CONDITIONS) {
      expect(CONDITION_LABEL[c]).toBeTruthy();
      expect(CONDITION_VARIANT[c]).toBeTruthy();
    }
    for (const s of STATUSES) {
      expect(STATUS_LABEL[s]).toBeTruthy();
      expect(STATUS_VARIANT[s]).toBeTruthy();
    }
  });
});
