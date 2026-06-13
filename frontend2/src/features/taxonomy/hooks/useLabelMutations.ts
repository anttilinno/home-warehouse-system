import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import {
  labelsApi,
  type CreateLabelBody,
  type UpdateLabelBody,
} from "@/lib/api/labels";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 10 Plan 04 — the label write surface (TAX-07 create/edit, archive +
// restore + delete). MIRRORS useCategoryMutations for shape: useWorkspace + qc +
// useLingui; every mutation PREFIX-invalidates ["labels", wsId] (NO exact:true —
// T-10-09, so the prefix covers the list query + any detail key). Toast copy is
// the UI-SPEC §Toasts authoritative set.
//
// The hook returns the mutation objects whole; consuming components destructure
// the stable `.mutate` (render-loop discipline lives in the consumer, Pitfall 1).
// The {name} interpolation toasts take a name arg so the success copy can read
// "{name} archived." / "{name} restored." / "{name} deleted." per the UI-SPEC.

export interface UpdateLabelArg {
  id: string;
  body: UpdateLabelBody;
}

export interface LabelNameArg {
  id: string;
  name: string;
}

export function useLabelMutations() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const qc = useQueryClient();
  const { t } = useLingui();

  // PREFIX-match (default exact:false) — covers list + detail (T-10-09).
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["labels", wsId as string] });

  const create = useMutation({
    mutationFn: (b: CreateLabelBody) => labelsApi.create(wsId as string, b),
    onSuccess: (label) => {
      invalidate();
      retroToast.success(t`${label.name} created.`);
    },
    onError: () => retroToast.error(t`Couldn't save this label.`),
  });

  const update = useMutation({
    mutationFn: (a: UpdateLabelArg) =>
      labelsApi.update(wsId as string, a.id, a.body),
    onSuccess: () => {
      invalidate();
      retroToast.success(t`Changes saved.`);
    },
    onError: () => retroToast.error(t`Couldn't save this label.`),
  });

  const archive = useMutation({
    mutationFn: (a: LabelNameArg) => labelsApi.archive(wsId as string, a.id),
    onSuccess: (_data, a) => {
      invalidate();
      retroToast.success(t`${a.name} archived.`);
    },
    onError: () => retroToast.error(t`Couldn't archive this label.`),
  });

  const restore = useMutation({
    mutationFn: (a: LabelNameArg) => labelsApi.restore(wsId as string, a.id),
    onSuccess: (_data, a) => {
      invalidate();
      retroToast.success(t`${a.name} restored.`);
    },
    onError: () => retroToast.error(t`Couldn't restore this label.`),
  });

  const del = useMutation({
    mutationFn: (a: LabelNameArg) => labelsApi.del(wsId as string, a.id),
    onSuccess: (_data, a) => {
      invalidate();
      retroToast.success(t`${a.name} deleted.`);
    },
    onError: () => retroToast.error(t`Couldn't delete this label.`),
  });

  return { create, update, archive, restore, del };
}
