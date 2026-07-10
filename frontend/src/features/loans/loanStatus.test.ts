import { describe, expect, it } from "vitest";
import type { Loan } from "@/lib/types";
import { loanStatus } from "./loanStatus";

// Phase 4 Plan 4.2 (test-gaps) — loanStatus derivation coverage. Mirrors
// repairStatus.test.ts. Confirms the server-authoritative override 2 rule:
// returned_at wins over is_overdue, and status never touches due_date.

const baseLoan: Loan = {
  id: "loan-1",
  workspace_id: "ws-1",
  inventory_id: "inv-1",
  borrower_id: "b-1",
  quantity: 1,
  loaned_at: "2026-01-01T00:00:00Z",
  due_date: "2026-01-08",
  is_active: true,
  is_overdue: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  item: { id: "item-1", name: "Drill" },
  borrower: { id: "b-1", name: "Alex" },
};

describe("loanStatus", () => {
  it("maps a returned loan to RETURNED (ok), even if is_overdue is true", () => {
    const r = loanStatus({
      ...baseLoan,
      returned_at: "2026-01-05T00:00:00Z",
      is_overdue: true,
    });
    expect(r).toEqual({ variant: "ok", label: "RETURNED" });
  });

  it("maps an unreturned overdue loan to OVERDUE (danger)", () => {
    const r = loanStatus({ ...baseLoan, is_overdue: true });
    expect(r).toEqual({ variant: "danger", label: "OVERDUE" });
  });

  it("maps an unreturned, not-overdue loan to ACTIVE (info)", () => {
    const r = loanStatus({ ...baseLoan, is_overdue: false });
    expect(r).toEqual({ variant: "info", label: "ACTIVE" });
  });
});
