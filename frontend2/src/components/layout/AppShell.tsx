import { useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { Trans } from "@lingui/react/macro";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { PageHeader } from "./PageHeader";
import { Bottombar } from "./Bottombar";
import { Fab } from "./Fab";
import { MobileDrawer } from "./MobileDrawer";
import { F1HelpDialog } from "./F1HelpDialog";
import { WorkspaceProvider } from "@/features/workspace/WorkspaceProvider";
import { useLogout } from "@/features/auth/useLogout";
import { SSEProvider, useSSEStatus } from "@/features/sse";

// AppShell (SHELL-01/02/06): the 2x3 CSS-Grid shell every authenticated route
// renders inside. It owns a SINGLE `collapsed` boolean (the only collapse state
// — no measurement; CSS swaps the rail off the `data-collapsed` attribute), a
// drawer-open boolean (mobile Navigator, toggled by the TopBar hamburger), and
// the F1 help-dialog open state (toggled by the Bottombar F1 chip + the F1 key,
// whose single keydown owner lives in F1HelpDialog). Route content renders
// through the <Outlet/>; the desktop Bottombar + the mobile FAB read the same
// useShortcuts SSOT. The Fab/MobileDrawer/Bottombar carry the responsive class
// contract (hidden md:flex / md:hidden) so CSS, not JS, picks the surface.

// Route → breadcrumb segments. Placeholder routes are fine this phase; feature
// phases extend this map as their routes land.
const ROUTE_SEGMENTS: Record<string, string[]> = {
  "/": ["OVERVIEW", "DASHBOARD"],
  "/items": ["INVENTORY", "ITEMS"],
  "/locations": ["INVENTORY", "LOCATIONS"],
  "/containers": ["INVENTORY", "CONTAINERS"],
  "/categories": ["INVENTORY", "CATEGORIES"],
  "/loans": ["INVENTORY", "LOANS"],
  "/borrowers": ["INVENTORY", "BORROWERS"],
  "/scan": ["SYSTEM", "SCAN"],
  "/settings": ["SYSTEM", "SETTINGS"],
};

function segmentsForPath(pathname: string): string[] {
  return ROUTE_SEGMENTS[pathname] ?? ["OVERVIEW"];
}

// Format a Date as a local HH:MM:SS readout for the PageHeader LAST SYNC slot.
// Returns undefined when there has been no event yet so PageHeader falls back to
// its "—" placeholder (D-#2). Kept tiny + pure so the chrome stays dumb.
function formatLastSync(at: Date | null): string | undefined {
  if (!at) return undefined;
  return at.toLocaleTimeString(undefined, { hour12: false });
}

// AppShell composes the authenticated provider stack (PROV-01): WorkspaceProvider
// (D-12 SSOT — wsId for the switcher AND every Outlet page) wraps SSEProvider (one
// EventSource; needs a valid wsId + an authed session — RESEARCH §1). The chrome
// that CONSUMES live status lives in <ShellChrome/>, a child rendered UNDER
// SSEProvider: a component cannot read a context it also renders, so the
// useSSEStatus() reader must sit below the provider it reads from.
export function AppShell() {
  return (
    <WorkspaceProvider>
      <SSEProvider>
        <ShellChrome />
      </SSEProvider>
    </WorkspaceProvider>
  );
}

// ShellChrome — the 2x3 CSS-Grid shell, rendered INSIDE SSEProvider so it can
// read useSSEStatus() once and thread `online` (TopBar) + `lastSync` (PageHeader)
// down to the chrome. It owns a SINGLE `collapsed` boolean (the only collapse
// state — no measurement; CSS swaps the rail off the `data-collapsed` attribute),
// a drawer-open boolean (mobile Navigator, toggled by the TopBar hamburger), and
// the F1 help-dialog open state (toggled by the Bottombar F1 chip + the F1 key,
// whose single keydown owner lives in F1HelpDialog). Route content renders through
// the <Outlet/>; the desktop Bottombar + the mobile FAB read the same useShortcuts
// SSOT. The Fab/MobileDrawer/Bottombar carry the responsive class contract (hidden
// md:flex / md:hidden) so CSS, not JS, picks the surface.
function ShellChrome() {
  const location = useLocation();

  // The ONLY collapse state — a single boolean, no measurement (SHELL-02).
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const segments = useMemo(
    () => segmentsForPath(location.pathname),
    [location.pathname],
  );

  // Live SSE status (read once here, threaded into the chrome). The split STATUS
  // context (Plan 06-01) re-renders this ONLY on connected/lastEventAt change —
  // never on event fan-out (Pitfall 5). TopBar's ONLINE dot + sse-slot bind to
  // `connected`; PageHeader LAST SYNC binds to the formatted `lastEventAt`.
  const { connected, lastEventAt } = useSSEStatus();
  const lastSync = formatLastSync(lastEventAt);

  // Real logout (AUTH-12 frontend half): POST /auth/logout (server-side revoke)
  // then clear refresh token + workspace + query cache and navigate to /login.
  // TopBar's confirm dialog still gates it (BAR-05) — onLogout fires only after
  // the user confirms.
  const logout = useLogout();

  return (
    <div className="app-shell" data-collapsed={collapsed}>
      {/* Skip link — first focusable element, jumps focus to #main. */}
      <a
        href="#main"
        className="sr-only absolute left-sp-2 top-sp-2 z-50 border-2 border-border-ink bg-bg-panel px-sp-3 py-sp-1 text-[13px] font-semibold focus:not-sr-only focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2"
      >
        <Trans>Skip to content</Trans>
      </a>

      <div className="app-topbar">
        <TopBar
          online={connected}
          onToggleDrawer={() => setDrawerOpen((v) => !v)}
          onLogout={logout}
        />
      </div>

      {/* Desktop Navigator — persistent in the grid; hidden <768px (the drawer
          takes over there via the responsive grid + this wrapper). */}
      <div className="app-sidebar hidden md:block">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
        />
      </div>

      <main id="main" tabIndex={-1} className="app-main">
        <PageHeader segments={segments} lastSync={lastSync} />
        <div className="p-sp-5">
          <Outlet />
        </div>
      </main>

      <div className="app-bottombar">
        <Bottombar onOpenHelp={() => setHelpOpen(true)} />
      </div>

      {/* Mobile-only surfaces (<768px): the off-canvas Navigator + the FAB. */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <Fab />

      {/* The F1 help dialog (its single F1/"?" keydown owner toggles it). */}
      <F1HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onToggle={() => setHelpOpen((v) => !v)}
      />
    </div>
  );
}
