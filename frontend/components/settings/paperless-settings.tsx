"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/contexts/auth-context";
import { paperlessApi } from "@/lib/api/paperless";

export function PaperlessSettings() {
  const t = useTranslations("settings.paperless");
  const { currentWorkspace } = useAuth();
  const workspaceId = currentWorkspace?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [syncTags, setSyncTags] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    setLoading(true);
    paperlessApi
      .getSettings(workspaceId)
      .then((s) => {
        if (cancelled) return;
        setConfigured(s.configured);
        setHasToken(!!s.has_token);
        setBaseUrl(s.base_url ?? "");
        setEnabled(!!s.is_enabled);
        setSyncTags(!!s.sync_tags_enabled);
      })
      .catch(() => {
        if (!cancelled) toast.error(t("loadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, t]);

  const handleSave = async () => {
    if (!workspaceId) return;
    if (!baseUrl.trim()) {
      toast.error(t("baseUrlRequired"));
      return;
    }
    // A token is required the first time; later it may be omitted to keep the
    // stored one.
    if (!hasToken && !token.trim()) {
      toast.error(t("tokenRequired"));
      return;
    }
    setSaving(true);
    try {
      const result = await paperlessApi.saveSettings(workspaceId, {
        base_url: baseUrl.trim(),
        api_token: token.trim() || undefined,
        sync_tags_enabled: syncTags,
        is_enabled: enabled,
      });
      setConfigured(result.configured);
      setHasToken(!!result.has_token);
      setToken("");
      toast.success(t("saved"));
    } catch {
      toast.error(t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!workspaceId) return;
    setSaving(true);
    try {
      await paperlessApi.deleteSettings(workspaceId);
      setConfigured(false);
      setHasToken(false);
      setBaseUrl("");
      setToken("");
      setEnabled(false);
      setSyncTags(false);
      toast.success(t("disconnected"));
    } catch {
      toast.error(t("disconnectError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("loading")}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="paperless-base-url">{t("baseUrl")}</Label>
              <Input
                id="paperless-base-url"
                type="url"
                placeholder="https://paperless.example.com"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paperless-token">{t("apiToken")}</Label>
              <Input
                id="paperless-token"
                type="password"
                placeholder={hasToken ? t("tokenStored") : t("tokenPlaceholder")}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                {hasToken ? t("tokenKeepHint") : t("tokenHint")}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="paperless-enabled">{t("enabled")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("enabledHint")}
                </p>
              </div>
              <Switch
                id="paperless-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="paperless-sync-tags">{t("syncTags")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("syncTagsHint")}
                </p>
              </div>
              <Switch
                id="paperless-sync-tags"
                checked={syncTags}
                onCheckedChange={setSyncTags}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("save")}
              </Button>
              {configured && (
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={saving}
                >
                  {t("disconnect")}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
