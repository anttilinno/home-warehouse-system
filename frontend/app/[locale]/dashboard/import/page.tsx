"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useTranslations } from "next-intl";
import {
  Upload,
  CheckCircle,
  AlertTriangle,
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
import { useThemed, useThemedClasses } from "@/lib/themed";

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
  const themed = useThemed();
  const classes = useThemedClasses();
  const { PageHeader, Card, Button } = themed;

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
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />

      {/* Import Section */}
      <Card
        title={t("importData")}
        icon="FileSpreadsheet"
        padding={classes.isRetro ? "none" : undefined}
      >
        <div className={cn(classes.isRetro && "p-6", "space-y-4")}>
          <p className={cn(
            classes.isRetro
              ? "retro-small uppercase text-muted-foreground retro-body"
              : "text-sm text-muted-foreground"
          )}>
            {t("importDescription")}
          </p>

          {/* Entity Type Selection */}
          <div>
            <label className={cn(
              "block mb-2",
              classes.isRetro
                ? "retro-small uppercase font-bold retro-body"
                : "text-sm font-medium"
            )}>
              {t("selectEntityType")}
            </label>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value as EntityType)}
              className={cn(
                "w-full md:w-64 px-3 py-2 bg-background text-foreground focus:outline-none",
                classes.isRetro
                  ? "border-4 border-border retro-body retro-small"
                  : "border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
              )}
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
              "p-8 text-center cursor-pointer transition-colors",
              classes.isRetro
                ? cn(
                    "border-4 border-dashed",
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )
                : cn(
                    "border-2 border-dashed rounded-lg",
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )
            )}
          >
            <input {...getInputProps()} />
            {classes.isRetro ? (
              <div className="w-12 h-12 mx-auto mb-3 border-4 border-border flex items-center justify-center" style={{ backgroundColor: NES_BLUE }}>
                <Icon name="Upload" className="w-6 h-6 text-white" />
              </div>
            ) : (
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            )}
            {file ? (
              <p className={cn(
                "text-foreground",
                classes.isRetro ? "font-bold retro-body retro-small" : "font-medium"
              )}>
                {file.name}
              </p>
            ) : (
              <p className={cn(
                "text-muted-foreground",
                classes.isRetro && "retro-body retro-small uppercase"
              )}>
                {t("dropzoneText")}
              </p>
            )}
            <p className={cn(
              "mt-1 text-muted-foreground",
              classes.isRetro ? "retro-small uppercase retro-body" : "text-sm"
            )}>
              {t("supportedFormats")}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className={cn(
              "p-3 flex items-start gap-2",
              classes.isRetro
                ? "border-4"
                : "bg-red-50 border border-red-200 rounded-md"
            )}
            style={classes.isRetro ? { borderColor: NES_RED, backgroundColor: 'rgba(206, 55, 43, 0.1)' } : undefined}
            >
              {classes.isRetro ? (
                <Icon name="AlertTriangle" className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: NES_RED }} />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <p className={cn(
                classes.isRetro
                  ? "retro-small uppercase retro-body"
                  : "text-sm text-red-600"
              )}
              style={classes.isRetro ? { color: NES_RED } : undefined}
              >
                {error}
              </p>
            </div>
          )}

          {/* Import Button */}
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={!file || isUploading}
              loading={isUploading}
            >
              {isUploading ? t("importing") : t("import")}
            </Button>
            {file && (
              <Button
                variant="muted"
                onClick={resetImport}
              >
                {t("clear")}
              </Button>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className={cn(
              "p-4 space-y-3",
              classes.isRetro
                ? "border-4 border-border"
                : "border border-border rounded-lg"
            )}>
              <div className="flex items-center gap-2">
                {classes.isRetro ? (
                  <Icon name="CheckCircle" className="w-5 h-5" style={{ color: NES_GREEN }} />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                <span className={cn(
                  classes.isRetro ? "font-bold retro-body retro-small" : "font-medium"
                )}>
                  {t("importComplete")}
                </span>
              </div>
              <div className={cn(
                "grid grid-cols-2 md:grid-cols-4 gap-4",
                classes.isRetro ? "retro-body" : "text-sm"
              )}>
                <div>
                  <p className={cn(
                    "text-muted-foreground",
                    classes.isRetro && "retro-small uppercase"
                  )}>
                    {t("totalRows")}
                  </p>
                  <p className={cn(
                    classes.isRetro ? "font-bold retro-small" : "font-medium"
                  )}>
                    {result.total_rows}
                  </p>
                </div>
                <div>
                  <p className={cn(
                    "text-muted-foreground",
                    classes.isRetro && "retro-small uppercase"
                  )}>
                    {t("created")}
                  </p>
                  <p
                    className={cn(
                      classes.isRetro ? "font-bold retro-small" : "font-medium text-green-600"
                    )}
                    style={classes.isRetro ? { color: NES_GREEN } : undefined}
                  >
                    {result.created}
                  </p>
                </div>
                <div>
                  <p className={cn(
                    "text-muted-foreground",
                    classes.isRetro && "retro-small uppercase"
                  )}>
                    {t("skipped")}
                  </p>
                  <p className={cn(
                    classes.isRetro ? "font-bold retro-small" : "font-medium text-yellow-600"
                  )}
                  style={classes.isRetro ? { color: NES_AMBER } : undefined}
                  >
                    {result.skipped}
                  </p>
                </div>
                <div>
                  <p className={cn(
                    "text-muted-foreground",
                    classes.isRetro && "retro-small uppercase"
                  )}>
                    {t("errors")}
                  </p>
                  <p className={cn(
                    classes.isRetro ? "font-bold retro-small" : "font-medium text-red-600"
                  )}
                  style={classes.isRetro ? { color: NES_RED } : undefined}
                  >
                    {result.errors.length}
                  </p>
                </div>
              </div>

              {/* Error Details */}
              {result.errors.length > 0 && (
                <div className="mt-4">
                  <p className={cn(
                    "mb-2",
                    classes.isRetro
                      ? "retro-small uppercase font-bold retro-body"
                      : "text-sm font-medium"
                  )}>
                    {t("errorDetails")}
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {result.errors.slice(0, 10).map((err, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "p-2",
                          classes.isRetro
                            ? "retro-small uppercase retro-body border-4 border-dashed"
                            : "text-sm text-red-600 bg-red-50 rounded"
                        )}
                        style={classes.isRetro ? { borderColor: NES_RED, color: NES_RED, backgroundColor: 'rgba(206, 55, 43, 0.1)' } : undefined}
                      >
                        {t("row")} {err.row}
                        {err.field && ` (${err.field})`}: {err.message}
                      </div>
                    ))}
                    {result.errors.length > 10 && (
                      <p className={cn(
                        "text-muted-foreground",
                        classes.isRetro ? "retro-small uppercase retro-body" : "text-sm"
                      )}>
                        {t("andMoreErrors", { count: result.errors.length - 10 })}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Barcode Lookup Section */}
      <Card
        title={t("barcodeLookup")}
        icon="Barcode"
        padding={classes.isRetro ? "none" : undefined}
      >
        <div className={cn(classes.isRetro && "p-6", "space-y-4")}>
          <p className={cn(
            classes.isRetro
              ? "retro-small uppercase text-muted-foreground retro-body"
              : "text-sm text-muted-foreground"
          )}>
            {t("barcodeLookupDescription")}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={t("enterBarcode")}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBarcodeLookup()}
              className={cn(
                "flex-1 px-3 py-2 bg-background text-foreground focus:outline-none",
                classes.isRetro
                  ? "border-4 border-border retro-body retro-small"
                  : "border border-border rounded-md placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
              )}
            />
            <Button
              variant="primary"
              size="icon"
              onClick={handleBarcodeLookup}
              disabled={!barcodeInput.trim() || isLookingUp}
              loading={isLookingUp}
              icon="Search"
            />
          </div>

          {barcodeResult && (
            <div className={cn(
              "p-4",
              classes.isRetro
                ? "border-4 border-border"
                : "border border-border rounded-lg"
            )}>
              {"found" in barcodeResult && barcodeResult.found === false ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  {classes.isRetro ? (
                    <Icon name="AlertTriangle" className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  <span className={cn(classes.isRetro && "retro-small uppercase retro-body")}>
                    {t("productNotFound")}
                  </span>
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
                            className={cn(
                              "w-20 h-20 object-contain",
                              classes.isRetro ? "border-4 border-border" : "rounded"
                            )}
                          />
                        )}
                        <div className={cn("flex-1", classes.isRetro && "retro-body")}>
                          <p className={cn(
                            classes.isRetro ? "font-bold retro-small" : "font-medium"
                          )}>
                            {barcodeResult.name || t("unknownProduct")}
                          </p>
                          {barcodeResult.brand && (
                            <p className={cn(
                              "text-muted-foreground",
                              classes.isRetro ? "retro-small uppercase" : "text-sm"
                            )}>
                              {t("brand")}: {barcodeResult.brand}
                            </p>
                          )}
                          {barcodeResult.category && (
                            <p className={cn(
                              "text-muted-foreground",
                              classes.isRetro ? "retro-small uppercase" : "text-sm"
                            )}>
                              {t("category")}: {barcodeResult.category}
                            </p>
                          )}
                        </div>
                      </div>
                      {barcodeResult.description && (
                        <p className={cn(
                          "text-muted-foreground",
                          classes.isRetro ? "retro-small retro-body" : "text-sm"
                        )}>
                          {barcodeResult.description}
                        </p>
                      )}
                      <p className={cn(
                        "text-muted-foreground",
                        classes.isRetro ? "text-xs uppercase retro-body" : "text-xs"
                      )}>
                        {t("source")}: {barcodeResult.source}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
