import { apiClient } from './client';

export interface WorkspaceExportMetadata {
  export_id: string;
  workspace_id: string;
  exported_at: string;
  exported_by: string;
  format: 'xlsx' | 'json';
  record_counts: Record<string, number>;
  total_records: number;
}

export interface WorkspaceImportResult {
  total_rows: number;
  succeeded: number;
  failed: number;
  errors?: Array<{
    row: number;
    column?: string;
    message: string;
    code: string;
  }>;
}

/**
 * Export complete workspace to Excel or JSON
 */
export async function exportWorkspace(
  workspaceId: string,
  format: 'xlsx' | 'json' = 'xlsx',
  includeArchived: boolean = false
): Promise<Blob> {
  const params = new URLSearchParams({
    format,
    include_archived: includeArchived.toString(),
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const token = apiClient.getToken();
  const headers: HeadersInit = {
    'X-Workspace-ID': workspaceId,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_URL}/export/workspace?${params}`,
    {
      method: 'GET',
      headers,
    }
  );

  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }

  return await response.blob();
}

/**
 * Import workspace from Excel or JSON file
 */
export async function importWorkspace(
  workspaceId: string,
  file: File,
  format: 'xlsx' | 'json'
): Promise<WorkspaceImportResult> {
  // Convert file to base64
  const base64Data = await fileToBase64(file);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const token = apiClient.getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Workspace-ID': workspaceId,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}/import/workspace`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      format,
      data: base64Data,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: 'Workspace import failed',
    }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const result = await response.json();
  return {
    total_rows: result.total_rows || 0,
    succeeded: result.succeeded || 0,
    failed: result.failed || 0,
    errors:
      result.errors?.map((e: any) => ({
        row: e.row || 0,
        column: e.column,
        message: e.message || '',
        code: e.code || '',
      })) || [],
  };
}

/**
 * Download workspace backup file
 */
export function downloadWorkspaceBackup(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convert File to base64 string
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:application/vnd.ms-excel;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
