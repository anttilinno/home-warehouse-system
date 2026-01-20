"use client";

import { useTranslations } from "next-intl";
import { Database, User, Shield } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackupRestoreDialog } from "@/components/shared/backup-restore-dialog";
import { NotificationSettings } from "@/components/settings/notification-settings";

export default function SettingsPage() {
  const t = useTranslations("settings");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              {t("dataManagement.title")}
            </CardTitle>
            <CardDescription>{t("dataManagement.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t("dataManagement.backupRestore")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("dataManagement.backupRestoreDescription")}
                </p>
              </div>
              <BackupRestoreDialog />
            </div>
          </CardContent>
        </Card>

        {/* Push Notifications */}
        <NotificationSettings />

        {/* Placeholder for future settings */}
        <Card className="opacity-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t("account.title")}
            </CardTitle>
            <CardDescription>{t("account.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("comingSoon")}</p>
          </CardContent>
        </Card>

        <Card className="opacity-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t("security.title")}
            </CardTitle>
            <CardDescription>{t("security.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("comingSoon")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
