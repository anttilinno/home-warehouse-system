import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import {
  itemsApi,
  itemKeys,
  type Item,
  type CreateItemInput,
  type UpdateItemInput,
} from "@/lib/api/items";
import { HttpError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/retro";

/**
 * Phase 60 item mutation hooks.
 *
 * Mirror Phase 59 borrower mutations with two deviations:
 *   1. Create/update map 400 "SKU already exists" → specific toast (Pitfall 6).
 *   2. Delete does NOT have a 400 active-loans branch (items have no
 *      equivalent guard, D-04), but DOES removeQueries(detail) BEFORE
 *      invalidateQueries(all) so back-nav doesn't flash the stale entity
 *      (Pitfall 9).
 */

function isSkuCollision(err: unknown): boolean {
  if (!(err instanceof HttpError)) return false;
  if (err.status !== 400) return false;
  // Server message contains "SKU" for the unique-constraint case.
  return err.message.toLowerCase().includes("sku");
}

export function useCreateItem() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<Item, unknown, CreateItemInput>({
    mutationFn: (input) => itemsApi.create(workspaceId!, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: itemKeys.all });
      addToast(t`Item created.`, "success");
    },
    onError: (err) => {
      if (isSkuCollision(err)) {
        addToast(
          t`That SKU is already in use. Please regenerate or choose another.`,
          "error",
        );
        return;
      }
      addToast(t`Could not save item. Check your connection and try again.`, "error");
    },
  });
}

export function useUpdateItem() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<Item, unknown, { id: string; input: UpdateItemInput }>({
    mutationFn: ({ id, input }) => itemsApi.update(workspaceId!, id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: itemKeys.all });
      addToast(t`Item saved.`, "success");
    },
    onError: (err) => {
      if (isSkuCollision(err)) {
        addToast(
          t`That SKU is already in use. Please regenerate or choose another.`,
          "error",
        );
        return;
      }
      addToast(t`Could not save item. Check your connection and try again.`, "error");
    },
  });
}

export function useArchiveItem() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => itemsApi.archive(workspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: itemKeys.all });
      addToast(t`Item archived.`, "success");
    },
    onError: () => addToast(t`Could not update item. Try again.`, "error"),
  });
}

export function useRestoreItem() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => itemsApi.restore(workspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: itemKeys.all });
      addToast(t`Item restored.`, "success");
    },
    onError: () => addToast(t`Could not update item. Try again.`, "error"),
  });
}

export function useDeleteItem(opts?: { onAfterDelete?: () => void }) {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => itemsApi.delete(workspaceId!, id),
    onSuccess: (_void, id) => {
      // Pitfall 9: remove the stale detail query BEFORE invalidating list.
      // Otherwise browser-back to /items/:id briefly renders the deleted
      // item before 404.
      qc.removeQueries({ queryKey: itemKeys.detail(id) });
      qc.invalidateQueries({ queryKey: itemKeys.all });
      addToast(t`Item deleted.`, "success");
      opts?.onAfterDelete?.();
    },
    onError: () => addToast(t`Could not delete item. Try again.`, "error"),
  });
}
