import { useEffect, useState, lazy, Suspense } from "react";
import { BrowserRouter } from "react-router";
import { I18nProvider } from "@lingui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { i18n, loadCatalog, defaultLocale } from "@/lib/i18n";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ToastProvider } from "@/components/retro";
import { AppRoutes } from "@/routes";

const ReactQueryDevtoolsLazy = lazy(() =>
  import("@tanstack/react-query-devtools").then((m) => ({ default: m.ReactQueryDevtools }))
);

function DevtoolsLazy() {
  return (
    <Suspense fallback={null}>
      <ReactQueryDevtoolsLazy initialIsOpen={false} />
    </Suspense>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadCatalog(defaultLocale)
      .then(() => setReady(true))
      .catch((err) => {
        console.error("Failed to load catalog:", err);
        setReady(true);
      });
  }, []);

  if (!ready) return null;

  return (
    <I18nProvider i18n={i18n}>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>
              <AppRoutes />
            </ToastProvider>
          </AuthProvider>
          {import.meta.env.DEV && <DevtoolsLazy />}
        </QueryClientProvider>
      </BrowserRouter>
    </I18nProvider>
  );
}
