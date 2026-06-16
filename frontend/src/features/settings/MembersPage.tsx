import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, HttpError } from "@/lib/api";
import { settingsApi } from "@/lib/api/settings";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { Member, User } from "@/lib/types";
import {
  BevelButton,
  RetroBadge,
  RetroConfirmDialog,
  RetroEmptyState,
  RetroInput,
  RetroSelect,
  RetroTable,
  Window,
  retroToast,
} from "@/components/retro";

// MembersPage (12-UI-SPEC §10, SETT-10) — one blue Window "MEMBERS".
// List (NAME / EMAIL / ROLE / actions) from ["members", wsId], enriched with
// email + full_name by the 12-01 backend. Per-row RetroSelect changes the role
// (PATCH /members/{user_id}); a pink RetroConfirmDialog removes a member
// (DELETE). A footer strip adds a member by email (POST {email, role}). The
// server is authoritative for own-role-change (400), last-owner removal (400),
// unregistered email (404) and already-member (400); the client mirrors the
// own-row guards for UX and surfaces the server error on a miss (AccountsPage
// 409 idiom).

const ROLES = ["owner", "admin", "member", "viewer"] as const;

function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

// Best-effort display name: full_name → email → a truncated user_id.
function memberName(m: Member): string {
  if (m.full_name) return m.full_name;
  if (m.email) return m.email;
  return `${m.user_id.slice(0, 8)}…`;
}

