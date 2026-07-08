import { type ReactNode, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { Trans } from "@lingui/react/macro";
import type { DashboardStats, User } from "@/lib/types";
import { PixelIcon, type PixelIconName, Window } from "@/components/retro";
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
  icon: PixelIconName;
  label: ReactNode;
  count?: number;
  /** Route path. Every nav destination is built, so this is required. */
  to: string;
}

// Shared base layout; `relative` anchors the rail-mode badge dot. Desktop keeps
// the dense py-[5px]; below md (the drawer) rows grow to a >=44px touch target
// (C1) via py-sp-3 (12px padding + the 20px glyph cell ≈ 44px).
const NAV_BASE =
  "relative flex items-center gap-sp-2 px-sp-2 py-[5px] max-md:py-sp-3 text-13 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2";

function NavBody({ icon, label, count }: Readonly<Omit<NavItemProps, "to">>) {
  return (
    <>
      <span
        aria-hidden="true"
        className="relative grid h-[20px] w-[20px] flex-none place-items-center"
      >
        <PixelIcon name={icon} size={18} />
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

function NavItem({ icon, label, count, to }: Readonly<NavItemProps>) {
  // Every nav destination is a distinct pathname now (Organize collapsed the
  // three /taxonomy ?tab links into one prefix match), so a plain NavLink —
  // which prefix-matches the pathname and ignores the query — is all we need.
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) => (isActive ? NAV_ACTIVE : NAV_INACTIVE)}
    >
      <NavBody icon={icon} label={label} count={count} />
    </NavLink>
  );
}

// Collapsible-group persistence (Plan 1D §2.3): one localStorage object keyed by
// group id → open bool. Per-user UI preference, no per-workspace scoping. Guarded
// so private-mode / quota failures degrade to the defaults instead of throwing.
const GROUPS_KEY = "hws.nav.groups.v1";

function readGroupState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function writeGroupOpen(key: string, open: boolean) {
  try {
    const state = readGroupState();
    state[key] = open;
    localStorage.setItem(GROUPS_KEY, JSON.stringify(state));
  } catch {
    // ignore — the toggle still works in-session, it just isn't persisted.
  }
}

interface NavGroupProps {
  /** Stable id for the localStorage open/closed record + aria-controls target. */
  groupKey: string;
  title: ReactNode;
  /** Fallback open state when nothing is persisted. */
  defaultOpen?: boolean;
  /** Route prefixes that live in this group; a match forces it open (active-row
   *  guard) so a deep-link never lands inside an invisible collapsed group. */
  routes?: string[];
  /** Shown at the header's right edge only while collapsed — e.g. a pending
   *  count that must stay visible even when the group is closed. */
  collapsedBadge?: ReactNode;
  children: ReactNode;
}

function NavGroup({
  groupKey,
  title,
  defaultOpen = true,
  routes,
  collapsedBadge,
  children,
}: Readonly<NavGroupProps>) {
  const { pathname } = useLocation();
  const activeInside = !!routes?.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  );
  const [open, setOpen] = useState(
    () => activeInside || (readGroupState()[groupKey] ?? defaultOpen),
  );
  // Navigating into a collapsed group (deep link or in-app) re-opens it.
  useEffect(() => {
    if (activeInside) setOpen(true);
  }, [activeInside]);

  const listId = `nav-group-${groupKey}`;
  const toggle = () =>
    setOpen((prev) => {
      const next = !prev;
      writeGroupOpen(groupKey, next);
      return next;
    });

  return (
    <div className="mb-sp-3">
      <h3 className="mx-sp-2 mb-sp-1">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={listId}
          className="flex w-full items-center gap-sp-2 border-b border-dotted border-fg-faint pb-[3px] max-md:py-sp-3 text-10 font-bold uppercase tracking-14 text-fg-muted hover:text-fg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2"
        >
          <span
            aria-hidden="true"
            className="font-mono text-12 leading-none tabular-nums"
          >
            {open ? "−" : "+"}
          </span>
          <span className="nav-label truncate">{title}</span>
          {!open && collapsedBadge && (
            <span className="ml-auto">{collapsedBadge}</span>
          )}
        </button>
      </h3>
      {open && <div id={listId}>{children}</div>}
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

// Collapse chevron for the docked Navigator titlebar. Rendered ONLY when the
// shell wires a toggle (desktop); the MobileDrawer passes none, so it returns
// undefined and the Window falls back to its default corner box (C2).
function CollapseToggle({
  collapsed,
  onToggle,
}: Readonly<{ collapsed: boolean; onToggle?: () => void }>) {
  if (!onToggle) return undefined;
  const label = collapsed ? "Expand navigator" : "Collapse navigator";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={label}
      title={label}
      className="grid h-[16px] w-[16px] flex-none place-items-center border-2 border-border-ink bg-bg-panel font-mono text-12 leading-none bevel-raised-ink hover:brightness-103 active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2"
    >
      <span aria-hidden="true">{collapsed ? "›" : "‹"}</span>
    </button>
  );
}

