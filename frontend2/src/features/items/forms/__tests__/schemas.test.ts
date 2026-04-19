// Phase 65 Wave 0 scaffold (Plan 65-01 Task 2). itemCreateSchema gains an
// optional brand field (D-23) and a loosened barcode regex accepting
// hyphens and underscores (D-24) in Plan 65-02 Task 1. Scaffold enumerates
// the new regression cases as it.todo — Plan 65-02 converts them into
// real passing assertions after the schema changes land.
//
// The single green it() below proves the schema module is importable and
// the existing pre-Phase-65 barcode regex still rejects "abc def" — a
// regression tripwire that survives the D-24 loosening (spaces are still
// forbidden).
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

  // D-24: barcode regex loosening — Plan 65-02 Task 1 converts these to real it() blocks
  it.todo("D-24: itemCreateSchema.barcode accepts \"ABC-123\" (hyphen)");
  it.todo("D-24: itemCreateSchema.barcode accepts \"code_128\" (underscore)");
  it.todo("D-24: itemCreateSchema.barcode still rejects \"abc def\" (space forbidden)");

  // D-23: optional brand field — Plan 65-02 Task 1 converts these to real it() blocks
  it.todo("D-23: itemCreateSchema accepts optional brand=\"Coca-Cola\"");
  it.todo("D-23: itemCreateSchema accepts empty/omitted brand (undefined)");
});
