import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { BevelButton } from "@/components/retro";
import type { Loan } from "@/lib/types";
import { ReturnLoanDialog } from "./ReturnLoanDialog";
import { ExtendLoanDialog } from "./ExtendLoanDialog";
import { EditLoanDialog } from "./EditLoanDialog";

// Phase 8 Plan 04 — the wired loans-list actions column (OVERWRITES the Plan 02
// real-stub at the SAME path with the SAME export + props, so LoansListPage
// needs no edit). Renders RETURN / EXTEND / ↧ EDIT BevelButtons, each opening
// its Plan-04 dialog (local open state). stopPropagation on the button wrapper
// keeps the row click (which navigates) from firing. History rows are a
// read-only archive — no lifecycle actions (UI-SPEC §1).

export interface LoanRowActionsProps {
  loan: Loan;
  /** The current list tab — drives which actions are offered. */
  tab?: string;
}

type OpenDialog = "return" | "extend" | "edit" | null;

export function LoanRowActions({ loan, tab }: Readonly<LoanRowActionsProps>) {
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

  // History rows are terminal (read-only) — no lifecycle actions.
  if (tab === "history") return null;

  return (
    // Row click navigates; keep the action cluster from bubbling into it.
    // biome-ignore lint/a11y/noStaticElementInteractions: stops row-click propagation only
    // biome-ignore lint/a11y/useKeyWithClickEvents: stops row-click propagation only
    <span className="inline-flex gap-sp-1" onClick={(e) => e.stopPropagation()}>
      <BevelButton onClick={() => setOpenDialog("return")}>
        <Trans>RETURN</Trans>
      </BevelButton>
      <BevelButton onClick={() => setOpenDialog("extend")}>
        <Trans>EXTEND</Trans>
      </BevelButton>
      <BevelButton onClick={() => setOpenDialog("edit")}>
        <Trans>↧ EDIT</Trans>
      </BevelButton>

      <ReturnLoanDialog
        open={openDialog === "return"}
        onClose={() => setOpenDialog(null)}
        loan={loan}
      />
      <ExtendLoanDialog
        open={openDialog === "extend"}
        onClose={() => setOpenDialog(null)}
        loan={loan}
      />
      <EditLoanDialog
        open={openDialog === "edit"}
        onClose={() => setOpenDialog(null)}
        loan={loan}
      />
    </span>
  );
}
