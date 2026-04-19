import { lazy, Suspense } from "react";
import { Routes, Route, Link } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { AuthPage } from "@/features/auth/AuthPage";
import { AuthCallbackPage } from "@/features/auth/AuthCallbackPage";
import { DemoPage } from "@/pages/DemoPage";
import { ApiDemoPage } from "@/pages/ApiDemoPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ItemsListPage } from "@/features/items/ItemsListPage";
import { ItemFormPage } from "@/features/items/ItemFormPage";
import { ItemDetailPage } from "@/features/items/ItemDetailPage";
import { LoansListPage } from "@/features/loans/LoansListPage";
// /scan is route-lazy-split so the scanner chunk (manualChunks-grouped in
// vite.config.ts — @yudiel/react-qr-scanner + barcode-detector + zxing-wasm
// + webrtc-adapter) is fetched on demand. Chunk-load failures propagate to
// the existing route-level ErrorBoundaryPage (Phase 64 D-19 narrowed).
const ScanPage = lazy(() =>
  import("@/features/scan/ScanPage").then((m) => ({ default: m.ScanPage })),
);
import { SetupPage } from "@/features/setup/SetupPage";
import TaxonomyPage from "@/features/taxonomy/TaxonomyPage";
import { BorrowersListPage } from "@/features/borrowers/BorrowersListPage";
import { BorrowerDetailPage } from "@/features/borrowers/BorrowerDetailPage";
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

// Suspense fallback for the lazy-loaded /scan route. Owns its own useLingui so
// the surrounding AppRoutes function stays untouched by i18n. Heading is
// UPPERCASE per UI-SPEC heading rule.
function ScannerLoadingFallback() {
  const { t } = useLingui();
  return (
    <div className="max-w-[480px] mx-auto p-lg">
      <RetroPanel showHazardStripe>
        <h2 className="text-[20px] font-bold uppercase text-retro-ink">
          {t`LOADING SCANNER…`}
        </h2>
        <p className="font-mono text-retro-charcoal mt-sm">
          {t`Please wait.`}
        </p>
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
        <Route path="borrowers" element={<BorrowersListPage />} />
        <Route path="borrowers/:id" element={<BorrowerDetailPage />} />
        <Route path="items" element={<ItemsListPage />} />
        <Route path="items/new" element={<ItemFormPage />} />
        <Route path="items/:id" element={<ItemDetailPage />} />
        <Route path="taxonomy" element={<TaxonomyPage />} />
        <Route path="loans" element={<LoansListPage />} />
        <Route
          path="scan"
          element={
            <Suspense fallback={<ScannerLoadingFallback />}>
              <ScanPage />
            </Suspense>
          }
        />
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
