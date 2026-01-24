"use client";

/**
 * ConflictResolutionDialog Component
 *
 * Displays a dialog for manual resolution of sync conflicts.
 * Shows side-by-side comparison of conflicting field values
 * and allows users to choose which version to keep.
 */

import { useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useConflictResolution } from "@/lib/sync/use-conflict-resolution";
import { AlertTriangle, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface ConflictFieldRowProps {
  fieldName: string;
  localValue: unknown;
  serverValue: unknown;
  selectedSource: "local" | "server";
  onSelect: (source: "local" | "server") => void;
}

type FieldSelections = Record<string, "local" | "server">;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Human-readable labels for field names
 */
const FIELD_LABELS: Record<string, string> = {
  quantity: "Quantity",
  status: "Status",
  condition: "Condition",
  location_id: "Location",
  container_id: "Container",
  notes: "Notes",
  returned_at: "Returned At",
  due_date: "Due Date",
  name: "Name",
  description: "Description",
  sku: "SKU",
  brand: "Brand",
  model: "Model",
  category_id: "Category",
  purchase_price: "Purchase Price",
  current_value: "Current Value",
  min_stock_level: "Min Stock Level",
};

/**
 * Format a field name for display
 */
function formatFieldName(fieldName: string): string {
  return (
    FIELD_LABELS[fieldName] ||
    fieldName
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "(empty)";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return value.toLocaleString();
  }

  if (value instanceof Date) {
    return formatDistanceToNow(value, { addSuffix: true });
  }

  // Try to parse ISO date strings
  if (typeof value === "string") {
    const dateMatch = /^\d{4}-\d{2}-\d{2}T/.test(value);
    if (dateMatch) {
      try {
        const date = new Date(value);
        return formatDistanceToNow(date, { addSuffix: true });
      } catch {
        // Fall through to string display
      }
    }

    // Truncate long strings
    if (value.length > 50) {
      return value.slice(0, 47) + "...";
    }

    return value;
  }

  // Arrays and objects
  if (typeof value === "object") {
    try {
      const json = JSON.stringify(value);
      if (json.length > 50) {
        return json.slice(0, 47) + "...";
      }
      return json;
    } catch {
      return String(value);
    }
  }

  return String(value);
}

/**
 * Check if two values are different
 */
function valuesAreDifferent(a: unknown, b: unknown): boolean {
  if (a === b) return false;
  if (a === null && b === undefined) return false;
  if (a === undefined && b === null) return false;

  // Compare stringified for objects/arrays
  try {
    return JSON.stringify(a) !== JSON.stringify(b);
  } catch {
    return String(a) !== String(b);
  }
}

// ============================================================================
// ConflictFieldRow Component
// ============================================================================

/**
 * Row displaying a single conflicting field with local/server values
 */
function ConflictFieldRow({
  fieldName,
  localValue,
  serverValue,
  selectedSource,
  onSelect,
}: ConflictFieldRowProps) {
  const isDifferent = valuesAreDifferent(localValue, serverValue);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Field Header */}
      <div className="bg-muted px-3 py-2 border-b">
        <span className="font-medium text-sm">{formatFieldName(fieldName)}</span>
        {isDifferent && (
          <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
            (differs)
          </span>
        )}
      </div>

      {/* Value Comparison */}
      <div className="grid grid-cols-2 divide-x">
        {/* Local Value */}
        <button
          type="button"
          onClick={() => onSelect("local")}
          className={cn(
            "p-3 text-left transition-colors hover:bg-accent/50",
            selectedSource === "local" && "bg-primary/10 ring-2 ring-primary ring-inset"
          )}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground font-medium">
              My Changes
            </span>
            {selectedSource === "local" && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </div>
          <div
            className={cn(
              "text-sm break-words",
              isDifferent && "font-medium text-amber-700 dark:text-amber-300"
            )}
          >
            {formatValue(localValue)}
          </div>
        </button>

        {/* Server Value */}
        <button
          type="button"
          onClick={() => onSelect("server")}
          className={cn(
            "p-3 text-left transition-colors hover:bg-accent/50",
            selectedSource === "server" && "bg-primary/10 ring-2 ring-primary ring-inset"
          )}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground font-medium">
              Server
            </span>
            {selectedSource === "server" && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </div>
          <div
            className={cn(
              "text-sm break-words",
              isDifferent && "font-medium text-blue-700 dark:text-blue-300"
            )}
          >
            {formatValue(serverValue)}
          </div>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// ConflictResolutionDialog Component
// ============================================================================

/**
 * Main dialog component for resolving sync conflicts.
 *
 * Shows when currentConflict is not null.
 * Displays side-by-side comparison of all conflicting fields.
 * Allows selecting individual field values or bulk actions.
 */
export function ConflictResolutionDialog() {
  const { currentConflict, resolveConflict, dismissConflict } =
    useConflictResolution();

  // Track field selections (default to 'server' for safety)
  const [selections, setSelections] = useState<FieldSelections>({});

  // Initialize selections when conflict changes
  const effectiveSelections = useMemo<FieldSelections>(() => {
    if (!currentConflict) return {};

    const initial: FieldSelections = {};
    for (const field of currentConflict.conflictFields) {
      initial[field] = selections[field] || "server";
    }
    return initial;
  }, [currentConflict, selections]);

  // Update selection for a field
  const handleFieldSelect = useCallback(
    (fieldName: string, source: "local" | "server") => {
      setSelections((prev) => ({ ...prev, [fieldName]: source }));
    },
    []
  );

  // Set all fields to local
  const handleKeepAllLocal = useCallback(() => {
    if (!currentConflict) return;

    const allLocal: FieldSelections = {};
    for (const field of currentConflict.conflictFields) {
      allLocal[field] = "local";
    }
    setSelections(allLocal);
  }, [currentConflict]);

  // Set all fields to server
  const handleUseAllServer = useCallback(() => {
    if (!currentConflict) return;

    const allServer: FieldSelections = {};
    for (const field of currentConflict.conflictFields) {
      allServer[field] = "server";
    }
    setSelections(allServer);
  }, [currentConflict]);

  // Resolve with current selections
  const handleResolve = useCallback(
    (strategy: "local" | "server" | "merged") => {
      if (!currentConflict) return;

      if (strategy === "local") {
        resolveConflict(currentConflict.id, "local", currentConflict.localData);
      } else if (strategy === "server") {
        resolveConflict(
          currentConflict.id,
          "server",
          currentConflict.serverData
        );
      } else {
        // Merge based on selections
        const mergedData: Record<string, unknown> = {
          ...currentConflict.serverData,
        };

        for (const [field, source] of Object.entries(effectiveSelections)) {
          if (source === "local") {
            mergedData[field] = currentConflict.localData[field];
          }
        }

        resolveConflict(currentConflict.id, "merged", mergedData);
      }

      // Clear selections for next conflict
      setSelections({});
    },
    [currentConflict, effectiveSelections, resolveConflict]
  );

  // Handle dialog close
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && currentConflict) {
        // User closed dialog without resolving - dismiss the conflict
        dismissConflict(currentConflict.id);
        setSelections({});
      }
    },
    [currentConflict, dismissConflict]
  );

  // Don't render if no conflict
  if (!currentConflict) {
    return null;
  }

  // Format entity type for display
  const entityTypeLabel =
    currentConflict.entityType.charAt(0).toUpperCase() +
    currentConflict.entityType.slice(1);

  // Check if any selection differs from server (for merge button enable state)
  const hasCustomSelections = Object.values(effectiveSelections).some(
    (source) => source === "local"
  );

  return (
    <Dialog open={true} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Conflict Detected
          </DialogTitle>
          <DialogDescription>
            {entityTypeLabel}
            {currentConflict.entityName && `: ${currentConflict.entityName}`}
            {" - "}
            <span className="text-muted-foreground">
              {formatDistanceToNow(currentConflict.timestamp, {
                addSuffix: true,
              })}
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable field list */}
        <div className="flex-1 overflow-y-auto space-y-3 py-2 min-h-0">
          {currentConflict.conflictFields.map((field) => (
            <ConflictFieldRow
              key={field}
              fieldName={field}
              localValue={currentConflict.localData[field]}
              serverValue={currentConflict.serverData[field]}
              selectedSource={effectiveSelections[field] || "server"}
              onSelect={(source) => handleFieldSelect(field, source)}
            />
          ))}
        </div>

        {/* Quick action buttons */}
        <div className="flex gap-2 py-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={handleKeepAllLocal}
            className="flex-1"
          >
            Select All Mine
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUseAllServer}
            className="flex-1"
          >
            Select All Server
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleResolve("server")}>
            Use Server Values
          </Button>
          <Button variant="outline" onClick={() => handleResolve("local")}>
            Keep My Values
          </Button>
          <Button
            variant="default"
            onClick={() => handleResolve("merged")}
            disabled={!hasCustomSelections}
          >
            Merge Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
