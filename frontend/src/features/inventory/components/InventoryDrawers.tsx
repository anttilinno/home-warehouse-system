import { MovementsDrawer } from "./MovementsDrawer";
import { RepairsDrawer } from "@/features/repairs/components/RepairsDrawer";
import { MaintenanceDrawer } from "@/features/maintenance/components/MaintenanceDrawer";
import type { Inventory } from "@/lib/types";

// Phase 10b refactor — the three right-hand drawers (movements / repairs /
// maintenance) the inventory list mounts, each resolving its item name from the
// loaded entries by the open id. Extracted verbatim from InventoryListPage to
// lift the repeated `id ? itemName(find…) : undefined` lookups out of the page
// body. Each drawer no-ops when its id is null.
export function InventoryDrawers({
  entries,
  itemName,
  movementsId,
  repairsId,
  maintenanceId,
  onCloseMovements,
  onCloseRepairs,
  onCloseMaintenance,
}: Readonly<{
  entries: Inventory[];
  itemName: (id: string) => string | undefined;
  movementsId: string | null;
  repairsId: string | null;
  maintenanceId: string | null;
  onCloseMovements: () => void;
  onCloseRepairs: () => void;
  onCloseMaintenance: () => void;
}>) {
  const nameFor = (id: string | null) =>
    id ? itemName(entries.find((e) => e.id === id)?.item_id ?? "") : undefined;

  return (
    <>
      <MovementsDrawer
        invId={movementsId}
        itemName={nameFor(movementsId)}
        onClose={onCloseMovements}
      />
      <RepairsDrawer
        invId={repairsId}
        itemName={nameFor(repairsId)}
        onClose={onCloseRepairs}
      />
      <MaintenanceDrawer
        invId={maintenanceId}
        itemName={nameFor(maintenanceId)}
        onClose={onCloseMaintenance}
      />
    </>
  );
}
