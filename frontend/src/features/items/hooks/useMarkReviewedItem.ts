import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { itemsApi } from "@/lib/api/items";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { Item } from "@/lib/types";

// SCAN-11 — Mark Reviewed quick-action backing mutation. Clears the
// needs_review flag via the items PATCH (backend handler.go:419/765 accepts
// needs_review — verified, NOT a dead button / T-11-10). Invalidates BOTH the
// ["items", wsId] prefix (covers list + detail) AND the by-barcode key so a
// freshly-scanned MATCH banner re-resolves without the review flag.
export function useMarkReviewedItem() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const queryClient = useQueryClient();
  const { t } = useLingui();

  return useMutation({
    mutationFn: (id: string): Promise<Item> =>
      itemsApi.update(wsId as string, id, { needs_review: false }),
    onSuccess: () => {
      // Prefix-match (default exact:false) — covers list + every detail key.
      queryClient.invalidateQueries({ queryKey: ["items", wsId as string] });
      // The scan funnel resolves through ["item-by-barcode", wsId, code] —
      // invalidate that family too so the MATCH banner drops the review state.
      queryClient.invalidateQueries({
        queryKey: ["item-by-barcode", wsId as string],
      });
      retroToast.success(t`Item marked reviewed.`);
    },
    onError: () => retroToast.error(t`Couldn't mark this item reviewed.`),
  });
}
