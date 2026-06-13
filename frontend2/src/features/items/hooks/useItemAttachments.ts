import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { itemAttachmentsApi } from "@/lib/api/attachments";
import { retroToast } from "@/components/retro";

// Phase 14b Plan 03 — item attachment reads + REAL multipart writes (ATT-01/02).
// The list query is keyed ["items", wsId, itemId, "attachments"] (LOCKED — 14b-04
// invalidates the SAME tuple, so it must match exactly). upload POSTs the actual
// bytes (FormData) to the 14b-02 byte route; setPrimary + delete mutate a row. All
// THREE mutations invalidate the list key (ATT-02 contract); failures surface a
// persistent toast (the dialog/panel also surface contextual messages).

/**
 * Per-item attachment list + upload/set-primary/delete mutations. The list
 * returns a BARE { items } envelope; `items` is exposed directly for the FILES
 * panel. All mutations invalidate ["items", wsId, itemId, "attachments"].
 */
export function useItemAttachments(wsId: string, itemId: string) {
  const { t } = useLingui();
  const queryClient = useQueryClient();
  const key = ["items", wsId, itemId, "attachments"];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const query = useQuery({
    queryKey: key,
    queryFn: () => itemAttachmentsApi.list(wsId, itemId),
    enabled: Boolean(wsId) && Boolean(itemId),
    retry: false,
  });

  const upload = useMutation({
    mutationFn: (form: FormData) =>
      itemAttachmentsApi.upload(wsId, itemId, form),
    onSuccess: invalidate,
    // The dialog surfaces a contextual upload error toast; this is the safety net.
    onError: () => retroToast.error(t`Couldn't upload this file.`),
  });

  const setPrimary = useMutation({
    mutationFn: (attachmentId: string) =>
      itemAttachmentsApi.setPrimary(wsId, itemId, attachmentId),
    onSuccess: invalidate,
    onError: () => retroToast.error(t`Couldn't set this file as primary.`),
  });

  const deleteAttachment = useMutation({
    mutationFn: (attachmentId: string) =>
      itemAttachmentsApi.del(wsId, attachmentId),
    onSuccess: invalidate,
    onError: () => retroToast.error(t`Couldn't delete this file.`),
  });

  return {
    items: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    upload,
    setPrimary,
    deleteAttachment,
  };
}
