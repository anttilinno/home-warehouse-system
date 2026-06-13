import type { Loan } from "@/lib/types";

// Phase 8 Plan 01 — status pill derivation (override 2: overdue is
// SERVER-authoritative). This helper reads ONLY `returned_at` and the server's
// `is_overdue` flag. It MUST NEVER compute overdue from `due_date` vs Date.now()
// — the backend owns that computation (avoids TZ/clock-skew bugs; 08-RESEARCH
// "Status pill derivation"). Pure function, no React imports. Shared by Plan 02
// (list pill + row tint), Plan 04 (item panels), Plan 05 (borrower panels);
// its behavior is exercised through those consumers' tests.
//
// Label strings are bare uppercase words (RETURNED/OVERDUE/ACTIVE); callers
// wrap them in <Trans>.
export function loanStatus(l: Loan): {
  variant: "ok" | "danger" | "info";
  label: string;
} {
  if (l.returned_at) return { variant: "ok", label: "RETURNED" };
  if (l.is_overdue) return { variant: "danger", label: "OVERDUE" };
  return { variant: "info", label: "ACTIVE" };
}
