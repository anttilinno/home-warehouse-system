"use client";

import { useTranslations } from "next-intl";
import { Database, Smartphone } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackupRestoreDialog } from "@/components/shared/backup-restore-dialog";
import { ActiveSessions } from "@/components/settings/active-sessions";
import { DateFormatSettings } from "@/components/settings/date-format-settings";
import { TimeFormatSettings } from "@/components/settings/time-format-settings";
import { NumberFormatSettings } from "@/components/settings/number-format-settings";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tSecurity = useTranslations("settings.security");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Data Management - Compact */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-4 w-4" />
              {t("dataManagement.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t("dataManagement.backupRestore")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("dataManagement.backupRestoreDescription")}
                </p>
              </div>
              <BackupRestoreDialog />
            </div>
          </CardContent>
        </Card>

        {/* Format Settings */}
        <DateFormatSettings />
        <TimeFormatSettings />
        <NumberFormatSettings />

        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              {tSecurity("sessions.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActiveSessions />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
