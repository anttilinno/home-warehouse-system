"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { useTheme } from "next-themes";
import { Icon } from "@/components/icons";
import { exportApi, ExportFormat } from "@/lib/api";
import { NES_GREEN, NES_BLUE } from "@/lib/nes-colors";
import { RetroPageHeader, RetroCard, RetroButton } from "@/components/retro";

export default function ExportPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const t = useTranslations("export");
  const { theme } = useTheme();
  const isRetro = theme?.startsWith("retro");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);


  const handleExport = async (format: ExportFormat) => {
    try {
      setExporting(true);
      setError(null);
      setSuccess(null);
      await exportApi.downloadExport(format);
      setSuccess(t("exportSuccess"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("exportError"));
    } finally {
      setExporting(false);
    }
  };

  if (authLoading) {
    if (isRetro) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="retro-small uppercase font-bold animate-pulse retro-heading">
            Loading...
          </p>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Retro NES theme
  if (isRetro) {
    return (
      <>
        <RetroPageHeader
          title={t("title")}
          subtitle="DOWNLOAD YOUR DATA FILES"
        />

        {error && (
          <div className="mb-6 p-4 bg-card border-4 border-primary text-primary retro-body">
            {error}
          </div>
        )}

        {success && (
          <div
            className="mb-6 p-4 bg-card border-4 border-border retro-body"
            style={{ borderColor: NES_GREEN, color: NES_GREEN }}
          >
            {success}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Excel Export Card */}
          <RetroCard
            title={t("excelTitle")}
            icon="FileSpreadsheet"
            headerBg="success"
          >
            <p className="retro-body text-muted-foreground mb-4">
              {t("excelDescription")}
            </p>
            <ul className="retro-body text-muted-foreground mb-6 space-y-2">
              <li className="flex items-center gap-2">
                <span style={{ color: NES_GREEN }}>&#9654;</span>
                {t("excelFeature1")}
              </li>
              <li className="flex items-center gap-2">
                <span style={{ color: NES_GREEN }}>&#9654;</span>
                {t("excelFeature2")}
              </li>
              <li className="flex items-center gap-2">
                <span style={{ color: NES_GREEN }}>&#9654;</span>
                {t("excelFeature3")}
              </li>
            </ul>
            <RetroButton
              variant="success"
              icon={exporting ? "Loader2" : "Download"}
              loading={exporting}
              fullWidth
              onClick={() => handleExport("xlsx")}
              disabled={exporting}
            >
              {exporting ? t("exporting") : t("downloadExcel")}
            </RetroButton>
          </RetroCard>

          {/* JSON Export Card */}
          <RetroCard
            title={t("jsonTitle")}
            icon="FileJson"
            headerBg="info"
          >
            <p className="retro-body text-muted-foreground mb-4">
              {t("jsonDescription")}
            </p>
            <ul className="retro-body text-muted-foreground mb-6 space-y-2">
              <li className="flex items-center gap-2">
                <span style={{ color: NES_BLUE }}>&#9654;</span>
                {t("jsonFeature1")}
              </li>
              <li className="flex items-center gap-2">
                <span style={{ color: NES_BLUE }}>&#9654;</span>
                {t("jsonFeature2")}
              </li>
              <li className="flex items-center gap-2">
                <span style={{ color: NES_BLUE }}>&#9654;</span>
                {t("jsonFeature3")}
              </li>
            </ul>
            <RetroButton
              variant="primary"
              icon={exporting ? "Loader2" : "Download"}
              loading={exporting}
              fullWidth
              onClick={() => handleExport("json")}
              disabled={exporting}
            >
              {exporting ? t("exporting") : t("downloadJson")}
            </RetroButton>
          </RetroCard>
        </div>

        {/* Info Section */}
        <RetroCard className="mt-8">
          <h3 className="retro-heading mb-2">
            {t("includedData")}
          </h3>
          <p className="retro-body text-muted-foreground">
            {t("includedDataDescription")}
          </p>
        </RetroCard>

        {/* Retro footer */}
        <div className="mt-8 text-center">
          <p className="retro-small text-muted-foreground uppercase">
            Press button to download
          </p>
        </div>
      </>
    );
  }

  // Standard theme
  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500 rounded-lg text-green-600">
          {success}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Excel Export Card */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <Icon name="FileSpreadsheet" className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{t("excelTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("excelDescription")}</p>
            </div>
          </div>
          <ul className="text-sm text-muted-foreground mb-6 space-y-1">
            <li>{t("excelFeature1")}</li>
            <li>{t("excelFeature2")}</li>
            <li>{t("excelFeature3")}</li>
          </ul>
          <button
            onClick={() => handleExport("xlsx")}
            disabled={exporting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <Icon name="Loader2" className="w-5 h-5 animate-spin" />
            ) : (
              <Icon name="Download" className="w-5 h-5" />
            )}
            {exporting ? t("exporting") : t("downloadExcel")}
          </button>
        </div>

        {/* JSON Export Card */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Icon name="FileJson" className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{t("jsonTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("jsonDescription")}</p>
            </div>
          </div>
          <ul className="text-sm text-muted-foreground mb-6 space-y-1">
            <li>{t("jsonFeature1")}</li>
            <li>{t("jsonFeature2")}</li>
            <li>{t("jsonFeature3")}</li>
          </ul>
          <button
            onClick={() => handleExport("json")}
            disabled={exporting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <Icon name="Loader2" className="w-5 h-5 animate-spin" />
            ) : (
              <Icon name="Download" className="w-5 h-5" />
            )}
            {exporting ? t("exporting") : t("downloadJson")}
          </button>
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-8 p-4 bg-muted/50 rounded-lg">
        <h3 className="font-semibold mb-2">{t("includedData")}</h3>
        <p className="text-sm text-muted-foreground">{t("includedDataDescription")}</p>
      </div>
    </>
  );
}