export function MembersPage() {
  const { t } = useLingui();
  const queryClient = useQueryClient();
  const { currentWorkspaceId: wsId } = useWorkspace();
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => get<User>("/users/me"),
  });

  const members = useQuery({
    queryKey: ["members", wsId],
    queryFn: () => settingsApi.listMembers(wsId as string),
    enabled: wsId != null,
  });

  const invalidateMembers = () =>
    queryClient.invalidateQueries({ queryKey: ["members", wsId] });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      settingsApi.updateMemberRole(wsId as string, userId, role),
    onSuccess: () => {
      retroToast.success(t`Role updated.`);
      invalidateMembers();
    },
    onError: (err) => {
      // Server is authoritative (T-12-12): ErrCannotChangeOwnRole → 400.
      if (err instanceof HttpError && err.status === 400) {
        retroToast.error(t`Couldn't change role.`);
        return;
      }
      retroToast.error(t`Couldn't change role. Try again.`);
    },
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      settingsApi.removeMember(wsId as string, userId),
    onSuccess: () => {
      retroToast.success(t`Member removed.`);
      invalidateMembers();
    },
    onError: (err) => {
      // Server is authoritative (T-12-13): last-owner removal → 400.
      if (err instanceof HttpError && err.status === 400) {
        retroToast.error(t`Can't remove the last owner.`);
        return;
      }
      retroToast.error(t`Couldn't remove member. Try again.`);
    },
  });

  if (wsId == null) {
    return (
      <Window title={<Trans>Members</Trans>} bodyClassName="p-sp-4">
        <p className="text-13 text-fg-muted">
          <Trans>Select a workspace to manage its members.</Trans>
        </p>
      </Window>
    );
  }

  const rows = members.data?.items ?? [];
  const meId = me.data?.id;

  return (
    <Window title={<Trans>Members</Trans>} bodyClassName="">
      {members.isPending ? (
        <p className="p-sp-4 text-13 text-fg-muted">
          <Trans>Loading members…</Trans>
        </p>
      ) : rows.length === 0 ? (
        <div className="p-sp-4">
          <RetroEmptyState
            heading={<Trans>No members yet</Trans>}
            body={<Trans>Invite someone to share this workspace.</Trans>}
          />
        </div>
      ) : (
        <RetroTable>
          <thead>
            <tr>
              <th scope="col" className="text-left">
                <Trans>Name</Trans>
              </th>
              <th scope="col" className="text-left">
                <Trans>Email</Trans>
              </th>
              <th scope="col" className="text-left">
                <Trans>Role</Trans>
              </th>
              <th scope="col" className="text-right">
                <span className="sr-only">
                  <Trans>Actions</Trans>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const isSelf = meId != null && m.user_id === meId;
              const name = memberName(m);
              return (
                <tr key={m.id} aria-selected={isSelf || undefined}>
                  <td className="py-sp-3">
                    <span className="flex items-center gap-sp-2">
                      <span className="text-14 text-fg-ink">{name}</span>
                      {isSelf && (
                        <RetroBadge variant="info">
                          <Trans>YOU</Trans>
                        </RetroBadge>
                      )}
                    </span>
                  </td>
                  <td className="mono py-sp-3 text-12 text-fg-muted">
                    {m.email ?? "—"}
                  </td>
                  <td className="py-sp-3">
                    <RetroSelect
                      label={
                        <span className="sr-only">
                          <Trans>Role for {name}</Trans>
                        </span>
                      }
                      value={m.role}
                      // Own role is server-authoritative (T-12-12): the select
                      // is disabled for self so the user can't self-promote.
                      disabled={isSelf || changeRole.isPending}
                      onChange={(e) =>
                        changeRole.mutate({
                          userId: m.user_id,
                          role: e.target.value,
                        })
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </RetroSelect>
                  </td>
                  <td className="py-sp-3 text-right">
                    {!isSelf && (
                      <BevelButton
                        aria-label={t`Remove ${name}`}
                        title={t`Remove ${name}`}
                        disabled={removeMember.isPending}
                        onClick={() => setRemoveTarget(m)}
                      >
                        <Trans>Remove</Trans>
                      </BevelButton>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </RetroTable>
      )}

      <AddMemberStrip wsId={wsId} onAdded={invalidateMembers} />

      <RetroConfirmDialog
        open={removeTarget != null}
        title={
          <Trans>Remove {removeTarget ? memberName(removeTarget) : ""}</Trans>
        }
        confirmLabel={<Trans>Remove</Trans>}
        onCancel={() => setRemoveTarget(null)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          const target = removeTarget;
          setRemoveTarget(null);
          if (target) removeMember.mutate(target.user_id);
        }}
      >
        <Trans>
          Remove {removeTarget ? memberName(removeTarget) : ""} from this
          workspace? They'll lose access immediately.
        </Trans>
      </RetroConfirmDialog>
    </Window>
  );
}

// --- Add-by-email footer strip ---
const addSchema = z.object({
  email: z.string().email(),
  role: z.enum(ROLES),
});

type AddForm = z.infer<typeof addSchema>;

function AddMemberStrip({
  wsId,
  onAdded,
}: Readonly<{
  wsId: string;
  onAdded: () => void;
}>) {
  const { t } = useLingui();
  // Inline danger band for the 404 / 400 server responses (existence oracle
  // T-12-14 accepted; surfaced only to an authenticated admin).
  const [bandMessage, setBandMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddForm>({
    resolver: zodResolver(addSchema),
    defaultValues: { role: "member" },
  });

  const submit = handleSubmit(async (values) => {
    setBandMessage(null);
    try {
      await settingsApi.addMemberByEmail(wsId, {
        email: values.email,
        role: values.role,
      });
      retroToast.success(t`Member added.`);
      reset({ email: "", role: "member" });
      onAdded();
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) {
        setBandMessage(t`No registered user with that email.`);
        return;
      }
      if (err instanceof HttpError && err.status === 400) {
        setBandMessage(t`That user is already a member.`);
        return;
      }
      setBandMessage(t`Couldn't add member. Try again.`);
    }
  });

  return (
    <div className="border-t-2 border-border-ink bg-bg-panel-2 px-sp-4 py-sp-3">
      {bandMessage && (
        <p
          role="alert"
          className="mb-sp-3 border-2 border-danger bg-danger-bg px-sp-3 py-sp-2 text-13 font-semibold text-danger"
        >
          {bandMessage}
        </p>
      )}
      <form
        onSubmit={submit}
        className="flex flex-wrap items-end gap-sp-3"
        noValidate
      >
        <div className="min-w-[200px] flex-1">
          <RetroInput
            label={<Trans>Email</Trans>}
            type="email"
            mono
            placeholder={t`user@email…`}
            aria-invalid={errors.email ? true : undefined}
            error={errors.email && <Trans>Enter a valid email.</Trans>}
            {...register("email")}
          />
        </div>
        <div className="w-[140px]">
          <RetroSelect
            label={
              <span className="sr-only">
                <Trans>Role for new member</Trans>
              </span>
            }
            {...register("role")}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </RetroSelect>
        </div>
        <BevelButton type="submit" variant="primary" disabled={isSubmitting}>
          <Trans>Add</Trans>
        </BevelButton>
      </form>
    </div>
  );
}
