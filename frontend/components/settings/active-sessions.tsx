"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await authApi.getSessions();
      // Sort by last_active_at and take only the last 5 sessions
      const sortedSessions = data
        .sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime())
        .slice(0, 5);
      setSessions(sortedSessions);
    } catch {
      setError(t("loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRevoke = async (sessionId: string) => {
    try {
      setRevokingId(sessionId);
      await authApi.revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast.success(t("revokeSuccess"));
    } catch {
      toast.error(t("revokeError"));
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    try {
      setIsRevokingAll(true);
      await authApi.revokeAllOtherSessions();
      setSessions((prev) => prev.filter((s) => s.is_current));
      toast.success(t("revokeAllSuccess"));
    } catch {
      toast.error(t("revokeAllError"));
    } finally {
      setIsRevokingAll(false);
    }
  };

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
      <p className="text-sm text-destructive">{error}</p>
    );
  }

  const hasOtherSessions = sessions.filter((s) => !s.is_current).length > 0;

  return (
    <div className="space-y-4">
      {sessions.map((session) => {
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
                onClick={() => handleRevoke(session.id)}
                disabled={revokingId === session.id}
                title={t("revokeButton")}
              >
                {revokingId === session.id ? (
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
          onClick={handleRevokeAll}
          disabled={isRevokingAll}
        >
          {isRevokingAll && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {t("revokeAllButton")}
        </Button>
      )}

      {sessions.length === 1 && sessions[0].is_current && (
        <p className="text-sm text-muted-foreground text-center">
          {t("onlyCurrentSession")}
        </p>
      )}
    </div>
  );
}
