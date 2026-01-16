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

  /**
   * Export complete workspace to Excel or JSON
   * @param workspaceId - Workspace ID
   * @param format - Export format (xlsx or json)
   * @param includeArchived - Include archived records
   * @returns File blob for download
   */
  async exportWorkspace(
    workspaceId: string,
    format: "xlsx" | "json" = "xlsx",
    includeArchived: boolean = false
  ): Promise<{ blob: Blob; filename: string }> {
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
      `${API_URL}/export/workspace?${params}`,
      { headers }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: "Workspace export failed",
      }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    // Extract filename from Content-Disposition header
    const contentDisposition = response.headers.get("Content-Disposition");
    let filename = `workspace_backup_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.${format}`;

    if (contentDisposition) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
      if (matches && matches[1]) {
        filename = matches[1].replace(/['"]/g, "");
      }
    }

    const blob = await response.blob();
    return { blob, filename };
  }

  /**
   * Import complete workspace from Excel or JSON
   * @param workspaceId - Workspace ID
   * @param file - File to import
   * @param format - Import format (xlsx or json)
   * @returns Import result with success/error counts
   */
  async importWorkspace(
    workspaceId: string,
    file: File,
    format: "xlsx" | "json"
  ): Promise<ImportResult> {
    // Convert file to base64
    const base64Data = await this.fileToBase64(file);

    const token = apiClient.getToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "X-Workspace-ID": workspaceId,
    };

    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const response = await fetch(`${API_URL}/import/workspace`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        format,
        data: base64Data,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: "Workspace import failed",
      }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const result = await response.json();
    return {
      total_records: result.total_rows || 0,
      successful_imports: result.succeeded || 0,
      failed_imports: result.failed || 0,
      errors:
        result.errors?.map((e: any) => ({
          row_number: e.row || 0,
          error: e.message || "",
        })) || [],
    };
  }

  /**
   * Convert File to base64 string
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:application/vnd.ms-excel;base64,")
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

export const importExportApi = new ImportExportAPI();
