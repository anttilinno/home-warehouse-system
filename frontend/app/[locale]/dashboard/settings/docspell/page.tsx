"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { useAuth } from "@/lib/auth";
import { useTranslations } from "next-intl";
import {
  docspellApi,
  DocspellSettings,
  DocspellConnectionTest,
  getTranslatedErrorMessage,
} from "@/lib/api";
import { Link } from "@/navigation";
import { cn } from "@/lib/utils";
import { NES_GREEN, NES_RED } from "@/lib/nes-colors";
import { useThemed, useThemedClasses } from "@/lib/themed";

export default function DocspellSettingsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const t = useTranslations("docspell");
  const tErrors = useTranslations();
  const themed = useThemed();
  const classes = useThemedClasses();

  const { Button, Card, PageHeader, Modal, Input, Checkbox, Label, Hint, Error } = themed;

  // Settings state
  const [settings, setSettings] = useState<DocspellSettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [baseUrl, setBaseUrl] = useState("");
  const [collectiveName, setCollectiveName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [syncTagsEnabled, setSyncTagsEnabled] = useState(false);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Connection test state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<DocspellConnectionTest | null>(null);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load settings on mount
  const loadSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    setLoadError(null);
    try {
      const data = await docspellApi.getSettings();
      setSettings(data);
      if (data) {
        setBaseUrl(data.base_url);
        setCollectiveName(data.collective_name);
        setUsername(data.username);
        setSyncTagsEnabled(data.sync_tags_enabled);
      }
    } catch (e) {
      const err = e as Error;
      setLoadError(
        getTranslatedErrorMessage(
          err.message || "Unknown error",
          (key) => tErrors(key)
        )
      );
    } finally {
      setIsLoadingSettings(false);
    }
  }, [tErrors]);

  useEffect(() => {
    if (isAuthenticated) {
      loadSettings();
    }
  }, [isAuthenticated, loadSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    setTestResult(null);

    try {
      if (settings) {
        // Update existing settings
        const updateData: Record<string, unknown> = {
          base_url: baseUrl,
          collective_name: collectiveName,
          username: username,
          sync_tags_enabled: syncTagsEnabled,
        };
        // Only include password if it was changed
        if (password) {
          updateData.password = password;
        }
        const updated = await docspellApi.updateSettings(updateData);
        setSettings(updated);
        setPassword(""); // Clear password field after save
      } else {
        // Create new settings
        const created = await docspellApi.createSettings({
          base_url: baseUrl,
          collective_name: collectiveName,
          username: username,
          password: password,
          sync_tags_enabled: syncTagsEnabled,
        });
        setSettings(created);
        setPassword(""); // Clear password field after save
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      const err = e as Error;
      setSaveError(
        getTranslatedErrorMessage(
          err.message || "Unknown error",
          (key) => tErrors(key)
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await docspellApi.testConnection();
      setTestResult(result);
    } catch (e) {
      const err = e as Error;
      setTestResult({
        success: false,
        message: err.message || "Unknown error",
        version: null,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!settings) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await docspellApi.updateSettings({
        is_enabled: !settings.is_enabled,
      });
      setSettings(updated);
    } catch (e) {
      const err = e as Error;
      setSaveError(
        getTranslatedErrorMessage(
          err.message || "Unknown error",
          (key) => tErrors(key)
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await docspellApi.deleteSettings();
      setSettings(null);
      setBaseUrl("");
      setCollectiveName("");
      setUsername("");
      setPassword("");
      setSyncTagsEnabled(false);
      setShowDeleteConfirm(false);
      setTestResult(null);
    } catch (e) {
      const err = e as Error;
      setSaveError(
        getTranslatedErrorMessage(
          err.message || "Unknown error",
          (key) => tErrors(key)
        )
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (authLoading) {
    return (
      <div className={cn(
        "flex items-center justify-center min-h-[400px]",
        classes.isRetro && "retro-body"
      )}>
        {classes.isRetro ? (
          <div className="retro-small uppercase text-muted-foreground">{t("title")}...</div>
        ) : (
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        )}
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <div className={cn(
          "flex items-center gap-2 mb-2",
          classes.isRetro ? "retro-small uppercase text-muted-foreground retro-body" : "text-sm text-muted-foreground"
        )}>
          <Link href="/dashboard/settings" className="hover:text-foreground transition-colors">
            {t("backToSettings")}
          </Link>
          <Icon name="ChevronRight" className="w-4 h-4" />
          <span className="text-foreground">{t("title")}</span>
        </div>
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
      </div>

      <div className="grid gap-6 w-full">
        {isLoadingSettings ? (
          <div className="flex items-center justify-center py-12">
            {classes.isRetro ? (
              <div className="retro-small uppercase text-muted-foreground retro-body">Loading...</div>
            ) : (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            )}
          </div>
        ) : loadError ? (
          <div className={cn(
            "p-4",
            classes.isRetro
              ? "border-4"
              : "bg-destructive/10 border border-destructive/30 rounded-lg"
          )} style={classes.isRetro ? { borderColor: NES_RED, backgroundColor: 'rgba(206, 55, 43, 0.1)' } : undefined}>
            <p className={cn(
              classes.isRetro ? "retro-small uppercase retro-body" : "text-destructive"
            )} style={classes.isRetro ? { color: NES_RED } : undefined}>{loadError}</p>
            <button
              onClick={loadSettings}
              className={cn(
                "mt-2",
                classes.isRetro
                  ? "retro-small uppercase font-bold text-primary hover:underline retro-body"
                  : "text-sm text-primary hover:underline"
              )}
            >
              {t("retry")}
            </button>
          </div>
        ) : (
          <>
            {/* Status Card */}
            {settings && (
              <Card>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        classes.isRetro ? "w-4 h-4 border-4 border-border" : "w-3 h-3 rounded-full"
                      )}
                      style={classes.isRetro
                        ? { backgroundColor: settings.is_enabled ? NES_GREEN : '#9ca3af' }
                        : { backgroundColor: settings.is_enabled ? '#22c55e' : '#9ca3af' }
                      }
                    />
                    <div>
                      <h3 className={cn(
                        "text-foreground",
                        classes.isRetro ? "font-bold retro-body retro-small" : "font-medium"
                      )}>
                        {settings.is_enabled ? t("statusEnabled") : t("statusDisabled")}
                      </h3>
                      <p className={cn(
                        "text-muted-foreground",
                        classes.isRetro ? "retro-small uppercase retro-body" : "text-sm"
                      )}>
                        {settings.last_sync_at
                          ? t("lastSync", { date: new Date(settings.last_sync_at).toLocaleString() })
                          : t("neverSynced")}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleToggleEnabled}
                    disabled={isSaving}
                    variant={settings.is_enabled ? "muted" : "primary"}
                  >
                    {settings.is_enabled ? t("disable") : t("enable")}
                  </Button>
                </div>
              </Card>
            )}

            {/* Connection Form */}
            <Card>
              <h3 className={cn(
                "mb-4 flex items-center gap-2",
                classes.isRetro
                  ? "text-sm font-bold uppercase retro-heading text-foreground"
                  : "text-lg font-semibold text-foreground"
              )}>
                <Icon name="Settings" className="w-5 h-5" />
                {settings ? t("editConnection") : t("setupConnection")}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="baseUrl">{t("baseUrl")} *</Label>
                  <Input
                    id="baseUrl"
                    type="url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    required
                    placeholder="https://docs.example.com"
                  />
                  <Hint>{t("baseUrlHint")}</Hint>
                </div>

                <div>
                  <Label htmlFor="collectiveName">{t("collectiveName")} *</Label>
                  <Input
                    id="collectiveName"
                    type="text"
                    value={collectiveName}
                    onChange={(e) => setCollectiveName(e.target.value)}
                    required
                    placeholder="my-collective"
                  />
                  <Hint>{t("collectiveNameHint")}</Hint>
                </div>

                <div>
                  <Label htmlFor="username">{t("username")} *</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="password">{t("password")} {settings ? "" : "*"}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!settings}
                    placeholder={settings ? t("passwordPlaceholderUpdate") : ""}
                  />
                  {settings && <Hint>{t("passwordHint")}</Hint>}
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="syncTagsEnabled"
                    checked={syncTagsEnabled}
                    onChange={(e) => setSyncTagsEnabled(e.target.checked)}
                  />
                  <label
                    htmlFor="syncTagsEnabled"
                    className={cn(
                      "text-foreground",
                      classes.isRetro ? "retro-small uppercase retro-body" : "text-sm"
                    )}
                  >
                    {t("enableTagSync")}
                  </label>
                </div>
                <Hint className="ml-7">{t("tagSyncHint")}</Hint>

                {saveError && <Error>{saveError}</Error>}

                {saveSuccess && (
                  <p className={cn(
                    classes.isRetro ? "retro-small uppercase retro-body" : "text-sm text-green-600"
                  )} style={classes.isRetro ? { color: NES_GREEN } : undefined}>
                    {t("saveSuccess")}
                  </p>
                )}

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={isSaving}
                    variant="primary"
                    loading={isSaving}
                  >
                    {isSaving ? t("saving") : settings ? t("saveChanges") : t("connect")}
                  </Button>

                  {settings && (
                    <Button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTesting}
                      variant="muted"
                      loading={isTesting}
                    >
                      {isTesting ? t("testing") : t("testConnection")}
                    </Button>
                  )}
                </div>
              </form>

              {/* Connection Test Result */}
              {testResult && (
                <div
                  className={cn(
                    "mt-4 p-4",
                    classes.isRetro
                      ? "border-4"
                      : cn(
                          "rounded-lg border",
                          testResult.success
                            ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
                            : "bg-destructive/10 border-destructive/30"
                        )
                  )}
                  style={classes.isRetro ? {
                    borderColor: testResult.success ? NES_GREEN : NES_RED,
                    backgroundColor: testResult.success ? 'rgba(146, 204, 65, 0.1)' : 'rgba(206, 55, 43, 0.1)',
                  } : undefined}
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      name={testResult.success ? "CheckCircle" : "XCircle"}
                      className={cn(
                        "w-5 h-5",
                        !classes.isRetro && (testResult.success ? "text-green-600" : "text-destructive")
                      )}
                      style={classes.isRetro ? { color: testResult.success ? NES_GREEN : NES_RED } : undefined}
                    />
                    <span
                      className={cn(
                        classes.isRetro
                          ? "font-bold retro-body retro-small"
                          : cn(
                              "font-medium",
                              testResult.success ? "text-green-700 dark:text-green-400" : "text-destructive"
                            )
                      )}
                      style={classes.isRetro ? { color: testResult.success ? NES_GREEN : NES_RED } : undefined}
                    >
                      {testResult.success ? t("connectionSuccess") : t("connectionFailed")}
                    </span>
                  </div>
                  <p className={cn(
                    "mt-1 text-muted-foreground",
                    classes.isRetro ? "retro-small retro-body" : "text-sm"
                  )}>
                    {testResult.message}
                  </p>
                  {testResult.version && (
                    <p className={cn(
                      "mt-1 text-muted-foreground",
                      classes.isRetro ? "retro-small retro-body" : "text-sm"
                    )}>
                      {t("docspellVersion", { version: testResult.version })}
                    </p>
                  )}
                </div>
              )}
            </Card>

            {/* Danger Zone */}
            {settings && (
              <div className={cn(
                "bg-card p-6",
                classes.isRetro ? "border-4 retro-shadow" : "rounded-lg border border-destructive/30 shadow-sm"
              )} style={classes.isRetro ? { borderColor: NES_RED } : undefined}>
                <h3 className={cn(
                  "mb-4 flex items-center gap-2",
                  classes.isRetro
                    ? "text-sm font-bold uppercase retro-heading"
                    : "text-lg font-semibold text-destructive"
                )} style={classes.isRetro ? { color: NES_RED } : undefined}>
                  <Icon name="AlertTriangle" className="w-5 h-5" />
                  {t("dangerZone")}
                </h3>

                <div className={cn(
                  "p-4",
                  classes.isRetro ? "border-4 border-dashed" : "bg-destructive/5 rounded-lg border border-destructive/20"
                )} style={classes.isRetro ? { borderColor: NES_RED, backgroundColor: 'rgba(206, 55, 43, 0.1)' } : undefined}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className={cn(
                        "text-foreground",
                        classes.isRetro ? "font-bold retro-body retro-small" : "font-medium"
                      )}>
                        {t("removeIntegration")}
                      </p>
                      <p className={cn(
                        "mt-1 text-muted-foreground",
                        classes.isRetro ? "retro-small uppercase retro-body" : "text-sm"
                      )}>
                        {t("removeIntegrationWarning")}
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowDeleteConfirm(true)}
                      variant="danger"
                    >
                      {t("remove")}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
      >
        <Modal.Header title={t("confirmRemove")} variant="danger" />
        <Modal.Body>
          <p className={cn(
            "mb-4 text-foreground",
            classes.isRetro ? "retro-small uppercase retro-body" : "text-sm"
          )}>
            {t("confirmRemoveMessage")}
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            onClick={() => setShowDeleteConfirm(false)}
            variant="secondary"
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleDelete}
            disabled={isDeleting}
            variant="danger"
            loading={isDeleting}
          >
            {isDeleting ? t("removing") : t("remove")}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
