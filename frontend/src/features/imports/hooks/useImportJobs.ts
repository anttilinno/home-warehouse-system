import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  importJobsApi,
  type ImportEntityType,
  type ImportJob,
} from "@/lib/api/importJobs";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 14 Plan 05 Task 2 — react-query bindings for the imports surface
// (SYS-04). useImportJobs reads the import-history list keyed on the active
// workspace (disabled until a workspace resolves). useUploadImport runs the
// async multipart upload (importJobsApi.uploadImport → POST /imports/upload)
// and, on success, invalidates ["import-jobs", wsId] so the freshly-created job
// appears in the history table. No base64 (multipart carries raw bytes); NO
// offline/sync engine import (FOUND-02 / lint:imports guard).

const IMPORT_JOBS_KEY = "import-jobs";

export interface UseImportJobsResult {
  jobs: ImportJob[];
  total: number;
  isLoading: boolean;
  isError: boolean;
}

export function useImportJobs(): UseImportJobsResult {
  const { currentWorkspaceId: wsId } = useWorkspace();

  const query = useQuery({
    queryKey: [IMPORT_JOBS_KEY, wsId],
    queryFn: () => importJobsApi.listJobs(wsId as string),
    enabled: Boolean(wsId),
    retry: false,
  });

  return {
    jobs: query.data?.jobs ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export interface UploadImportVars {
  entityType: ImportEntityType;
  file: File;
}

export function useUploadImport() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entityType, file }: UploadImportVars) =>
      importJobsApi.uploadImport(wsId as string, entityType, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [IMPORT_JOBS_KEY, wsId] });
    },
  });
}
