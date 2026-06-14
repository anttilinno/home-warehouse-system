import { describe, expect, it } from "vitest";
import { declutterToCsvBlob } from "./declutterCsv";
import type { DeclutterItem } from "@/lib/api/declutter";

// Phase 14 Plan 04 Task 1 — declutter client CSV unit tests. Mirrors the
// loanCsv test discipline: the CSV crosses into a formula-evaluating sink
// (spreadsheet apps), so a cell that LEADS with `=` (or +,-,@,\t,\r) is guarded
// with a `'` prefix (T-14-10). Empty input yields a header-only Blob.

function makeRow(over: Partial<DeclutterItem> = {}): DeclutterItem {
  return {
    id: "inv-1",
    item_id: "it-1",
    item_name: "Cordless Drill",
    item_sku: "SKU-1",
    location_id: "loc-1",
    location_name: "Garage",
    category_id: "cat-1",
    category_name: "Tools",
    quantity: 1,
    days_unused: 200,
    score: 88,
    purchase_price: 4999,
    currency_code: "EUR",
    last_used_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

async function lines(blob: Blob): Promise<string[]> {
  const text = await blob.text();
  return text.trimEnd().split("\n");
}

describe("declutterToCsvBlob", () => {
  it("builds a text/csv Blob with a header + one row per item", async () => {
    const blob = declutterToCsvBlob([makeRow()]);

    expect(blob.type).toBe("text/csv");
    const rows = await lines(blob);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("item");
    expect(rows[0]).toContain("score");
    expect(rows[1]).toContain("Cordless Drill");
    expect(rows[1]).toContain("88");
  });

  it("prefixes a formula-injection cell (leading =) with a quote", async () => {
    const blob = declutterToCsvBlob([
      makeRow({ item_name: "=SUM(A1:A9)" }),
    ]);

    const rows = await lines(blob);
    // escapeCell wraps in quotes and prefixes the guard: "'=SUM(A1:A9)"
    expect(rows[1]).toContain(`"'=SUM(A1:A9)"`);
  });

  it("yields a header-only Blob on empty input", async () => {
    const blob = declutterToCsvBlob([]);

    const rows = await lines(blob);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("item");
  });

  it("emits a blank cell (not crash) for a null last_used_at / missing price", async () => {
    const blob = declutterToCsvBlob([
      makeRow({ last_used_at: null, purchase_price: undefined }),
    ]);

    const rows = await lines(blob);
    expect(rows).toHaveLength(2);
    // No "undefined"/"null" literals leak into the CSV.
    expect(rows[1]).not.toContain("undefined");
    expect(rows[1]).not.toContain("null");
  });
});
