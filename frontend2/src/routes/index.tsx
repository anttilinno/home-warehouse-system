import { Routes, Route, Link } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { useLingui as useLinguiRuntime } from "@lingui/react";
import { loadCatalog, locales } from "@/lib/i18n";
import { RequireAuth } from "@/features/auth/RequireAuth";

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

function RetroPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-retro-charcoal flex items-center justify-center p-lg">
      <div className="bg-retro-cream border-retro-thick border-retro-ink shadow-retro-raised p-lg max-w-[640px] w-full">
        <div className="bg-hazard-stripe h-[8px] mb-md" />
        {children}
      </div>
    </div>
  );
}

function DashboardPage() {
  const { t } = useLingui();
  const { i18n } = useLinguiRuntime();

  return (
    <RetroPanel>
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
    </RetroPanel>
  );
}

function SettingsPage() {
  return (
    <RetroPanel>
      <NavBar />
      <h1 className="text-[20px] font-bold uppercase text-retro-ink">
        SETTINGS
      </h1>
      <p className="text-retro-ink mt-sm">Configuration panels standing by.</p>
    </RetroPanel>
  );
}

function NotFoundPage() {
  return (
    <RetroPanel>
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
  );
}

function LoginPlaceholder() {
  return (
    <RetroPanel>
      <p className="text-retro-ink">Auth loading...</p>
    </RetroPanel>
  );
}

function CallbackPlaceholder() {
  return (
    <RetroPanel>
      <p className="text-retro-ink">Callback loading...</p>
    </RetroPanel>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPlaceholder />} />
      <Route path="/auth/callback" element={<CallbackPlaceholder />} />
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
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
