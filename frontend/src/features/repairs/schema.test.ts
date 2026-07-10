import { describe, expect, it } from "vitest";
import { repairFormSchema } from "./schema";

// Phase 4 Plan 4.2 (test-gaps) — repairFormSchema validation coverage.
// cost is the load-bearing transform: major-unit string in, CENTS int out.

const base = {
  description: "Fix wheel",
  repair_date: "",
  cost: "",
  currency_code: "",
  service_provider: "",
  is_warranty_claim: false,
  reminder_date: "",
};

describe("repairFormSchema — description", () => {
  it("accepts a valid description", () => {
    expect(repairFormSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an empty description with 'Description is required.'", () => {
    const r = repairFormSchema.safeParse({ ...base, description: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe("Description is required.");
    }
  });
});

describe("repairFormSchema — cost (major-unit string -> cents)", () => {
  it("transforms an empty string to undefined (omitted)", () => {
    const r = repairFormSchema.safeParse({ ...base, cost: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.cost).toBeUndefined();
    }
  });

  it("transforms '42.50' to 4250 cents", () => {
    const r = repairFormSchema.safeParse({ ...base, cost: "42.50" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.cost).toBe(4250);
    }
  });

  it("transforms a whole-number string to whole cents", () => {
    const r = repairFormSchema.safeParse({ ...base, cost: "10" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.cost).toBe(1000);
    }
  });

  it("rejects a negative cost with 'Cost must be a non-negative amount.'", () => {
    const r = repairFormSchema.safeParse({ ...base, cost: "-5" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe(
        "Cost must be a non-negative amount.",
      );
    }
  });

  it("rejects a non-numeric cost", () => {
    const r = repairFormSchema.safeParse({ ...base, cost: "abc" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe(
        "Cost must be a non-negative amount.",
      );
    }
  });

  it("treats whitespace-only cost as absent (undefined)", () => {
    const r = repairFormSchema.safeParse({ ...base, cost: "   " });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.cost).toBeUndefined();
    }
  });
});

describe("repairFormSchema — optional defaults", () => {
  it("defaults optional fields when omitted", () => {
    const r = repairFormSchema.safeParse({ description: "Fix wheel" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.repair_date).toBe("");
      expect(r.data.currency_code).toBe("");
      expect(r.data.service_provider).toBe("");
      expect(r.data.is_warranty_claim).toBe(false);
      expect(r.data.reminder_date).toBe("");
    }
  });

  it("accepts is_warranty_claim=true", () => {
    const r = repairFormSchema.safeParse({
      ...base,
      is_warranty_claim: true,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.is_warranty_claim).toBe(true);
    }
  });
});
