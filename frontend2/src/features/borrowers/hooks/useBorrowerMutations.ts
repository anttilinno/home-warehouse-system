import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import {
  borrowersApi,
  type CreateBorrowerBody,
  type UpdateBorrowerBody,
} from "@/lib/api/borrowers";
import { HttpError } from "@/lib/api";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 9 Plan 01 — the borrower write surface (BORR-02 create/update, BORR-05
// delete). Source: useLoanMutations (PREFIX invalidate, no `exact`) +
// useItemMutations (HttpError 400 map).
//
// All three mutations PREFIX-invalidate `["borrowers", wsId]` (binding override
// #7 — no `exact:true`, so the prefix covers the list + any detail key). del's
// onError maps the backend 400 "cannot delete borrower with active loans"
// (NOT 409 — handler.go) to the active-loans toast; every other failure gets a
// generic toast. The hook owns the toast + 400 mapping ONLY — routing (the
// delete-blocked banner / "View active loans" link) lives in the consuming page.
//
// Toast copy is the UI-SPEC §Toasts authoritative set (lines 390-396).
//
// NOTE: the hook returns the mutation objects whole; consuming pages destructure
// the stable `.mutate` (render-loop discipline lives in the consuming page).

export interface UpdateBorrowerArg {
  id: string;
  body: UpdateBorrowerBody;
}

export function useBorrowerMutations() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const qc = useQueryClient();
  const { t } = useLingui();

  // PREFIX-match (default exact:false) — covers list + detail (binding #7).
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["borrowers", wsId as string] });

  const create = useMutation({
    mutationFn: (b: CreateBorrowerBody) =>
      borrowersApi.create(wsId as string, b),
    onSuccess: () => {
      invalidate();
      retroToast.success(t`Borrower created.`);
    },
    onError: () => retroToast.error(t`Couldn't save this borrower.`),
  });

  const update = useMutation({
    mutationFn: (a: UpdateBorrowerArg) =>
      borrowersApi.update(wsId as string, a.id, a.body),
    onSuccess: () => {
      invalidate();
      retroToast.success(t`Borrower updated.`);
    },
    onError: () => retroToast.error(t`Couldn't save this borrower.`),
  });

  const del = useMutation({
    mutationFn: (id: string) => borrowersApi.del(wsId as string, id),
    onSuccess: () => {
      invalidate();
      retroToast.success(t`Borrower deleted.`);
    },
    // Reactive backstop (binding override #3): map the backend 400 active-loans
    // block to the specific message; everything else gets the generic one.
    onError: (err) =>
      retroToast.error(
        err instanceof HttpError && err.status === 400
          ? t`Couldn't delete — this borrower has active loans.`
          : t`Couldn't delete this borrower.`,
      ),
  });

  return { create, update, del };
}
