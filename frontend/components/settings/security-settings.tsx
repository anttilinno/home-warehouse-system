"use client";

import { useTranslations } from "next-intl";
import { Shield, KeyRound, Smartphone, AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PasswordChange } from "./password-change";
import { ActiveSessions } from "./active-sessions";
import { DeleteAccountDialog } from "./delete-account-dialog";

export function SecuritySettings() {
  const t = useTranslations("settings.security");
  const tDanger = useTranslations("settings.dangerZone");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Password Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            {t("password.title")}
          </h3>
          <PasswordChange />
        </div>

        {/* Sessions Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            {t("sessions.title")}
          </h3>
          <ActiveSessions />
        </div>

        {/* Danger Zone Section */}
        <div className="space-y-4 border-t pt-6">
          <h3 className="text-sm font-medium flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {tDanger("title")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {tDanger("description")}
          </p>
          <DeleteAccountDialog />
        </div>
      </CardContent>
    </Card>
  );
}
