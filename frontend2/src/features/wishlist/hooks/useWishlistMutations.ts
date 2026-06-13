import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  wishlistApi,
  type WishlistCreate,
  type WishlistItem,
  type WishlistUpdate,
} from "@/lib/api/wishlist";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 14 Plan 03 — wishlist create/update/remove mutations (WISH-02). Each
// onSuccess invalidates the ["wishlist", wsId] PREFIX (default exact:false) so
// every status-tab cache (["wishlist", wsId, "wanted"|"ordered"|"acquired"|"all"])
// is refetched after any write.
//
// The server validates status transitions (409 ErrInvalidStatusTransition). The
// mutationFn does NOT swallow the error — react-query surfaces it via the
// mutation's onError so the form can read HttpError.status === 409 and render a
// calm form-level message (T-14-07). No optimistic transition is assumed.

export interface UpdateWishlistArg {
  id: string;
  body: WishlistUpdate;
}

export function useWishlistMutations() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const queryClient = useQueryClient();

  function invalidatePrefix() {
    queryClient.invalidateQueries({ queryKey: ["wishlist", wsId as string] });
  }

  const create = useMutation({
    mutationFn: (body: WishlistCreate): Promise<WishlistItem> =>
      wishlistApi.create(wsId as string, body),
    onSuccess: invalidatePrefix,
  });

  const update = useMutation({
    mutationFn: ({ id, body }: UpdateWishlistArg): Promise<WishlistItem> =>
      wishlistApi.update(wsId as string, id, body),
    onSuccess: invalidatePrefix,
  });

  const remove = useMutation({
    mutationFn: (id: string): Promise<void> =>
      wishlistApi.remove(wsId as string, id),
    onSuccess: invalidatePrefix,
  });

  return { create, update, remove };
}
