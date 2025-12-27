"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useTranslations } from "next-intl";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Barcode,
  Search,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  importsApi,
  EntityType,
  ImportResult,
  BarcodeProduct,
  BarcodeNotFound,
} from "@/lib/api";

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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
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
