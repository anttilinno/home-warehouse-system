"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { Icon } from "@/components/icons";
import { exportApi, ExportFormat } from "@/lib/api";
import { NES_GREEN, NES_BLUE } from "@/lib/nes-colors";
import { useThemed, useThemedClasses } from "@/lib/themed";

export default function ExportPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const t = useTranslations("export");
  const themed = useThemed();
  const classes = useThemedClasses();
  const { PageHeader, Card, Button } = themed;

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
        <p className={classes.loadingText}>
          {classes.isRetro ? "Loading..." : "Loading..."}
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={classes.isRetro ? "DOWNLOAD YOUR DATA FILES" : t("subtitle")}
      />

      {error && (
        <div className={classes.isRetro
          ? "mb-6 p-4 bg-card border-4 border-primary text-primary retro-body"
          : "mb-6 p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive"
        }>
          {error}
        </div>
      )}

      {success && (
        <div
          className={classes.isRetro
            ? "mb-6 p-4 bg-card border-4 border-border retro-body"
            : "mb-6 p-4 bg-green-500/10 border border-green-500 rounded-lg text-green-600"
          }
          style={classes.isRetro ? { borderColor: NES_GREEN, color: NES_GREEN } : undefined}
        >
          {success}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Excel Export Card */}
        <Card
          title={t("excelTitle")}
          icon="FileSpreadsheet"
          headerBg="success"
        >
          <p className={`${classes.bodyText} text-muted-foreground mb-4`}>
            {t("excelDescription")}
          </p>
          <ul className={`${classes.bodyText} text-muted-foreground mb-6 space-y-2`}>
            <li className="flex items-center gap-2">
              {classes.isRetro ? (
                <span style={{ color: NES_GREEN }}>&#9654;</span>
              ) : null}
              {t("excelFeature1")}
            </li>
            <li className="flex items-center gap-2">
              {classes.isRetro ? (
                <span style={{ color: NES_GREEN }}>&#9654;</span>
              ) : null}
              {t("excelFeature2")}
            </li>
            <li className="flex items-center gap-2">
              {classes.isRetro ? (
                <span style={{ color: NES_GREEN }}>&#9654;</span>
              ) : null}
              {t("excelFeature3")}
            </li>
          </ul>
          <Button
            variant="success"
            icon={exporting ? "Loader2" : "Download"}
            loading={exporting}
            fullWidth
            onClick={() => handleExport("xlsx")}
            disabled={exporting}
          >
            {exporting ? t("exporting") : t("downloadExcel")}
          </Button>
        </Card>

        {/* JSON Export Card */}
        <Card
          title={t("jsonTitle")}
          icon="FileJson"
          headerBg="info"
        >
          <p className={`${classes.bodyText} text-muted-foreground mb-4`}>
            {t("jsonDescription")}
          </p>
          <ul className={`${classes.bodyText} text-muted-foreground mb-6 space-y-2`}>
            <li className="flex items-center gap-2">
              {classes.isRetro ? (
                <span style={{ color: NES_BLUE }}>&#9654;</span>
              ) : null}
              {t("jsonFeature1")}
            </li>
            <li className="flex items-center gap-2">
              {classes.isRetro ? (
                <span style={{ color: NES_BLUE }}>&#9654;</span>
              ) : null}
              {t("jsonFeature2")}
            </li>
            <li className="flex items-center gap-2">
              {classes.isRetro ? (
                <span style={{ color: NES_BLUE }}>&#9654;</span>
              ) : null}
              {t("jsonFeature3")}
            </li>
          </ul>
          <Button
            variant="primary"
            icon={exporting ? "Loader2" : "Download"}
            loading={exporting}
            fullWidth
            onClick={() => handleExport("json")}
            disabled={exporting}
          >
            {exporting ? t("exporting") : t("downloadJson")}
          </Button>
        </Card>
      </div>

      {/* Info Section */}
      <Card className="mt-8">
        <h3 className={classes.heading + " mb-2"}>
          {t("includedData")}
        </h3>
        <p className={`${classes.bodyText} text-muted-foreground`}>
          {t("includedDataDescription")}
        </p>
      </Card>

      {/* Retro footer */}
      {classes.isRetro && (
        <div className="mt-8 text-center">
          <p className="retro-small text-muted-foreground uppercase">
            Press button to download
          </p>
        </div>
      )}
    </>
  );
}
