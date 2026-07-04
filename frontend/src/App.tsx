import { lazy, Suspense } from "react";
import { BrowserRouter } from "react-router";
import { onlineManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/useTheme";
import { queryClient } from "@/lib/queryClient";
import { persister, CACHE_BUSTER } from "@/lib/offline/persister";
import { registerMutationDefaults } from "@/lib/offline/mutationDefaults";
import { requestPersistentStorage } from "@/lib/offline/persistStorage";
import { ShortcutsProvider } from "@/components/shortcuts";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { AppRoutes } from "@/routes";

// SUBSET of v2.1's full provider stack. FINAL canonical tree (PROV-01, Phase 6):
//   I18nProvider > BrowserRouter > PersistQueryClientProvider (offline-first
//   PWA Phase 1; same slot the plain QueryClientProvider occupied)
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

// Offline write queue (Phase 3): registers the itemCreate mutationFn/scope/
// onSettled on the singleton queryClient BEFORE any mutation can fire — module
// scope runs once, on first import of App.tsx, ahead of render.
registerMutationDefaults();

// Best-effort persistent storage (Phase A1) — fire-and-forget, never delays
// first render. Guards the paused offline-write queue against storage-
// pressure eviction.
void requestPersistentStorage();

// Seed onlineManager from the real initial network state. It defaults to
// `true` and only flips on window online/offline TRANSITION events — so a
// cold launch or reload WHILE OFFLINE would otherwise report ONLINE. That
// would make PersistQueryClientProvider's onSuccess → resumePausedMutations
// (below) drain the restored offline-write queue against a dead network,
// erroring each write out (retry:0) and LOSING it — the exact "relaunched the
// app while still in the field with no signal" case. Seeding it means a
// still-offline boot keeps those mutations paused until a genuine reconnect.
if (typeof navigator !== "undefined" && "onLine" in navigator) {
  onlineManager.setOnline(navigator.onLine);
}

export default function App() {
  return (
    <I18nProvider i18n={i18n}>
      <ThemeProvider>
        <BrowserRouter>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister,
              buster: CACHE_BUSTER,
              maxAge: 7 * 24 * 60 * 60 * 1000,
              dehydrateOptions: {
                shouldDehydrateMutation: (m) => m.state.isPaused,
              },
            }}
            onSuccess={() => {
              queryClient.resumePausedMutations();
            }}
          >
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
          </PersistQueryClientProvider>
        </BrowserRouter>
      </ThemeProvider>
    </I18nProvider>
  );
}
