import { useLingui } from "@lingui/react/macro";
import { RetroDialog } from "@/components/retro";
import { useMovementsQuery } from "../hooks/useMovementsQuery";
import { MovementsPanel } from "./MovementsPanel";

// Phase 7b Plan 02 — the per-entry movements drawer (INV-07, inventory scope). A
// blue (utility) RetroDialog titled MOVEMENTS that renders the MovementsPanel
// fed by useMovementsQuery for the open row's inventory id. ESC closes the
// dialog via the Phase 3 modal stack (RetroDialog owns that); the panel's own
// content never traps ESC. `invId` null ⇒ closed; passing an id opens it.

export interface MovementsDrawerProps {
  /** The inventory entry whose history to show; null = closed. */
  invId: string | null;
  /** Display name shown in the title context (the owning item). */
  itemName?: string;
  onClose: () => void;
  resolveLocation?: (id: string) => string | undefined;
  resolveMember?: (id: string) => string | undefined;
}

export function MovementsDrawer({
  invId,
  itemName,
  onClose,
  resolveLocation,
  resolveMember,
}: MovementsDrawerProps) {
  const { t } = useLingui();
  const { data, isLoading } = useMovementsQuery(invId);

  return (
    <RetroDialog
      open={invId !== null}
      onClose={onClose}
      title={itemName ? t`MOVEMENTS — ${itemName}` : t`MOVEMENTS`}
      titlebarVariant="blue"
    >
      <MovementsPanel
        movements={data ?? []}
        isLoading={isLoading}
        resolveLocation={resolveLocation}
        resolveMember={resolveMember}
      />
    </RetroDialog>
  );
}
