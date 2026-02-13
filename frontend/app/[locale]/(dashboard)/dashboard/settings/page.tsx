"use client";

import { useTranslations } from "next-intl";
import {
  Palette,
  Globe,
  Calendar,
  Shield,
  Bell,
  Database,
  ChevronRight,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/contexts/auth-context";
import { SettingsRow } from "@/components/settings/settings-row";
import { localeNames, type Locale } from "@/i18n/config";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const { user } = useAuth();

  const initials =
    user?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "?";

  const themePreview =
    user?.theme === "dark"
      ? t("hub.dark")
      : user?.theme === "light"
        ? t("hub.light")
        : t("hub.system");

  const languagePreview =
    localeNames[(user?.language || "en") as Locale] || "English";

  const datePreview = user?.date_format || "YYYY-MM-DD";

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Link href="/dashboard/settings/profile">
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
          <CardContent className="flex items-center gap-4 p-4">
            <Avatar className="h-16 w-16">
              <AvatarImage
                src={user?.avatar_url || undefined}
                alt={user?.full_name || "User"}
              />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg">{user?.full_name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      {/* Preferences Group */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground px-1 mb-2">
          {t("hub.preferences")}
        </h3>
        <div className="space-y-2">
          <SettingsRow
            icon={Palette}
            label={t("nav.appearance")}
            description={t("hub.appearanceDesc")}
            href="/dashboard/settings/appearance"
            preview={themePreview}
          />
          <SettingsRow
            icon={Globe}
            label={t("nav.language")}
            description={t("hub.languageDesc")}
            href="/dashboard/settings/language"
            preview={languagePreview}
          />
          <SettingsRow
            icon={Calendar}
            label={t("nav.regionalFormats")}
            description={t("hub.regionalFormatsDesc")}
            href="/dashboard/settings/regional-formats"
            preview={datePreview}
          />
        </div>
      </div>

      {/* System & Security Group */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground px-1 mb-2">
          {t("hub.systemSecurity")}
        </h3>
        <div className="space-y-2">
          <SettingsRow
            icon={Shield}
            label={t("nav.security")}
            description={t("hub.securityDesc")}
            href="/dashboard/settings/security"
          />
          <SettingsRow
            icon={Bell}
            label={t("nav.notifications")}
            description={t("hub.notificationsDesc")}
            href="/dashboard/settings/notifications"
          />
          <SettingsRow
            icon={Database}
            label={t("nav.dataStorage")}
            description={t("hub.dataStorageDesc")}
            href="/dashboard/settings/data-storage"
          />
        </div>
      </div>
    </div>
  );
}
