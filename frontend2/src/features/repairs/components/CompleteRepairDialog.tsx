import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { RetroDialog, BevelButton, RetroSelect } from "@/components/retro";
import {
  CONDITIONS,
  CONDITION_LABEL,
} from "@/features/inventory/inventoryEnums";
import type { Condition, Repair } from "@/lib/types";
import { useRepairMutations } from "../hooks/useRepairMutations";

// Phase 10b Plan 02 — the COMPLETE REPAIR dialog (UI-SPEC §2). A BLUE RetroDialog
// (completion is a positive, reversible lifecycle transition — NOT destructive,
// mirrors the loans return R9 resolution). Optional New condition select: the
// default keeps the current condition; choosing one updates the owning inventory
// entry's condition server-side (the hook then invalidates the inventory prefix).

export interface CompleteRepairDialogProps {
  open: boolean;
  onClose: () => void;
  repair: Repair;
}

export function CompleteRepairDialog({
  open,
  onClose,
  repair,
}: CompleteRepairDialogProps) {
  const { t } = useLingui();
  const { completeRepair } = useRepairMutations();
  // "" = keep current condition (no new_condition sent).
  const [newCondition, setNewCondition] = useState<"" | Condition>("");

  function handleConfirm() {
    completeRepair.mutate(
      {
        id: repair.id,
        new_condition: newCondition === "" ? undefined : newCondition,
      },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  }

  return (
    <RetroDialog
      open={open}
      onClose={onClose}
      title={<Trans>COMPLETE REPAIR</Trans>}
      titlebarVariant="blue"
      footer={
        <>
          <BevelButton variant="neutral" onClick={onClose}>
            <Trans>CANCEL</Trans>
          </BevelButton>
          <BevelButton
            variant="primary"
            onClick={handleConfirm}
            disabled={completeRepair.isPending}
          >
            <Trans>COMPLETE</Trans>
          </BevelButton>
        </>
      }
    >
      <p className="text-[12px] text-fg-muted">
        <Trans>Mark "{repair.description}" completed?</Trans>
      </p>

      <RetroSelect
        label={<Trans>New condition</Trans>}
        value={newCondition}
        onChange={(e) => setNewCondition(e.target.value as "" | Condition)}
      >
        <option value="">{t`— Keep current condition`}</option>
        {CONDITIONS.map((c) => (
          <option key={c} value={c}>
            {CONDITION_LABEL[c]}
          </option>
        ))}
      </RetroSelect>
      <p className="text-[12px] font-body text-fg-muted">
        <Trans>Optionally update the item's condition now that it's fixed.</Trans>
      </p>
    </RetroDialog>
  );
}
