import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { LoadingBar } from "./LoadingBar";

export function AppShell() {
  const { t } = useLingui();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close drawer on Escape key
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [drawerOpen]);

  // Close drawer on location change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-dvh bg-retro-charcoal">
      <LoadingBar />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-sm focus:bg-retro-amber focus:text-retro-ink"
      >
        {t`Skip to main content`}
      </a>
      <div className="flex">
        {/* Desktop sidebar -- fixed position */}
        <div className="hidden md:block fixed left-0 top-0 h-dvh w-[240px] z-10">
          <Sidebar className="h-full" />
        </div>

        {/* Mobile drawer backdrop */}
        <div
          className={`fixed inset-0 bg-black/50 z-20 transition-opacity duration-200 ${
            drawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />

        {/* Mobile drawer panel */}
        <div
          className={`fixed left-0 top-0 h-dvh w-[240px] bg-retro-cream border-r-retro-thick border-retro-ink shadow-retro-raised z-30 transform transition-transform duration-200 ease-out md:hidden ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar className="h-full" onNavClick={() => setDrawerOpen(false)} />
        </div>

        {/* Main content column */}
        <div className="flex-1 md:ml-[240px]">
          <TopBar
            onMenuClick={() => setDrawerOpen(!drawerOpen)}
            drawerOpen={drawerOpen}
          />
          <main id="main-content" className="p-lg">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
