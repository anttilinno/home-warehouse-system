"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { User, Palette, Shield, Database, Mail, KeyRound } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BackupRestoreDialog } from "@/components/shared/backup-restore-dialog";
import { ActiveSessions } from "@/components/settings/active-sessions";
import { DateFormatSettings } from "@/components/settings/date-format-settings";
import { TimeFormatSettings } from "@/components/settings/time-format-settings";
import { NumberFormatSettings } from "@/components/settings/number-format-settings";
import { ProfileEditSheet } from "@/components/dashboard/profile-edit-sheet";
import { useAuth } from "@/lib/contexts/auth-context";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tAccount = useTranslations("settings.account");
  const tSecurity = useTranslations("settings.security");
  const { user } = useAuth();
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);

  const initials = user?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      <div className="flex flex-col gap-8">
        {/* Account Settings Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Account Settings</h2>
          </div>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="space-y-1.5">
                <CardTitle>{tAccount("title")}</CardTitle>
                <CardDescription>{tAccount("description")}</CardDescription>
              </div>
              <Button variant="outline" onClick={() => setProfileSheetOpen(true)}>
                Edit Profile
              </Button>
            </CardHeader>
            <CardContent>
              {/* User Profile Display */}
              <div className="flex items-start gap-4 mb-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage
                    src={user?.avatar_url || undefined}
                    alt={user?.full_name || "User"}
                  />
                  <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{user?.full_name}</p>
                      <p className="text-xs text-muted-foreground">Full Name</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{user?.email}</p>
                      <p className="text-xs text-muted-foreground">Email Address</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">••••••••</p>
                      <p className="text-xs text-muted-foreground">Password</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Personalization Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Personalization</h2>
          </div>
          <div className="flex flex-col gap-4">
            <DateFormatSettings />
            <TimeFormatSettings />
            <NumberFormatSettings />
          </div>
        </section>

        <Separator />

        {/* Security Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Security</h2>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{tSecurity("sessions.title")}</CardTitle>
              <CardDescription>
                Manage your active sessions across devices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActiveSessions />
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Data Management Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">{t("dataManagement.title")}</h2>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t("dataManagement.backupRestore")}</CardTitle>
              <CardDescription>
                {t("dataManagement.backupRestoreDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BackupRestoreDialog />
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Profile Edit Sheet */}
      <ProfileEditSheet
        open={profileSheetOpen}
        onOpenChange={setProfileSheetOpen}
      />
    </div>
  );
}
