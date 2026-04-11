import { Routes, Route, Link } from "react-router";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { AuthPage } from "@/features/auth/AuthPage";
import { AuthCallbackPage } from "@/features/auth/AuthCallbackPage";
import { DemoPage } from "@/pages/DemoPage";
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
import { RetroPanel } from "@/components/retro";

function NotFoundPage() {
  return (
    <div className="min-h-dvh bg-retro-charcoal flex items-center justify-center p-lg">
      <RetroPanel showHazardStripe className="max-w-[640px] w-full">
        <h1 className="text-[20px] font-bold uppercase text-retro-ink">
          SECTOR NOT FOUND
        </h1>
        <p className="text-retro-ink mt-sm">
          The requested area does not exist. Return to base.
        </p>
        <Link
          to="/"
          className="inline-block mt-md text-retro-ink font-bold uppercase text-[14px] border-retro-thick border-retro-ink bg-retro-cream px-md py-sm shadow-retro-raised hover:shadow-retro-pressed"
        >
          RETURN TO BASE
        </Link>
      </RetroPanel>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<AuthPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/demo" element={<DemoPage />} />

      {/* Setup route -- outside AppShell, per D-02 */}
      <Route
        path="/setup"
        element={
          <RequireAuth>
            <SetupPage />
          </RequireAuth>
        }
      />

      {/* Authenticated routes */}
      <Route
        path="/"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/items"
        element={
          <RequireAuth>
            <ItemsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/loans"
        element={
          <RequireAuth>
            <LoansPage />
          </RequireAuth>
        }
      />
      <Route
        path="/scan"
        element={
          <RequireAuth>
            <ScanPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings/profile"
        element={
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings/security"
        element={
          <RequireAuth>
            <SecurityPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings/appearance"
        element={
          <RequireAuth>
            <AppearancePage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings/language"
        element={
          <RequireAuth>
            <LanguagePage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings/formats"
        element={
          <RequireAuth>
            <FormatsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings/notifications"
        element={
          <RequireAuth>
            <NotificationsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings/data"
        element={
          <RequireAuth>
            <DataPage />
          </RequireAuth>
        }
      />

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
