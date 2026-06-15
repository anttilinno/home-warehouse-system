import { describe, expect, it } from "vitest";
import type { Inventory } from "@/lib/types";
import { inventoryToCsvBlob } from "./inventoryCsv";

// Phase 14 Plan 07 — client-generated, CSV-injection-safe inventory export
// (parity §4 / T-14-19). These exercise the escape function (injection-prefix
// guard + quote-wrap), the raw-cents fidelity, and null-field handling.

function makeEntry(overrides: Partial<Inventory> = {}): Inventory {
  return {
    id: "inv-1",
    workspace_id: "ws-1",
    item_id: "it-1",
    location_id: "loc-1",
    quantity: 3,
    condition: "GOOD",
    status: "AVAILABLE",
    purchase_price: 1299,
    currency_code: "EUR",
    is_archived: false,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

async function blobToLines(blob: Blob): Promise<string[]> {
  const text = await blob.text();
  // Trailing newline produces an empty final element — drop it.
  return text.split("\n").filter((line) => line.length > 0);
}

describe("inventoryToCsvBlob", () => {
  it("emits the fixed header row", async () => {
    const blob = inventoryToCsvBlob([]);
    const [header] = await blobToLines(blob);
    // Every cell is quote-wrapped, so the header is wrapped per-column.
    expect(header).toBe(
      '"item_id","location_id","container_id","quantity","condition","status",' +
        '"purchase_price_cents","currency_code","date_acquired",' +
        '"warranty_expires","expiration_date","is_archived"',
    );
  });

  it("returns a text/csv Blob with only the header for an empty list", async () => {
    const blob = inventoryToCsvBlob([]);
    expect(blob.type).toBe("text/csv");
    const lines = await blobToLines(blob);
    expect(lines).toHaveLength(1);
  });

  it("builds one row per inventory entry", async () => {
    const blob = inventoryToCsvBlob([makeEntry(), makeEntry({ id: "inv-2" })]);
    const lines = await blobToLines(blob);
    expect(lines).toHaveLength(3); // header + 2 rows
  });

  it("prefixes formula-injection cells with a leading quote", async () => {
    for (const dangerous of ["=cmd", "+1", "-1", "@SUM", "\tx", "\rx"]) {
      // item_id is the first column — drive the injection through it.
      const blob = inventoryToCsvBlob([makeEntry({ item_id: dangerous })]);
      const [, row] = await blobToLines(blob);
      expect(row).toContain(`"'${dangerous}"`);
    }
  });

  it("doubles embedded quotes and wraps the cell", async () => {
    const blob = inventoryToCsvBlob([makeEntry({ location_id: 'Shelf "A"' })]);
    const [, row] = await blobToLines(blob);
    expect(row).toContain('"Shelf ""A"""');
  });

  it("emits purchase_price as raw cents for round-trip fidelity", async () => {
    const blob = inventoryToCsvBlob([makeEntry({ purchase_price: 1299 })]);
    const [, row] = await blobToLines(blob);
    expect(row).toContain('"1299"');
  });

  it("renders null/undefined optional fields as empty cells", async () => {
    const blob = inventoryToCsvBlob([
      makeEntry({
        container_id: undefined,
        purchase_price: undefined,
        currency_code: undefined,
        date_acquired: undefined,
        warranty_expires: undefined,
        expiration_date: undefined,
      }),
    ]);
    const [, row] = await blobToLines(blob);
    // item_id, location_id present; container_id empty.
    expect(row).toContain('"it-1","loc-1","",');
  });
});
