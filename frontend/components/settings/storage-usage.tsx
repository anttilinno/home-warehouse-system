"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { HardDrive, RefreshCw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils/format-bytes";

export function StorageUsage() {
  const t = useTranslations("settings.dataStorage.storageUsage");
  const [usage, setUsage] = useState(0);
  const [quota, setQuota] = useState(0);
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchEstimate = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
      setSupported(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const estimate = await navigator.storage.estimate();
      setUsage(estimate.usage ?? 0);
      setQuota(estimate.quota ?? 0);
      setSupported(true);
    } catch {
      setSupported(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEstimate();
  }, [fetchEstimate]);

  const percent = quota > 0 ? ((usage / quota) * 100).toFixed(1) : "0";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!supported ? (
          <p className="text-sm text-muted-foreground">{t("unsupported")}</p>
        ) : loading ? (
          <div className="space-y-3">
            <Progress value={0} className="h-2" />
            <p className="text-sm text-muted-foreground">...</p>
          </div>
        ) : (
          <>
            <Progress value={parseFloat(percent)} className="h-2" />
            <p className="text-sm text-muted-foreground">
              {t("used", {
                usage: formatBytes(usage),
                quota: formatBytes(quota),
                percent,
              })}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {t("approximate")}
            </p>
          </>
        )}
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchEstimate}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            {t("refresh")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
