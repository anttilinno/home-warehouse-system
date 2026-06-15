import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { itemsApi } from "@/lib/api/items";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";

/** Delete arg: the id plus its archived state (the defensive guard reads it). */
export interface DeleteItemArg {
  id: string;
  isArchived: boolean;
}

/**
 * Archive / restore / delete mutations for items. Each invalidates the
 * `["items", wsId]` PREFIX (no `exact:true` — the prefix covers both the list
 * and any detail key per the SSE invalidation contract). Errors surface a
 * non-auto-dismissing retroToast.error.
 *
 * `del` is defensive: it refuses a non-archived id before the network call (the
 * UI also blocks it, but the hook enforces ITEM-06's archived-only delete).
 */
export function useItemMutations() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const queryClient = useQueryClient();
  const { t } = useLingui();

  function invalidateItems() {
    // Prefix-match (default exact:false) — covers list + detail (Phase 6).
    queryClient.invalidateQueries({ queryKey: ["items", wsId as string] });
  }

  const archive = useMutation({
    mutationFn: (id: string) => itemsApi.archive(wsId as string, id),
    onSuccess: invalidateItems,
    onError: () => retroToast.error(t`Couldn't archive that item.`),
  });

  const restore = useMutation({
    mutationFn: (id: string) => itemsApi.restore(wsId as string, id),
    onSuccess: invalidateItems,
    onError: () => retroToast.error(t`Couldn't restore that item.`),
  });

  const del = useMutation({
    mutationFn: ({ id, isArchived }: DeleteItemArg) => {
      // Defensive: delete is archived-only (ITEM-06). Reject BEFORE the call so
      // a UI bug can never hard-delete a live item.
      if (!isArchived) {
        return Promise.reject(new Error("Only archived items can be deleted."));
      }
      return itemsApi.del(wsId as string, id);
    },
    onSuccess: invalidateItems,
    onError: (err) => {
      // The archived-only guard surfaces a hint; a real network failure too.
      retroToast.error(
        err instanceof Error && err.message.includes("archived")
          ? t`Only archived items can be deleted.`
          : t`Couldn't delete that item.`,
      );
    },
  });

  return { archive, restore, del };
}
