import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/api/settings";
import type { User } from "@/lib/types";
import {
  BevelButton,
  RetroConfirmDialog,
  RetroFileInput,
  retroToast,
} from "@/components/retro";

// Phase 12 Plan 03 — AvatarUploader (SETT-02). A DEDICATED single-file
// multipart avatar uploader, deliberately NOT PhotoUpload (which carries the
// item queue / dup-check / gallery dead weight). It owns the ["me"] query
// itself so it stays self-contained: it reads avatar_url + full_name for the
// preview and uses the query's dataUpdatedAt to cache-bust the <img> src — the
// avatar_url is a STABLE URL ("/api/users/me/avatar"), so without ?v= the
// browser would show the stale image after an upload (Pitfall 7).

// Up to two initials from the name (ProviderTile idiom, AccountsPage:44-53).
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // mirror the server cap (handler.go:659-665)

export function AvatarUploader() {
  const { t } = useLingui();
  const queryClient = useQueryClient();
  const [confirmRemove, setConfirmRemove] = useState(false);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => settingsApi.getMe(),
  });

  const invalidateMe = () =>
    queryClient.invalidateQueries({ queryKey: ["me"] });

  const upload = useMutation({
    mutationFn: (file: File) => settingsApi.uploadAvatar(file),
    onSuccess: () => {
      retroToast.success(t`Photo updated.`);
      invalidateMe();
    },
    onError: () => {
      retroToast.error(t`Couldn't upload the photo. Try again.`);
    },
  });

  const remove = useMutation({
    mutationFn: () => settingsApi.deleteAvatar(),
    onSuccess: () => {
      retroToast.success(t`Photo removed.`);
      invalidateMe();
    },
    onError: () => {
      retroToast.error(t`Couldn't remove the photo. Try again.`);
    },
  });

  const avatarUrl = me.data?.avatar_url ?? null;
  const fullName = me.data?.full_name ?? "";
  // Cache-bust: the avatar_url is stable, so version it with the query's last
  // update timestamp. Changes on every successful invalidation refetch.
  const cacheBustedSrc =
    avatarUrl == null ? null : `${avatarUrl}?v=${me.dataUpdatedAt}`;

  const busy = upload.isPending || remove.isPending;

  return (
    <div className="flex flex-col gap-sp-3 sm:flex-row sm:items-start sm:gap-sp-4">
      {/* 150×150 preview: cache-busted <img> or an initials placeholder. */}
      {cacheBustedSrc ? (
        <img
          src={cacheBustedSrc}
          alt={t`Your profile`}
          width={150}
          height={150}
          className="h-[150px] w-[150px] flex-none border border-border-ink object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid h-[150px] w-[150px] flex-none place-items-center border border-border-ink bg-bg-panel-2 font-display text-40 uppercase leading-none text-fg-ink"
        >
          {initialsOf(fullName)}
        </span>
      )}

      <div className="flex flex-1 flex-col gap-sp-2">
        <RetroFileInput
          label={<Trans>Change photo…</Trans>}
          accept="image/jpeg,image/png,image/webp"
          maxSize={MAX_AVATAR_BYTES}
          multiple={false}
          disabled={busy}
          onChange={(files) => {
            const file = files[0];
            if (file) upload.mutate(file);
          }}
        />
        <p className="text-12 text-fg-muted">
          <Trans>PNG/JPG · max 5 MB</Trans>
        </p>
        {avatarUrl != null && (
          <div>
            <BevelButton
              variant="danger"
              disabled={busy}
              onClick={() => setConfirmRemove(true)}
            >
              <Trans>Remove</Trans>
            </BevelButton>
          </div>
        )}
      </div>

      <RetroConfirmDialog
        open={confirmRemove}
        title={<Trans>Remove photo</Trans>}
        confirmLabel={<Trans>Remove</Trans>}
        onCancel={() => setConfirmRemove(false)}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false);
          remove.mutate();
        }}
      >
        <Trans>
          Remove photo? Your profile will show your initials instead.
        </Trans>
      </RetroConfirmDialog>
    </div>
  );
}

// Re-export the User type touchpoint for callers that want the avatar fields.
export type AvatarUser = Pick<User, "avatar_url" | "full_name">;
