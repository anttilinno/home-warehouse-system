import { Routes, Route, Navigate } from "react-router";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { CallbackPage } from "@/features/auth/CallbackPage";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { SettingsLayout } from "@/features/settings/SettingsLayout";
import { SecurityPage } from "@/features/settings/SecurityPage";
import { AccountsPage } from "@/features/settings/AccountsPage";
import { DemoPage } from "@/routes/demo/DemoPage";
import { ItemsListPage } from "@/features/items/ItemsListPage";

// Library-mode RR7 (NOT framework mode — AP-1). Literal routes before the
// wildcard. /login stays public; the authenticated branch is now an AppShell
// LAYOUT route — RequireAuth gates the shell, which renders each child route
// through its <Outlet/> (Phase 3 chrome). Feature phases (4 atoms, 5+ features)
// add child routes under the same shell.

function PlaceholderShell() {
  return (
    <main style={{ padding: 16, fontFamily: "monospace" }}>
      <h1>frontend2 — v3.0 placeholder shell</h1>
      <p>
        Phase 1 scaffold OK. Tokens (Phase 2), chrome (Phase 3), atoms
        (Phase 4) follow.
      </p>
    </main>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* /auth/callback is PUBLIC (sibling of /login) — the user is not yet
          authenticated; the page exchanges the one-time OAuth code itself. */}
      <Route path="/auth/callback" element={<CallbackPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        {/* Items list (07-03). Literal route before the wildcard (AP-1). The
            detail/create/edit routes (/items/new, /items/:id, /items/:id/edit)
            land with Plans 05/06 in Wave 3 — this plan registers ONLY the list
            to avoid a route-file conflict with the parallel plans. */}
        <Route path="items" element={<ItemsListPage />} />
        {/* Settings hub (05-UI-SPEC §5): SettingsLayout sub-layout under the
            AUTHENTICATED AppShell. /settings → /settings/security; the two built
            pages (security + accounts) render through the layout's tab Outlet. */}
        <Route path="settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="security" replace />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="accounts" element={<AccountsPage />} />
        </Route>
        {/* /demo: the Phase 4 atom review surface. DEV-gated — it renders
            inside AppShell for review but never ships as a user route. */}
        {import.meta.env.DEV && (
          <Route path="demo" element={<DemoPage />} />
        )}
      </Route>
      <Route path="*" element={<PlaceholderShell />} />
    </Routes>
  );
}
