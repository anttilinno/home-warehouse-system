import { describe, expect, it } from "vitest";
import { itemFormSchema } from "./schema";

// Phase 4 Plan 4.2 (test-gaps) — itemFormSchema validation coverage.
// Mirrors taxonomy/borrowers schema.test.ts conventions.

const base = {
  sku: "SKU-1",
  name: "Widget",
  description: "",
  barcode: "",
  category: "",
  minStock: "",
};

describe("itemFormSchema — sku", () => {
  it("accepts a valid sku", () => {
    expect(itemFormSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an empty sku with 'SKU is required.'", () => {
    const r = itemFormSchema.safeParse({ ...base, sku: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe("SKU is required.");
    }
  });

  it("rejects a whitespace-only sku (trimmed)", () => {
    const r = itemFormSchema.safeParse({ ...base, sku: "   " });
    expect(r.success).toBe(false);
  });

  it("rejects a sku over 255 chars", () => {
    const r = itemFormSchema.safeParse({ ...base, sku: "x".repeat(256) });
    expect(r.success).toBe(false);
  });

  it("accepts a sku of exactly 255 chars", () => {
    const r = itemFormSchema.safeParse({ ...base, sku: "x".repeat(255) });
    expect(r.success).toBe(true);
  });
});

describe("itemFormSchema — name", () => {
  it("rejects an empty name with 'Name is required.'", () => {
    const r = itemFormSchema.safeParse({ ...base, name: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe("Name is required.");
    }
  });

  it("rejects a name over 255 chars", () => {
    const r = itemFormSchema.safeParse({ ...base, name: "x".repeat(256) });
    expect(r.success).toBe(false);
  });
});

describe("itemFormSchema — minStock", () => {
  it("coerces an empty string to undefined (omitted)", () => {
    const r = itemFormSchema.safeParse({ ...base, minStock: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.minStock).toBeUndefined();
    }
  });

  it("coerces a numeric string to a number", () => {
    const r = itemFormSchema.safeParse({ ...base, minStock: "5" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.minStock).toBe(5);
    }
  });

  it("accepts a numeric value directly", () => {
    const r = itemFormSchema.safeParse({ ...base, minStock: 3 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.minStock).toBe(3);
    }
  });

  it("rejects a negative minStock with 'Quantity can't be negative.'", () => {
    const r = itemFormSchema.safeParse({ ...base, minStock: "-1" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe("Quantity can't be negative.");
    }
  });

  it("coerces a non-numeric string to undefined rather than erroring", () => {
    const r = itemFormSchema.safeParse({ ...base, minStock: "abc" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.minStock).toBeUndefined();
    }
  });
});

describe("itemFormSchema — optional string defaults", () => {
  it("defaults description/barcode/category to '' when omitted", () => {
    const r = itemFormSchema.safeParse({ sku: "SKU-1", name: "Widget" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.description).toBe("");
      expect(r.data.barcode).toBe("");
      expect(r.data.category).toBe("");
    }
  });

  it("rejects a description over 10000 chars", () => {
    const r = itemFormSchema.safeParse({
      ...base,
      description: "x".repeat(10001),
    });
    expect(r.success).toBe(false);
  });

  it("rejects a barcode over 255 chars", () => {
    const r = itemFormSchema.safeParse({ ...base, barcode: "x".repeat(256) });
    expect(r.success).toBe(false);
  });
});
