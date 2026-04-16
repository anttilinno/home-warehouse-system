import { describe, expect, it } from "vitest";
import { itemCreateSchema, generateSku } from "../forms/schemas";

describe("itemCreateSchema", () => {
  it("accepts minimal valid input (name + sku)", () => {
    const result = itemCreateSchema.safeParse({ name: "A", sku: "ITEM-AAA-0001" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = itemCreateSchema.safeParse({ name: "", sku: "ITEM-AAA-0001" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("Name is required.");
  });

  it("rejects SKU with whitespace", () => {
    const result = itemCreateSchema.safeParse({ name: "A", sku: "ITEM 001" });
    expect(result.success).toBe(false);
  });

  it("rejects barcode with punctuation", () => {
    const result = itemCreateSchema.safeParse({
      name: "A",
      sku: "ITEM-AAA-0001",
      barcode: "123-456",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty-string barcode (optional literal)", () => {
    const result = itemCreateSchema.safeParse({
      name: "A",
      sku: "ITEM-AAA-0001",
      barcode: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty-string category_id (optional literal)", () => {
    const result = itemCreateSchema.safeParse({
      name: "A",
      sku: "ITEM-AAA-0001",
      category_id: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects malformed category_id UUID", () => {
    const result = itemCreateSchema.safeParse({
      name: "A",
      sku: "ITEM-AAA-0001",
      category_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

describe("generateSku", () => {
  it("matches the ITEM-XXX-XXXX pattern", () => {
    expect(generateSku()).toMatch(/^ITEM-[A-Z0-9]+-[A-Z0-9]{4}$/);
  });

  it("produces different values across calls (collision unlikely)", () => {
    const samples = new Set<string>();
    for (let i = 0; i < 50; i += 1) samples.add(generateSku());
    // At least 40 unique out of 50 is a weak assertion but robust against CI flake
    expect(samples.size).toBeGreaterThanOrEqual(40);
  });
});
