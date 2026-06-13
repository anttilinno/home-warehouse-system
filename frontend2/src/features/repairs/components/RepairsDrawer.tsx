import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  RetroDialog,
  RetroConfirmDialog,
  BevelButton,
  StatusPill,
  RetroBadge,
  RetroEmptyState,
  retroToast,
} from "@/components/retro";
import { formatCents } from "@/lib/utils/money";
import { repairStatus } from "../repairStatus";
import {
  useRepairsByInventoryQuery,
  useRepairCostQuery,
} from "../hooks/useRepairsQuery";
import { useRepairMutations } from "../hooks/useRepairMutations";
import { RepairForm } from "./RepairForm";
import { CompleteRepairDialog } from "./CompleteRepairDialog";
import type { Repair } from "@/lib/types";

// Phase 10b Plan 02 — the per-inventory-row Repairs drawer (RPR-01 + RPR-02). A
// BLUE RetroDialog titled `REPAIRS — {item}`, a sibling of MovementsDrawer:
// `invId === null ⇒ closed`. Body top→bottom (UI-SPEC §1): a per-currency cost
// rollup header (NEVER cross-currency summed — OQ5), an ⊕ ADD REPAIR CTA, and the
// repair record list with status-gated lifecycle actions (PENDING: START/EDIT/
// DELETE; IN_PROGRESS: COMPLETE/EDIT/DELETE; COMPLETED: DELETE only — the backend
// rejects edits on a completed repair). All writes flow through useRepairMutations.
//
// PHOTOS/FILES SEAM (Plan 10b-03, Wave 3): each record row renders no-op
// `PHOTOS (n)` / `FILES (n)` buttons as a declared seam. 10b-03 wires the record
// sub-view onto `onOpenRecord` WITHOUT re-editing this drawer's trigger/structure
// — keep the export + the per-row action cluster stable.

export interface RepairsDrawerProps {
  /** The inventory entry whose repairs to show; null = closed. */
  invId: string | null;
  /** Display name shown in the title context (the owning item). */
  itemName?: string;
  onClose: () => void;
  /**
   * SEAM for Plan 10b-03 — opens the repair record sub-view (RECORD/PHOTOS/FILES
   * tabs). Until 10b-03 wires it, the PHOTOS/FILES buttons no-op.
   */
  onOpenRecord?: (repair: Repair, tab: "photos" | "files") => void;
}

function formatDate(rfc?: string): string {
  return rfc ? rfc.slice(0, 10) : "—";
}

