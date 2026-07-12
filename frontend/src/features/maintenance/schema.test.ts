import { describe, expect, it } from "vitest";
import { maintenanceFormSchema } from "./schema";

// Phase 4 Plan 4.2 (test-gaps) — maintenanceFormSchema validation coverage.

const base = {
  title: "Oil change",
  interval_days: 30,
  next_due: "2026-08-01",
  notes: "",
};

describe("maintenanceFormSchema — title", () => {
  it("accepts a valid title", () => {
    expect(maintenanceFormSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an empty title with 'Title is required.'", () => {
    const r = maintenanceFormSchema.safeParse({ ...base, title: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe("Title is required.");
    }
  });
});

describe("maintenanceFormSchema — interval_days", () => {
  it("rejects 0 with 'Interval must be at least 1 day.'", () => {
    const r = maintenanceFormSchema.safeParse({ ...base, interval_days: 0 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe(
        "Interval must be at least 1 day.",
      );
    }
  });

  it("rejects a negative interval", () => {
    const r = maintenanceFormSchema.safeParse({
      ...base,
      interval_days: -5,
    });
    expect(r.success).toBe(false);
  });

  it("rejects a non-integer interval", () => {
    const r = maintenanceFormSchema.safeParse({
      ...base,
      interval_days: 1.5,
    });
    expect(r.success).toBe(false);
  });

  it("accepts an interval of exactly 1", () => {
    const r = maintenanceFormSchema.safeParse({ ...base, interval_days: 1 });
    expect(r.success).toBe(true);
  });
});

describe("maintenanceFormSchema — next_due", () => {
  it("rejects an empty next_due with 'Next due date is required.'", () => {
    const r = maintenanceFormSchema.safeParse({ ...base, next_due: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe("Next due date is required.");
    }
  });
});

describe("maintenanceFormSchema — notes default", () => {
  it("defaults notes to '' when omitted", () => {
    const r = maintenanceFormSchema.safeParse({
      title: "Oil change",
      interval_days: 30,
      next_due: "2026-08-01",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.notes).toBe("");
    }
  });
});
