import { useMemo, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BevelButton,
  RetroDialog,
  RetroSelect,
  retroToast,
} from "@/components/retro";
import { inventoryApi } from "@/lib/api/inventory";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { Inventory } from "@/lib/types";
import type { PickerOption } from "../hooks/usePickerOptions";

// Phase 7b Plan 03 — whole-entry MoveDialog (INV-04).
//
// Relocates the ENTIRE entry (the backend MoveInventoryInput has no quantity
// field — Pitfall 2 / UI-SPEC §4 Variant A). Blue titlebar (utility task).
// Submit calls inventoryApi.move(wsId, id, location_id, container_id?) — the
// request body is location-only; there is NO quantity split.
//
// On success: invalidate BOTH ["inventory", wsId] AND ["movements", wsId]
// (movements emit no SSE — they are a side effect of a move, so the cache must
// be invalidated manually) + success toast + close. On error: error toast,
// dialog stays open.
//
// MOVE is disabled until the chosen target (location + container) is DISTINCT
// from the entry's current placement — a no-op move is blocked with a hint.

export interface MoveDialogProps {
  open: boolean;
  onClose: () => void;
  entry: Inventory;
  /** Workspace location options (from usePickerOptions). */
  locationOptions: PickerOption[];
  /** Workspace container options (from usePickerOptions). */
  containerOptions: PickerOption[];
}

export function MoveDialog({
  open,
  onClose,
  entry,
  locationOptions,
  containerOptions,
}: MoveDialogProps) {
  const { t } = useLingui();
  const { currentWorkspaceId: wsId } = useWorkspace();
  const queryClient = useQueryClient();

  // Local target state, seeded from the entry's current placement.
  const [targetLocation, setTargetLocation] = useState(entry.location_id);
  const [targetContainer, setTargetContainer] = useState(
    entry.container_id ?? "",
  );

  const currentContainer = entry.container_id ?? "";
  // A no-op move = unchanged location AND unchanged container.
  const isNoop =
    targetLocation === entry.location_id &&
    targetContainer === currentContainer;

  const locationLabel = useMemo(
    () =>
      locationOptions.find((o) => o.id === entry.location_id)?.label ??
      entry.location_id,
    [locationOptions, entry.location_id],
  );
  const containerLabel = useMemo(
    () =>
      currentContainer
        ? (containerOptions.find((o) => o.id === currentContainer)?.label ??
          currentContainer)
        : "",
    [containerOptions, currentContainer],
  );
  const currentPath = containerLabel
    ? `${locationLabel} / ${containerLabel}`
    : locationLabel;

  const move = useMutation({
    mutationFn: (): Promise<Inventory> =>
      inventoryApi.move(
        wsId as string,
        entry.id,
        targetLocation,
        targetContainer || undefined,
      ),
    onSuccess: () => {
      // Both prefixes — inventory + movements (movements have no SSE; manual).
      queryClient.invalidateQueries({
        queryKey: ["inventory", wsId as string],
      });
      queryClient.invalidateQueries({
        queryKey: ["movements", wsId as string],
      });
      const dest =
        locationOptions.find((o) => o.id === targetLocation)?.label ??
        targetLocation;
      retroToast.success(t`Moved to ${dest}.`);
      onClose();
    },
    onError: () => retroToast.error(t`Couldn't move this entry.`),
  });

  const moving = move.isPending;
  const canMove = !isNoop && targetLocation.length > 0 && !moving;

  return (
    <RetroDialog
      open={open}
      onClose={onClose}
      title={<Trans>MOVE ENTRY</Trans>}
      titlebarVariant="blue"
      width="min(420px,92vw)"
      footer={
        <>
          <BevelButton
            type="button"
            variant="neutral"
            onClick={onClose}
            disabled={moving}
          >
            <Trans>Cancel</Trans>
          </BevelButton>
          <BevelButton
            type="button"
            variant="primary"
            disabled={!canMove}
            onClick={() => move.mutate()}
          >
            <Trans>Move</Trans>
          </BevelButton>
        </>
      }
    >
      {/* Context line: where the entry currently lives. */}
      <p className="text-12 text-fg-muted">
        <Trans>Currently in {currentPath}.</Trans>
      </p>

      <div className="flex flex-col gap-sp-3">
        <RetroSelect
          label={<Trans>To location</Trans>}
          required
          aria-required="true"
          value={targetLocation}
          onChange={(e) => setTargetLocation(e.target.value)}
        >
          <option value="">{t`— Select a location`}</option>
          {locationOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </RetroSelect>

        <RetroSelect
          label={<Trans>To container</Trans>}
          value={targetContainer}
          onChange={(e) => setTargetContainer(e.target.value)}
        >
          <option value="">{t`— No container`}</option>
          {containerOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </RetroSelect>
      </div>

      {isNoop && (
        <p className="text-12 text-fg-muted">
          <Trans>Pick a different location or container.</Trans>
        </p>
      )}

      {move.isError && (
        <div
          role="alert"
          className="border-2 border-border-ink bg-danger-bg p-sp-3 text-14 text-danger"
        >
          <span aria-hidden="true">✕ </span>
          <Trans>Couldn't move this entry.</Trans>
        </div>
      )}
    </RetroDialog>
  );
}
