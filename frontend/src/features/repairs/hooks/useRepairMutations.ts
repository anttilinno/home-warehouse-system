import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { repairsApi } from "@/lib/api/repairs";
import type {
  CreateRepairBody,
  UpdateRepairBody,
} from "@/lib/api/repairs";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { Condition, Repair } from "@/lib/types";

// Phase 10b Plan 02 — the repair lifecycle + CRUD write surface (RPR-01).
// MIRRORS useLoanMutations EXACTLY: onMutate snapshots EVERY ["repairs", wsId]
// query, patches the matching repair in place, onError restores the snapshot +
// fires a persistent retroToast.error, onSettled re-invalidates the prefix so
// the SERVER status (the start/complete-authoritative lifecycle) wins. No
// client-trusted state survives a 4xx (T-10b-03 defense-in-depth — the backend
// also rejects invalid transitions).
//
// Pitfall 4: repair list caches are a { items: Repair[] } envelope, so the patch
// guards Array.isArray(old.items).
//
// completeRepair with a `new_condition` ALSO invalidates ["inventory", wsId]
// (T-10b-04 / Pitfall 8): completing-with-condition mutates the owning entry's
// condition server-side, so the inventory caches would otherwise go stale.

/** Snapshot context: every captured ["repairs", wsId] query entry. */
interface OptimisticContext {
  snapshots: [QueryKey, unknown][];
}

/** A single repair-list cache shape — only `items` is patched. */
type RepairListLike = { items: Repair[] } & Record<string, unknown>;

export interface UpdateRepairArg {
  id: string;
  body: UpdateRepairBody;
}

export interface CompleteRepairArg {
  id: string;
  /** Optional new inventory condition; when set, ALSO invalidates inventory. */
  new_condition?: Condition;
}

export function useRepairMutations() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const queryClient = useQueryClient();
  const { t } = useLingui();

  const prefix: QueryKey = ["repairs", wsId as string];

  function invalidate() {
    // Prefix-match (default exact:false) — covers by-inventory + cost + by-id.
    queryClient.invalidateQueries({ queryKey: prefix });
  }

  // Snapshot + optimistically patch the matching repair across ALL repair caches.
  async function optimisticPatch(
    id: string,
    patch: Partial<Repair>,
  ): Promise<OptimisticContext> {
    await queryClient.cancelQueries({ queryKey: prefix });
    const snapshots = queryClient.getQueriesData({ queryKey: prefix });
    queryClient.setQueriesData<RepairListLike>({ queryKey: prefix }, (old) => {
      if (!old || !Array.isArray(old.items)) return old;
      return {
        ...old,
        items: old.items.map((repair) =>
          repair.id === id ? { ...repair, ...patch } : repair,
        ),
      };
    });
    return { snapshots };
  }

  function restore(ctx: OptimisticContext | undefined) {
    ctx?.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data));
  }

  const startRepair = useMutation<Repair, Error, string, OptimisticContext>({
    mutationFn: (id) => repairsApi.start(wsId as string, id),
    // PENDING → IN_PROGRESS; server settles the authoritative status onSettled.
    onMutate: (id) => optimisticPatch(id, { status: "IN_PROGRESS" }),
    onError: (_err, _arg, ctx) => {
      restore(ctx);
      retroToast.error(t`Couldn't start this repair.`);
    },
    onSettled: invalidate,
  });

  const completeRepair = useMutation<
    Repair,
    Error,
    CompleteRepairArg,
    OptimisticContext
  >({
    mutationFn: ({ id, new_condition }) =>
      repairsApi.complete(wsId as string, id, new_condition),
    onMutate: ({ id }) =>
      optimisticPatch(id, {
        status: "COMPLETED",
        completed_at: new Date().toISOString(),
      }),
    onError: (_err, _arg, ctx) => {
      restore(ctx);
      retroToast.error(t`Couldn't complete this repair.`);
    },
    // When a new_condition was applied the owning inventory entry's condition
    // changed server-side — invalidate the inventory prefix too (Pitfall 8).
    onSettled: (_data, _err, { new_condition }) => {
      invalidate();
      if (new_condition) {
        queryClient.invalidateQueries({
          queryKey: ["inventory", wsId as string],
        });
      }
    },
  });

  const updateRepair = useMutation<
    Repair,
    Error,
    UpdateRepairArg,
    OptimisticContext
  >({
    mutationFn: ({ id, body }) => repairsApi.update(wsId as string, id, body),
    // Patch the editable metadata in place (NO status — lifecycle is start/complete).
    onMutate: ({ id, body }) => optimisticPatch(id, body as Partial<Repair>),
    onError: (_err, _arg, ctx) => {
      restore(ctx);
      retroToast.error(t`Couldn't save this repair.`);
    },
    onSettled: invalidate,
  });

  const createRepair = useMutation<Repair, Error, CreateRepairBody>({
    mutationFn: (body) => repairsApi.create(wsId as string, body),
    onError: () => {
      retroToast.error(t`Couldn't save this repair.`);
    },
    onSettled: invalidate,
  });

  const deleteRepair = useMutation<void, Error, string, OptimisticContext>({
    mutationFn: (id) => repairsApi.del(wsId as string, id),
    // Optimistic row removal across all repair caches.
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: prefix });
      const snapshots = queryClient.getQueriesData({ queryKey: prefix });
      queryClient.setQueriesData<RepairListLike>(
        { queryKey: prefix },
        (old) => {
          if (!old || !Array.isArray(old.items)) return old;
          return { ...old, items: old.items.filter((r) => r.id !== id) };
        },
      );
      return { snapshots };
    },
    onError: (_err, _arg, ctx) => {
      restore(ctx);
      retroToast.error(t`Couldn't delete this repair.`);
    },
    onSettled: invalidate,
  });

  return {
    startRepair,
    completeRepair,
    updateRepair,
    createRepair,
    deleteRepair,
  };
}
