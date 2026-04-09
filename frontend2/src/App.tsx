import { useEffect, useState } from "react";
import { BrowserRouter } from "react-router";
import { I18nProvider } from "@lingui/react";
import { i18n, loadCatalog, defaultLocale } from "@/lib/i18n";
import { AppRoutes } from "@/routes";

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadCatalog(defaultLocale).then(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <I18nProvider i18n={i18n}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </I18nProvider>
  );
}
