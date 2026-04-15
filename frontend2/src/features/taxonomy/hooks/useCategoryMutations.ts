import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HttpError } from "@/lib/api";
import {
  categoriesApi,
  categoryKeys,
  type Category,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@/lib/api/categories";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/retro";
import { useLingui } from "@lingui/react/macro";

export function useCreateCategory() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<Category, unknown, CreateCategoryInput>({
    mutationFn: (input) => categoriesApi.create(workspaceId!, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: categoryKeys.all });
      addToast(t`Category created.`, "success");
    },
    onError: () =>
      addToast(t`Connection lost. Your change was not saved.`, "error"),
  });
}

export function useUpdateCategory() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<
    Category,
    unknown,
    { id: string; input: UpdateCategoryInput }
  >({
    mutationFn: ({ id, input }) =>
      categoriesApi.update(workspaceId!, id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: categoryKeys.all });
      addToast(t`Category saved.`, "success");
    },
    onError: () =>
      addToast(t`Connection lost. Your change was not saved.`, "error"),
  });
}

export function useArchiveCategory() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => categoriesApi.archive(workspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: categoryKeys.all });
      addToast(t`Category archived.`, "success");
    },
    onError: () =>
      addToast(t`Could not archive. Try again.`, "error"),
  });
}

export function useRestoreCategory() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => categoriesApi.restore(workspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: categoryKeys.all });
      addToast(t`Category restored.`, "success");
    },
    onError: () =>
      addToast(t`Connection lost. Your change was not saved.`, "error"),
  });
}

export function useDeleteCategory() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => categoriesApi.remove(workspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: categoryKeys.all });
      addToast(t`Category deleted.`, "success");
    },
    onError: (err) => {
      if (err instanceof HttpError && err.status === 409) {
        addToast(t`Move or delete child nodes first.`, "error");
        return;
      }
      addToast(t`Connection lost. Your change was not saved.`, "error");
    },
  });
}
