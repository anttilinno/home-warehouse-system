import { describe, expect, it } from "vitest";
import { inventoryFormSchema } from "./schema";

// Phase 7b Plan 03 Task 1 — zod create/edit schema for the inventory entry form.
// The schema is ALWAYS-ON (one schema for create + edit); the edit body-builder
// drops status, but the resolver still validates it (edit prefills a real value).

// A minimal valid create payload (the always-required fields).
function valid(overrides: Record<string, unknown> = {}) {
  return {
    item_id: "it-1",
    location_id: "loc-1",
    condition: "GOOD",
    status: "AVAILABLE",
    quantity: "1",
    ...overrides,
  };
}

describe("inventoryFormSchema — required fields", () => {
  it("accepts a minimal valid entry and defaults optional strings to ''", () => {
    const r = inventoryFormSchema.safeParse(valid());
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.quantity).toBe(1); // coerced number
      expect(r.data.container_id).toBe("");
      expect(r.data.date_acquired).toBe("");
      expect(r.data.warranty_expires).toBe("");
      expect(r.data.expiration_date).toBe("");
      expect(r.data.notes).toBe("");
    }
  });

  it("rejects a missing item_id", () => {
    expect(inventoryFormSchema.safeParse(valid({ item_id: "" })).success).toBe(
      false,
    );
  });

  it("rejects a missing location_id", () => {
    expect(
      inventoryFormSchema.safeParse(valid({ location_id: "" })).success,
    ).toBe(false);
  });

  it("rejects an out-of-enum condition and status", () => {
    expect(
      inventoryFormSchema.safeParse(valid({ condition: "BOGUS" })).success,
    ).toBe(false);
    expect(
      inventoryFormSchema.safeParse(valid({ status: "BOGUS" })).success,
    ).toBe(false);
  });
});

describe("inventoryFormSchema — quantity", () => {
  it("coerces a numeric string to a number", () => {
    const r = inventoryFormSchema.safeParse(valid({ quantity: "5" }));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.quantity).toBe(5);
  });

  it("rejects quantity < 1 (create/full-PATCH enforce >= 1)", () => {
    expect(
      inventoryFormSchema.safeParse(valid({ quantity: "0" })).success,
    ).toBe(false);
    expect(
      inventoryFormSchema.safeParse(valid({ quantity: "-3" })).success,
    ).toBe(false);
  });
});

describe("inventoryFormSchema — expiry >= acquired refinement", () => {
  it("rejects an expiry earlier than the acquired date with the spec message", () => {
    const r = inventoryFormSchema.safeParse(
      valid({ date_acquired: "2026-06-10", expiration_date: "2026-06-01" }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) =>
          /can't be before the acquired date/i.test(i.message),
        ),
      ).toBe(true);
      // The error is attached to the expiration_date field.
      expect(
        r.error.issues.some((i) => i.path.includes("expiration_date")),
      ).toBe(true);
    }
  });

  it("accepts an expiry equal to the acquired date (>=, not strictly >)", () => {
    const r = inventoryFormSchema.safeParse(
      valid({ date_acquired: "2026-06-10", expiration_date: "2026-06-10" }),
    );
    expect(r.success).toBe(true);
  });

  it("accepts an expiry after the acquired date", () => {
    const r = inventoryFormSchema.safeParse(
      valid({ date_acquired: "2026-06-10", expiration_date: "2026-12-31" }),
    );
    expect(r.success).toBe(true);
  });

  it("does not enforce the refinement when either date is absent", () => {
    expect(
      inventoryFormSchema.safeParse(valid({ expiration_date: "2026-06-01" }))
        .success,
    ).toBe(true);
    expect(
      inventoryFormSchema.safeParse(valid({ date_acquired: "2026-06-10" }))
        .success,
    ).toBe(true);
  });
});
