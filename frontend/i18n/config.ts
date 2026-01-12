export const locales = ["en", "et", "ru"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  et: "Eesti",
  ru: "Русский",
};

export const localeFlags: Record<Locale, string> = {
  en: "🇬🇧",
  et: "🇪🇪",
  ru: "🇷🇺",
};
