import { i18n, type Messages } from "@lingui/core";

export const locales = {
  en: "English",
  et: "Eesti",
} as const;

export type Locale = keyof typeof locales;

export const defaultLocale: Locale = "en";

const catalogImports: Record<string, () => Promise<{ messages: Messages }>> = {
  en: () => import("../../locales/en/messages.ts"),
  et: () => import("../../locales/et/messages.ts"),
};

export async function loadCatalog(locale: string) {
  const { messages } = await catalogImports[locale]();
  i18n.load(locale, messages);
  i18n.activate(locale);
}

export { i18n };
