import { Routes, Route } from "react-router";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { DashboardPage } from "@/features/dashboard/DashboardPage";

// Library-mode RR7 (NOT framework mode — AP-1). Literal routes before the
// wildcard. /login + / are the retro-os sample screens (2026-06-11); later
// phases (3 chrome, 4 atoms, 5+ features) add real routes against this
// baseline.

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
        path="/"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<PlaceholderShell />} />
    </Routes>
  );
}
