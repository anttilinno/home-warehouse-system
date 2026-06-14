import { Outlet } from "react-router";

// SettingsLayout (12-UI-SPEC §"Layout shell") — the thin Settings hub shell.
// Phase 12 replaced the Phase-5 two-tab RetroTabs sub-nav with an iOS/System-7
// grouped-row landing: /settings (index) renders SettingsLandingPage, and each
// subpage renders full-width through this layout's <Outlet/>. The shell is now a
// single centered column (mx-auto max-w-[720px]) matching the shipped scaffold
// width — no tabs, no active-tab logic. It renders INSIDE AppShell (chrome +
// SYSTEM › SETTINGS breadcrumb already supplied). The route table in
// routes/index.tsx is the single source of truth for which subpages mount.
export function SettingsLayout() {
  return (
    <div className="mx-auto max-w-[720px]">
      <Outlet />
    </div>
  );
}
