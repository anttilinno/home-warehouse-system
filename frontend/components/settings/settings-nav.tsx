"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard/settings", labelKey: "nav.overview" },
  { href: "/dashboard/settings/profile", labelKey: "nav.profile" },
  { href: "/dashboard/settings/appearance", labelKey: "nav.appearance" },
  { href: "/dashboard/settings/language", labelKey: "nav.language" },
  {
    href: "/dashboard/settings/regional-formats",
    labelKey: "nav.regionalFormats",
  },
  { href: "/dashboard/settings/security", labelKey: "nav.security" },
  {
    href: "/dashboard/settings/notifications",
    labelKey: "nav.notifications",
  },
  { href: "/dashboard/settings/data-storage", labelKey: "nav.dataStorage" },
] as const;

export function SettingsNav() {
  const t = useTranslations("settings");
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const isActive =
          item.href === "/dashboard/settings"
            ? pathname === "/dashboard/settings"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
