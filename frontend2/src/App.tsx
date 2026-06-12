import { lazy, Suspense } from "react";
import { BrowserRouter } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { queryClient } from "@/lib/queryClient";
import { ShortcutsProvider } from "@/components/shortcuts";
import { ModalStackProvider } from "@/components/modal";
import { AppRoutes } from "@/routes";

// SUBSET of v2.1's full provider stack. Mounts:
//   I18nProvider > BrowserRouter > QueryClientProvider
//     > ShortcutsProvider > ModalStackProvider > AppRoutes
// (I18nProvider pulled forward from Phase 6 for the retro-os sample screens;
// main.tsx awaits loadCatalog("en") before render.) ShortcutsProvider (Plan
// 03-01, the keyboard-shortcut SSOT) + ModalStackProvider (Plan 03-02, the
// capture-phase ESC arbiter) are mounted INSIDE the router so the AppShell
// chrome AND the routed content both consume the same SSOT + modal stack
// (PROV-01 final order is Intl > Query > Auth > SSE > Toast > Shortcuts >
// Router; Auth/SSE/Toast land in Phases 5/6 and append without reordering the
// existing providers' relative positions). AuthProvider / ToastProvider land
// in Phase 5/6 — provider order matches v2.1 production so those phases append
// without reordering.
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
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <ShortcutsProvider>
            <ModalStackProvider>
              <AppRoutes />
            </ModalStackProvider>
          </ShortcutsProvider>
          {import.meta.env.DEV && (
            <Suspense fallback={null}>
              <ReactQueryDevtoolsLazy initialIsOpen={false} />
            </Suspense>
          )}
        </QueryClientProvider>
      </BrowserRouter>
    </I18nProvider>
  );
}
