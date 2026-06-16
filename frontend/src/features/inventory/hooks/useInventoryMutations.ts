import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { inventoryApi } from "@/lib/api/inventory";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { Condition, Inventory, InventoryStatus } from "@/lib/types";

// Phase 7b Plan 02 — the inventory write surface for the list page's inline
// edits (qty / status / condition) plus archive/restore. The three field edits
// are OPTIMISTIC with revert-on-error, mirroring the Phase 7 photo-reorder
// optimism: onMutate snapshots EVERY `["inventory", wsId]` query, patches the
// matching entry in place, onError restores the snapshot + fires a persistent
// retroToast.error, onSettled re-invalidates the prefix so the SERVER value is
// authoritative (T-07b-03 — no client-trusted state survives a 4xx).
//
// Pitfall 6: condition has NO dedicated endpoint — it rides the full PATCH
// (`inventoryApi.update`) bundled with the entry's CURRENT location_id +
// quantity. The caller supplies those (they're unchanged), so the wire body is
// `{ location_id, quantity, condition }` and status is never sent here.

/** Snapshot context: every captured `["inventory", wsId]` query entry. */
interface OptimisticContext {
  snapshots: [QueryKey, unknown][];
}

/** A single inventory-list cache shape — only `items` is patched. */
type InventoryListLike = { items: Inventory[] } & Record<string, unknown>;

export interface UpdateQuantityArg {
  id: string;
  quantity: number;
}
export interface UpdateStatusArg {
  id: string;
  status: InventoryStatus;
}
/** Condition rides the full PATCH — the caller bundles the unchanged fields. */
export interface UpdateConditionArg {
  id: string;
  condition: Condition;
  location_id: string;
  quantity: number;
}

export function useInventoryMutations() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const queryClient = useQueryClient();
  const { t } = useLingui();

  const prefix: QueryKey = ["inventory", wsId];

  function invalidate() {
    // Prefix-match (default exact:false) — covers every page/param variant.
    queryClient.invalidateQueries({ queryKey: prefix });
  }

  // Snapshot + optimistically patch the matching entry across ALL inventory
  // list queries (any page/param combo currently cached).
  async function optimisticPatch(
    id: string,
    patch: Partial<Inventory>,
  ): Promise<OptimisticContext> {
    await queryClient.cancelQueries({ queryKey: prefix });
    const snapshots = queryClient.getQueriesData({ queryKey: prefix });
    queryClient.setQueriesData<InventoryListLike>(
      { queryKey: prefix },
      (old) => {
        if (!old || !Array.isArray(old.items)) return old;
        return {
          ...old,
          items: old.items.map((entry) =>
            entry.id === id ? { ...entry, ...patch } : entry,
          ),
        };
      },
    );
    return { snapshots };
  }

  function restore(ctx: OptimisticContext | undefined) {
    ctx?.snapshots.forEach(([key, data]) => {
      queryClient.setQueryData(key, data);
    });
  }

  const updateQuantity = useMutation<
    Inventory,
    Error,
    UpdateQuantityArg,
    OptimisticContext
  >({
    mutationFn: ({ id, quantity }) =>
      inventoryApi.updateQuantity(wsId as string, id, quantity),
    onMutate: ({ id, quantity }) => optimisticPatch(id, { quantity }),
    onError: (_err, _arg, ctx) => {
      restore(ctx);
      retroToast.error(t`Couldn't update quantity.`);
    },
    onSettled: invalidate,
  });

  const updateStatus = useMutation<
    Inventory,
    Error,
    UpdateStatusArg,
    OptimisticContext
  >({
    mutationFn: ({ id, status }) =>
      inventoryApi.updateStatus(wsId as string, id, status),
    onMutate: ({ id, status }) => optimisticPatch(id, { status }),
    onError: (_err, _arg, ctx) => {
      restore(ctx);
      retroToast.error(t`Couldn't update status.`);
    },
    onSettled: invalidate,
  });

  const updateCondition = useMutation<
    Inventory,
    Error,
    UpdateConditionArg,
    OptimisticContext
  >({
    // Pitfall 6: full PATCH with the unchanged location_id + quantity bundled.
    mutationFn: ({ id, condition, location_id, quantity }) =>
      inventoryApi.update(wsId as string, id, {
        location_id,
        quantity,
        condition,
      }),
    onMutate: ({ id, condition }) => optimisticPatch(id, { condition }),
    onError: (_err, _arg, ctx) => {
      restore(ctx);
      retroToast.error(t`Couldn't update condition.`);
    },
    onSettled: invalidate,
  });

  const archive = useMutation({
    mutationFn: (id: string) => inventoryApi.archive(wsId as string, id),
    onSuccess: invalidate,
    onError: () => retroToast.error(t`Couldn't archive that entry.`),
  });

  const restoreEntry = useMutation({
    mutationFn: (id: string) => inventoryApi.restore(wsId as string, id),
    onSuccess: invalidate,
    onError: () => retroToast.error(t`Couldn't restore that entry.`),
  });

  return {
    updateQuantity,
    updateStatus,
    updateCondition,
    archive,
    restore: restoreEntry,
  };
}
