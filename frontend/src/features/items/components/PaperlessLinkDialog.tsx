import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BevelButton,
  RetroDialog,
  RetroInput,
  retroToast,
} from "@/components/retro";
import { HttpError, post } from "@/lib/api";
import { paperlessApi, type PaperlessDocument } from "@/lib/api/paperless";

// Phase 14b Plan 04 — PaperlessLinkDialog (PPL-03). Search Paperless, pick a
// document, LINK it to an item by creating an attachment via the EXISTING
// create-attachment endpoint with external_doc_id = String(doc.id). The
// dms_type is derived server-side ("paperless"); no new backend route.
//
// On success we invalidate ["items", wsId, itemId, "attachments"] — the EXACT
// tuple the 14b-03 attachment hook owns — so the linked doc surfaces in the
// item's attachment list. We call post() directly (rather than importing
// 14b-03's api/attachments.ts) to keep the two same-wave plans DISJOINT.
//
// LANDMINE FOUND-02: no sync/idb/offline substrings in any name here.

export interface PaperlessLinkDialogProps {
  wsId: string;
  itemId: string;
  open: boolean;
  onClose: () => void;
}

export function PaperlessLinkDialog({
  wsId,
  itemId,
  open,
  onClose,
}: PaperlessLinkDialogProps) {
  const { t } = useLingui();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PaperlessDocument | null>(null);

  const search = useQuery({
    queryKey: ["paperless", wsId, "link-search", query],
    queryFn: () => paperlessApi.search(wsId, query),
    enabled: open && query.trim().length > 0,
    retry: false,
  });

  const link = useMutation({
    mutationFn: (doc: PaperlessDocument) =>
      post(`/workspaces/${wsId}/items/${itemId}/attachments`, {
        attachment_type: "OTHER",
        title: doc.title,
        // Paperless ids are NUMBERS; the backend field is *string — stringify.
        external_doc_id: String(doc.id),
        file_id: null,
        is_primary: false,
      }),
    onSuccess: () => {
      // Same tuple 14b-03's attachment hook owns — hardcoded so the linked doc
      // appears in the item's attachment list.
      queryClient.invalidateQueries({
        queryKey: ["items", wsId, itemId, "attachments"],
      });
      retroToast.success(t`Document linked.`);
      handleClose();
    },
    onError: (err) => {
      const reason =
        err instanceof HttpError && err.status === 409
          ? t`Configure and enable Paperless first.`
          : err instanceof HttpError && err.status === 502
            ? t`Paperless is unreachable.`
            : t`Try again.`;
      retroToast.error(t`Couldn't link this document. ${reason}`);
    },
  });

  function handleClose() {
    setDraft("");
    setQuery("");
    setSelected(null);
    onClose();
  }

  const searchError = (() => {
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

  const results = search.data?.results ?? [];

  return (
    <RetroDialog
      open={open}
      onClose={handleClose}
      title={<Trans>LINK PAPERLESS DOCUMENT</Trans>}
      titlebarVariant="blue"
      footer={
        <>
          <BevelButton onClick={handleClose}>
            <Trans>CANCEL</Trans>
          </BevelButton>
          <BevelButton
            variant="primary"
            disabled={!selected || link.isPending}
            onClick={() => selected && link.mutate(selected)}
          >
            <Trans>LINK</Trans>
          </BevelButton>
        </>
      }
    >
      <form
        className="flex items-end gap-sp-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSelected(null);
          setQuery(draft);
        }}
      >
        <div className="flex-1">
          <RetroInput
            label={<Trans>Search Paperless</Trans>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
        <BevelButton
          type="submit"
          variant="primary"
          disabled={draft.trim().length === 0 || search.isFetching}
        >
          <Trans>Search</Trans>
        </BevelButton>
      </form>

      {search.isFetching && (
        <p className="text-14 text-fg-muted">
          <Trans>Searching…</Trans>
        </p>
      )}

      {searchError && <p className="text-14 text-danger">{searchError}</p>}

      {!search.isFetching &&
        !searchError &&
        query.trim().length > 0 &&
        results.length === 0 && (
          <p className="text-14 text-fg-muted">
            <Trans>No documents matched.</Trans>
          </p>
        )}

      {results.length > 0 && (
        <ul className="grid gap-sp-2">
          {results.map((doc) => {
            const isSelected = selected?.id === doc.id;
            return (
              <li key={doc.id}>
                <button
                  type="button"
                  onClick={() => setSelected(doc)}
                  aria-pressed={isSelected}
                  className={`w-full border-2 px-sp-3 py-sp-2 text-left ${
                    isSelected
                      ? "border-titlebar-blue bg-bg-pressed"
                      : "border-border-ink bg-bg-panel"
                  }`}
                >
                  <span className="block text-14 font-bold text-fg-ink">
                    {doc.title}
                  </span>
                  {doc.created && (
                    <span className="block font-mono text-12 text-fg-muted">
                      {doc.created}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </RetroDialog>
  );
}
