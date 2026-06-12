import { useLingui } from "@lingui/react/macro";
import { Outlet, useLocation, useNavigate } from "react-router";
import { RetroTabs } from "@/components/retro";

// SettingsLayout (05-UI-SPEC §5) — the minimal-but-stable Settings hub shell
// (Phase 12 fills the full hub). It renders INSIDE AppShell (chrome + PageHeader
// breadcrumb SYSTEM › SETTINGS already supplied by the shell), presenting the two
// built pages as RetroTabs (folder tabs) bound to routes. The active tab is
// derived from the current route (deep-linkable); clicking a tab navigates. The
// page content renders through the nested <Outlet/>. Future hub tabs (Profile,
// Members, Preferences — Phase 12) are intentionally NOT rendered here (no
// disabled stubs — the tab row stays truthful).

const TAB_ROUTES = {
  security: "/settings/security",
  accounts: "/settings/accounts",
} as const;

type TabId = keyof typeof TAB_ROUTES;

function activeTabFromPath(pathname: string): TabId {
  return pathname.startsWith("/settings/accounts") ? "accounts" : "security";
}

export function SettingsLayout() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const location = useLocation();
  const active = activeTabFromPath(location.pathname);

  return (
    <div className="mx-auto max-w-[720px]">
      <RetroTabs
        value={active}
        onChange={(id) => navigate(TAB_ROUTES[id as TabId])}
        tabs={[
          {
            id: "security",
            label: t`Security`,
            // The page content is supplied by the routed child via <Outlet/>;
            // each tab's panel renders the same outlet (the route is the SSOT).
            content: <Outlet />,
          },
          {
            id: "accounts",
            label: t`Connected Accounts`,
            content: <Outlet />,
          },
        ]}
      />
    </div>
  );
}
