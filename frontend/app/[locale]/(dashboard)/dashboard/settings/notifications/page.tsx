"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { NotificationPreferenceSettings } from "@/components/settings/notification-preference-settings";
import { NotificationSettings } from "@/components/settings/notification-settings";

export default function NotificationsPage() {
  const t = useTranslations("settings");

  return (
    <div className="space-y-6">
      {/* Mobile back link */}
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground md:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("title")}
      </Link>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {t("nav.notifications")}
        </h2>
        <p className="text-muted-foreground">
          {t("notifications.description")}
        </p>
      </div>

      <NotificationPreferenceSettings />
      <NotificationSettings />
    </div>
  );
}
