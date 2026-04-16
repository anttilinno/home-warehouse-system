import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HttpError } from "@/lib/api";
import {
  borrowersApi,
  borrowerKeys,
  type Borrower,
  type CreateBorrowerInput,
  type UpdateBorrowerInput,
} from "@/lib/api/borrowers";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/retro";
import { useLingui } from "@lingui/react/macro";

export function useCreateBorrower() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<Borrower, unknown, CreateBorrowerInput>({
    mutationFn: (input) => borrowersApi.create(workspaceId!, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: borrowerKeys.all });
      addToast(t`Borrower created.`, "success");
    },
    onError: () =>
      addToast(t`Connection lost. Your change was not saved.`, "error"),
  });
}

export function useUpdateBorrower() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<
    Borrower,
    unknown,
    { id: string; input: UpdateBorrowerInput }
  >({
    mutationFn: ({ id, input }) =>
      borrowersApi.update(workspaceId!, id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: borrowerKeys.all });
      addToast(t`Borrower saved.`, "success");
    },
    onError: () =>
      addToast(t`Connection lost. Your change was not saved.`, "error"),
  });
}

export function useArchiveBorrower() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => borrowersApi.archive(workspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: borrowerKeys.all });
      addToast(t`Borrower archived.`, "success");
    },
    onError: () =>
      addToast(t`Could not archive. Try again.`, "error"),
  });
}

export function useRestoreBorrower() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => borrowersApi.restore(workspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: borrowerKeys.all });
      addToast(t`Borrower restored.`, "success");
    },
    onError: () =>
      addToast(t`Connection lost. Your change was not saved.`, "error"),
  });
}

export function useDeleteBorrower() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => borrowersApi.remove(workspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: borrowerKeys.all });
      addToast(t`Borrower deleted.`, "success");
    },
    onError: (err) => {
      // 400 = active loans guard fired on backend (BORR-04)
      if (err instanceof HttpError && err.status === 400) {
        addToast(
          t`Cannot delete: this borrower has active loans.`,
          "error",
        );
        return;
      }
      addToast(t`Connection lost. Your change was not saved.`, "error");
    },
  });
}
