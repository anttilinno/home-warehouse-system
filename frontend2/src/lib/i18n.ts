import { i18n } from "@lingui/core";

// v3.0 i18n runtime singleton (FOUND-04). Phase 5 mounts <I18nProvider i18n={i18n}>
// in the App.tsx provider stack; Phase 15 fills in real translations for et+ru
// (en is the source locale).
//
// The catalog import path uses Vite's dynamic-import + Lingui's vite-plugin
// transform, which converts the .po file at build time into a JS module
// exporting `messages` (id → translated string).

export const defaultLocale = "en";
export const locales = ["en", "et", "ru"] as const;
export type Locale = (typeof locales)[number];

export async function loadCatalog(locale: Locale): Promise<void> {
  const { messages } = await import(`../locales/${locale}/messages.po`);
  i18n.load(locale, messages);
  i18n.activate(locale);
  // Keep <html lang> in sync with the active locale so assistive tech announces
  // content in the right language (Lingui's activate does not touch the DOM).
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

export { i18n };
