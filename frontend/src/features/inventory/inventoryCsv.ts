import type { Inventory } from "@/lib/types";

// Phase 14 Plan 07 — client-generated inventory CSV export (parity §4). The
// backend importexport EntityType set is item|location|container|category|
// label|company|borrower (verified importexport/types.go) — there is NO
// /export/inventory endpoint, so a server export button would 400. The CSV is
// built in-memory from the already-fetched rows and streamed via an object URL,
// so no token ever rides a download link (T-14-20 / T-08-TOKEN parity). The CSV
// crosses into a formula-evaluating sink (spreadsheet apps), so every cell is
// escaped against CSV/formula injection (T-14-19 / T-08-CSV parity).
//
// escapeCell + INJECTION_PREFIXES + toRow + triggerCsvDownload are COPIED
// verbatim from loanCsv.ts (kept single-writer-clean: loans + inventory CSV
// builders do not import one another).

const HEADER = [
  "item_id",
  "location_id",
  "container_id",
  "quantity",
  "condition",
  "status",
  "purchase_price_cents",
  "currency_code",
  "date_acquired",
  "warranty_expires",
  "expiration_date",
  "is_archived",
];

// Chars that trigger formula evaluation when they lead a spreadsheet cell.
const INJECTION_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"]);

// stringifyCell coerces a cell value to a string. Primitives keep their plain
// String() form (the only shape current callers pass); objects are JSON-encoded
// so they never collapse to the useless "[object Object]".
function stringifyCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// escapeCell: coerce to string → guard formula-injection prefix with a leading
// `'` → double embedded quotes → wrap the whole cell in double quotes.
function escapeCell(value: unknown): string {
  let cell = stringifyCell(value);
  if (cell.length > 0 && INJECTION_PREFIXES.has(cell[0])) {
    cell = `'${cell}`;
  }
  cell = cell.replace(/"/g, '""');
  return `"${cell}"`;
}

function toRow(cells: unknown[]): string {
  return cells.map(escapeCell).join(",");
}

// inventoryToCsvBlob builds a text/csv Blob: header row + one row per inventory
// entry. purchase_price is emitted as raw cents for round-trip fidelity (a
// formatted "$12.34" would not survive re-import); null → "". Empty input yields
// a header-only Blob.
export function inventoryToCsvBlob(rows: Inventory[]): Blob {
  const lines = [toRow(HEADER)];
  for (const e of rows) {
    lines.push(
      toRow([
        e.item_id,
        e.location_id,
        e.container_id ?? "",
        e.quantity,
        e.condition,
        e.status,
        e.purchase_price ?? "",
        e.currency_code ?? "",
        e.date_acquired ?? "",
        e.warranty_expires ?? "",
        e.expiration_date ?? "",
        e.is_archived,
      ]),
    );
  }
  return new Blob([lines.join("\n") + "\n"], { type: "text/csv" });
}

// triggerCsvDownload streams an in-memory Blob to the user via a transient
// anchor click (object URL revoked immediately after). No network call.
export function triggerCsvDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
