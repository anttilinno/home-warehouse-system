"use client";

import * as React from "react";
import { useState } from "react";
import {
  Download,
  Upload,
  AlertCircle,
  CheckCircle,
  Loader2,
  HardDrive,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { importExportApi } from "@/lib/api/importexport";
import { toast } from "sonner";

type Tab = "export" | "import";

interface BackupRestoreDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function BackupRestoreDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: BackupRestoreDialogProps) {
  const { workspaceId } = useWorkspace();
  const [internalOpen, setInternalOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("export");

  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen =
    controlledOnOpenChange !== undefined
      ? controlledOnOpenChange
      : setInternalOpen;

  // Export state
  const [exportFormat, setExportFormat] = useState<"xlsx" | "json">("xlsx");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Import state
  const [importFormat, setImportFormat] = useState<"xlsx" | "json">("xlsx");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    total_records: number;
    successful_imports: number;
    failed_imports: number;
    errors: Array<{
      row_number: number;
      error: string;
    }>;
  } | null>(null);

  const handleExport = async () => {
    if (!workspaceId) {
      toast.error("No workspace selected");
      return;
    }

    setIsExporting(true);
    try {
      const { blob, filename } = await importExportApi.exportWorkspace(
        workspaceId,
        exportFormat,
        includeArchived
      );

      // Trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(
        `Workspace exported successfully as ${exportFormat.toUpperCase()}`
      );
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(
        `Failed to export workspace: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!workspaceId) {
      toast.error("No workspace selected");
      return;
    }

    if (!importFile) {
      toast.error("Please select a file to import");
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const result = await importExportApi.importWorkspace(
        workspaceId,
        importFile,
        importFormat
      );

      setImportResult(result);

      if (result.failed_imports === 0) {
        toast.success(
          `Import successful! ${result.successful_imports} records imported.`
        );
      } else {
        toast.warning(
          `Import completed with ${result.failed_imports} errors. ${result.successful_imports} records imported.`
        );
      }

      // Refresh page after successful import
      if (result.successful_imports > 0) {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      console.error("Import failed:", error);
      toast.error(
        `Failed to import workspace: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      // Auto-detect format from file extension
      if (file.name.endsWith(".json")) {
        setImportFormat("json");
      } else if (file.name.endsWith(".xlsx")) {
        setImportFormat("xlsx");
      }
    }
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="gap-2">
      <HardDrive className="h-4 w-4" />
      <span className="hidden sm:inline">Backup & Restore</span>
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Backup & Restore</DialogTitle>
          <DialogDescription>
            Export your entire workspace for backup or import from a previous
            backup.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Selector */}
        <div className="flex gap-2 border-b">
          <Button
            variant={tab === "export" ? "default" : "ghost"}
            onClick={() => setTab("export")}
            className="flex-1"
          >
            <Download className="mr-2 h-4 w-4" />
            Export (Backup)
          </Button>
          <Button
            variant={tab === "import" ? "default" : "ghost"}
            onClick={() => setTab("import")}
            className="flex-1"
          >
            <Upload className="mr-2 h-4 w-4" />
            Import (Restore)
          </Button>
        </div>

        {/* Export Tab */}
        {tab === "export" && (
          <div className="space-y-6 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>What gets exported?</AlertTitle>
              <AlertDescription>
                All workspace data including items, inventory, locations,
                containers, categories, labels, borrowers, loans, and
                attachments.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <Label className="text-base">Export Format</Label>
                <RadioGroup
                  value={exportFormat}
                  onValueChange={(value) =>
                    setExportFormat(value as "xlsx" | "json")
                  }
                  className="mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="xlsx" id="xlsx" />
                    <Label htmlFor="xlsx" className="font-normal">
                      Excel (.xlsx) - Recommended for backup
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="json" id="json" />
                    <Label htmlFor="json" className="font-normal">
                      JSON (.json) - For programmatic use
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-archived"
                  checked={includeArchived}
                  onCheckedChange={(checked) =>
                    setIncludeArchived(checked as boolean)
                  }
                />
                <Label htmlFor="include-archived" className="font-normal">
                  Include archived items
                </Label>
              </div>
            </div>

            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full"
              size="lg"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download Backup
                </>
              )}
            </Button>
          </div>
        )}

        {/* Import Tab */}
        {tab === "import" && (
          <div className="space-y-6 py-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Importing will add data to your workspace. Duplicate entries may
                be created. Consider exporting a backup first.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <Label htmlFor="import-file">Select Backup File</Label>
                <input
                  id="import-file"
                  type="file"
                  accept=".xlsx,.json"
                  onChange={handleFileChange}
                  className="mt-2 block w-full text-sm text-muted-foreground
                    file:mr-4 file:rounded-md file:border-0
                    file:bg-primary file:px-4 file:py-2 file:text-sm
                    file:font-medium file:text-primary-foreground
                    hover:file:bg-primary/90"
                />
                {importFile && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Selected: {importFile.name} (
                    {(importFile.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>

              <div>
                <Label className="text-base">File Format</Label>
                <RadioGroup
                  value={importFormat}
                  onValueChange={(value) =>
                    setImportFormat(value as "xlsx" | "json")
                  }
                  className="mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="xlsx" id="import-xlsx" />
                    <Label htmlFor="import-xlsx" className="font-normal">
                      Excel (.xlsx)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="json" id="import-json" />
                    <Label htmlFor="import-json" className="font-normal">
                      JSON (.json)
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            {importResult && (
              <Alert
                variant={
                  importResult.failed_imports === 0 ? "default" : "destructive"
                }
              >
                {importResult.failed_imports === 0 ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>Import Result</AlertTitle>
                <AlertDescription>
                  <div className="space-y-2">
                    <p>
                      Total: {importResult.total_records} | Succeeded:{" "}
                      {importResult.successful_imports} | Failed:{" "}
                      {importResult.failed_imports}
                    </p>
                    {importResult.errors && importResult.errors.length > 0 && (
                      <div className="mt-2 max-h-40 overflow-y-auto text-xs">
                        <p className="font-semibold">Errors:</p>
                        <ul className="list-inside list-disc">
                          {importResult.errors.slice(0, 10).map((err, i) => (
                            <li key={i}>
                              Row {err.row_number}: {err.error}
                            </li>
                          ))}
                          {importResult.errors.length > 10 && (
                            <li>
                              ... and {importResult.errors.length - 10} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleImport}
              disabled={isImporting || !importFile}
              className="w-full"
              size="lg"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Backup
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
