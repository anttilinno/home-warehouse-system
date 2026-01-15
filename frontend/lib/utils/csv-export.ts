/**
 * CSV Export Utility
 * Provides functions to export data to CSV format
 */

export interface ColumnDefinition<T> {
  /** The key of the property to export */
  key: keyof T | string;
  /** The column header label */
  label: string;
  /** Optional formatter function to transform the value */
  formatter?: (value: any, item: T) => string;
}

/**
 * Escapes a CSV field value
 * Wraps in quotes if it contains commas, quotes, or newlines
 */
function escapeCsvField(value: any): string {
  if (value == null) {
    return "";
  }

  const stringValue = String(value);

  // Check if the value needs to be quoted
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    // Escape quotes by doubling them
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Converts an array of objects to CSV format
 */
export function convertToCSV<T>(
  data: T[],
  columns: ColumnDefinition<T>[]
): string {
  // Header row
  const headers = columns.map((col) => escapeCsvField(col.label)).join(",");

  // Data rows
  const rows = data.map((item) => {
    return columns
      .map((col) => {
        // Get the value using the key
        let value: any;
        if (typeof col.key === "string" && col.key.includes(".")) {
          // Handle nested properties (e.g., "category.name")
          value = col.key.split(".").reduce((obj, key) => obj?.[key], item as any);
        } else {
          value = (item as any)[col.key];
        }

        // Apply formatter if provided
        if (col.formatter) {
          value = col.formatter(value, item);
        }

        return escapeCsvField(value);
      })
      .join(",");
  });

  return [headers, ...rows].join("\n");
}

/**
 * Triggers a browser download of CSV data
 */
export function downloadCSV(csvContent: string, filename: string): void {
  // Add BOM for proper UTF-8 encoding in Excel
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}

/**
 * Exports data to CSV and triggers download
 *
 * @param data - Array of objects to export
 * @param columns - Column definitions
 * @param filename - Name of the downloaded file (should end with .csv)
 *
 * @example
 * ```tsx
 * exportToCSV(
 *   selectedItems,
 *   [
 *     { key: "sku", label: "SKU" },
 *     { key: "name", label: "Item Name" },
 *     { key: "brand", label: "Brand" },
 *     {
 *       key: "created_at",
 *       label: "Created Date",
 *       formatter: (value) => new Date(value).toLocaleDateString()
 *     }
 *   ],
 *   "items-export.csv"
 * );
 * ```
 */
export function exportToCSV<T>(
  data: T[],
  columns: ColumnDefinition<T>[],
  filename: string
): void {
  if (data.length === 0) {
    console.warn("No data to export");
    return;
  }

  // Ensure filename ends with .csv
  if (!filename.endsWith(".csv")) {
    filename += ".csv";
  }

  const csvContent = convertToCSV(data, columns);
  downloadCSV(csvContent, filename);
}

/**
 * Generates a filename with timestamp
 *
 * @example
 * generateFilename("items") // Returns "items-2024-01-15-143052.csv"
 */
export function generateFilename(prefix: string): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .slice(0, 19)
    .replace(/:/g, "")
    .replace("T", "-");
  return `${prefix}-${timestamp}.csv`;
}
