import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get } from "@/lib/api";
import type { SessionResponse } from "@/lib/types";
import {
  BevelButton,
  RetroBadge,
  RetroConfirmDialog,
  RetroEmptyState,
  RetroTable,
  Window,
  retroToast,
} from "@/components/retro";

// SecurityPage (05-UI-SPEC §5a) — three stacked cards: Active Sessions (Card A),
// Password (Card B), Danger Zone (Card C). Every surface is a thin form over an
// already-complete backend endpoint; the work is calling the right endpoint and
// surfacing the right error. Cards B + C land in commit B of this task.

// Friendly relative timestamp ("3 min ago"); full ISO stays on the title hover.
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

export function SecurityPage() {
  return (
    <div className="grid gap-sp-5">
      <SessionsCard />
    </div>
  );
}

// --- Card A: Active Sessions ---
function SessionsCard() {
  const { t } = useLingui();
  const queryClient = useQueryClient();
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);

  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: () => get<SessionResponse[]>("/users/me/sessions"),
  });

  const revokeOne = useMutation({
    mutationFn: (id: string) => del(`/users/me/sessions/${id}`),
    onSuccess: () => {
      retroToast.success(t`Session revoked.`);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });

  const revokeAllOthers = useMutation({
    mutationFn: () => del("/users/me/sessions"),
    onSuccess: () => {
      retroToast.success(t`All other sessions revoked.`);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });

  const rows = sessions.data ?? [];
  const others = rows.filter((s) => !s.is_current);
  // Disable revoke-all when there is nothing but the current session.
  const revokeAllDisabled = others.length === 0 || revokeAllOthers.isPending;

  return (
    <Window title={<Trans>Sessions</Trans>} bodyClassName="">
      {sessions.isPending ? (
        <p className="p-sp-4 text-[13px] text-fg-muted">
          <Trans>Loading sessions…</Trans>
        </p>
      ) : rows.length === 0 ? (
        <div className="p-sp-4">
          <RetroEmptyState
            heading={<Trans>No sessions</Trans>}
            body={<Trans>No other sessions.</Trans>}
          />
        </div>
      ) : (
        <RetroTable>
          <thead>
            <tr>
              <th scope="col" className="text-left">
                <Trans>Device</Trans>
              </th>
              <th scope="col" className="text-left">
                <Trans>IP</Trans>
              </th>
              <th scope="col" className="text-left">
                <Trans>Last active</Trans>
              </th>
              <th scope="col" className="text-right">
                <span className="sr-only">
                  <Trans>Actions</Trans>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} aria-selected={s.is_current || undefined}>
                <td className="py-sp-3">
                  <span className="flex items-center gap-sp-2">
                    <span className="text-[14px] text-fg-ink">
                      {s.device_info}
                    </span>
                    {s.is_current && (
                      <RetroBadge variant="info">
                        <Trans>THIS DEVICE</Trans>
                      </RetroBadge>
                    )}
                  </span>
                </td>
                <td className="mono py-sp-3 text-[12px] text-fg-muted">
                  {s.ip_address ?? "—"}
                </td>
                <td
                  className="mono py-sp-3 text-[12px]"
                  title={new Date(s.last_active_at).toISOString()}
                >
                  {s.is_current ? (
                    <span className="text-accent-mint-deep">
                      <Trans>active now</Trans>
                    </span>
                  ) : (
                    relativeTime(s.last_active_at)
                  )}
                </td>
                <td className="py-sp-3 text-right">
                  {!s.is_current && (
                    <BevelButton
                      aria-label={t`Revoke session on ${s.device_info}`}
                      disabled={revokeOne.isPending}
                      onClick={() => revokeOne.mutate(s.id)}
                    >
                      <Trans>Revoke</Trans>
                    </BevelButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </RetroTable>
      )}

      {/* Revoke-all-others footer strip (recessed). */}
      <div className="flex justify-end border-t-2 border-border-ink bg-bg-panel-2 px-sp-4 py-sp-3">
        <BevelButton
          variant="danger"
          disabled={revokeAllDisabled}
          onClick={() => setConfirmAllOpen(true)}
        >
          <Trans>Revoke all other sessions</Trans>
        </BevelButton>
      </div>

      <RetroConfirmDialog
        open={confirmAllOpen}
        title={<Trans>Revoke all other sessions</Trans>}
        confirmLabel={<Trans>Revoke all</Trans>}
        onCancel={() => setConfirmAllOpen(false)}
        onClose={() => setConfirmAllOpen(false)}
        onConfirm={() => {
          setConfirmAllOpen(false);
          revokeAllOthers.mutate();
        }}
      >
        <Trans>
          Sign out everywhere else? Other devices will need to log in again.
        </Trans>
      </RetroConfirmDialog>
    </Window>
  );
}
