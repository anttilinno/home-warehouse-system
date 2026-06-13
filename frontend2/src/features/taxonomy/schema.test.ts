import { describe, expect, it } from "vitest";
import {
  categorySchema,
  containerSchema,
  labelSchema,
  locationSchema,
} from "./schema";

describe("labelSchema.color", () => {
  it("accepts the project danger hex #b73348", () => {
    const r = labelSchema.safeParse({ name: "Fragile", color: "#b73348" });
    expect(r.success).toBe(true);
  });

  it("accepts an empty color (no color = absent)", () => {
    const r = labelSchema.safeParse({ name: "Fragile", color: "" });
    expect(r.success).toBe(true);
  });

  it("accepts an omitted color", () => {
    const r = labelSchema.safeParse({ name: "Fragile" });
    expect(r.success).toBe(true);
  });

  it("rejects 3-digit shorthand #fff", () => {
    const r = labelSchema.safeParse({ name: "Fragile", color: "#fff" });
    expect(r.success).toBe(false);
  });

  it("rejects a named color 'red'", () => {
    const r = labelSchema.safeParse({ name: "Fragile", color: "red" });
    expect(r.success).toBe(false);
  });

  it("rejects non-hex chars #GGGGGG", () => {
    const r = labelSchema.safeParse({ name: "Fragile", color: "#GGGGGG" });
    expect(r.success).toBe(false);
  });
});

describe("name length bounds (all domains)", () => {
  it("rejects an empty name", () => {
    expect(categorySchema.safeParse({ name: "" }).success).toBe(false);
    expect(labelSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects a name over 255 chars", () => {
    const long = "x".repeat(256);
    expect(categorySchema.safeParse({ name: long }).success).toBe(false);
  });

  it("accepts a 1-char name", () => {
    expect(categorySchema.safeParse({ name: "A" }).success).toBe(true);
  });
});

describe("containerSchema.location_id", () => {
  it("requires location_id", () => {
    const r = containerSchema.safeParse({ name: "Bin 3" });
    expect(r.success).toBe(false);
  });

  it("accepts a non-empty location_id", () => {
    const r = containerSchema.safeParse({ name: "Bin 3", location_id: "loc-1" });
    expect(r.success).toBe(true);
  });
});

describe("short_code validation (locations/containers)", () => {
  it("accepts a valid 4-8 alnum short_code", () => {
    const r = locationSchema.safeParse({ name: "Garage", short_code: "GAR1" });
    expect(r.success).toBe(true);
  });

  it("accepts an empty short_code (auto-generated server-side)", () => {
    const r = locationSchema.safeParse({ name: "Garage", short_code: "" });
    expect(r.success).toBe(true);
  });

  it("rejects a too-short short_code", () => {
    const r = locationSchema.safeParse({ name: "Garage", short_code: "AB" });
    expect(r.success).toBe(false);
  });

  it("rejects a short_code with punctuation", () => {
    const r = containerSchema.safeParse({
      name: "Bin",
      location_id: "loc-1",
      short_code: "BIN-1",
    });
    expect(r.success).toBe(false);
  });
});

describe("parent fields (optional = root)", () => {
  it("categorySchema accepts an empty parent_category_id (root)", () => {
    const r = categorySchema.safeParse({ name: "Tools", parent_category_id: "" });
    expect(r.success).toBe(true);
  });

  it("locationSchema uses parent_location (NOT _id) and accepts empty (root)", () => {
    const r = locationSchema.safeParse({ name: "Garage", parent_location: "" });
    expect(r.success).toBe(true);
  });
});
