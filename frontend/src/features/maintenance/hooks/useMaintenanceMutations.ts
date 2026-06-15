import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { maintenanceApi } from "@/lib/api/maintenance";
import type {
  CreateScheduleBody,
  UpdateScheduleBody,
} from "@/lib/api/maintenance";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { MaintenanceSchedule } from "@/lib/types";

// Phase 10b Plan 04 — the maintenance schedule CRUD + complete write surface
// (MNT-01/02). MIRRORS useRepairMutations EXACTLY: onMutate snapshots EVERY
// ["maintenance", wsId] query, patches/removes the matching schedule in place,
// onError restores the snapshot + fires a persistent retroToast.error,
// onSettled re-invalidates the prefix so the SERVER value (the complete-advanced
// next_due) wins. NO client date math anywhere (override #3) — completing a
// schedule NEVER computes the next date client-side; it calls the endpoint and
// re-reads the server's authoritative next_due.
//
// completeSchedule ALSO invalidates ["repairs", wsId] (override #7 / Pitfall 8):
// the server writes a repair_logs row on complete, so the repair caches would
// otherwise go stale.
//
// Pitfall 4: schedule list caches are an { items: MaintenanceSchedule[] }
// envelope, so the patch guards Array.isArray(old.items).

/** Snapshot context: every captured ["maintenance", wsId] query entry. */
interface OptimisticContext {
  snapshots: [QueryKey, unknown][];
}

/** A single schedule-list cache shape — only `items` is patched. */
type ScheduleListLike = {
  items: MaintenanceSchedule[];
} & Record<string, unknown>;

export interface UpdateScheduleArg {
  id: string;
  body: UpdateScheduleBody;
}

export function useMaintenanceMutations() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const queryClient = useQueryClient();
  const { t } = useLingui();

  const prefix: QueryKey = ["maintenance", wsId as string];

  function invalidate() {
    // Prefix-match (default exact:false) — covers by-inventory + due + list + by-id.
    queryClient.invalidateQueries({ queryKey: prefix });
  }

  // Snapshot + optimistically patch the matching schedule across ALL caches.
  async function optimisticPatch(
    id: string,
    patch: Partial<MaintenanceSchedule>,
  ): Promise<OptimisticContext> {
    await queryClient.cancelQueries({ queryKey: prefix });
    const snapshots = queryClient.getQueriesData({ queryKey: prefix });
    queryClient.setQueriesData<ScheduleListLike>(
      { queryKey: prefix },
      (old) => {
        if (!old || !Array.isArray(old.items)) return old;
        return {
          ...old,
          items: old.items.map((schedule) =>
            schedule.id === id ? { ...schedule, ...patch } : schedule,
          ),
        };
      },
    );
    return { snapshots };
  }

  function restore(ctx: OptimisticContext | undefined) {
    ctx?.snapshots.forEach(([key, data]) =>
      queryClient.setQueryData(key, data),
    );
  }

  const createSchedule = useMutation<
    MaintenanceSchedule,
    Error,
    CreateScheduleBody
  >({
    mutationFn: (body) => maintenanceApi.create(wsId as string, body),
    onError: () => {
      retroToast.error(t`Couldn't save this schedule.`);
    },
    onSettled: invalidate,
  });

  const updateSchedule = useMutation<
    MaintenanceSchedule,
    Error,
    UpdateScheduleArg,
    OptimisticContext
  >({
    mutationFn: ({ id, body }) =>
      maintenanceApi.update(wsId as string, id, body),
    onMutate: ({ id, body }) =>
      optimisticPatch(id, body as Partial<MaintenanceSchedule>),
    onError: (_err, _arg, ctx) => {
      restore(ctx);
      retroToast.error(t`Couldn't save this schedule.`);
    },
    onSettled: invalidate,
  });

  const completeSchedule = useMutation<
    MaintenanceSchedule,
    Error,
    string,
    OptimisticContext
  >({
    // The server advances next_due (max(today, next_due + interval)), sets
    // last_completed_at, AND writes a repair_logs row — the UI just calls + reads
    // back (override #3: zero client date math; override #7: dual invalidate).
    mutationFn: (id) => maintenanceApi.complete(wsId as string, id),
    onError: (_err, _arg, ctx) => {
      restore(ctx);
      retroToast.error(t`Couldn't complete this schedule.`);
    },
    // Invalidate BOTH the maintenance prefix (next_due/last_completed_at changed,
    // and the row may leave the due list) AND the repairs prefix (the server
    // wrote a repair-log row — Pitfall 8).
    onSettled: () => {
      invalidate();
      queryClient.invalidateQueries({
        queryKey: ["repairs", wsId as string],
      });
    },
  });

  const deleteSchedule = useMutation<void, Error, string, OptimisticContext>({
    mutationFn: (id) => maintenanceApi.del(wsId as string, id),
    // Optimistic row removal across all schedule caches.
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: prefix });
      const snapshots = queryClient.getQueriesData({ queryKey: prefix });
      queryClient.setQueriesData<ScheduleListLike>(
        { queryKey: prefix },
        (old) => {
          if (!old || !Array.isArray(old.items)) return old;
          return { ...old, items: old.items.filter((s) => s.id !== id) };
        },
      );
      return { snapshots };
    },
    onError: (_err, _arg, ctx) => {
      restore(ctx);
      retroToast.error(t`Couldn't delete this schedule.`);
    },
    onSettled: invalidate,
  });

  return {
    createSchedule,
    updateSchedule,
    completeSchedule,
    deleteSchedule,
  };
}
