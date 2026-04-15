import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  locationsApi,
  locationKeys,
  type Location,
  type CreateLocationInput,
  type UpdateLocationInput,
} from "@/lib/api/locations";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/retro";
import { useLingui } from "@lingui/react/macro";

export function useCreateLocation() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<Location, unknown, CreateLocationInput>({
    mutationFn: (input) => locationsApi.create(workspaceId!, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: locationKeys.all });
      addToast(t`Location created.`, "success");
    },
    onError: () =>
      addToast(t`Connection lost. Your change was not saved.`, "error"),
  });
}

export function useUpdateLocation() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<
    Location,
    unknown,
    { id: string; input: UpdateLocationInput }
  >({
    mutationFn: ({ id, input }) =>
      locationsApi.update(workspaceId!, id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: locationKeys.all });
      addToast(t`Location saved.`, "success");
    },
    onError: () =>
      addToast(t`Connection lost. Your change was not saved.`, "error"),
  });
}

export function useArchiveLocation() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => locationsApi.archive(workspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: locationKeys.all });
      addToast(t`Location archived.`, "success");
    },
    onError: () =>
      addToast(t`Could not archive. Try again.`, "error"),
  });
}

export function useRestoreLocation() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => locationsApi.restore(workspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: locationKeys.all });
      addToast(t`Location restored.`, "success");
    },
    onError: () =>
      addToast(t`Connection lost. Your change was not saved.`, "error"),
  });
}

export function useDeleteLocation() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => locationsApi.remove(workspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: locationKeys.all });
      addToast(t`Location deleted.`, "success");
    },
    onError: () =>
      addToast(t`Connection lost. Your change was not saved.`, "error"),
  });
}
