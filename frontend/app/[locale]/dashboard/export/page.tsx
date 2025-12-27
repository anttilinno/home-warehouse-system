"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { Download, FileSpreadsheet, FileJson, Loader2 } from "lucide-react";
import { exportApi, ExportFormat } from "@/lib/api";

export default function ExportPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const t = useTranslations("export");
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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

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
              <FileSpreadsheet className="w-8 h-8 text-green-600" />
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
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            {exporting ? t("exporting") : t("downloadExcel")}
          </button>
        </div>

        {/* JSON Export Card */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <FileJson className="w-8 h-8 text-blue-600" />
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
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
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
