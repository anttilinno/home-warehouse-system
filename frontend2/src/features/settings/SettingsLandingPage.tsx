import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { RetroBadge, Window } from "@/components/retro";
import type { Member, OAuthAccountsResponse } from "@/lib/types";

// SettingsLandingPage (12-UI-SPEC §1, SETT-01) — the iOS/System-7 grouped-row
// landing that IS the Settings hub index (no redirect). Three group Windows
// (ACCOUNT / PREFERENCES / WORKSPACE), each a <ul> of <Link> rows with a
// trailing › chevron, mirroring the AccountsPage row idiom (border-b table-rule,
// last:border-b-0). NO leading icons (MANIFEST: icon style unresolved). Optional
// trailing counts come from EXISTING query keys and render ONLY when already
// cached (no spinner, no layout shift). The Paperless row is a disabled COMING
// SOON pointer to Phase 14b — it does NOT build the DMS.

interface LinkRowProps {
  to: string;
  label: ReactNode;
  trailing?: ReactNode;
}

// One grouped-row link. The whole row is the link (>=44px hit height); the
// trailing slot holds an optional current-value/count, then the chevron.
function LinkRow({ to, label, trailing }: LinkRowProps) {
  return (
    <li className="border-b border-table-rule last:border-b-0">
      <Link
        to={to}
        className="flex min-h-[44px] items-center justify-between gap-sp-3 px-sp-4 py-sp-3 text-[14px] text-fg-ink hover:bg-bg-panel-2"
      >
        <span>{label}</span>
        <span className="flex items-center gap-sp-2 text-fg-muted">
          {trailing}
          <span aria-hidden="true" className="text-fg-muted">
            ›
          </span>
        </span>
      </Link>
    </li>
  );
}

// The Paperless pointer row — a NON-link (aria-disabled) with a butter COMING
// SOON badge + "Set up in DMS" trailing copy. CONTEXT decision: pointer to
// Phase 14b, do NOT build DMS here.
function PaperlessRow() {
  return (
    <li className="border-b border-table-rule last:border-b-0">
      <div
        aria-disabled="true"
        className="flex min-h-[44px] cursor-not-allowed items-center justify-between gap-sp-3 px-sp-4 py-sp-3 text-[14px] text-fg-muted"
      >
        <span>
          <Trans>Paperless</Trans>
        </span>
        <span className="flex items-center gap-sp-2 text-fg-muted">
          <RetroBadge variant="warn">
            <Trans>COMING SOON</Trans>
          </RetroBadge>
          <span className="text-[12px]">
            <Trans>Set up in DMS</Trans>
          </span>
        </span>
      </div>
    </li>
  );
}

export function SettingsLandingPage() {
  const queryClient = useQueryClient();

  // Optional counts from EXISTING caches — render only when already loaded so
  // the landing never shows a spinner or shifts layout. oauth-accounts uses the
  // fixed ["oauth-accounts"] key; members is keyed by workspace, so we scan the
  // cache for any ["members", *] entry (the landing has no workspace context of
  // its own and must not force a fetch).
  const oauth = queryClient.getQueryData<OAuthAccountsResponse>([
    "oauth-accounts",
  ]);
  const linkedCount = oauth?.accounts?.length;

  const membersEntry = queryClient
    .getQueryCache()
    .findAll({ queryKey: ["members"] })
    .map((q) => q.state.data as { items?: Member[] } | undefined)
    .find((d) => d != null);
  const memberCount = membersEntry?.items?.length;

  return (
    <div className="grid gap-sp-5">
      <Window title={<Trans>ACCOUNT</Trans>} bodyClassName="p-0">
        <ul className="grid">
          <LinkRow to="profile" label={<Trans>Profile</Trans>} />
          <LinkRow to="security" label={<Trans>Security</Trans>} />
          <LinkRow
            to="accounts"
            label={<Trans>Connected Accounts</Trans>}
            trailing={
              linkedCount != null && linkedCount > 0 ? (
                <RetroBadge variant="info">
                  {linkedCount} <Trans>LINKED</Trans>
                </RetroBadge>
              ) : undefined
            }
          />
        </ul>
      </Window>

      <Window title={<Trans>PREFERENCES</Trans>} bodyClassName="p-0">
        <ul className="grid">
          <LinkRow to="appearance" label={<Trans>Appearance</Trans>} />
          <LinkRow to="language" label={<Trans>Language</Trans>} />
          <LinkRow to="formats" label={<Trans>Regional Formats</Trans>} />
          <LinkRow to="notifications" label={<Trans>Notifications</Trans>} />
        </ul>
      </Window>

      <Window title={<Trans>WORKSPACE</Trans>} bodyClassName="p-0">
        <ul className="grid">
          <LinkRow
            to="members"
            label={<Trans>Members</Trans>}
            trailing={
              memberCount != null ? (
                <RetroBadge variant="info">
                  {memberCount} <Trans>members</Trans>
                </RetroBadge>
              ) : undefined
            }
          />
          <LinkRow to="data" label={<Trans>Data &amp; Storage</Trans>} />
          <PaperlessRow />
        </ul>
      </Window>
    </div>
  );
}
