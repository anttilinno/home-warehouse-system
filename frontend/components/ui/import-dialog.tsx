"use client";

import * as React from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, AlertCircle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  onImport: (file: File) => Promise<ImportResult>;
  title?: string;
  description?: string;
  acceptedFormats?: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors?: Array<{ row: number; message: string }>;
}

type ImportStep = "upload" | "preview" | "importing" | "complete";

export function ImportDialog({
  open,
  onOpenChange,
  entityType,
  onImport,
  title = "Import Data",
  description = "Upload a CSV file to import data",
  acceptedFormats = ".csv",
}: ImportDialogProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReset = () => {
    setStep("upload");
    setFile(null);
    setPreview([]);
    setProgress(0);
    setResult(null);
    setError(null);
  };

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);

    // Read first few lines for preview
    try {
      const text = await selectedFile.text();
      const lines = text.split("\n").slice(0, 6); // Header + 5 rows
      const parsed = lines.map((line) => {
        // Simple CSV parsing - handles quoted fields
        const fields: string[] = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            fields.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        fields.push(current.trim());
        return fields;
      });

      setPreview(parsed);
      setStep("preview");
    } catch (err) {
      setError("Failed to read file. Please make sure it's a valid CSV file.");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setStep("importing");
    setProgress(0);

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 10, 90));
    }, 200);

    try {
      const importResult = await onImport(file);
      clearInterval(progressInterval);
      setProgress(100);
      setResult(importResult);
      setStep("complete");
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    }
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Upload Step */}
          {step === "upload" && (
            <div className="space-y-4">
              <div
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors",
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="mb-2 text-sm font-medium">
                  Drop your CSV file here, or{" "}
                  <label className="cursor-pointer text-primary hover:underline">
                    browse
                    <input
                      type="file"
                      className="hidden"
                      accept={acceptedFormats}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileSelect(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                </p>
                <p className="text-xs text-muted-foreground">
                  Accepts CSV files only
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> Your CSV file should include a header row with
                  column names. The import will attempt to match columns automatically.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Preview Step */}
          {step === "preview" && file && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(file.size / 1024).toFixed(2)} KB)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {preview.length > 0 && (
                <div className="space-y-2">
                  <Label>Preview (first 5 rows)</Label>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          {preview[0]?.map((header, i) => (
                            <th key={i} className="px-3 py-2 text-left font-medium">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.slice(1).map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-t">
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="px-3 py-2">
                                {cell || <span className="text-muted-foreground">-</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Importing Step */}
          {step === "importing" && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="mb-4 text-sm text-muted-foreground">
                  Importing {entityType}s...
                </p>
                <Progress value={progress} className="h-2" />
                <p className="mt-2 text-xs text-muted-foreground">{progress}%</p>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step === "complete" && result && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-6">
                <CheckCircle2 className="mb-4 h-12 w-12 text-green-500" />
                <h3 className="mb-2 text-lg font-semibold">Import Complete</h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600">{result.success}</p>
                    <p className="text-sm text-muted-foreground">Imported</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                    <p className="text-sm text-muted-foreground">Failed</p>
                  </div>
                </div>
              </div>

              {result.errors && result.errors.length > 0 && (
                <div className="space-y-2">
                  <Label>Errors ({result.errors.length})</Label>
                  <div className="max-h-48 overflow-y-auto rounded-lg border bg-muted/50 p-3">
                    {result.errors.slice(0, 10).map((error, i) => (
                      <div key={i} className="mb-2 text-sm">
                        <span className="font-medium">Row {error.row}:</span>{" "}
                        <span className="text-muted-foreground">{error.message}</span>
                      </div>
                    ))}
                    {result.errors.length > 10 && (
                      <p className="text-xs text-muted-foreground">
                        ... and {result.errors.length - 10} more errors
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={handleReset}>
                Choose Different File
              </Button>
              <Button onClick={handleImport}>
                <Upload className="mr-2 h-4 w-4" />
                Import Data
              </Button>
            </>
          )}
          {step === "complete" && (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
