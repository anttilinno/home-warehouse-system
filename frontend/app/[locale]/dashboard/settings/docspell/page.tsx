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

export default function DocspellSettingsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const t = useTranslations("docspell");
  const tErrors = useTranslations();

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
    } catch (err) {
      setLoadError(
        getTranslatedErrorMessage(
          err instanceof Error ? err.message : "Unknown error",
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
    } catch (err) {
      setSaveError(
        getTranslatedErrorMessage(
          err instanceof Error ? err.message : "Unknown error",
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
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Unknown error",
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
    } catch (err) {
      setSaveError(
        getTranslatedErrorMessage(
          err instanceof Error ? err.message : "Unknown error",
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
    } catch (err) {
      setSaveError(
        getTranslatedErrorMessage(
          err instanceof Error ? err.message : "Unknown error",
          (key) => tErrors(key)
        )
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href="/dashboard/settings" className="hover:text-foreground transition-colors">
            {t("backToSettings")}
          </Link>
          <Icon name="ChevronRight" className="w-4 h-4" />
          <span className="text-foreground">{t("title")}</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {isLoadingSettings ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : loadError ? (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
            <p className="text-destructive">{loadError}</p>
            <button
              onClick={loadSettings}
              className="mt-2 text-sm text-primary hover:underline"
            >
              {t("retry")}
            </button>
          </div>
        ) : (
          <>
            {/* Status Card */}
            {settings && (
              <div className="bg-card p-6 rounded-lg border shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        settings.is_enabled ? "bg-green-500" : "bg-gray-400"
                      }`}
                    />
                    <div>
                      <h3 className="font-medium text-foreground">
                        {settings.is_enabled ? t("statusEnabled") : t("statusDisabled")}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {settings.last_sync_at
                          ? t("lastSync", { date: new Date(settings.last_sync_at).toLocaleString() })
                          : t("neverSynced")}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleEnabled}
                    disabled={isSaving}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      settings.is_enabled
                        ? "text-foreground bg-muted hover:bg-muted/80"
                        : "text-primary-foreground bg-primary hover:bg-primary/90"
                    } disabled:opacity-50`}
                  >
                    {settings.is_enabled ? t("disable") : t("enable")}
                  </button>
                </div>
              </div>
            )}

            {/* Connection Form */}
            <div className="bg-card p-6 rounded-lg border shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Icon name="Settings" className="w-5 h-5" />
                {settings ? t("editConnection") : t("setupConnection")}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("baseUrl")} *
                  </label>
                  <input
                    type="url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    required
                    placeholder="https://docs.example.com"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{t("baseUrlHint")}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("collectiveName")} *
                  </label>
                  <input
                    type="text"
                    value={collectiveName}
                    onChange={(e) => setCollectiveName(e.target.value)}
                    required
                    placeholder="my-collective"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{t("collectiveNameHint")}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("username")} *
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("password")} {settings ? "" : "*"}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!settings}
                    placeholder={settings ? t("passwordPlaceholderUpdate") : ""}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  {settings && (
                    <p className="mt-1 text-xs text-muted-foreground">{t("passwordHint")}</p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="syncTagsEnabled"
                    checked={syncTagsEnabled}
                    onChange={(e) => setSyncTagsEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/50"
                  />
                  <label htmlFor="syncTagsEnabled" className="text-sm text-foreground">
                    {t("enableTagSync")}
                  </label>
                </div>
                <p className="text-xs text-muted-foreground ml-7">{t("tagSyncHint")}</p>

                {saveError && <p className="text-sm text-destructive">{saveError}</p>}

                {saveSuccess && (
                  <p className="text-sm text-green-600">{t("saveSuccess")}</p>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSaving ? t("saving") : settings ? t("saveChanges") : t("connect")}
                  </button>

                  {settings && (
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTesting}
                      className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isTesting ? t("testing") : t("testConnection")}
                    </button>
                  )}
                </div>
              </form>

              {/* Connection Test Result */}
              {testResult && (
                <div
                  className={`mt-4 p-4 rounded-lg border ${
                    testResult.success
                      ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
                      : "bg-destructive/10 border-destructive/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      name={testResult.success ? "CheckCircle" : "XCircle"}
                      className={`w-5 h-5 ${
                        testResult.success ? "text-green-600" : "text-destructive"
                      }`}
                    />
                    <span
                      className={`font-medium ${
                        testResult.success ? "text-green-700 dark:text-green-400" : "text-destructive"
                      }`}
                    >
                      {testResult.success ? t("connectionSuccess") : t("connectionFailed")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{testResult.message}</p>
                  {testResult.version && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("docspellVersion", { version: testResult.version })}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Danger Zone */}
            {settings && (
              <div className="bg-card p-6 rounded-lg border border-destructive/30 shadow-sm">
                <h3 className="text-lg font-semibold text-destructive mb-4 flex items-center gap-2">
                  <Icon name="AlertTriangle" className="w-5 h-5" />
                  {t("dangerZone")}
                </h3>

                <div className="p-4 bg-destructive/5 rounded-lg border border-destructive/20">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">{t("removeIntegration")}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("removeIntegrationWarning")}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-4 py-2 text-sm font-medium text-destructive-foreground bg-destructive hover:bg-destructive/90 rounded-lg transition-colors whitespace-nowrap"
                    >
                      {t("remove")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-destructive flex items-center gap-2">
                <Icon name="AlertTriangle" className="w-5 h-5" />
                {t("confirmRemove")}
              </h3>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Icon name="X" className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-foreground mb-4">{t("confirmRemoveMessage")}</p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-destructive-foreground bg-destructive hover:bg-destructive/90 rounded-lg transition-colors disabled:opacity-50"
              >
                {isDeleting ? t("removing") : t("remove")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
