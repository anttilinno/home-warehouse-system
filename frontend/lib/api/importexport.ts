import { apiClient } from "./client";

export type EntityType =
  | "item"
  | "inventory"
  | "location"
  | "container"
  | "category"
  | "label"
  | "company"
  | "borrower";

export interface ImportResult {
  total_records: number;
  successful_imports: number;
  failed_imports: number;
  errors: Array<{
    row_number: number;
    error: string;
  }>;
}

export interface ExportOptions {
  format?: "csv" | "json";
  includeArchived?: boolean;
}

class ImportExportAPI {
  /**
   * Import entities from a CSV or JSON file
   * @param workspaceId - Workspace ID
   * @param entityType - Type of entity to import
   * @param file - File to import
   * @returns Import result with success/error counts
   */
  async import(
    workspaceId: string,
    entityType: EntityType,
    file: File
  ): Promise<ImportResult> {
    // Read file as base64
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const base64 = btoa(String.fromCharCode(...bytes));

    // Determine format from file extension
    const format = file.name.endsWith(".json") ? "json" : "csv";

    const response = await apiClient.post<ImportResult>(
      `/import/${entityType}`,
      {
        format,
        data: base64,
      },
      workspaceId
    );

    return {
      total_records: response.total_records,
      successful_imports: response.successful_imports,
      failed_imports: response.failed_imports,
      errors: response.errors || [],
    };
  }

  /**
   * Export entities to CSV or JSON format
   * @param workspaceId - Workspace ID
   * @param entityType - Type of entity to export
   * @param options - Export options
   * @returns File blob for download
   */
  async export(
    workspaceId: string,
    entityType: EntityType,
    options: ExportOptions = {}
  ): Promise<Blob> {
    const { format = "csv", includeArchived = false } = options;

    const token = apiClient.getToken();
    const headers: HeadersInit = {
      "X-Workspace-ID": workspaceId,
    };

    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    const params = new URLSearchParams({
      format,
      include_archived: includeArchived.toString(),
    });

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const response = await fetch(
      `${API_URL}/export/${entityType}?${params}`,
      { headers }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: "Export failed",
      }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.blob();
  }
}

export const importExportApi = new ImportExportAPI();
