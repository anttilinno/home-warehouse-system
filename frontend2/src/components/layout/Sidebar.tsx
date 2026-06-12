import type { ReactNode } from "react";
import { Link } from "react-router";
import { Trans } from "@lingui/react/macro";
import type { DashboardStats, User } from "@/lib/types";
import { Window } from "@/components/retro";

// Navigator sidebar (sketch 006): grouped Overview / Inventory / System nav
// inside a plain-titlebar Window, user identity in the footer (frontend1
// pattern, carried over). Items with a `to` are real router links; the rest
// land with their feature phases (7-12) and render disabled until then.
// The full collapsible AppShell chrome is Phase 3 scope.

interface NavItemProps {
  glyph: string;
  label: ReactNode;
  count?: number;
  /** Route path. Omit for not-yet-built destinations (renders disabled). */
  to?: string;
  active?: boolean;
}

function NavItem({ glyph, label, count, to, active = false }: NavItemProps) {
  const body = (
    <>
      <span aria-hidden="true">{glyph}</span>
      {label}
      {count !== undefined && (
        <span className="ml-auto font-mono text-[11px] text-fg-muted">
          {count}
        </span>
      )}
    </>
  );
  const base = "flex items-center gap-sp-2 px-sp-2 py-[5px] text-[13px] font-semibold";

  if (active) {
    return (
      <Link
        to={to ?? "#"}
        aria-current="page"
        className={`${base} border border-border-ink bg-titlebar-blue shadow-hard-ink`}
      >
        {body}
      </Link>
    );
  }
  if (to) {
    return (
      <Link
        to={to}
        className={`${base} border border-transparent text-fg-ink hover:border-border-ink hover:bg-bg-panel-2 active:bg-bg-pressed`}
      >
        {body}
      </Link>
    );
  }
  return (
    <div
      aria-disabled="true"
      title="Not built yet"
      className={`${base} cursor-not-allowed border border-transparent text-fg-muted hover:border-dashed hover:border-fg-faint`}
    >
      {body}
    </div>
  );
}

function NavGroup({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-sp-3">
      <h3 className="mx-sp-2 mb-sp-1 border-b border-dotted border-fg-faint pb-[3px] text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">
        {title}
      </h3>
      {children}
    </div>
  );
}

export interface SidebarProps {
  stats?: DashboardStats;
  user?: User;
}

export function Sidebar({ stats, user }: SidebarProps) {
  const initial = (user?.full_name || user?.email || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <Window
      title={<Trans>Navigator</Trans>}
      titlebarVariant="plain"
      bodyClassName="p-sp-2"
    >
      <nav>
        <NavGroup title={<Trans>Overview</Trans>}>
          <NavItem glyph="▦" label={<Trans>Dashboard</Trans>} to="/" active />
          <NavItem glyph="▤" label={<Trans>Analytics</Trans>} />
        </NavGroup>
        <NavGroup title={<Trans>Inventory</Trans>}>
          <NavItem glyph="▣" label={<Trans>Items</Trans>} count={stats?.total_items} />
          <NavItem glyph="▢" label={<Trans>Locations</Trans>} count={stats?.total_locations} />
          <NavItem glyph="▥" label={<Trans>Containers</Trans>} count={stats?.total_containers} />
          <NavItem glyph="◇" label={<Trans>Categories</Trans>} count={stats?.total_categories} />
          <NavItem glyph="↧" label={<Trans>Loans</Trans>} count={stats?.active_loans} />
          <NavItem glyph="☺" label={<Trans>Borrowers</Trans>} count={stats?.total_borrowers} />
        </NavGroup>
        <NavGroup title={<Trans>System</Trans>}>
          <NavItem glyph="⌗" label={<Trans>Scan</Trans>} />
          <NavItem glyph="⚙" label={<Trans>Settings</Trans>} />
        </NavGroup>
      </nav>
      {user && (
        <footer className="mt-sp-3 flex items-center gap-sp-2 border-t-2 border-border-ink p-sp-2">
          <span
            aria-hidden="true"
            className="grid h-[28px] w-[28px] flex-none place-items-center border-2 border-border-ink bg-titlebar-pink font-display text-[16px]"
          >
            {initial}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold">
              {user.full_name}
            </span>
            <span className="block truncate text-[11px] text-fg-muted">
              {user.email}
            </span>
          </span>
        </footer>
      )}
    </Window>
  );
}
