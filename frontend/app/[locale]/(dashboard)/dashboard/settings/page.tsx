"use client";

import { useTranslations } from "next-intl";
import { Database, Smartphone, KeyRound } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackupRestoreDialog } from "@/components/shared/backup-restore-dialog";
import { ActiveSessions } from "@/components/settings/active-sessions";
import { PasswordChange } from "@/components/settings/password-change";

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

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column */}
        <div className="flex flex-col gap-6">
          {/* Data Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                {t("dataManagement.title")}
              </CardTitle>
              <CardDescription>{t("dataManagement.description")}</CardDescription>
            </CardHeader>
            <CardContent>
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

          {/* Password */}
          <Card className="flex-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                {tSecurity("password.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PasswordChange />
            </CardContent>
          </Card>
        </div>

        {/* Active Sessions */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              {tSecurity("sessions.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            <ActiveSessions />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
