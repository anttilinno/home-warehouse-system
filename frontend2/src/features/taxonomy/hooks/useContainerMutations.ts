import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import {
  containerApi,
  type CreateContainerBody,
  type UpdateContainerBody,
} from "@/lib/api/container";
import { HttpError } from "@/lib/api";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 10 Plan 03 — the container write surface (TAX-05 create/edit, TAX-06
// DELETE). MIRRORS useCategoryMutations for shape, with two container-specific
// twists:
//
//  1. Containers use DELETE (not archive) per CONTEXT OQ6 — the `del` mutation
//     is the destructive path.
//  2. del.onSuccess PREFIX-invalidates BOTH ["containers", wsId] AND
//     ["inventory", wsId] (T-10-05 / OQ2): the server FK SET NULLs
//     inventory.container_id when a container is deleted, so the inventory caches
//     MUST refetch to drop the stale container assignment. A bare DELETE — NO
//     ?force, NO second call (the unassign is a server-side cascade).
//  3. del.onError maps a 409 → a conflict toast (defensive backstop; the current
//     service cascades and can't 409, but the UI is correct if that ever changes).
//
// create/update PREFIX-invalidate ["containers", wsId] only. Toast copy is the
// UI-SPEC §Toasts authoritative set. Consumers destructure the stable `.mutate`.

export interface UpdateContainerArg {
  id: string;
  body: UpdateContainerBody;
}

export interface DeleteContainerArg {
  id: string;
  name: string;
}

export function useContainerMutations() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const qc = useQueryClient();
  const { t } = useLingui();

  // PREFIX-match (default exact:false) — covers list + detail (T-10-03).
  const invalidateContainers = () =>
    qc.invalidateQueries({ queryKey: ["containers", wsId as string] });
  // FK SET NULL cascade: a deleted container unassigns inventory rows, so the
  // inventory caches must refetch (T-10-05 / OQ2).
  const invalidateInventory = () =>
    qc.invalidateQueries({ queryKey: ["inventory", wsId as string] });

  const create = useMutation({
    mutationFn: (b: CreateContainerBody) =>
      containerApi.create(wsId as string, b),
    onSuccess: (c) => {
      invalidateContainers();
      retroToast.success(t`${c.name} created.`);
    },
    onError: () => retroToast.error(t`Couldn't save this container.`),
  });

  const update = useMutation({
    mutationFn: (a: UpdateContainerArg) =>
      containerApi.update(wsId as string, a.id, a.body),
    onSuccess: () => {
      invalidateContainers();
      retroToast.success(t`Changes saved.`);
    },
    onError: () => retroToast.error(t`Couldn't save this container.`),
  });

  const del = useMutation({
    mutationFn: (a: DeleteContainerArg) => containerApi.del(wsId as string, a.id),
    onSuccess: (_data, a) => {
      // Double PREFIX-invalidate: containers (the list) AND inventory (the FK
      // SET NULL cascade unassigned the items) — T-10-05 / OQ2.
      invalidateContainers();
      invalidateInventory();
      retroToast.success(t`${a.name} deleted.`);
    },
    onError: (err) => {
      // Defensive: a 409 means the server refused the cascade (it currently
      // can't, but surface a clear conflict message if that ever changes).
      if (err instanceof HttpError && err.status === 409) {
        retroToast.error(
          t`This container is still in use and can't be deleted.`,
        );
        return;
      }
      retroToast.error(t`Couldn't delete this container.`);
    },
  });

  return { create, update, del };
}
