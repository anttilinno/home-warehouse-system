import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import {
  paperlessApi,
  type PaperlessSettings,
  type PaperlessSettingsInput,
} from "@/lib/api/paperless";
import { retroToast } from "@/components/retro";

// Phase 14b Plan 04 — PPL-01 connection settings hook. The settings query is
// keyed ["paperless", wsId, "settings"]; save (PUT) + delete both invalidate it.
// Errors surface a persistent toast (the page also renders an inline error).

export function usePaperlessSettings(wsId: string | null) {
  const { t } = useLingui();
  const queryClient = useQueryClient();
  const key = ["paperless", wsId, "settings"];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const query = useQuery({
    queryKey: key,
    queryFn: () => paperlessApi.getSettings(wsId as string),
    enabled: Boolean(wsId),
    retry: false,
  });

  const save = useMutation({
    mutationFn: (body: PaperlessSettingsInput) =>
      paperlessApi.saveSettings(wsId as string, body),
    onSuccess: (_settings: PaperlessSettings) => {
      invalidate();
      retroToast.success(t`Paperless settings saved.`);
    },
    onError: () => retroToast.error(t`Couldn't save Paperless settings.`),
  });

  const remove = useMutation({
    mutationFn: () => paperlessApi.deleteSettings(wsId as string),
    onSuccess: () => {
      invalidate();
      retroToast.success(t`Paperless disconnected.`);
    },
    onError: () => retroToast.error(t`Couldn't disconnect Paperless.`),
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    save,
    remove,
  };
}
