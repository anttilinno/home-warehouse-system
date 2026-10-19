import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";

// Static "Routes" group for the command palette (TUI-05). The sidebar nav list
// (Sidebar.tsx) is NOT exported and is a single-writer file, so the palette owns
// its own ~17-entry route table here (CONTEXT.md §Palette content #1). Labels are
// Lingui message descriptors via `msg` so they extract into the catalog and get
// et/ru translations (Phase 15 guard fails CI on untranslated new msgids); the
// consumer resolves them with `i18n._(label)` / `t(label)` at render.
//
// LINT LANDMINE (FOUND-02): `palette`/`route` are SAFE substrings — nothing here
// is named `*sync*`/`*idb*`/`*offline*`.

export interface PaletteRoute {
  /** Router navigation target. */
  to: string;
  /** i18n label (resolve with i18n._(label) at render). */
  label: MessageDescriptor;
}

export const paletteRoutes: PaletteRoute[] = [
  { to: "/", label: msg`Dashboard` },
  { to: "/analytics", label: msg`Analytics` },
  { to: "/items", label: msg`Items` },
  { to: "/inventory", label: msg`Inventory` },
  { to: "/inventory/expiring", label: msg`Expiring` },
  { to: "/maintenance/due", label: msg`Maintenance` },
  { to: "/taxonomy?tab=locations", label: msg`Locations` },
  { to: "/taxonomy?tab=containers", label: msg`Containers` },
  { to: "/taxonomy?tab=categories", label: msg`Categories` },
  { to: "/loans", label: msg`Loans` },
  { to: "/borrowers", label: msg`Borrowers` },
  { to: "/scan", label: msg`Scan` },
  { to: "/approvals", label: msg`Approvals` },
  { to: "/my-changes", label: msg`My Changes` },
  { to: "/wishlist", label: msg`Wishlist` },
  { to: "/declutter", label: msg`Declutter` },
  { to: "/imports", label: msg`Imports` },
  { to: "/settings", label: msg`Settings` },
  { to: "/settings/profile", label: msg`Settings · Profile` },
  { to: "/settings/appearance", label: msg`Settings · Appearance` },
  { to: "/settings/language", label: msg`Settings · Language` },
  { to: "/settings/formats", label: msg`Settings · Formats` },
  { to: "/settings/notifications", label: msg`Settings · Notifications` },
  { to: "/settings/data", label: msg`Settings · Data` },
  { to: "/settings/members", label: msg`Settings · Members` },
  { to: "/settings/security", label: msg`Settings · Security` },
  { to: "/settings/accounts", label: msg`Settings · Accounts` },
  { to: "/settings/paperless", label: msg`Settings · Paperless` },
];

/** Static "Actions" group — verbs, rendered before Routes. `to` is absent for
 *  non-navigation actions (the palette dispatches on `id`). Ids are stable so
 *  the MRU keeps replaying them. */
export interface PaletteAction {
  /** Stable id; doubles as the MRU id and (when `to` is set) the nav target. */
  id: string;
  label: MessageDescriptor;
  to?: string;
}

export const paletteActions: PaletteAction[] = [
  { id: "/items/new", to: "/items/new", label: msg`New item` },
  { id: "/loans/new", to: "/loans/new", label: msg`New loan` },
  { id: "/borrowers/new", to: "/borrowers/new", label: msg`New borrower` },
  { id: "/scan", to: "/scan", label: msg`Scan` },
  { id: "action:toggle-theme", label: msg`Toggle theme` },
  { id: "/settings", to: "/settings", label: msg`Settings` },
];
