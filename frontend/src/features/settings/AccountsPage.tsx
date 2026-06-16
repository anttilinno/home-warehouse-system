import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, HttpError } from "@/lib/api";
import type { OAuthAccount, OAuthAccountsResponse, User } from "@/lib/types";
import {
  BevelButton,
  RetroBadge,
  RetroConfirmDialog,
  StatusPill,
  Window,
  retroToast,
} from "@/components/retro";

// AccountsPage (05-UI-SPEC §5b, AUTH-10) — Connected Accounts. One row per
// supported provider (Google, GitHub), reconciling GET /auth/oauth/accounts
// against the supported set. Linked → LINKED pill + Unlink (pink confirm →
// DELETE); not linked → NOT LINKED pill + Link (full-page nav to the initiate
// path). The last-method lockout guard (canUnlink) mirrors the backend's
// authoritative ErrCannotUnlinkLastAuth 409 (T-05-21): the client guard is UX —
// if the backend still 409s, a danger toast surfaces (defense in depth).

interface Provider {
  id: string;
  label: string;
  initial: string;
}

const PROVIDERS: Provider[] = [
  { id: "google", label: "Google", initial: "G" },
  { id: "github", label: "GitHub", initial: "GH" },
];

// Full-page redirect — OAuth initiate cannot use the api client (needs a
// top-level navigation, not an XHR). Assigning `.href` is the testable seam.
function navigateTo(href: string): void {
  globalThis.location.href = href;
}

function ProviderTile({ initial }: Readonly<{ initial: string }>) {
  return (
    <span
      aria-hidden="true"
      className="grid h-[28px] w-[28px] flex-none place-items-center border border-border-ink bg-bg-panel font-display text-12 uppercase leading-none text-fg-ink"
    >
      {initial}
    </span>
  );
}

export function AccountsPage() {
  const { t } = useLingui();
  const queryClient = useQueryClient();
  const [unlinkTarget, setUnlinkTarget] = useState<Provider | null>(null);

  const accounts = useQuery({
    queryKey: ["oauth-accounts"],
    queryFn: () => get<OAuthAccountsResponse>("/auth/oauth/accounts"),
  });
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => get<User>("/users/me"),
  });

  const unlink = useMutation({
    mutationFn: (provider: string) => del(`/auth/oauth/accounts/${provider}`),
    onSuccess: (_data, provider) => {
      const label = PROVIDERS.find((p) => p.id === provider)?.label ?? provider;
      retroToast.success(t`${label} unlinked.`);
      queryClient.invalidateQueries({ queryKey: ["oauth-accounts"] });
    },
    onError: (err) => {
      // Backend is authoritative (T-05-21): a 409 means it's the only sign-in
      // method. Surface the danger toast even if the client guard missed it.
      if (err instanceof HttpError && err.status === 409) {
        retroToast.error(
          t`Can't unlink — it's your only sign-in method. Set a password first.`,
        );
        return;
      }
      retroToast.error(t`Couldn't unlink. Try again.`);
    },
  });

  const linked = accounts.data?.accounts ?? [];
  const linkedCount = linked.length;
  const hasPassword = me.data?.has_password ?? true;
  // Lockout guard mirror: unlinking is blocked only when this is the sole
  // sign-in method (one linked provider AND no password set).
  const canUnlink = !(linkedCount === 1 && !hasPassword);

  const linkedFor = (id: string): OAuthAccount | undefined =>
    linked.find((a) => a.provider === id);

  return (
    <Window title={<Trans>Connected Accounts</Trans>} bodyClassName="p-sp-4">
      {accounts.isPending ? (
        <p className="text-13 text-fg-muted">
          <Trans>Loading accounts…</Trans>
        </p>
      ) : (
        <ul className="grid">
          {PROVIDERS.map((provider) => {
            const account = linkedFor(provider.id);
            const isLinked = account != null;
            return (
              <li
                key={provider.id}
                className="flex items-center gap-sp-3 border-b border-table-rule py-sp-3 last:border-b-0"
              >
                <ProviderTile initial={provider.initial} />
                <span className="flex flex-col">
                  <span className="text-14 text-fg-ink">{provider.label}</span>
                  {account?.email || account?.display_name ? (
                    <span className="font-mono text-12 text-fg-muted">
                      {account.email ?? account.display_name}
                    </span>
                  ) : null}
                </span>
                <span className="flex-1" />
                {isLinked ? (
                  <StatusPill variant="ok">
                    <Trans>LINKED</Trans>
                  </StatusPill>
                ) : (
                  <RetroBadge variant="neutral">
                    <Trans>NOT LINKED</Trans>
                  </RetroBadge>
                )}
                {isLinked ? (
                  <UnlinkAction
                    provider={provider}
                    canUnlink={canUnlink}
                    onUnlink={() => setUnlinkTarget(provider)}
                  />
                ) : (
                  <BevelButton
                    onClick={() => navigateTo(`/api/auth/oauth/${provider.id}`)}
                  >
                    <Trans>Link</Trans>
                  </BevelButton>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <RetroConfirmDialog
        open={unlinkTarget != null}
        title={<Trans>Unlink {unlinkTarget?.label}</Trans>}
        confirmLabel={<Trans>Unlink</Trans>}
        onCancel={() => setUnlinkTarget(null)}
        onClose={() => setUnlinkTarget(null)}
        onConfirm={() => {
          const target = unlinkTarget;
          setUnlinkTarget(null);
          if (target) unlink.mutate(target.id);
        }}
      >
        <Trans>
          Unlink {unlinkTarget?.label}? You'll no longer be able to sign in with
          it.
        </Trans>
      </RetroConfirmDialog>
    </Window>
  );
}

function UnlinkAction({
  provider,
  canUnlink,
  onUnlink,
}: Readonly<{
  provider: Provider;
  canUnlink: boolean;
  onUnlink: () => void;
}>) {
  const noteId = `unlink-lock-${provider.id}`;
  if (!canUnlink) {
    return (
      <span className="flex flex-col items-end gap-sp-1">
        <BevelButton disabled aria-describedby={noteId}>
          <Trans>Unlink</Trans>
        </BevelButton>
        <span
          id={noteId}
          className="max-w-[220px] text-right text-12 text-warn-deep"
        >
          <Trans>
            This is your only way to sign in. Set a password first to unlink.
          </Trans>
        </span>
      </span>
    );
  }
  return (
    <BevelButton onClick={onUnlink}>
      <Trans>Unlink</Trans>
    </BevelButton>
  );
}
