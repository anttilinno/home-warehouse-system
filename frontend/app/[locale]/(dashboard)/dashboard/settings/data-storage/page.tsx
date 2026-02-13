"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft, HardDrive } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StorageUsage } from "@/components/settings/storage-usage";
import { CacheManagement } from "@/components/settings/cache-management";
import { SyncSettings } from "@/components/settings/sync-settings";
import { BackupRestoreDialog } from "@/components/shared/backup-restore-dialog";

export default function DataStoragePage() {
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
          {t("nav.dataStorage")}
        </h2>
        <p className="text-muted-foreground">{t("dataStorage.description")}</p>
      </div>

      <StorageUsage />
      <CacheManagement />
      <SyncSettings />

      {/* Backup & Restore */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            {t("dataStorage.backupRestore.title")}
          </CardTitle>
          <CardDescription>
            {t("dataStorage.backupRestore.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BackupRestoreDialog
            trigger={
              <Button variant="outline" className="gap-2">
                <HardDrive className="h-4 w-4" />
                {t("dataStorage.backupRestore.openDialog")}
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
