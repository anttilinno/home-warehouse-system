import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import {
  repairAttachmentsApi,
  type CreateAttachmentBody,
} from "@/lib/api/repairAttachments";
import { retroToast } from "@/components/retro";

// Phase 10b Plan 03 — repair attachment reads + LINK-ONLY writes (RPR-04). The
// list query is keyed ["repairs", wsId, repairId, "attachments"] (LOCKED). create
// registers an EXISTING file_id (no byte upload — the byte-storage path is a
// pre-existing project-wide backend stub, logged as a residue). delete removes a
// row. Both invalidate the attachments key; failures surface a persistent toast.

/**
 * Per-repair attachment list + link/delete mutations. The list returns a BARE
 * { items, total } envelope; `items` is exposed directly for the FILES panel.
 */
export function useRepairAttachments(wsId: string, repairId: string) {
  const { t } = useLingui();
  const queryClient = useQueryClient();
  const key = ["repairs", wsId, repairId, "attachments"];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const query = useQuery({
    queryKey: key,
    queryFn: () => repairAttachmentsApi.list(wsId, repairId),
    enabled: Boolean(wsId) && Boolean(repairId),
    retry: false,
  });

  const createAttachment = useMutation({
    mutationFn: (body: CreateAttachmentBody) =>
      repairAttachmentsApi.create(wsId, repairId, body),
    onSuccess: invalidate,
    // The dialog surfaces a contextual link error toast; this is the safety net.
    onError: () => retroToast.error(t`Couldn't attach this file.`),
  });

  const deleteAttachment = useMutation({
    mutationFn: (attachmentId: string) =>
      repairAttachmentsApi.del(wsId, repairId, attachmentId),
    onSuccess: invalidate,
    onError: () => retroToast.error(t`Couldn't delete this file.`),
  });

  return {
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    createAttachment,
    deleteAttachment,
  };
}
