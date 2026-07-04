import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import {
  locationApi,
  type Location,
  type CreateLocationBody,
  type UpdateLocationBody,
} from "@/lib/api/location";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { MK } from "@/lib/offline/mutationKeys";
import { newIdemKey } from "@/lib/offline/idempotency";
import { generateShortCode } from "@/lib/offline/shortCode";
import type { LocationCreateVars } from "@/lib/offline/mutationDefaults";

// Phase 10 Plan 03 — the location write surface (TAX-03 create/edit, TAX-04
// archive + restore). MIRRORS useCategoryMutations for shape; update/archive/
// restore PREFIX-invalidate ["locations", wsId] (NO exact:true — T-10-03, so
// the prefix covers the list query + any detail key). Toast copy is the
// UI-SPEC §Toasts authoritative set.
//
// create (Phase 3b offline rewrite): MIRRORS useItemFormMutations.ts /
// useContainerMutations.ts exactly — mutationFn lives in the
// centrally-registered default (mutationDefaults.ts) so a paused offline
// create survives a page reload; the hook only supplies mutationKey +
// optimistic onMutate/onError/onSuccess. Callers keep calling
// `createLocation(body)` (wraps `create.mutateAsync` with the
// wsId/idemKey/short_code variables); `create` itself is exposed for
// isPending/isError. create's invalidate lives in mutationDefaults.ts
// onSettled.
//
// ⚠ ARCHIVE-ONLY (TAX-04 / OQ6 / T-10-07): there is deliberately NO `del`
// exposed. Location hard-delete is dangerous (CASCADE/RESTRICT on inventory &
// children) — the UI offers archive only, never delete. The locationApi.del
// endpoint exists but is intentionally NOT wired here.
//
// The hook returns the mutation objects whole; consuming components destructure
// the stable `.mutate` (render-loop discipline lives in the consumer).

export interface UpdateLocationArg {
  id: string;
  body: UpdateLocationBody;
}

export interface ArchiveLocationArg {
  id: string;
  name: string;
}

export function useLocationMutations() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const qc = useQueryClient();
  const { t } = useLingui();

  // PREFIX-match (default exact:false) — covers list + detail (T-10-03).
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["locations", wsId as string] });

  // Snapshot every ["locations", wsId] cache entry so onError can restore it
  // (mirrors useItemFormMutations.ts / useContainerMutations.ts create's
  // onMutate/onError pattern).
  interface CreateContext {
    snapshots: [QueryKey, unknown][];
  }

  const create = useMutation<
    Location,
    Error,
    LocationCreateVars,
    CreateContext
  >({
    mutationKey: MK.locationCreate,
    // No mutationFn here — resolved from the mutationDefaults.ts registration
    // so a resumed-after-reload replay still has a request to run.
    onMutate: async (vars) => {
      const prefix: QueryKey = ["locations", vars.wsId];
      await qc.cancelQueries({ queryKey: prefix });
      const snapshots = qc.getQueriesData({ queryKey: prefix });
      const now = new Date().toISOString();
      const tempLocation: Location = {
        id: crypto.randomUUID(),
        workspace_id: vars.wsId,
        name: vars.body.name,
        parent_location: vars.body.parent_location,
        description: vars.body.description,
        short_code: vars.body.short_code,
        is_archived: false,
        created_at: now,
        updated_at: now,
      };
      // The locations list cache is a PLAIN Location[] (useTaxonomyListQuery
      // unwraps the paginated envelope in the queryFn), unlike items'
      // {items,total} envelope — patch the array directly.
      // ponytail: patches every cached ["locations", wsId, ...] entry
      // regardless of its own filter — acceptable for v1, the reconnect
      // invalidate (mutationDefaults onSettled) replaces it with the real set.
      qc.setQueriesData<Location[]>({ queryKey: prefix }, (old) => {
        if (!Array.isArray(old)) return old;
        return [tempLocation, ...old];
      });
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => {
        qc.setQueryData(key, data);
      });
      retroToast.error(t`Couldn't save this location.`);
    },
    // onSettled (the real invalidate) lives in mutationDefaults.ts so a
    // resumed replay (no hook mounted) still refetches. This onSuccess is
    // cosmetic-only.
    onSuccess: (loc) => retroToast.success(t`${loc.name} created.`),
  });

  // Wraps `create.mutateAsync` so callers keep passing a bare
  // CreateLocationBody — wsId, the idempotency key, and the short_code
  // (final at creation, printed on the label — never remapped) are minted
  // here. A short_code already set by the caller (form pre-fill / scanned QR
  // label) wins; only a missing one is generated.
  function createLocation(body: CreateLocationBody): Promise<Location> {
    return create.mutateAsync({
      wsId: wsId as string,
      idemKey: newIdemKey(),
      body: { ...body, short_code: body.short_code ?? generateShortCode() },
    });
  }

  const update = useMutation({
    mutationFn: (a: UpdateLocationArg) =>
      locationApi.update(wsId as string, a.id, a.body),
    onSuccess: () => {
      invalidate();
      retroToast.success(t`Changes saved.`);
    },
    onError: () => retroToast.error(t`Couldn't save this location.`),
  });

  const archive = useMutation({
    mutationFn: (a: ArchiveLocationArg) =>
      locationApi.archive(wsId as string, a.id),
    onSuccess: (_data, a) => {
      invalidate();
      retroToast.success(t`${a.name} archived.`);
    },
    onError: () => retroToast.error(t`Couldn't archive this location.`),
  });

  const restore = useMutation({
    mutationFn: (a: ArchiveLocationArg) =>
      locationApi.restore(wsId as string, a.id),
    onSuccess: (_data, a) => {
      invalidate();
      retroToast.success(t`${a.name} restored.`);
    },
    onError: () => retroToast.error(t`Couldn't restore this location.`),
  });

  // NOTE: NO `del` (TAX-04 archive-only; location hard-delete is dangerous).
  return { create, createLocation, update, archive, restore };
}
