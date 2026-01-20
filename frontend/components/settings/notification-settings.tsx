"use client";

import { useTranslations } from "next-intl";
import { Bell, BellOff, Smartphone, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { usePushNotifications } from "@/lib/hooks/use-push-notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export function NotificationSettings() {
  const t = useTranslations("settings.pushNotifications");
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  // Not supported in this browser
  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("notSupported.title")}</AlertTitle>
            <AlertDescription>{t("notSupported.description")}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Permission denied
  if (permission === "denied") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("denied.title")}</AlertTitle>
            <AlertDescription>{t("denied.description")}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {isSubscribed ? t("status.enabled") : t("status.disabled")}
            </span>
          </div>
          <Badge variant={isSubscribed ? "default" : "secondary"}>
            {isSubscribed ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {t("badge.active")}
              </span>
            ) : (
              t("badge.inactive")
            )}
          </Badge>
        </div>

        {/* Error message */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Toggle button */}
        <Button
          onClick={handleToggle}
          disabled={isLoading}
          variant={isSubscribed ? "outline" : "default"}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("button.loading")}
            </>
          ) : isSubscribed ? (
            <>
              <BellOff className="mr-2 h-4 w-4" />
              {t("button.disable")}
            </>
          ) : (
            <>
              <Bell className="mr-2 h-4 w-4" />
              {t("button.enable")}
            </>
          )}
        </Button>

        {/* Info text */}
        <p className="text-xs text-muted-foreground">{t("info")}</p>
      </CardContent>
    </Card>
  );
}
