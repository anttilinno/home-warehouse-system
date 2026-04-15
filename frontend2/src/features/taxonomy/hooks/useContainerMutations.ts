import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  containersApi,
  containerKeys,
  type Container,
  type CreateContainerInput,
  type UpdateContainerInput,
} from "@/lib/api/containers";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/retro";
import { useLingui } from "@lingui/react/macro";

export function useCreateContainer() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<Container, unknown, CreateContainerInput>({
    mutationFn: (input) => containersApi.create(workspaceId!, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: containerKeys.all });
      addToast(t`Container created.`, "success");
    },
    onError: () =>
      addToast(t`Connection lost. Your change was not saved.`, "error"),
  });
}

export function useUpdateContainer() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<
    Container,
    unknown,
    { id: string; input: UpdateContainerInput }
  >({
    mutationFn: ({ id, input }) =>
      containersApi.update(workspaceId!, id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: containerKeys.all });
      addToast(t`Container saved.`, "success");
    },
    onError: () =>
      addToast(t`Connection lost. Your change was not saved.`, "error"),
  });
}

export function useArchiveContainer() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => containersApi.archive(workspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: containerKeys.all });
      addToast(t`Container archived.`, "success");
    },
    onError: () =>
      addToast(t`Could not archive. Try again.`, "error"),
  });
}

export function useRestoreContainer() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => containersApi.restore(workspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: containerKeys.all });
      addToast(t`Container restored.`, "success");
    },
    onError: () =>
      addToast(t`Connection lost. Your change was not saved.`, "error"),
  });
}

export function useDeleteContainer() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => containersApi.remove(workspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: containerKeys.all });
      addToast(t`Container deleted.`, "success");
    },
    onError: () =>
      addToast(t`Connection lost. Your change was not saved.`, "error"),
  });
}
