import type { DeclutterItem } from "@/lib/api/declutter";

// Phase 14 Plan 04 (DECL-02) — client-generated declutter CSV export. There is
// NO backend /export call for declutter (DECL-02 + OQ): the CSV is built
// in-memory from already-fetched rows and streamed via an object URL, so no
// token ever rides a download link (T-14-11). The CSV crosses into a
// formula-evaluating sink (spreadsheet apps), so every untrusted cell
// (item_name/sku/location/category) is escaped against CSV/formula injection
// (T-14-10). escapeCell + INJECTION_PREFIXES + toRow + triggerCsvDownload are
// COPIED VERBATIM from features/loans/loanCsv.ts — the two list pages stay
// single-writer-clean (no cross-import of the loans-shaped builder).

const HEADER = [
  "item",
  "sku",
  "location",
  "category",
  "quantity",
  "days_unused",
  "score",
  "last_used_at",
  "purchase_price", // raw CENTS for round-trip fidelity (see note below)
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

// declutterToCsvBlob builds a text/csv Blob: header row + one row per item.
// purchase_price is emitted as RAW CENTS (the on-the-wire integer) for
// round-trip fidelity — the human-readable display lives in the UI, the CSV
// keeps the exact stored value. Empty input yields a header-only Blob.
export function declutterToCsvBlob(rows: DeclutterItem[]): Blob {
  const lines = [toRow(HEADER)];
  for (const r of rows) {
    lines.push(
      toRow([
        r.item_name ?? "",
        r.item_sku ?? "",
        r.location_name ?? "",
        r.category_name ?? "",
        r.quantity,
        r.days_unused,
        r.score,
        r.last_used_at ?? "",
        r.purchase_price ?? "",
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
