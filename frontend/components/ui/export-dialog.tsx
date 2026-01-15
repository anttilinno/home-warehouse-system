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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Download, FileDown } from "lucide-react";
import { exportToCSV, generateFilename, ColumnDefinition } from "@/lib/utils/csv-export";

export interface ExportDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: T[];
  allData?: T[];
  columns: ColumnDefinition<T>[];
  filePrefix: string;
  title?: string;
  description?: string;
}

export function ExportDialog<T>({
  open,
  onOpenChange,
  data,
  allData,
  columns,
  filePrefix,
  title = "Export to CSV",
  description = "Select columns and data to export",
}: ExportDialogProps<T>) {
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(columns.map((col) => String(col.key)))
  );
  const [exportScope, setExportScope] = useState<"current" | "all">("current");
  const [isExporting, setIsExporting] = useState(false);

  const toggleColumn = (key: string) => {
    const newSelected = new Set(selectedColumns);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedColumns(newSelected);
  };

  const toggleAll = () => {
    if (selectedColumns.size === columns.length) {
      setSelectedColumns(new Set());
    } else {
      setSelectedColumns(new Set(columns.map((col) => String(col.key))));
    }
  };

  const handleExport = () => {
    setIsExporting(true);

    try {
      // Filter columns based on selection
      const columnsToExport = columns.filter((col) =>
        selectedColumns.has(String(col.key))
      );

      if (columnsToExport.length === 0) {
        alert("Please select at least one column to export");
        setIsExporting(false);
        return;
      }

      // Determine which data to export
      const dataToExport = exportScope === "all" && allData ? allData : data;

      if (dataToExport.length === 0) {
        alert("No data to export");
        setIsExporting(false);
        return;
      }

      // Generate filename with timestamp
      const filename = generateFilename(filePrefix);

      // Export to CSV
      exportToCSV(dataToExport, columnsToExport, filename);

      // Close dialog after short delay
      setTimeout(() => {
        setIsExporting(false);
        onOpenChange(false);
      }, 500);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Please try again.");
      setIsExporting(false);
    }
  };

  const hasAllData = allData && allData.length > 0;
  const currentCount = data.length;
  const allCount = allData?.length || currentCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Column Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Columns to export</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAll}
                className="h-8 text-xs"
              >
                {selectedColumns.size === columns.length
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>

            <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
              {columns.map((column) => {
                const key = String(column.key);
                const isChecked = selectedColumns.has(key);
                return (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`column-${key}`}
                      checked={isChecked}
                      onCheckedChange={() => toggleColumn(key)}
                    />
                    <Label
                      htmlFor={`column-${key}`}
                      className="flex-1 cursor-pointer text-sm font-normal"
                    >
                      {column.label}
                    </Label>
                  </div>
                );
              })}
            </div>

            <div className="text-xs text-muted-foreground">
              {selectedColumns.size} of {columns.length} columns selected
            </div>
          </div>

          {/* Export Scope */}
          {hasAllData && currentCount !== allCount && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Data to export</Label>
              <RadioGroup
                value={exportScope}
                onValueChange={(value) => setExportScope(value as "current" | "all")}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="current" id="export-current" />
                  <Label
                    htmlFor="export-current"
                    className="cursor-pointer text-sm font-normal"
                  >
                    Current page ({currentCount.toLocaleString()}{" "}
                    {currentCount === 1 ? "item" : "items"})
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="export-all" />
                  <Label
                    htmlFor="export-all"
                    className="cursor-pointer text-sm font-normal"
                  >
                    All data ({allCount.toLocaleString()}{" "}
                    {allCount === 1 ? "item" : "items"})
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting..." : "Export CSV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
