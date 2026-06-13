import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import {
  categoryApi,
  type CreateCategoryBody,
  type UpdateCategoryBody,
} from "@/lib/api/category";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 10 Plan 02 — the category write surface (TAX-01 create/edit, TAX-02
// archive + restore). MIRRORS useBorrowerMutations verbatim for shape:
// useWorkspace + qc + useLingui; every mutation PREFIX-invalidates
// ["categories", wsId] (NO exact:true — T-10-03, so the prefix covers the list
// query + any detail key). Toast copy is the UI-SPEC §Toasts authoritative set.
//
// The hook returns the mutation objects whole; consuming components destructure
// the stable `.mutate` (render-loop discipline lives in the consumer, Pitfall 1).
// The {name} interpolation toasts take a name arg so the success copy can read
// "{name} archived." / "{name} restored." per the UI-SPEC.

export interface UpdateCategoryArg {
  id: string;
  body: UpdateCategoryBody;
}

export interface ArchiveCategoryArg {
  id: string;
  name: string;
}

export function useCategoryMutations() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const qc = useQueryClient();
  const { t } = useLingui();

  // PREFIX-match (default exact:false) — covers list + detail (T-10-03).
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["categories", wsId as string] });

  const create = useMutation({
    mutationFn: (b: CreateCategoryBody) => categoryApi.create(wsId as string, b),
    onSuccess: (cat) => {
      invalidate();
      retroToast.success(t`${cat.name} created.`);
    },
    onError: () => retroToast.error(t`Couldn't save this category.`),
  });

  const update = useMutation({
    mutationFn: (a: UpdateCategoryArg) =>
      categoryApi.update(wsId as string, a.id, a.body),
    onSuccess: () => {
      invalidate();
      retroToast.success(t`Changes saved.`);
    },
    onError: () => retroToast.error(t`Couldn't save this category.`),
  });

  const archive = useMutation({
    mutationFn: (a: ArchiveCategoryArg) =>
      categoryApi.archive(wsId as string, a.id),
    onSuccess: (_data, a) => {
      invalidate();
      retroToast.success(t`${a.name} archived.`);
    },
    onError: () => retroToast.error(t`Couldn't archive this category.`),
  });

  const restore = useMutation({
    mutationFn: (a: ArchiveCategoryArg) =>
      categoryApi.restore(wsId as string, a.id),
    onSuccess: (_data, a) => {
      invalidate();
      retroToast.success(t`${a.name} restored.`);
    },
    onError: () => retroToast.error(t`Couldn't restore this category.`),
  });

  return { create, update, archive, restore };
}
