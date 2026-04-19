// Phase 65 Plan 65-02 Task 1 — RED→GREEN.
// D-23: itemCreateSchema gains an optional `brand` field (max 120).
// D-24: itemCreateSchema.barcode regex loosened from /^[A-Za-z0-9]+$/ to
//       /^[A-Za-z0-9\-_]+$/ so hyphens and underscores are accepted (spaces
//       still forbidden).
//
// The space-rejection case below stays green before AND after the D-24
// loosening — it is a regression tripwire ensuring the loosened regex does
// NOT also start accepting whitespace.
import { describe, it, expect } from "vitest";
import { itemCreateSchema } from "@/features/items/forms/schemas";

describe("itemCreateSchema module import smoke", () => {
  it("itemCreateSchema rejects barcode with a space character (regression tripwire)", () => {
    const result = itemCreateSchema.safeParse({
      name: "X",
      sku: "ITEM-1",
      barcode: "has space",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      // Some zod issue should be on the barcode field
      const barcodeIssue = result.error.issues.find((i) => i.path[0] === "barcode");
      expect(barcodeIssue).toBeDefined();
    }
  });

  // D-24: barcode regex loosening
  it("D-24: itemCreateSchema.barcode accepts \"TEST-CODE-123\" (hyphen)", () => {
    const result = itemCreateSchema.safeParse({
      name: "X",
      sku: "ITEM-1",
      barcode: "TEST-CODE-123",
    });
    expect(result.success).toBe(true);
  });

  it("D-24: itemCreateSchema.barcode accepts \"abc_def_123\" (underscore)", () => {
    const result = itemCreateSchema.safeParse({
      name: "X",
      sku: "ITEM-1",
      barcode: "abc_def_123",
    });
    expect(result.success).toBe(true);
  });

  it("D-24: itemCreateSchema.barcode still rejects \"abc def\" (space forbidden)", () => {
    const result = itemCreateSchema.safeParse({
      name: "X",
      sku: "ITEM-1",
      barcode: "abc def",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const barcodeIssue = result.error.issues.find((i) => i.path[0] === "barcode");
      expect(barcodeIssue).toBeDefined();
    }
  });

  // D-23: optional brand field
  it("D-23: itemCreateSchema accepts optional brand=\"Coca-Cola\" and preserves it through parse", () => {
    const result = itemCreateSchema.safeParse({
      name: "X",
      sku: "ITEM-1",
      brand: "Coca-Cola",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.brand).toBe("Coca-Cola");
    }
  });

  it("D-23: itemCreateSchema accepts empty/omitted brand (undefined)", () => {
    const result = itemCreateSchema.safeParse({
      name: "X",
      sku: "ITEM-1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.brand).toBeUndefined();
    }
  });

  // D-23 regression: enforce max-120 cap
  it("D-23: itemCreateSchema rejects brand over 120 characters", () => {
    const result = itemCreateSchema.safeParse({
      name: "X",
      sku: "ITEM-1",
      brand: "A".repeat(121),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const brandIssue = result.error.issues.find((i) => i.path[0] === "brand");
      expect(brandIssue).toBeDefined();
    }
  });
});
