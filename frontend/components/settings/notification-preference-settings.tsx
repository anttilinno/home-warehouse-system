"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, Package, Users, Shield, Megaphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/contexts/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { key: "loans", icon: Megaphone },
  { key: "inventory", icon: Package },
  { key: "workspace", icon: Users },
  { key: "system", icon: Shield },
] as const;

export function NotificationPreferenceSettings() {
  const t = useTranslations("settings.notificationPreferences");
  const { user, refreshUser } = useAuth();
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const prefs = user?.notification_preferences ?? {};
  const isEnabled = prefs.enabled !== false;

  const handleToggle = async (key: string, checked: boolean) => {
    setIsUpdating(key);
    const newPrefs = { ...prefs, [key]: checked };

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/me/preferences`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          credentials: "include",
          body: JSON.stringify({ notification_preferences: newPrefs }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to save preferences");
      }

      await refreshUser();
      toast.success(t("saved"));
    } catch {
      toast.error(t("saveError"));
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Master toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="master-toggle">{t("masterToggle")}</Label>
            <p className="text-sm text-muted-foreground">
              {t("masterDescription")}
            </p>
          </div>
          <Switch
            id="master-toggle"
            checked={isEnabled}
            onCheckedChange={(checked) => handleToggle("enabled", checked)}
            disabled={isUpdating !== null}
          />
        </div>

        <Separator />

        {/* Category toggles */}
        <div className={cn("space-y-4", !isEnabled && "opacity-50")}>
          {CATEGORIES.map(({ key, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="space-y-0.5">
                  <Label htmlFor={`toggle-${key}`}>
                    {t(`categories.${key}`)}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t(`categories.${key}Description`)}
                  </p>
                </div>
              </div>
              <Switch
                id={`toggle-${key}`}
                checked={prefs[key] !== false}
                onCheckedChange={(checked) => handleToggle(key, checked)}
                disabled={!isEnabled || isUpdating !== null}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
