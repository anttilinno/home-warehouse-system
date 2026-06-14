import { describe, expect, it } from "vitest";
import { repairStatus } from "./repairStatus";

// Phase 10b Plan 01 Task 1 — repair status pill derivation (server-flag
// discipline, mirrors loanStatus.ts). repairStatus reads ONLY the server-owned
// `status` enum — never any date math. Variants must be in StatusPill's union
// ("info" | "warn" | "ok" | "danger").
describe("repairStatus", () => {
  it("maps PENDING to an info pill", () => {
    expect(repairStatus({ status: "PENDING" })).toEqual({
      variant: "info",
      label: "Pending",
    });
  });

  it("maps IN_PROGRESS to a warn pill", () => {
    expect(repairStatus({ status: "IN_PROGRESS" })).toEqual({
      variant: "warn",
      label: "In progress",
    });
  });

  it("maps COMPLETED to an ok pill", () => {
    expect(repairStatus({ status: "COMPLETED" })).toEqual({
      variant: "ok",
      label: "Completed",
    });
  });
});
