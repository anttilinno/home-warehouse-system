import { get, postMultipart } from "@/lib/api";

// Phase 14 Plan 05 Task 1 — typed importJobsApi over api.ts (SYS-04). Three
// surfaces against the backend importjob domain (verified upload_handler.go +
// importjob/handler.go this planning session):
//   * listJobs — GET /imports/jobs → the bare `{ jobs, total, page, total_pages }`
//     envelope (key is `jobs`, NOT items/changes — importjob/handler.go:101).
//   * jobErrors — GET /imports/jobs/{id}/errors → `{ errors, total }`.
//   * uploadImport — the ASYNC multipart path POST /imports/upload (Chi handler,
//     form fields `entity_type` + `file`, 10 MB). This CREATES the ImportJob +
//     enqueues the worker → 201 + the job JSON. THIS is the endpoint that feeds
//     the jobs table (NOT the synchronous /import/{entity_type}, which makes no
//     job). Multipart carries raw bytes — NO base64. We reuse the shared
//     postMultipart helper (api.ts), which omits Content-Type so the browser
//     supplies the multipart boundary, carries credentials:"include", and throws
//     HttpError on a non-2xx response.

export type ImportJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

// PLURAL importjob EntityType (verified upload_handler.go:70-81) — includes
// `inventory`, excludes label/company.
export type ImportEntityType =
  | "items"
  | "inventory"
  | "locations"
  | "containers"
  | "categories"
  | "borrowers";

export const IMPORT_ENTITY_TYPES: ImportEntityType[] = [
  "items",
  "inventory",
  "locations",
  "containers",
  "categories",
  "borrowers",
];

export interface ImportJob {
  id: string;
  entity_type: ImportEntityType;
  status: ImportJobStatus;
  file_name: string;
  file_size_bytes: number;
  total_rows?: number;
  processed_rows: number;
  success_count: number;
  error_count: number;
  progress: number; // 0–100
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface ImportError {
  id: string;
  row_number: number;
  field_name?: string;
  error_message: string;
  created_at: string;
}

export interface ImportJobsPage {
  jobs: ImportJob[];
  total: number;
  page: number;
  total_pages: number;
}

export interface ImportErrorsPage {
  errors: ImportError[];
  total: number;
}

export const importJobsApi = {
  // GET /imports/jobs?page&limit (limit default 20, max 100 backend-side).
  listJobs(
    wsId: string,
    opts?: { page?: number; limit?: number },
  ): Promise<ImportJobsPage> {
    const params = new URLSearchParams();
    if (opts?.page != null) params.set("page", String(opts.page));
    if (opts?.limit != null) params.set("limit", String(opts.limit));
    const query = params.toString();
    return get<ImportJobsPage>(
      `/workspaces/${wsId}/imports/jobs${query ? `?${query}` : ""}`,
    );
  },

  jobErrors(wsId: string, jobId: string): Promise<ImportErrorsPage> {
    return get<ImportErrorsPage>(
      `/workspaces/${wsId}/imports/jobs/${jobId}/errors`,
    );
  },

  // Multipart upload — the async importjob path. Fields MUST be `entity_type`
  // + `file` (verified upload_handler.go). Returns the created ImportJob (201).
  uploadImport(
    wsId: string,
    entityType: ImportEntityType,
    file: File,
  ): Promise<ImportJob> {
    const form = new FormData();
    form.append("entity_type", entityType);
    form.append("file", file);
    return postMultipart<ImportJob>(`/workspaces/${wsId}/imports/upload`, form);
  },
};
