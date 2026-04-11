import { Routes, Route, Link } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { useLingui as useLinguiRuntime } from "@lingui/react";
import { loadCatalog, locales } from "@/lib/i18n";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { AuthPage } from "@/features/auth/AuthPage";
import { AuthCallbackPage } from "@/features/auth/AuthCallbackPage";
import { RetroPanel } from "@/components/retro";
import { DemoPage } from "@/pages/DemoPage";
import { SetupPage } from "@/features/setup/SetupPage";

function NavBar() {
  return (
    <nav className="flex gap-md mb-md">
      <Link
        to="/"
        className="text-retro-ink font-bold uppercase text-[14px] border-retro-thick border-retro-ink bg-retro-cream px-md py-sm shadow-retro-raised hover:shadow-retro-pressed"
      >
        Dashboard
      </Link>
      <Link
        to="/settings"
        className="text-retro-ink font-bold uppercase text-[14px] border-retro-thick border-retro-ink bg-retro-cream px-md py-sm shadow-retro-raised hover:shadow-retro-pressed"
      >
        Settings
      </Link>
    </nav>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-retro-charcoal flex items-center justify-center p-lg">
      <RetroPanel showHazardStripe className="max-w-[640px] w-full">
        {children}
      </RetroPanel>
    </div>
  );
}

function DashboardPage() {
  const { t } = useLingui();
  const { i18n } = useLinguiRuntime();

  return (
    <PageShell>
      <NavBar />
      <h1 className="text-[20px] font-bold uppercase text-retro-ink">
        DASHBOARD
      </h1>
      <p className="text-retro-ink mt-sm">Inventory HUD loading...</p>
      <p className="text-retro-ink mt-sm font-mono">
        {t`Welcome to Home Warehouse`}
      </p>
      <div className="mt-md">
        <label className="text-retro-ink font-bold uppercase text-[14px] block mb-sm">
          LANGUAGE
        </label>
        <select
          value={i18n.locale}
          onChange={(e) => loadCatalog(e.target.value)}
          className="border-retro-thick border-retro-ink bg-retro-cream text-retro-ink p-sm font-mono"
        >
          {Object.entries(locales).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </PageShell>
  );
}

function SettingsPage() {
  return (
    <PageShell>
      <NavBar />
      <h1 className="text-[20px] font-bold uppercase text-retro-ink">
        SETTINGS
      </h1>
      <p className="text-retro-ink mt-sm">Configuration panels standing by.</p>
    </PageShell>
  );
}

function NotFoundPage() {
  return (
    <PageShell>
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
    </PageShell>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/demo" element={<DemoPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <DashboardPage />
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
        path="/setup"
        element={
          <RequireAuth>
            <SetupPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
