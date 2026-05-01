import { lazy, Suspense } from "react";
import { BrowserRouter } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AppRoutes } from "@/routes";

// Phase 1 SUBSET of v2.1's full provider stack. Mounts only:
//   BrowserRouter > QueryClientProvider > AppRoutes
// AuthProvider / ToastProvider / I18nProvider land in Phase 5/6 — provider
// order matches v2.1 production so those phases append without reordering.
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
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AppRoutes />
        {import.meta.env.DEV && (
          <Suspense fallback={null}>
            <ReactQueryDevtoolsLazy initialIsOpen={false} />
          </Suspense>
        )}
      </QueryClientProvider>
    </BrowserRouter>
  );
}
