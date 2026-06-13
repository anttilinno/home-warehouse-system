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
import { ItemFormPage } from "@/features/items/ItemFormPage";
import { ItemDetailPage } from "@/features/items/ItemDetailPage";
import { InventoryListPage } from "@/features/inventory/InventoryListPage";
import { InventoryFormPage } from "@/features/inventory/InventoryFormPage";
import { ExpiringPage } from "@/features/inventory/ExpiringPage";
import { LoansListPage } from "@/features/loans/LoansListPage";
import { LoanFormPage } from "@/features/loans/LoanFormPage";
import { BorrowersListPage } from "@/features/borrowers/BorrowersListPage";
import { BorrowerFormPage } from "@/features/borrowers/BorrowerFormPage";
import { BorrowerDetailPage } from "@/features/borrowers/BorrowerDetailPage";

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
        {/* Items list (07-03) + detail/create/edit (07-06). Literal routes
            BEFORE the param route (AP-1 library mode) — `items/new` must win over
            `items/:id` or "new" would be parsed as an id. */}
        <Route path="items" element={<ItemsListPage />} />
        <Route path="items/new" element={<ItemFormPage />} />
        <Route path="items/:id" element={<ItemDetailPage />} />
        {/* Inventory list (07b-02) + form/expiring routes (07b-04). Literal
            routes BEFORE the param route (AP-1 library mode) — `inventory/new`
            and `inventory/expiring` must win over `inventory/:id`. */}
        <Route path="inventory" element={<InventoryListPage />} />
        <Route path="inventory/new" element={<InventoryFormPage />} />
        <Route path="inventory/expiring" element={<ExpiringPage />} />
        <Route path="inventory/:id/edit" element={<InventoryFormPage />} />
        <Route path="items/:id/edit" element={<ItemFormPage />} />
        {/* Loans list (08-02) + create form (08-03). Literal routes BEFORE any
            param route (AP-1 library mode) — `loans/new` must win over a future
            `loans/:id`, so it is registered ABOVE the `loans` literal route. */}
        <Route path="loans/new" element={<LoanFormPage />} />
        <Route path="loans" element={<LoansListPage />} />
        {/* Borrowers list (09-02) + form/detail (09-03). Literal routes BEFORE
            any param route (AP-1 library mode) — `borrowers/new` must win over
            `borrowers/:id` or "new" would be parsed as an id (Pitfall 7), so it
            is registered ABOVE the `:id` route. */}
        <Route path="borrowers/new" element={<BorrowerFormPage />} />
        <Route path="borrowers" element={<BorrowersListPage />} />
        <Route path="borrowers/:id/edit" element={<BorrowerFormPage />} />
        <Route path="borrowers/:id" element={<BorrowerDetailPage />} />
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
