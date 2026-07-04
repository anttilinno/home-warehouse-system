import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import {
  containerApi,
  type Container,
  type CreateContainerBody,
  type UpdateContainerBody,
} from "@/lib/api/container";
import { HttpError } from "@/lib/api";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { MK } from "@/lib/offline/mutationKeys";
import { newIdemKey } from "@/lib/offline/idempotency";
import { generateShortCode } from "@/lib/offline/shortCode";
import type { ContainerCreateVars } from "@/lib/offline/mutationDefaults";

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
// create (Phase 3b offline rewrite): MIRRORS useItemFormMutations.ts exactly —
// mutationFn lives in the centrally-registered default (mutationDefaults.ts) so
// a paused offline create survives a page reload; the hook only supplies
// mutationKey + optimistic onMutate/onError/onSuccess. Callers keep calling
// `createContainer(body)` (wraps `create.mutateAsync` with the
// wsId/idemKey/short_code variables); `create` itself is exposed for
// isPending/isError. update/del PREFIX-invalidate ["containers", wsId] only
// (create's invalidate lives in mutationDefaults.ts onSettled). Toast copy is
// the UI-SPEC §Toasts authoritative set. Consumers destructure the stable
// `.mutate`.

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

  // Snapshot every ["containers", wsId] cache entry so onError can restore it
  // (mirrors useItemFormMutations.ts create's onMutate/onError pattern).
  interface CreateContext {
    snapshots: [QueryKey, unknown][];
  }

  const create = useMutation<
    Container,
    Error,
    ContainerCreateVars,
    CreateContext
  >({
    mutationKey: MK.containerCreate,
    // No mutationFn here — resolved from the mutationDefaults.ts registration
    // so a resumed-after-reload replay still has a request to run.
    onMutate: async (vars) => {
      const prefix: QueryKey = ["containers", vars.wsId];
      await qc.cancelQueries({ queryKey: prefix });
      const snapshots = qc.getQueriesData({ queryKey: prefix });
      const now = new Date().toISOString();
      const tempContainer: Container = {
        id: crypto.randomUUID(),
        workspace_id: vars.wsId,
        name: vars.body.name,
        location_id: vars.body.location_id,
        description: vars.body.description,
        capacity: vars.body.capacity,
        short_code: vars.body.short_code,
        is_archived: false,
        created_at: now,
        updated_at: now,
      };
      // The containers list cache is a PLAIN Container[] (useTaxonomyListQuery
      // unwraps the paginated envelope in the queryFn), unlike items'
      // {items,total} envelope — patch the array directly.
      // ponytail: patches every cached ["containers", wsId, ...] entry
      // regardless of its own filter — acceptable for v1, the reconnect
      // invalidate (mutationDefaults onSettled) replaces it with the real set.
      qc.setQueriesData<Container[]>({ queryKey: prefix }, (old) => {
        if (!Array.isArray(old)) return old;
        return [tempContainer, ...old];
      });
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => {
        qc.setQueryData(key, data);
      });
      retroToast.error(t`Couldn't save this container.`);
    },
    // onSettled (the real invalidate) lives in mutationDefaults.ts so a
    // resumed replay (no hook mounted) still refetches. This onSuccess is
    // cosmetic-only.
    onSuccess: (c) => retroToast.success(t`${c.name} created.`),
  });

  // Wraps `create.mutateAsync` so callers keep passing a bare
  // CreateContainerBody — wsId, the idempotency key, and the short_code
  // (final at creation, printed on the label — never remapped) are minted
  // here. A short_code already set by the caller (form pre-fill / scanned QR
  // label) wins; only a missing one is generated.
  function createContainer(body: CreateContainerBody): Promise<Container> {
    return create.mutateAsync({
      wsId: wsId as string,
      idemKey: newIdemKey(),
      body: { ...body, short_code: body.short_code ?? generateShortCode() },
    });
  }

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
    mutationFn: (a: DeleteContainerArg) =>
      containerApi.del(wsId as string, a.id),
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

  return { create, createContainer, update, del };
}
