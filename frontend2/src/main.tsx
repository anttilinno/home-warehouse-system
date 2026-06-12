import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import { defaultLocale, i18n, loadCatalog } from "@/lib/i18n";
import App from "@/App";

// Catalog must be active before first render — Lingui's t/Trans throw on an
// inactive i18n instance. The en catalog is tiny; awaiting it beats a
// flash-of-msgid. On load failure (stale chunk hash, network), activate an
// empty catalog and render anyway — macros embed the en source text as
// fallback, so the app degrades to English instead of a blank page.
const root = createRoot(document.getElementById("root")!);

loadCatalog(defaultLocale)
  .catch((error) => {
    console.error("[i18n] catalog load failed, rendering with fallbacks", error);
    i18n.load(defaultLocale, {});
    i18n.activate(defaultLocale);
  })
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
