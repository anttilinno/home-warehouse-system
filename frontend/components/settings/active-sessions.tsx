"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Monitor, Smartphone, Tablet, LogOut, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { authApi, Session } from "@/lib/api/auth";
import { toast } from "sonner";

function getDeviceIcon(deviceInfo: string) {
  const lower = deviceInfo.toLowerCase();
  if (lower.includes("iphone") || lower.includes("android") || lower.includes("mobile")) {
    return Smartphone;
  }
  if (lower.includes("ipad") || lower.includes("tablet")) {
    return Tablet;
  }
  return Monitor;
}

export function ActiveSessions() {
  const t = useTranslations("settings.security.sessions");
  const queryClient = useQueryClient();

  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => authApi.getSessions(),
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => authApi.revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success(t("revokeSuccess"));
    },
    onError: () => {
      toast.error(t("revokeError"));
    },
  });

  const revokeAllMutation = useMutation({
    mutationFn: () => authApi.revokeAllOtherSessions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success(t("revokeAllSuccess"));
    },
    onError: () => {
      toast.error(t("revokeAllError"));
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">{t("loadError")}</p>
    );
  }

  const hasOtherSessions = sessions && sessions.filter(s => !s.is_current).length > 0;

  return (
    <div className="space-y-4">
      {sessions?.map((session) => {
        const DeviceIcon = getDeviceIcon(session.device_info);
        return (
          <div
            key={session.id}
            className="flex items-center justify-between p-3 border rounded-lg"
          >
            <div className="flex items-center gap-3">
              <DeviceIcon className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">
                    {session.device_info || t("unknownDevice")}
                  </p>
                  {session.is_current && (
                    <Badge variant="secondary" className="text-xs">
                      {t("currentSession")}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("lastActive", {
                    time: formatDistanceToNow(new Date(session.last_active_at), {
                      addSuffix: true,
                    }),
                  })}
                </p>
              </div>
            </div>
            {!session.is_current && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => revokeMutation.mutate(session.id)}
                disabled={revokeMutation.isPending}
                title={t("revokeButton")}
              >
                {revokeMutation.isPending && revokeMutation.variables === session.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        );
      })}

      {hasOtherSessions && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => revokeAllMutation.mutate()}
          disabled={revokeAllMutation.isPending}
        >
          {revokeAllMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {t("revokeAllButton")}
        </Button>
      )}

      {sessions?.length === 1 && sessions[0].is_current && (
        <p className="text-sm text-muted-foreground text-center">
          {t("onlyCurrentSession")}
        </p>
      )}
    </div>
  );
}