export function Sidebar({
  stats,
  pendingApprovals,
  user,
  collapsed = false,
  onToggleCollapse,
  onLogout,
}: Readonly<SidebarProps>) {
  return (
    <Window
      title={<Trans>Navigator</Trans>}
      titlebarVariant="plain"
      className="flex flex-col"
      bodyClassName="flex flex-1 flex-col p-sp-2"
      actions={
        onToggleCollapse ? (
          <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapse} />
        ) : undefined
      }
    >
      <nav aria-label="Primary">
        <NavGroup
          groupKey="overview"
          title={<Trans>Overview</Trans>}
          routes={["/", "/analytics", "/scan"]}
        >
          <NavItem icon="app-windows" label={<Trans>Dashboard</Trans>} to="/" />
          <NavItem
            icon="chart-bar-big"
            label={<Trans>Analytics</Trans>}
            to="/analytics"
          />
          {/* Scan promoted to Overview — it is the primary capture action. */}
          <NavItem icon="camera" label={<Trans>Scan</Trans>} to="/scan" />
        </NavGroup>
        <NavGroup
          groupKey="inventory"
          title={<Trans>Inventory</Trans>}
          routes={["/items", "/inventory", "/taxonomy", "/loans", "/borrowers"]}
        >
          {/* Zero counts render no badge (0 is noise) — same `|| undefined`
              convention the Approvals count already used. */}
          <NavItem
            icon="archive"
            label={<Trans>Items</Trans>}
            count={stats?.total_items || undefined}
            to="/items"
          />
          <NavItem
            icon="grid-3x3"
            label={<Trans>Inventory</Trans>}
            to="/inventory"
          />
          {/* Organize folds the three /taxonomy tabs (Locations / Containers /
              Categories) into one entry — they are already tabs of one page.
              No count: the sum is not actionable. The palette keeps the three
              direct-jump entries. */}
          <NavItem
            icon="map-pin"
            label={<Trans>Organize</Trans>}
            to="/taxonomy"
          />
          <NavItem
            icon="download"
            label={<Trans>Loans</Trans>}
            count={stats?.active_loans || undefined}
            to="/loans"
          />
          <NavItem
            icon="users"
            label={<Trans>Borrowers</Trans>}
            count={stats?.total_borrowers || undefined}
            to="/borrowers"
          />
        </NavGroup>
        <NavGroup
          groupKey="planning"
          title={<Trans>Planning</Trans>}
          defaultOpen={false}
          routes={["/maintenance", "/wishlist", "/declutter"]}
        >
          {/* Label honest to the only maintenance surface (/maintenance/due —
              there is no /maintenance index). */}
          <NavItem
            icon="clock"
            label={<Trans>Due Maintenance</Trans>}
            to="/maintenance/due"
          />
          <NavItem
            icon="heart"
            label={<Trans>Wishlist</Trans>}
            to="/wishlist"
          />
          <NavItem
            icon="trash"
            label={<Trans>Declutter</Trans>}
            to="/declutter"
          />
        </NavGroup>
        <NavGroup
          groupKey="system"
          title={<Trans>System</Trans>}
          defaultOpen={false}
          routes={[
            "/approvals",
            "/my-changes",
            "/imports",
            "/sync-history",
            "/settings",
          ]}
          // Pending approvals must stay visible even when System is collapsed.
          collapsedBadge={
            pendingApprovals ? (
              <span className="font-mono text-10 leading-none tabular-nums border border-border-ink bg-selection-fill px-[3px] py-px text-fg-ink">
                {pendingApprovals}
              </span>
            ) : undefined
          }
        >
          {/* Phase 14 System pages (14-08 wiring). Distinct retro glyphs;
              all labels via <Trans>. The Approvals count is threaded in from
              AppShell (shared cache) — no query is added here. `|| undefined`
              hides the badge when nothing is pending (0 is noise). */}
          <NavItem
            icon="check"
            label={<Trans>Approvals</Trans>}
            count={pendingApprovals || undefined}
            to="/approvals"
          />
          <NavItem
            icon="bulletlist"
            label={<Trans>My Changes</Trans>}
            to="/my-changes"
          />
          <NavItem icon="upload" label={<Trans>Imports</Trans>} to="/imports" />
          <NavItem
            icon="reload"
            label={<Trans>Sync History</Trans>}
            to="/sync-history"
          />
          <NavItem
            icon="settings-2"
            label={<Trans>Settings</Trans>}
            to="/settings"
          />
        </NavGroup>
      </nav>
      {user && onLogout && <SidebarUserMenu user={user} onLogout={onLogout} />}
    </Window>
  );
}
