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
// is named `*sync*`/`*idb*`/`*offline*`. The "Sync History" ROW label is a plain
// translated string and its `to` is "/sync-history" (a route path, not an import
// specifier — `lint:imports` scans import statements, not data literals).

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
  { to: "/sync-history", label: msg`Sync History` },
  { to: "/settings", label: msg`Settings` },
];
