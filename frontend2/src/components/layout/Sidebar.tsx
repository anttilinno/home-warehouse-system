import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { Trans } from "@lingui/react/macro";
import type { DashboardStats, User } from "@/lib/types";
import { Window } from "@/components/retro";

// Navigator sidebar (sketch 006): grouped Overview / Inventory / System nav
// inside a plain-titlebar Window, user identity in the footer (frontend1
// pattern, carried over). Items with a `to` are real router NavLinks whose
// active state is per-route (SHELL-04); the rest land with their feature phases
// (7-12) and render disabled until then. The AppShell owns the `collapsed`
// boolean (Plan 06) and toggles it via the titlebar chevron; rail-mode CSS keys
// off an ancestor `[data-collapsed]` and hides the `.nav-label` / `.nav-count`
// hooks, leaving the glyph cell (+ a badge dot for counted items).

interface NavItemProps {
  glyph: string;
  label: ReactNode;
  count?: number;
  /** Route path. Omit for not-yet-built destinations (renders disabled). */
  to?: string;
}

// Shared base layout; `relative` anchors the rail-mode badge dot.
const NAV_BASE =
  "relative flex items-center gap-sp-2 px-sp-2 py-[5px] text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2";

function NavBody({ glyph, label, count }: NavItemProps) {
  return (
    <>
      <span
        aria-hidden="true"
        className="relative grid h-[20px] w-[20px] flex-none place-items-center"
      >
        {glyph}
        {count !== undefined && (
          // Rail-mode badge dot: hidden in expanded mode, surfaced when the
          // sidebar collapses to its 60px glyph rail (Plan 06 CSS keys off
          // [data-collapsed] to reveal it). 6px ink-bordered pastel dot.
          <span
            aria-hidden="true"
            className="nav-badge-dot pointer-events-none absolute right-[-2px] top-[-2px] hidden h-[6px] w-[6px] rounded-[2px] border border-border-ink bg-titlebar-blue"
          />
        )}
      </span>
      <span className="nav-label truncate">{label}</span>
      {count !== undefined && (
        <span className="nav-count ml-auto font-mono text-[11px] tabular-nums text-fg-muted">
          {count}
        </span>
      )}
    </>
  );
}

function NavItem({ glyph, label, count, to }: NavItemProps) {
  if (to) {
    return (
      <NavLink
        to={to}
        end={to === "/"}
        className={({ isActive }) =>
          isActive
            ? `${NAV_BASE} border border-border-ink bg-titlebar-blue shadow-hard-ink`
            : `${NAV_BASE} border border-transparent text-fg-ink hover:border-border-ink hover:bg-bg-panel-2 active:bg-bg-pressed`
        }
      >
        <NavBody glyph={glyph} label={label} count={count} />
      </NavLink>
    );
  }
  return (
    <div
      aria-disabled="true"
      title="Not built yet"
      className={`${NAV_BASE} cursor-not-allowed border border-transparent text-fg-muted hover:border-dashed hover:border-fg-faint`}
    >
      <NavBody glyph={glyph} label={label} count={count} />
    </div>
  );
}

function NavGroup({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-sp-3">
      <h3 className="nav-label mx-sp-2 mb-sp-1 border-b border-dotted border-fg-faint pb-[3px] text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">
        {title}
      </h3>
      {children}
    </div>
  );
}

export interface SidebarProps {
  stats?: DashboardStats;
  user?: User;
  /** Rail-mode flag (AppShell owns it, Plan 06). Drives the chevron direction. */
  collapsed?: boolean;
  /** Toggle handler for the titlebar chevron; AppShell flips `collapsed`. */
  onToggleCollapse?: () => void;
}

export function Sidebar({
  stats,
  user,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const initial = (user?.full_name || user?.email || "?")
    .charAt(0)
    .toUpperCase();

  const collapseToggle = (
    <button
      type="button"
      onClick={onToggleCollapse}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expand navigator" : "Collapse navigator"}
      title={collapsed ? "Expand navigator" : "Collapse navigator"}
      className="grid h-[16px] w-[16px] flex-none place-items-center border-2 border-border-ink bg-bg-panel font-mono text-[12px] leading-none bevel-raised-ink hover:brightness-103 active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2"
    >
      <span aria-hidden="true">{collapsed ? "›" : "‹"}</span>
    </button>
  );

  return (
    <Window
      title={<Trans>Navigator</Trans>}
      titlebarVariant="plain"
      bodyClassName="p-sp-2"
      actions={collapseToggle}
    >
      <nav aria-label="Primary">
        <NavGroup title={<Trans>Overview</Trans>}>
          <NavItem glyph="▦" label={<Trans>Dashboard</Trans>} to="/" />
          <NavItem glyph="▤" label={<Trans>Analytics</Trans>} to="/analytics" />
        </NavGroup>
        <NavGroup title={<Trans>Inventory</Trans>}>
          <NavItem glyph="▣" label={<Trans>Items</Trans>} count={stats?.total_items} to="/items" />
          <NavItem glyph="⬚" label={<Trans>Inventory</Trans>} to="/inventory" />
          <NavItem glyph="⊞" label={<Trans>Maintenance</Trans>} to="/maintenance/due" />
          <NavItem glyph="▢" label={<Trans>Locations</Trans>} count={stats?.total_locations} to="/taxonomy?tab=locations" />
          <NavItem glyph="▥" label={<Trans>Containers</Trans>} count={stats?.total_containers} to="/taxonomy?tab=containers" />
          <NavItem glyph="◇" label={<Trans>Categories</Trans>} count={stats?.total_categories} to="/taxonomy?tab=categories" />
          <NavItem glyph="↧" label={<Trans>Loans</Trans>} count={stats?.active_loans} to="/loans" />
          <NavItem glyph="☺" label={<Trans>Borrowers</Trans>} count={stats?.total_borrowers} to="/borrowers" />
        </NavGroup>
        <NavGroup title={<Trans>System</Trans>}>
          <NavItem glyph="⌗" label={<Trans>Scan</Trans>} to="/scan" />
          {/* Phase 14 System pages (14-08 wiring). Distinct retro glyphs;
              all labels via <Trans>. Wiring stays side-effect-free — no new
              query is added here just for a count badge. */}
          <NavItem glyph="✓" label={<Trans>Approvals</Trans>} to="/approvals" />
          <NavItem glyph="≣" label={<Trans>My Changes</Trans>} to="/my-changes" />
          <NavItem glyph="♡" label={<Trans>Wishlist</Trans>} to="/wishlist" />
          <NavItem glyph="⊘" label={<Trans>Declutter</Trans>} to="/declutter" />
          <NavItem glyph="↥" label={<Trans>Imports</Trans>} to="/imports" />
          <NavItem glyph="⇄" label={<Trans>Sync History</Trans>} to="/sync-history" />
          <NavItem glyph="⚙" label={<Trans>Settings</Trans>} to="/settings" />
          {/* DEV-only atom review surface (Phase 4). Gated so it never appears
              as a user nav entry; the matching /demo route is DEV-gated too. */}
          {import.meta.env.DEV && (
            <NavItem glyph="◈" label={<Trans>Demo</Trans>} to="/demo" />
          )}
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
          <span className="nav-label min-w-0">
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