export function RepairsDrawer({
  invId,
  itemName,
  onClose,
  onOpenRecord,
}: RepairsDrawerProps) {
  const { t } = useLingui();
  const { items, isLoading, isError } = useRepairsByInventoryQuery(invId);
  const { summaries } = useRepairCostQuery(invId);
  const { startRepair, deleteRepair } = useRepairMutations();

  // Nested dialog state (form create/edit, complete, delete confirm).
  const [formRepair, setFormRepair] = useState<Repair | null | undefined>(
    undefined,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [completeRepair, setCompleteRepair] = useState<Repair | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Repair | null>(null);

  function openCreate() {
    setFormRepair(null);
    setFormOpen(true);
  }
  function openEdit(repair: Repair) {
    setFormRepair(repair);
    setFormOpen(true);
  }
  function handleStart(repair: Repair) {
    startRepair.mutate(repair.id, {
      onSuccess: () => retroToast.success(t`DONE · Repair started.`),
    });
  }
  function handleDelete() {
    if (!deleteTarget) return;
    deleteRepair.mutate(deleteTarget.id, {
      onSuccess: () => {
        retroToast.success(t`DONE · Repair deleted.`);
        setDeleteTarget(null);
      },
    });
  }

  return (
    <>
      <RetroDialog
        open={invId !== null}
        onClose={onClose}
        title={itemName ? t`REPAIRS — ${itemName}` : t`REPAIRS`}
        titlebarVariant="blue"
      >
        {/* (1) Cost-rollup header — recessed strip, one mono line per currency. */}
        <div className="bg-bg-panel-2 px-sp-3 py-sp-2">
          <h4 className="mb-sp-1 text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">
            <Trans>Repair cost</Trans>
          </h4>
          {summaries.length === 0 ? (
            <p className="font-mono text-[12px] text-fg-muted">
              <Trans>No completed repairs yet.</Trans>
            </p>
          ) : (
            <ul className="flex flex-col gap-sp-1">
              {summaries.map((s) => (
                <li
                  key={s.currency_code ?? "default"}
                  className="font-mono text-[12px] tabular-nums text-fg-ink"
                >
                  {formatCents(s.total_cost_cents, s.currency_code)}{" "}
                  <span className="text-fg-muted">
                    · {s.repair_count} <Trans>completed</Trans>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* (2) ⊕ ADD REPAIR — mint primary, right-aligned. */}
        <div className="flex justify-end">
          <BevelButton variant="mint" onClick={openCreate}>
            <Trans>⊕ ADD REPAIR</Trans>
          </BevelButton>
        </div>

        {/* (3) record list / loading / error / empty. */}
        {isLoading ? (
          <p className="bg-bg-panel-2 p-sp-4 font-mono text-[12px] text-fg-muted">
            <Trans>Loading…</Trans>
          </p>
        ) : isError ? (
          <p className="bg-bg-panel-2 p-sp-4 text-[14px] text-danger">
            <Trans>Couldn't load repairs. Try again.</Trans>
          </p>
        ) : items.length === 0 ? (
          <div className="bg-bg-panel-2 p-sp-3">
            <RetroEmptyState
              eyebrow={<Trans>Repairs</Trans>}
              glyph="🔧"
              heading={<Trans>NO REPAIRS</Trans>}
              body={
                <Trans>
                  No repairs logged for this entry yet. Add one to track work,
                  cost, and warranty.
                </Trans>
              }
              action={{
                label: <Trans>⊕ ADD REPAIR</Trans>,
                onClick: openCreate,
              }}
            />
          </div>
        ) : (
          <ul className="bg-bg-panel-2">
            {items.map((repair) => {
              const status = repairStatus(repair);
              const isPending = repair.status === "PENDING";
              const isInProgress = repair.status === "IN_PROGRESS";
              const isCompleted = repair.status === "COMPLETED";
              return (
                <li
                  key={repair.id}
                  className="flex flex-col gap-sp-1 border-b border-table-rule px-sp-3 py-sp-2"
                >
                  <div className="flex items-baseline justify-between gap-sp-2">
                    <span className="text-[14px] font-semibold text-fg-ink">
                      {repair.description}
                    </span>
                    <StatusPill variant={status.variant}>
                      {status.label}
                    </StatusPill>
                  </div>

                  <div className="flex flex-wrap items-baseline gap-sp-2 font-mono text-[12px] text-fg-muted">
                    <span>{formatDate(repair.repair_date)}</span>
                    <span>·</span>
                    <span>
                      {typeof repair.cost === "number"
                        ? formatCents(repair.cost, repair.currency_code)
                        : "—"}
                    </span>
                    {repair.service_provider && (
                      <>
                        <span>·</span>
                        <span>{repair.service_provider}</span>
                      </>
                    )}
                    {repair.is_warranty_claim && (
                      <RetroBadge variant="warn">
                        <Trans>⚖ WARRANTY</Trans>
                      </RetroBadge>
                    )}
                    {isCompleted && repair.completed_at && (
                      <span>
                        <Trans>completed</Trans> {formatDate(repair.completed_at)}
                      </span>
                    )}
                  </div>

                  {/* Actions — status-gated; COMPLETED = DELETE only. */}
                  <div className="flex flex-wrap justify-end gap-sp-1">
                    {isPending && (
                      <BevelButton
                        className="!px-[8px] !py-[2px] !text-[11px]"
                        onClick={() => handleStart(repair)}
                      >
                        <Trans>START</Trans>
                      </BevelButton>
                    )}
                    {isInProgress && (
                      <BevelButton
                        className="!px-[8px] !py-[2px] !text-[11px]"
                        onClick={() => setCompleteRepair(repair)}
                      >
                        <Trans>COMPLETE</Trans>
                      </BevelButton>
                    )}
                    {!isCompleted && (
                      <BevelButton
                        className="!px-[8px] !py-[2px] !text-[11px]"
                        onClick={() => openEdit(repair)}
                      >
                        <Trans>EDIT</Trans>
                      </BevelButton>
                    )}
                    <BevelButton
                      className="!px-[8px] !py-[2px] !text-[11px]"
                      onClick={() => setDeleteTarget(repair)}
                    >
                      <Trans>DELETE</Trans>
                    </BevelButton>
                    {/* PHOTOS/FILES seam — Plan 10b-03 wires onOpenRecord. */}
                    <BevelButton
                      className="!px-[8px] !py-[2px] !text-[11px]"
                      onClick={() => onOpenRecord?.(repair, "photos")}
                    >
                      <Trans>PHOTOS</Trans>
                    </BevelButton>
                    <BevelButton
                      className="!px-[8px] !py-[2px] !text-[11px]"
                      onClick={() => onOpenRecord?.(repair, "files")}
                    >
                      <Trans>FILES</Trans>
                    </BevelButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </RetroDialog>

      {/* Nested create/edit form (keyed so a fresh form mounts per target). */}
      {invId !== null && formOpen && (
        <RepairForm
          key={formRepair?.id ?? "create"}
          open={formOpen}
          invId={invId}
          repair={formRepair}
          onClose={() => setFormOpen(false)}
        />
      )}

      {/* Nested complete dialog. */}
      {completeRepair && (
        <CompleteRepairDialog
          key={completeRepair.id}
          open
          repair={completeRepair}
          onClose={() => setCompleteRepair(null)}
        />
      )}

      {/* Delete confirm (pink — true destructive). */}
      {deleteTarget && (
        <RetroConfirmDialog
          open
          title={<Trans>DELETE REPAIR?</Trans>}
          confirmLabel={<Trans>Delete</Trans>}
          confirmDisabled={deleteRepair.isPending}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          onClose={() => setDeleteTarget(null)}
        >
          <Trans>
            This repair and its photos and files will be permanently removed.
          </Trans>
        </RetroConfirmDialog>
      )}
    </>
  );
}
