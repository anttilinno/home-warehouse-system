import type { Loan } from "@/lib/types";

// Phase 8 Plan 01 — client-generated loan CSV export (override 3: NO backend
// /export/loan — that route returns 400; the export is built in-memory from
// already-fetched rows and streamed via an object URL, so no token ever rides
// a download link — T-08-TOKEN). The CSV crosses into a formula-evaluating sink
// (spreadsheet apps), so every untrusted cell (borrower name, notes) is escaped
// against CSV/formula injection (T-08-CSV).

const HEADER = [
  "item",
  "borrower",
  "quantity",
  "loaned_at",
  "due_date",
  "returned_at",
  "status",
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

// Override-2 status precedence (returned_at → overdue → active). Lowercased for
// the CSV column. MUST NOT use due-date math — reads server flags only.
function statusCell(l: Loan): string {
  if (l.returned_at) return "returned";
  if (l.is_overdue) return "overdue";
  return "active";
}

function toRow(cells: unknown[]): string {
  return cells.map(escapeCell).join(",");
}

// loansToCsvBlob builds a text/csv Blob: header row + one row per loan. Empty
// input yields a header-only Blob.
export function loansToCsvBlob(rows: Loan[]): Blob {
  const lines = [toRow(HEADER)];
  for (const l of rows) {
    lines.push(
      toRow([
        l.item?.name ?? "",
        l.borrower?.name ?? "",
        l.quantity,
        l.loaned_at ?? "",
        l.due_date ?? "",
        l.returned_at ?? "",
        statusCell(l),
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
