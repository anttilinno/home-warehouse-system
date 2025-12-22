"use client";

import { useTransition } from "react";
import { Icon } from "@/components/icons";
import { locales, type Locale } from "@/i18n";
import { usePathname, useRouter } from "@/navigation";
import { useLocale } from "next-intl";

const languageNames = {
  en: "English",
  et: "Eesti",
  ru: "Русский",
} as const;

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();

  const switchLanguage = (newLocale: Locale) => {
    startTransition(() => {
      router.replace(pathname, { locale: newLocale });
    });
  };

  return (
    <div className="relative">
      <div className="flex items-center space-x-1">
        <Icon name="Globe" className="w-4 h-4 text-muted-foreground" />
        <select
          value={locale}
          onChange={(e) => switchLanguage(e.target.value as Locale)}
          disabled={isPending}
          className="bg-transparent border-none text-sm font-medium text-foreground hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded px-1 py-0.5 disabled:opacity-50"
          style={{ minWidth: '80px' }}
        >
          {locales.map((l) => (
            <option key={l} value={l}>
              {languageNames[l]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
