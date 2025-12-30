"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Barcode,
  Search,
} from "lucide-react";
import { Icon } from "@/components/icons";
import { useAuth } from "@/lib/auth";
import {
  importsApi,
  EntityType,
  ImportResult,
  BarcodeProduct,
  BarcodeNotFound,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { NES_GREEN, NES_BLUE, NES_RED, NES_AMBER } from "@/lib/nes-colors";
import { RetroPageHeader, RetroCard, RetroButton } from "@/components/retro";

const ENTITY_TYPES: EntityType[] = [
  "categories",
  "locations",
  "containers",
  "items",
  "borrowers",
  "inventory",
];

export default function ImportPage() {
  const { isAuthenticated } = useAuth();
  const t = useTranslations("import");
  const { theme } = useTheme();
  const isRetro = theme?.startsWith("retro");
  const [selectedEntity, setSelectedEntity] = useState<EntityType>("items");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Barcode lookup state
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeResult, setBarcodeResult] = useState<BarcodeProduct | BarcodeNotFound | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setResult(null);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
  });

  const handleImport = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setResult(null);

    try {
      const result = await importsApi.upload(file, selectedEntity);
      setResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleBarcodeLookup = async () => {
    if (!barcodeInput.trim()) return;

    setIsLookingUp(true);
    setBarcodeResult(null);

    try {
      const result = await importsApi.lookupBarcode(barcodeInput.trim());
      setBarcodeResult(result);
    } catch (err) {
      setBarcodeResult({
        barcode: barcodeInput.trim(),
        found: false,
        message: err instanceof Error ? err.message : "Lookup failed",
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  if (!isAuthenticated) return null;

  // Retro theme UI
  if (isRetro) {
    return (
      <div className="space-y-6">
        <RetroPageHeader
          title={t("title")}
          subtitle={t("subtitle")}
        />

        {/* Import Section */}
        <RetroCard
          title={t("importData")}
          icon="FileSpreadsheet"
          padding="none"
        >
          <div className="p-6 space-y-4">
            <p className="retro-small uppercase text-muted-foreground retro-body">{t("importDescription")}</p>

            {/* Entity Type Selection */}
            <div>
              <label className="block retro-small uppercase font-bold mb-2 retro-body">{t("selectEntityType")}</label>
              <select
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value as EntityType)}
                className="w-full md:w-64 px-3 py-2 border-4 border-border bg-background text-foreground retro-body retro-small focus:outline-none"
              >
                {ENTITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`entityTypes.${type}`)}
                  </option>
                ))}
              </select>
            </div>

            {/* Drop Zone */}
            <div
              {...getRootProps()}
              className={cn(
                "border-4 border-dashed p-8 text-center cursor-pointer transition-colors",
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <input {...getInputProps()} />
              <div className="w-12 h-12 mx-auto mb-3 border-4 border-border flex items-center justify-center" style={{ backgroundColor: NES_BLUE }}>
                <Icon name="Upload" className="w-6 h-6 text-white" />
              </div>
              {file ? (
                <p className="text-foreground font-bold retro-body retro-small">{file.name}</p>
              ) : (
                <p className="text-muted-foreground retro-body retro-small uppercase">{t("dropzoneText")}</p>
              )}
              <p className="retro-small uppercase text-muted-foreground mt-1 retro-body">{t("supportedFormats")}</p>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 border-4 flex items-start gap-2" style={{ borderColor: NES_RED, backgroundColor: 'rgba(206, 55, 43, 0.1)' }}>
                <Icon name="AlertTriangle" className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: NES_RED }} />
                <p className="retro-small uppercase retro-body" style={{ color: NES_RED }}>{error}</p>
              </div>
            )}

            {/* Import Button */}
            <div className="flex gap-2">
              <RetroButton
                variant="primary"
                onClick={handleImport}
                disabled={!file || isUploading}
                loading={isUploading}
              >
                {isUploading ? t("importing") : t("import")}
              </RetroButton>
              {file && (
                <RetroButton
                  variant="muted"
                  onClick={resetImport}
                >
                  {t("clear")}
                </RetroButton>
              )}
            </div>

            {/* Result */}
            {result && (
              <div className="border-4 border-border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Icon name="CheckCircle" className="w-5 h-5" style={{ color: NES_GREEN }} />
                  <span className="font-bold retro-body retro-small">{t("importComplete")}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 retro-body">
                  <div>
                    <p className="retro-small uppercase text-muted-foreground">{t("totalRows")}</p>
                    <p className="font-bold retro-small">{result.total_rows}</p>
                  </div>
                  <div>
                    <p className="retro-small uppercase text-muted-foreground">{t("created")}</p>
                    <p className="font-bold retro-small" style={{ color: NES_GREEN }}>{result.created}</p>
                  </div>
                  <div>
                    <p className="retro-small uppercase text-muted-foreground">{t("skipped")}</p>
                    <p className="font-bold retro-small" style={{ color: NES_AMBER }}>{result.skipped}</p>
                  </div>
                  <div>
                    <p className="retro-small uppercase text-muted-foreground">{t("errors")}</p>
                    <p className="font-bold retro-small" style={{ color: NES_RED }}>{result.errors.length}</p>
                  </div>
                </div>

                {/* Error Details */}
                {result.errors.length > 0 && (
                  <div className="mt-4">
                    <p className="retro-small uppercase font-bold mb-2 retro-body">{t("errorDetails")}</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {result.errors.slice(0, 10).map((err, idx) => (
                        <div key={idx} className="retro-small uppercase retro-body p-2 border-4 border-dashed" style={{ borderColor: NES_RED, color: NES_RED, backgroundColor: 'rgba(206, 55, 43, 0.1)' }}>
                          {t("row")} {err.row}
                          {err.field && ` (${err.field})`}: {err.message}
                        </div>
                      ))}
                      {result.errors.length > 10 && (
                        <p className="retro-small uppercase text-muted-foreground retro-body">
                          {t("andMoreErrors", { count: result.errors.length - 10 })}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </RetroCard>

        {/* Barcode Lookup Section */}
        <RetroCard
          title={t("barcodeLookup")}
          icon="Barcode"
          padding="none"
        >
          <div className="p-6 space-y-4">
            <p className="retro-small uppercase text-muted-foreground retro-body">{t("barcodeLookupDescription")}</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t("enterBarcode")}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleBarcodeLookup()}
                className="flex-1 px-3 py-2 border-4 border-border bg-background text-foreground retro-body retro-small focus:outline-none"
              />
              <RetroButton
                variant="primary"
                size="icon"
                onClick={handleBarcodeLookup}
                disabled={!barcodeInput.trim() || isLookingUp}
                loading={isLookingUp}
                icon="Search"
              />
            </div>

            {barcodeResult && (
              <div className="border-4 border-border p-4">
                {"found" in barcodeResult && barcodeResult.found === false ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon name="AlertTriangle" className="w-4 h-4" />
                    <span className="retro-small uppercase retro-body">{t("productNotFound")}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {"name" in barcodeResult && (
                      <>
                        <div className="flex items-start gap-4">
                          {barcodeResult.image_url && (
                            <img
                              src={barcodeResult.image_url}
                              alt={barcodeResult.name || ""}
                              className="w-20 h-20 object-contain border-4 border-border"
                            />
                          )}
                          <div className="flex-1 retro-body">
                            <p className="font-bold retro-small">{barcodeResult.name || t("unknownProduct")}</p>
                            {barcodeResult.brand && (
                              <p className="retro-small uppercase text-muted-foreground">
                                {t("brand")}: {barcodeResult.brand}
                              </p>
                            )}
                            {barcodeResult.category && (
                              <p className="retro-small uppercase text-muted-foreground">
                                {t("category")}: {barcodeResult.category}
                              </p>
                            )}
                          </div>
                        </div>
                        {barcodeResult.description && (
                          <p className="retro-small text-muted-foreground retro-body">{barcodeResult.description}</p>
                        )}
                        <p className="text-xs uppercase text-muted-foreground retro-body">
                          {t("source")}: {barcodeResult.source}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </RetroCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Import Section */}
      <div className="bg-card border border-border rounded-lg shadow-sm">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            {t("importData")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{t("importDescription")}</p>
        </div>
        <div className="p-6 space-y-4">
          {/* Entity Type Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">{t("selectEntityType")}</label>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value as EntityType)}
              className="w-full md:w-64 px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`entityTypes.${type}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Drop Zone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            {file ? (
              <p className="text-foreground font-medium">{file.name}</p>
            ) : (
              <p className="text-muted-foreground">{t("dropzoneText")}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">{t("supportedFormats")}</p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Import Button */}
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={!file || isUploading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("importing")}
                </>
              ) : (
                t("import")
              )}
            </button>
            {file && (
              <button
                onClick={resetImport}
                className="px-4 py-2 border border-border rounded-md font-medium hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
              >
                {t("clear")}
              </button>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="font-medium">{t("importComplete")}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{t("totalRows")}</p>
                  <p className="font-medium">{result.total_rows}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("created")}</p>
                  <p className="font-medium text-green-600">{result.created}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("skipped")}</p>
                  <p className="font-medium text-yellow-600">{result.skipped}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("errors")}</p>
                  <p className="font-medium text-red-600">{result.errors.length}</p>
                </div>
              </div>

              {/* Error Details */}
              {result.errors.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">{t("errorDetails")}</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {result.errors.slice(0, 10).map((err, idx) => (
                      <div key={idx} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        {t("row")} {err.row}
                        {err.field && ` (${err.field})`}: {err.message}
                      </div>
                    ))}
                    {result.errors.length > 10 && (
                      <p className="text-sm text-muted-foreground">
                        {t("andMoreErrors", { count: result.errors.length - 10 })}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Barcode Lookup Section */}
      <div className="bg-card border border-border rounded-lg shadow-sm">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Barcode className="w-5 h-5" />
            {t("barcodeLookup")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{t("barcodeLookupDescription")}</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={t("enterBarcode")}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBarcodeLookup()}
              className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <button
              onClick={handleBarcodeLookup}
              disabled={!barcodeInput.trim() || isLookingUp}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLookingUp ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </button>
          </div>

          {barcodeResult && (
            <div className="border border-border rounded-lg p-4">
              {"found" in barcodeResult && barcodeResult.found === false ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{t("productNotFound")}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {"name" in barcodeResult && (
                    <>
                      <div className="flex items-start gap-4">
                        {barcodeResult.image_url && (
                          <img
                            src={barcodeResult.image_url}
                            alt={barcodeResult.name || ""}
                            className="w-20 h-20 object-contain rounded"
                          />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{barcodeResult.name || t("unknownProduct")}</p>
                          {barcodeResult.brand && (
                            <p className="text-sm text-muted-foreground">
                              {t("brand")}: {barcodeResult.brand}
                            </p>
                          )}
                          {barcodeResult.category && (
                            <p className="text-sm text-muted-foreground">
                              {t("category")}: {barcodeResult.category}
                            </p>
                          )}
                        </div>
                      </div>
                      {barcodeResult.description && (
                        <p className="text-sm text-muted-foreground">{barcodeResult.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {t("source")}: {barcodeResult.source}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
