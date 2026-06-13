import { describe, expect, it } from "vitest";
import type { Loan } from "@/lib/types";
import { loansToCsvBlob } from "./loanCsv";

// Phase 8 Plan 01 — client-generated, CSV-injection-safe export (T-08-CSV).
// These exercise the escape function (injection-prefix guard + quote-wrap) and
// the override-2 status precedence (returned_at→returned, is_overdue→overdue,
// else active — NO due-date math).

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: "loan-1",
    workspace_id: "ws-1",
    inventory_id: "inv-1",
    borrower_id: "bor-1",
    quantity: 1,
    loaned_at: "2026-06-01T00:00:00Z",
    is_active: true,
    is_overdue: false,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    item: { id: "it-1", name: "Cordless Drill" },
    borrower: { id: "bor-1", name: "Alex" },
    ...overrides,
  };
}

async function blobToLines(blob: Blob): Promise<string[]> {
  const text = await blob.text();
  // Trailing newline produces an empty final element — drop it.
  return text.split("\n").filter((line) => line.length > 0);
}

describe("loansToCsvBlob", () => {
  it("emits the fixed header row", async () => {
    const blob = loansToCsvBlob([]);
    const [header] = await blobToLines(blob);
    // Every cell is quote-wrapped, so the header is wrapped per-column.
    expect(header).toBe(
      '"item","borrower","quantity","loaned_at","due_date","returned_at","status"',
    );
  });

  it("returns a text/csv Blob with only the header for an empty list", async () => {
    const blob = loansToCsvBlob([]);
    expect(blob.type).toBe("text/csv");
    const lines = await blobToLines(blob);
    expect(lines).toHaveLength(1);
  });

  it("prefixes formula-injection cells with a leading quote", async () => {
    for (const dangerous of ["=cmd", "+1", "-1", "@SUM", "\tx", "\rx"]) {
      const blob = loansToCsvBlob([
        makeLoan({ borrower: { id: "b", name: dangerous } }),
      ]);
      const [, row] = await blobToLines(blob);
      // The borrower cell is column 2; it must begin with '" then a single
      // quote guard before the original first char.
      expect(row).toContain(`"'${dangerous}"`);
    }
  });

  it("doubles embedded quotes and wraps the cell", async () => {
    const blob = loansToCsvBlob([
      makeLoan({ borrower: { id: "b", name: 'He said "hi"' } }),
    ]);
    const [, row] = await blobToLines(blob);
    expect(row).toContain('"He said ""hi"""');
  });

  it("derives status via override-2 precedence (no due-date math)", async () => {
    const returned = loansToCsvBlob([
      makeLoan({ returned_at: "2026-06-05T00:00:00Z", is_overdue: true }),
    ]);
    const overdue = loansToCsvBlob([makeLoan({ is_overdue: true })]);
    const active = loansToCsvBlob([makeLoan({ is_overdue: false })]);

    expect((await blobToLines(returned))[1]).toContain('"returned"');
    expect((await blobToLines(overdue))[1]).toContain('"overdue"');
    expect((await blobToLines(active))[1]).toContain('"active"');
  });
});
