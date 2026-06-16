import { useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import {
  BevelButton,
  RetroCheckbox,
  RetroInput,
  Window,
} from "@/components/retro";
import { HttpError } from "@/lib/api";
import { paperlessApi, type PaperlessDocument } from "@/lib/api/paperless";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { usePaperlessSettings } from "./hooks/usePaperlessSettings";

// Phase 14b Plan 04 — PaperlessPage (PPL-01 connection settings + PPL-02
// document search). Mirrors the Phase-12 settings-page shape (useQuery +
// useMutation + Window + BevelButton + retroToast + Lingui). This plan only
// EXPORTS the page — registering the /settings/paperless route and the landing
// row is 14b-05's single-writer job.
//
// LANDMINE FOUND-02: no sync/idb/offline substrings in any name here.

export function PaperlessPage() {
  const { t } = useLingui();
  const { currentWorkspaceId: wsId } = useWorkspace();
  const { settings, isLoading, save, remove } = usePaperlessSettings(wsId);

  // Connection form state, re-baselined when settings resolve.
  const [baseUrl, setBaseUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [syncTagsEnabled, setSyncTagsEnabled] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setBaseUrl(settings.base_url ?? "");
    setIsEnabled(settings.is_enabled);
    setSyncTagsEnabled(settings.sync_tags_enabled);
    setApiToken(""); // never prefill the write-only token
  }, [settings]);

  const handleSave = () => {
    save.mutate({
      base_url: baseUrl.trim(),
      // Omit the token when blank so the backend keeps the stored one.
      api_token: apiToken.trim() ? apiToken.trim() : undefined,
      is_enabled: isEnabled,
      sync_tags_enabled: syncTagsEnabled,
    });
  };

  const configured = settings?.configured ?? false;
  const searchable = configured && (settings?.is_enabled ?? false);

  return (
    <div className="grid gap-sp-4">
      <Window
        title={<Trans>Paperless connection</Trans>}
        bodyClassName="grid gap-sp-4 p-sp-4"
      >
        {isLoading ? (
          <p className="text-14 text-fg-muted">
            <Trans>Loading…</Trans>
          </p>
        ) : (
          <>
            <RetroInput
              label={<Trans>Paperless URL</Trans>}
              value={baseUrl}
              mono
              placeholder="https://paperless.example"
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <RetroInput
              label={<Trans>API token</Trans>}
              type="password"
              value={apiToken}
              mono
              placeholder={
                settings?.has_token
                  ? t`••••••• (stored — leave blank to keep)`
                  : t`Paste your Paperless API token`
              }
              onChange={(e) => setApiToken(e.target.value)}
            />
            <RetroCheckbox
              checked={isEnabled}
              onChange={() => setIsEnabled((v) => !v)}
              label={<Trans>Enable Paperless integration</Trans>}
            />
            <RetroCheckbox
              checked={syncTagsEnabled}
              onChange={() => setSyncTagsEnabled((v) => !v)}
              label={<Trans>Mirror Paperless tags</Trans>}
            />

            <div className="flex justify-end gap-sp-2">
              {configured && (
                <BevelButton
                  type="button"
                  variant="danger"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate()}
                >
                  <Trans>Disconnect</Trans>
                </BevelButton>
              )}
              <BevelButton
                type="button"
                variant="primary"
                disabled={save.isPending || baseUrl.trim().length === 0}
                onClick={handleSave}
              >
                <Trans>Save</Trans>
              </BevelButton>
            </div>
          </>
        )}
      </Window>

      <PaperlessSearch wsId={wsId} enabled={searchable} />
    </div>
  );
}

// PPL-02 — embedded document search. Disabled until Paperless is configured AND
// enabled. A 409 (not configured/enabled) or 502 (bad token / unreachable)
// surfaces a contextual inline message.
function PaperlessSearch({
  wsId,
  enabled,
}: Readonly<{
  wsId: string | null;
  enabled: boolean;
}>) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  const search = useQuery({
    queryKey: ["paperless", wsId, "search", query],
    queryFn: () => paperlessApi.search(wsId as string, query),
    enabled: Boolean(wsId) && enabled && query.trim().length > 0,
    retry: false,
  });

  const errorMessage = (() => {
    const err = search.error;
    if (!(err instanceof HttpError)) return null;
    if (err.status === 409) {
      return <Trans>Configure and enable Paperless first.</Trans>;
    }
    if (err.status === 502) {
      return <Trans>Paperless is unreachable — check the URL and token.</Trans>;
    }
    return <Trans>Search failed. Try again.</Trans>;
  })();

  const results: PaperlessDocument[] = search.data?.results ?? [];

  return (
    <Window
      title={<Trans>Search documents</Trans>}
      bodyClassName="grid gap-sp-4 p-sp-4"
    >
      {!enabled && (
        <p className="text-14 text-fg-muted">
          <Trans>Enable Paperless above to search documents.</Trans>
        </p>
      )}

      <form
        className="flex items-end gap-sp-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(draft);
        }}
      >
        <div className="flex-1">
          <RetroInput
            label={<Trans>Search Paperless</Trans>}
            value={draft}
            disabled={!enabled}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
        <BevelButton
          type="submit"
          variant="primary"
          disabled={!enabled || draft.trim().length === 0 || search.isFetching}
        >
          <Trans>Search</Trans>
        </BevelButton>
      </form>

      {search.isFetching && (
        <p className="text-14 text-fg-muted">
          <Trans>Searching…</Trans>
        </p>
      )}

      {errorMessage && <p className="text-14 text-danger">{errorMessage}</p>}

      {!search.isFetching &&
        !errorMessage &&
        query.trim().length > 0 &&
        results.length === 0 && (
          <p className="text-14 text-fg-muted">
            <Trans>No documents matched.</Trans>
          </p>
        )}

      {results.length > 0 && (
        <ul className="grid gap-sp-2">
          {results.map((doc) => (
            <li
              key={doc.id}
              className="border-2 border-border-ink bg-bg-panel px-sp-3 py-sp-2"
            >
              <span className="block text-14 font-bold text-fg-ink">
                {doc.title}
              </span>
              {doc.created && (
                <span className="block font-mono text-12 text-fg-muted">
                  {doc.created}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Window>
  );
}
