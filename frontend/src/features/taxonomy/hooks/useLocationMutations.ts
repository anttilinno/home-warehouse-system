import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import {
  locationApi,
  type CreateLocationBody,
  type UpdateLocationBody,
} from "@/lib/api/location";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 10 Plan 03 — the location write surface (TAX-03 create/edit, TAX-04
// archive + restore). MIRRORS useCategoryMutations for shape; every mutation
// PREFIX-invalidates ["locations", wsId] (NO exact:true — T-10-03, so the prefix
// covers the list query + any detail key). Toast copy is the UI-SPEC §Toasts
// authoritative set.
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

  const create = useMutation({
    mutationFn: (b: CreateLocationBody) =>
      locationApi.create(wsId as string, b),
    onSuccess: (loc) => {
      invalidate();
      retroToast.success(t`${loc.name} created.`);
    },
    onError: () => retroToast.error(t`Couldn't save this location.`),
  });

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
  return { create, update, archive, restore };
}
