import type { ReactNode } from "react";
import { NavLink, Link, useLocation } from "react-router";
import { Trans } from "@lingui/react/macro";
import type { DashboardStats, User } from "@/lib/types";
import { Window } from "@/components/retro";
import { SidebarUserMenu } from "./SidebarUserMenu";

// Navigator sidebar (sketch 006): grouped Overview / Inventory / Planning /
// System nav inside a plain-titlebar Window, user identity in the footer
// (frontend1 pattern, carried over). Every nav item is a real router NavLink
// whose active state is per-route (SHELL-04) — all destinations are built now.
// The AppShell owns the `collapsed`
// boolean (Plan 06) and toggles it via the titlebar chevron; rail-mode CSS keys
// off an ancestor `[data-collapsed]` and hides the `.nav-label` / `.nav-count`
// hooks, leaving the glyph cell (+ a badge dot for counted items).

interface NavItemProps {
  glyph: string;
  label: ReactNode;
  count?: number;
  /** Route path. Every nav destination is built, so this is required. */
  to: string;
}

// Shared base layout; `relative` anchors the rail-mode badge dot.
const NAV_BASE =
  "relative flex items-center gap-sp-2 px-sp-2 py-[5px] text-13 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2";

function NavBody({ glyph, label, count }: Readonly<Omit<NavItemProps, "to">>) {
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
            className="nav-badge-dot pointer-events-none absolute right-[-2px] top-[-2px] hidden h-[6px] w-[6px] rounded-[2px] border border-border-ink bg-selection-fill"
          />
        )}
      </span>
      <span className="nav-label truncate uppercase tracking-4">{label}</span>
      {count !== undefined && (
        <span className="nav-count ml-auto font-mono text-11 tabular-nums text-fg-muted">
          {count}
        </span>
      )}
    </>
  );
}

const NAV_ACTIVE = `${NAV_BASE} border border-border-ink bg-selection-fill shadow-hard-ink`;
const NAV_INACTIVE = `${NAV_BASE} border border-transparent text-fg-ink hover:border-border-ink hover:bg-bg-panel-2 active:bg-bg-pressed`;

// /taxonomy with no ?tab renders the Categories tab (TaxonomyPage default).
const TAXONOMY_DEFAULT_TAB = "categories";

function NavItem({ glyph, label, count, to }: Readonly<NavItemProps>) {
  const location = useLocation();
  // Query-tab links (e.g. /taxonomy?tab=locations) all share one pathname, so
  // NavLink — which ignores the query string — would mark ALL of them active at
  // once. Match the `tab` param explicitly instead.
  const qIndex = to.indexOf("?");
  if (qIndex !== -1) {
    const path = to.slice(0, qIndex);
    const linkTab = new URLSearchParams(to.slice(qIndex + 1)).get("tab");
    const currentTab =
      new URLSearchParams(location.search).get("tab") ?? TAXONOMY_DEFAULT_TAB;
    // Active on the tab itself (/taxonomy?tab=X) AND on that tab's sub-routes
    // (e.g. /taxonomy/categories/new keeps Categories highlighted, the way
    // /items/new keeps Items highlighted under NavLink's prefix match).
    const subPath = `${path}/${linkTab}`;
    const isActive =
      (location.pathname === path && currentTab === linkTab) ||
      location.pathname === subPath ||
      location.pathname.startsWith(`${subPath}/`);
    return (
      <Link
        to={to}
        aria-current={isActive ? "page" : undefined}
        className={isActive ? NAV_ACTIVE : NAV_INACTIVE}
      >
        <NavBody glyph={glyph} label={label} count={count} />
      </Link>
    );
  }
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) => (isActive ? NAV_ACTIVE : NAV_INACTIVE)}
    >
      <NavBody glyph={glyph} label={label} count={count} />
    </NavLink>
  );
}

function NavGroup({
  title,
  children,
}: Readonly<{
  title: ReactNode;
  children: ReactNode;
}>) {
  return (
    <div className="mb-sp-3">
      <h3 className="nav-label mx-sp-2 mb-sp-1 border-b border-dotted border-fg-faint pb-[3px] text-10 font-bold uppercase tracking-14 text-fg-muted">
        {title}
      </h3>
      {children}
    </div>
  );
}

export interface SidebarProps {
  stats?: DashboardStats;
  /** Pending-approvals count for the Approvals nav badge. Threaded from
   *  AppShell (shared ["pending-changes", wsId, "pending"] cache) so no query
   *  is added here — the Sidebar stays side-effect-free. */
  pendingApprovals?: number;
  user?: User;
  /** Rail-mode flag (AppShell owns it, Plan 06). Drives the chevron direction. */
  collapsed?: boolean;
  /** Toggle handler for the titlebar chevron; AppShell flips `collapsed`. */
  onToggleCollapse?: () => void;
  /** Logout handler for the bottom user menu (confirm-gated). */
  onLogout?: () => void;
}

