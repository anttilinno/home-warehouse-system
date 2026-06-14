import { useEffect } from "react";
import { useLingui } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { settingsApi } from "@/lib/api/settings";
import { loadCatalog, locales, type Locale } from "@/lib/i18n";

// I18N-02 boot fix. main.tsx activates the en catalog before first render so
// Lingui's t/Trans never throw; nothing, however, re-activated the user's
// PERSISTED `language` after auth — so a ru/et user always booted English on
// every reload / next login. The live LanguagePage switch (loadCatalog in its
// mutation handler) masked the gap.
//
// This hook reads the SHARED ["me"] query (settingsApi.getMe — already cached
// app-wide by the settings/format hooks; no new fetch path) and activates the
// stored locale once it differs from the active one.
//
// RENDER-LOOP GUARD (Pitfall 4): loadCatalog activates i18n → re-render. The
// effect runs in an EVENT context (not during render) and is keyed on the
// locale STRING; the `i18n.locale === locale` early-out makes it idempotent, so
// the post-activation re-render does not re-trigger it.
export function useApplyLocale(): void {
  const { i18n } = useLingui();
  const me = useQuery({ queryKey: ["me"], queryFn: () => settingsApi.getMe() });
  const persisted = me.data?.language;

  useEffect(() => {
    if (!persisted) return;
    if (!locales.includes(persisted as Locale)) return; // defensive: ignore junk
    if (i18n.locale === persisted) return; // already active — no redundant import
    loadCatalog(persisted as Locale).catch((err) => {
      console.error("[i18n] persisted-locale activation failed", err);
    });
  }, [persisted, i18n]);
}
