// Phase 65 Wave 0 scaffold (Plan 65-01 Task 2). Behavioral tests are
// todos until Plan 65-02 adds itemsApi.lookupByBarcode. Turn each
// it.todo into a real it() with vi.spyOn(itemsApi, "list") assertions
// as part of Plan 65-02.
import { describe, it, expect } from "vitest";
import { itemsApi } from "@/lib/api/items";

describe("itemsApi.lookupByBarcode", () => {
  it("itemsApi barrel is importable and has the expected siblings", () => {
    expect(typeof itemsApi.list).toBe("function");
    expect(typeof itemsApi.get).toBe("function");
    expect(typeof itemsApi.create).toBe("function");
  });

  // D-06: wraps list(wsId, { search: code, limit: 1 })
  it.todo("D-06: calls itemsApi.list with { search: code, limit: 1 }");
  // D-07: case-sensitive exact-barcode guard — returns null on mismatch
  it.todo("D-07: returns null when items[0].barcode !== code (case-sensitive)");
  it.todo("D-07: returns null on empty items[] response");
  // D-08: workspace defense-in-depth + structured console.error
  it.todo("D-08: returns null + logs { kind: \"scan-workspace-mismatch\" } when workspace_id mismatch");
  // Happy path
  it.todo("returns the Item on exact barcode + workspace_id match");
});