export function Sidebar({
  stats,
  pendingApprovals,
  user,
  collapsed = false,
  onToggleCollapse,
  onLogout,
}: Readonly<SidebarProps>) {
  const collapseToggle = (
    <button
      type="button"
      onClick={onToggleCollapse}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expand navigator" : "Collapse navigator"}
      title={collapsed ? "Expand navigator" : "Collapse navigator"}
      className="grid h-[16px] w-[16px] flex-none place-items-center border-2 border-border-ink bg-bg-panel font-mono text-12 leading-none bevel-raised-ink hover:brightness-103 active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2"
    >
      <span aria-hidden="true">{collapsed ? "›" : "‹"}</span>
    </button>
  );

  return (
    <Window
      title={<Trans>Navigator</Trans>}
      titlebarVariant="plain"
      className="flex flex-col"
      bodyClassName="flex flex-1 flex-col p-sp-2"
      actions={collapseToggle}
    >
      <nav aria-label="Primary">
        <NavGroup title={<Trans>Overview</Trans>}>
          <NavItem glyph="▦" label={<Trans>Dashboard</Trans>} to="/" />
          <NavItem glyph="▤" label={<Trans>Analytics</Trans>} to="/analytics" />
          {/* Scan promoted to Overview — it is the primary capture action. */}
          <NavItem glyph="⌗" label={<Trans>Scan</Trans>} to="/scan" />
        </NavGroup>
        <NavGroup title={<Trans>Inventory</Trans>}>
          <NavItem
            glyph="▣"
            label={<Trans>Items</Trans>}
            count={stats?.total_items}
            to="/items"
          />
          <NavItem glyph="⬚" label={<Trans>Inventory</Trans>} to="/inventory" />
          <NavItem
            glyph="▢"
            label={<Trans>Locations</Trans>}
            count={stats?.total_locations}
            to="/taxonomy?tab=locations"
          />
          <NavItem
            glyph="▥"
            label={<Trans>Containers</Trans>}
            count={stats?.total_containers}
            to="/taxonomy?tab=containers"
          />
          <NavItem
            glyph="◇"
            label={<Trans>Categories</Trans>}
            count={stats?.total_categories}
            to="/taxonomy?tab=categories"
          />
          <NavItem
            glyph="↧"
            label={<Trans>Loans</Trans>}
            count={stats?.active_loans}
            to="/loans"
          />
          <NavItem
            glyph="☺"
            label={<Trans>Borrowers</Trans>}
            count={stats?.total_borrowers}
            to="/borrowers"
          />
        </NavGroup>
        <NavGroup title={<Trans>Planning</Trans>}>
          {/* Label honest to the only maintenance surface (/maintenance/due —
              there is no /maintenance index). */}
          <NavItem
            glyph="⊞"
            label={<Trans>Due Maintenance</Trans>}
            to="/maintenance/due"
          />
          <NavItem glyph="♡" label={<Trans>Wishlist</Trans>} to="/wishlist" />
          <NavItem glyph="⊘" label={<Trans>Declutter</Trans>} to="/declutter" />
        </NavGroup>
        <NavGroup title={<Trans>System</Trans>}>
          {/* Phase 14 System pages (14-08 wiring). Distinct retro glyphs;
              all labels via <Trans>. The Approvals count is threaded in from
              AppShell (shared cache) — no query is added here. `|| undefined`
              hides the badge when nothing is pending (0 is noise). */}
          <NavItem
            glyph="✓"
            label={<Trans>Approvals</Trans>}
            count={pendingApprovals || undefined}
            to="/approvals"
          />
          <NavItem
            glyph="≣"
            label={<Trans>My Changes</Trans>}
            to="/my-changes"
          />
          <NavItem glyph="↥" label={<Trans>Imports</Trans>} to="/imports" />
          <NavItem
            glyph="⇄"
            label={<Trans>Sync History</Trans>}
            to="/sync-history"
          />
          <NavItem glyph="⚙" label={<Trans>Settings</Trans>} to="/settings" />
          {/* DEV-only atom review surface (Phase 4). Gated so it never appears
              as a user nav entry; the matching /demo route is DEV-gated too. */}
          {import.meta.env.DEV && (
            <NavItem glyph="◈" label={<Trans>Demo</Trans>} to="/demo" />
          )}
        </NavGroup>
      </nav>
      {user && onLogout && <SidebarUserMenu user={user} onLogout={onLogout} />}
    </Window>
  );
}
