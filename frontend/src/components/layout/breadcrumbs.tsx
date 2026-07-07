import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";

// Breadcrumb model (B1/B2). A crumb is a translated label plus an optional
// link target for ancestor crumbs; the leaf renders as a plain aria-current
// span in PageHeader regardless of `to`. Labels are <Trans> elements (normal
// case — the uppercase is CSS in PageHeader, not content) so they extract into
// the i18n catalog and stay in sync with the sidebar group names.
export type Crumb = { label: ReactNode; to?: string };

const GROUPS = {
  overview: { label: <Trans>Overview</Trans>, to: "/" },
  inventory: { label: <Trans>Inventory</Trans>, to: "/items" },
  planning: { label: <Trans>Planning</Trans>, to: "/maintenance/due" },
  system: { label: <Trans>System</Trans>, to: "/settings" },
} as const;

type GroupKey = keyof typeof GROUPS;

// Section bases → owning group + leaf label. Longest bases first so
// "/maintenance/due" wins over any shorter prefix; matched by exact-or-`/child`.
const SECTIONS: ReadonlyArray<{
  base: string;
  group: GroupKey;
  label: ReactNode;
}> = [
  {
    base: "/maintenance/due",
    group: "planning",
    label: <Trans>Due Maintenance</Trans>,
  },
  {
    base: "/sync-history",
    group: "system",
    label: <Trans>Sync History</Trans>,
  },
  { base: "/my-changes", group: "system", label: <Trans>My Changes</Trans> },
  { base: "/analytics", group: "overview", label: <Trans>Analytics</Trans> },
  { base: "/borrowers", group: "inventory", label: <Trans>Borrowers</Trans> },
  { base: "/inventory", group: "inventory", label: <Trans>Inventory</Trans> },
  { base: "/approvals", group: "system", label: <Trans>Approvals</Trans> },
  { base: "/declutter", group: "planning", label: <Trans>Declutter</Trans> },
  { base: "/wishlist", group: "planning", label: <Trans>Wishlist</Trans> },
  { base: "/taxonomy", group: "inventory", label: <Trans>Taxonomy</Trans> },
  { base: "/settings", group: "system", label: <Trans>Settings</Trans> },
  { base: "/imports", group: "system", label: <Trans>Imports</Trans> },
  { base: "/scan", group: "overview", label: <Trans>Scan</Trans> },
  { base: "/loans", group: "inventory", label: <Trans>Loans</Trans> },
  { base: "/items", group: "inventory", label: <Trans>Items</Trans> },
];

const SETTINGS_SUB: Record<string, ReactNode> = {
  security: <Trans>Security</Trans>,
  accounts: <Trans>Accounts</Trans>,
  profile: <Trans>Profile</Trans>,
  appearance: <Trans>Appearance</Trans>,
  language: <Trans>Language</Trans>,
  formats: <Trans>Formats</Trans>,
  notifications: <Trans>Notifications</Trans>,
  data: <Trans>Data & Storage</Trans>,
  members: <Trans>Members</Trans>,
  paperless: <Trans>Paperless</Trans>,
};

const TAXONOMY_TABS: Record<string, ReactNode> = {
  locations: <Trans>Locations</Trans>,
  containers: <Trans>Containers</Trans>,
  categories: <Trans>Categories</Trans>,
};

// Leaf modifier for the entity sub-routes (/new, /:id, /:id/edit, /expiring).
// null → the section itself is the leaf (list route).
function leafModifier(rest: string): ReactNode | null {
  if (rest === "") return null;
  if (rest === "/new") return <Trans>New</Trans>;
  if (rest === "/expiring") return <Trans>Expiring</Trans>;
  if (rest.endsWith("/edit")) return <Trans>Edit</Trans>;
  return <Trans>Detail</Trans>;
}

// Build the breadcrumb chain for a pathname (+ search for the ?tab taxonomy
// leaf). Longest-prefix match against SECTIONS; unmatched paths fall back to the
// OVERVIEW root so the header always has a label.
export function buildCrumbs(pathname: string, search = ""): Crumb[] {
  if (pathname === "/") {
    return [
      { label: GROUPS.overview.label, to: "/" },
      { label: <Trans>Dashboard</Trans> },
    ];
  }

  const section = SECTIONS.find(
    (s) => pathname === s.base || pathname.startsWith(`${s.base}/`),
  );
  if (!section) return [{ label: GROUPS.overview.label, to: "/" }];

  const group = GROUPS[section.group];
  const rest = pathname.slice(section.base.length);
  const crumbs: Crumb[] = [{ label: group.label, to: group.to }];

  // Taxonomy list route: the leaf is the active ?tab (Locations/Containers/…).
  if (section.base === "/taxonomy" && rest === "") {
    const tab = new URLSearchParams(search).get("tab") ?? "categories";
    crumbs.push({ label: TAXONOMY_TABS[tab] ?? section.label });
    return crumbs;
  }

  // Settings named subpages: SYSTEM › SETTINGS › <subpage>.
  if (section.base === "/settings" && rest.startsWith("/")) {
    crumbs.push({ label: section.label, to: section.base });
    crumbs.push({ label: SETTINGS_SUB[rest.slice(1)] ?? section.label });
    return crumbs;
  }

  const mod = leafModifier(rest);
  if (mod === null) {
    crumbs.push({ label: section.label });
  } else {
    crumbs.push({ label: section.label, to: section.base });
    crumbs.push({ label: mod });
  }
  return crumbs;
}
