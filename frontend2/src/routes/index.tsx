import { Routes, Route } from "react-router";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { DemoPage } from "@/routes/demo/DemoPage";

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
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
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
