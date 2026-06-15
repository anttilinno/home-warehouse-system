import type { RepairStatus } from "@/lib/types";

// Phase 10b Plan 01 — repair status pill derivation (server-flag discipline,
// mirrors loanStatus.ts EXACTLY). This helper reads ONLY the server-owned
// `status` enum; it MUST NEVER compute state from dates (no repair_date /
// completed_at math — the backend owns the lifecycle via start/complete POSTs).
// Pure function, no React imports. Shared by the Wave-2/3 list + panel consumers;
// its behavior is exercised through their tests plus repairStatus.test.ts.
//
// Variants are constrained to StatusPill's union ("ok" | "warn" | "info" |
// "danger"). Labels are human strings; callers wrap them in <Trans> as needed.
export function repairStatus(r: { status: RepairStatus }): {
  variant: "ok" | "warn" | "info" | "danger";
  label: string;
} {
  switch (r.status) {
    case "IN_PROGRESS":
      return { variant: "warn", label: "In progress" };
    case "COMPLETED":
      return { variant: "ok", label: "Completed" };
    default: // "PENDING"
      return { variant: "info", label: "Pending" };
  }
}
