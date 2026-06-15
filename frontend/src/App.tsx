import { lazy, Suspense } from "react";
import { BrowserRouter } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/useTheme";
import { queryClient } from "@/lib/queryClient";
import { ShortcutsProvider } from "@/components/shortcuts";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { AppRoutes } from "@/routes";

// SUBSET of v2.1's full provider stack. FINAL canonical tree (PROV-01, Phase 6):
//   I18nProvider > BrowserRouter > QueryClientProvider
//     ├─ ShortcutsProvider > ModalStackProvider > AppRoutes
//     │     (and, deep inside an authed route: WorkspaceProvider > SSEProvider
//     │      in AppShell — SSE needs a wsId + an authed session, so it CANNOT
//     │      sit above the router; RESEARCH §1 / D-12)
//     └─ RetroToaster  (root-level sibling of the router subtree)
// (I18nProvider pulled forward from Phase 6 for the retro-os sample screens;
// main.tsx awaits loadCatalog("en") before render.) ShortcutsProvider (Plan
// 03-01, the keyboard-shortcut SSOT) + ModalStackProvider (Plan 03-02, the
// capture-phase ESC arbiter) are mounted INSIDE the router so the AppShell
// chrome AND the routed content both consume the same SSOT + modal stack.
// RetroToaster (Plan 04-05, sonner skin) mounts at the App ROOT — NOT inside
// AppShell — so a toast fired from /login (e.g. a failed login) still renders
// and toasts persist across navigation (RESEARCH §1 decision). Phase 6 only
// APPENDS RetroToaster (here) + SSEProvider (AppShell); it does NOT reorder the
// shipped I18n > Router > Query > Shortcuts > ModalStack chain (the 03-06 /
// 05-03 append-without-reorder contract).
//
// Devtools are React.lazy + DEV-gated (Pitfall 4). Vite static-replaces
// import.meta.env.DEV to false for production builds; the dead branch is then
// tree-shaken so '__react-query-devtools' never appears in dist/.
const ReactQueryDevtoolsLazy = lazy(() =>
  import("@tanstack/react-query-devtools").then((m) => ({
    default: m.ReactQueryDevtools,
  })),
);

export default function App() {
  return (
    <I18nProvider i18n={i18n}>
      <ThemeProvider>
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <ShortcutsProvider>
              <ModalStackProvider>
                <AppRoutes />
              </ModalStackProvider>
            </ShortcutsProvider>
            {/* Toast region — root-level sibling of the router subtree so toasts
              render on /login AND survive navigation (RESEARCH §1). */}
            <RetroToaster />
            {import.meta.env.DEV && (
              <Suspense fallback={null}>
                <ReactQueryDevtoolsLazy initialIsOpen={false} />
              </Suspense>
            )}
          </QueryClientProvider>
        </BrowserRouter>
      </ThemeProvider>
    </I18nProvider>
  );
}
