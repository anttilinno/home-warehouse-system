import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, patch, HttpError, setRefreshToken } from "@/lib/api";
import type {
  CanDeleteResponse,
  SessionResponse,
  User,
} from "@/lib/types";
import {
  BevelButton,
  RetroBadge,
  RetroConfirmDialog,
  RetroEmptyState,
  RetroFormField,
  RetroInput,
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
  // has_password (from GET /users/me) drives the password card's change-vs-set
  // branch. Fetched once here and shared with the card.
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => get<User>("/users/me"),
  });

  return (
    <div className="grid gap-sp-5">
      <SessionsCard />
      <PasswordCard hasPassword={me.data?.has_password ?? true} />
      <DangerZoneCard />
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

// --- Card B: Password (change vs set, driven by has_password) ---
const passwordSchema = z
  .object({
    current_password: z.string().optional(),
    new_password: z.string().min(8),
    confirm_password: z.string(),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    path: ["confirm_password"],
    message: "mismatch",
  });

type PasswordForm = z.infer<typeof passwordSchema>;

function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const { t } = useLingui();
  // Inline band shown when the backend rejects the current password (400).
  const [wrongCurrent, setWrongCurrent] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const submit = handleSubmit(async (values) => {
    setWrongCurrent(false);
    // Set-password path (OAuth-only, has_password=false) omits current_password
    // entirely — the backend UpdatePassword accepts that (05-RESEARCH Q1).
    const body = hasPassword
      ? {
          current_password: values.current_password,
          new_password: values.new_password,
        }
      : { new_password: values.new_password };
    try {
      await patch("/users/me/password", body);
      retroToast.success(t`Password updated.`);
      reset();
    } catch (err) {
      if (err instanceof HttpError && err.status === 400) {
        setWrongCurrent(true);
        return;
      }
      throw err;
    }
  });

  return (
    <Window title={<Trans>Password</Trans>} bodyClassName="grid gap-sp-4 p-sp-4">
      {!hasPassword && (
        <p
          role="note"
          className="border-2 border-border-ink bg-titlebar-butter px-sp-3 py-sp-2 text-[13px] text-fg-ink"
        >
          <Trans>
            You signed in with a provider and haven't set a password yet. Add one
            to enable email + password login.
          </Trans>
        </p>
      )}

      {wrongCurrent && (
        <p
          role="alert"
          className="border-2 border-danger bg-danger-bg px-sp-3 py-sp-2 text-[13px] font-semibold text-danger"
        >
          <Trans>Current password is incorrect.</Trans>
        </p>
      )}

      <form onSubmit={submit} className="grid gap-sp-4" noValidate>
        {hasPassword && (
          <RetroInput
            label={<Trans>Current password</Trans>}
            type="password"
            mono
            {...register("current_password")}
          />
        )}
        <RetroFormField
          label={<Trans>New password</Trans>}
          hint={<Trans>At least 8 characters.</Trans>}
          error={
            errors.new_password && <Trans>Use at least 8 characters.</Trans>
          }
        >
          {(id, describedBy) => (
            <input
              id={id}
              type="password"
              aria-invalid={errors.new_password ? true : undefined}
              aria-describedby={describedBy}
              className="w-full border-2 border-border-ink bg-bg-panel px-[10px] py-[7px] font-mono text-[14px] text-fg-ink bevel-sunken focus:outline-3 focus:outline-offset-1 focus:outline-titlebar-blue"
              {...register("new_password")}
            />
          )}
        </RetroFormField>
        <RetroFormField
          label={<Trans>Confirm new password</Trans>}
          error={
            errors.confirm_password && <Trans>Passwords don't match.</Trans>
          }
        >
          {(id, describedBy) => (
            <input
              id={id}
              type="password"
              aria-invalid={errors.confirm_password ? true : undefined}
              aria-describedby={describedBy}
              className="w-full border-2 border-border-ink bg-bg-panel px-[10px] py-[7px] font-mono text-[14px] text-fg-ink bevel-sunken focus:outline-3 focus:outline-offset-1 focus:outline-titlebar-blue"
              {...register("confirm_password")}
            />
          )}
        </RetroFormField>
        <div className="flex justify-end">
          <BevelButton type="submit" variant="primary" disabled={isSubmitting}>
            {hasPassword ? (
              <Trans>Change password</Trans>
            ) : (
              <Trans>Set password</Trans>
            )}
          </BevelButton>
        </div>
      </form>
    </Window>
  );
}

// --- Card C: Danger Zone (account deletion behind a type-DELETE gate) ---
function DangerZoneCard() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const canDelete = useQuery({
    queryKey: ["can-delete"],
    queryFn: () => get<CanDeleteResponse>("/users/me/can-delete"),
  });

  const deleteAccount = useMutation({
    mutationFn: () => del("/users/me"),
    onSuccess: () => {
      // Mirror useLogout's client cleanup: the account is gone, so drop all
      // client auth state and bounce to /login.
      setRefreshToken(null);
      localStorage.removeItem("workspace_id");
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });

  const blocked = canDelete.data?.can_delete === false;
  const blockingNames = (canDelete.data?.blocking_workspaces ?? [])
    .map((w) => w.name)
    .join(", ");
  // Type-DELETE gate (UX friction only — backend is authoritative; T-05-20).
  const confirmEnabled = typed.trim().toUpperCase() === "DELETE";

  return (
    <Window title={<Trans>Danger Zone</Trans>} titlebarVariant="pink">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-warn-deep">
        <Trans>Delete account</Trans>
      </p>
      <p className="mt-sp-2 text-[14px] text-fg-ink">
        <Trans>Deleting your account is permanent and cannot be undone.</Trans>
      </p>

      {blocked && (
        <p
          role="alert"
          className="mt-sp-3 border-2 border-danger bg-danger-bg px-sp-3 py-sp-2 text-[13px] font-semibold text-danger"
        >
          <Trans>
            You're the sole owner of: {blockingNames}. Transfer ownership or
            delete these workspaces before deleting your account.
          </Trans>
        </p>
      )}

      <div className="mt-sp-4 flex justify-end">
        <BevelButton
          variant="danger"
          disabled={blocked || canDelete.isPending}
          onClick={() => {
            setTyped("");
            setDialogOpen(true);
          }}
        >
          <Trans>Delete my account</Trans>
        </BevelButton>
      </div>

      <RetroConfirmDialog
        open={dialogOpen}
        title={<Trans>Delete account</Trans>}
        confirmLabel={<Trans>Delete account</Trans>}
        // Type-DELETE gate: the confirm stays disabled until the input matches.
        confirmDisabled={!confirmEnabled}
        onCancel={() => setDialogOpen(false)}
        onClose={() => setDialogOpen(false)}
        onConfirm={() => {
          if (!confirmEnabled) return;
          setDialogOpen(false);
          deleteAccount.mutate();
        }}
      >
        <span className="grid gap-sp-3">
          <Trans>
            Type DELETE to confirm. This permanently removes your account and
            cannot be undone.
          </Trans>
          <input
            aria-label={t`Type DELETE to confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="w-full border-2 border-border-ink bg-bg-panel px-[10px] py-[7px] font-mono text-[14px] text-fg-ink bevel-sunken focus:outline-3 focus:outline-offset-1 focus:outline-titlebar-blue"
          />
        </span>
      </RetroConfirmDialog>
    </Window>
  );
}
