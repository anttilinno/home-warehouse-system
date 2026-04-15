import { Routes, Route, Link } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { AuthPage } from "@/features/auth/AuthPage";
import { AuthCallbackPage } from "@/features/auth/AuthCallbackPage";
import { DemoPage } from "@/pages/DemoPage";
import { ApiDemoPage } from "@/pages/ApiDemoPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ItemsPage } from "@/features/items/ItemsPage";
import { LoansPage } from "@/features/loans/LoansPage";
import { ScanPage } from "@/features/scan/ScanPage";
import { SetupPage } from "@/features/setup/SetupPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { ProfilePage } from "@/features/settings/ProfilePage";
import { SecurityPage } from "@/features/settings/SecurityPage";
import { AppearancePage } from "@/features/settings/AppearancePage";
import { LanguagePage } from "@/features/settings/LanguagePage";
import { FormatsPage } from "@/features/settings/FormatsPage";
import { NotificationsPage } from "@/features/settings/NotificationsPage";
import { DataPage } from "@/features/settings/DataPage";
import { AppShell, ErrorBoundaryPage } from "@/components/layout";
import { RetroPanel } from "@/components/retro";

function NotFoundPage() {
  const { t } = useLingui();
  return (
    <div className="min-h-dvh bg-retro-charcoal flex items-center justify-center p-lg">
      <RetroPanel showHazardStripe className="max-w-[640px] w-full">
        <h1 className="text-[20px] font-bold uppercase text-retro-ink">
          {t`SECTOR NOT FOUND`}
        </h1>
        <p className="text-retro-ink mt-sm">
          {t`The requested area does not exist. Return to base.`}
        </p>
        <Link
          to="/"
          className="inline-block mt-md text-retro-ink font-bold uppercase text-[14px] border-retro-thick border-retro-ink bg-retro-cream px-md py-sm shadow-retro-raised hover:shadow-retro-pressed"
        >
          {t`RETURN TO BASE`}
        </Link>
      </RetroPanel>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes -- no shell */}
      <Route path="/login" element={<AuthPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/demo" element={<DemoPage />} />
      <Route path="/rq-demo" element={<ApiDemoPage />} />

      {/* Setup route -- outside AppShell, per D-02 */}
      <Route
        path="/setup"
        element={
          <RequireAuth>
            <SetupPage />
          </RequireAuth>
        }
      />

      {/* Authenticated routes -- nested in AppShell with single RequireAuth */}
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
        errorElement={<ErrorBoundaryPage />}
      >
        <Route index element={<DashboardPage />} />
        <Route path="items" element={<ItemsPage />} />
        <Route path="loans" element={<LoansPage />} />
        <Route path="scan" element={<ScanPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/profile" element={<ProfilePage />} />
        <Route path="settings/security" element={<SecurityPage />} />
        <Route path="settings/appearance" element={<AppearancePage />} />
        <Route path="settings/language" element={<LanguagePage />} />
        <Route path="settings/formats" element={<FormatsPage />} />
        <Route path="settings/notifications" element={<NotificationsPage />} />
        <Route path="settings/data" element={<DataPage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
