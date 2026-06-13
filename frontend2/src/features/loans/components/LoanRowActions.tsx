import { Trans } from "@lingui/react/macro";
import { BevelButton } from "@/components/retro";
import type { Loan } from "@/lib/types";

// Phase 8 Plan 02 — REAL exported stub (plan-checker handoff note). This file
// reserves the loans-list actions column so LoansListPage can import a stable
// `<LoanRowActions loan tab />` slot NOW. Plan 04 (wave 3, lands after 08-02
// merges) OVERWRITES this body with the wired return/extend/edit dialogs —
// SAME path, SAME props, so LoansListPage needs no change from Plan 04.
//
// Until then the three lifecycle buttons render DISABLED (with a hint title) so
// the column geometry + the per-tab action set are visible and testable. The
// History tab is terminal (read-only) — it renders no action buttons.

export interface LoanRowActionsProps {
  loan: Loan;
  /** The current list tab — drives which actions are offered. */
  tab?: string;
}

export function LoanRowActions({ tab }: LoanRowActionsProps) {
  // History rows are a read-only archive — no lifecycle actions (UI-SPEC §1).
  if (tab === "history") return null;

  return (
    <span className="inline-flex gap-sp-1">
      <BevelButton disabled title="Coming soon" aria-disabled>
        <Trans>RETURN</Trans>
      </BevelButton>
      <BevelButton disabled title="Coming soon" aria-disabled>
        <Trans>EXTEND</Trans>
      </BevelButton>
      <BevelButton disabled title="Coming soon" aria-disabled>
        <Trans>↧ EDIT</Trans>
      </BevelButton>
    </span>
  );
}
