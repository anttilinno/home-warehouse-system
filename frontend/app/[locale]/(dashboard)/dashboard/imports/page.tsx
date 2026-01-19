"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { FileText, Clock, CheckCircle2, XCircle, Loader2, Upload, AlertTriangle, ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { toast } from "sonner";

interface FetchError extends Error {
  status?: number;
}

interface ImportJob {
  id: string;
  entity_type: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  file_name: string;
  total_rows: number | null;
  processed_rows: number;
  success_count: number;
  error_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface ImportJobsResponse {
  jobs: ImportJob[];
  total: number;
  page: number;
  total_pages: number;
}

export default function ImportsPage() {
  const t = useTranslations("imports");
  const { workspaceId, isLoading: workspaceLoading } = useWorkspace();
  const [data, setData] = useState<ImportJobsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!workspaceId) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/workspaces/${workspaceId}/imports/jobs`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) {
        const fetchError: FetchError = new Error("Failed to fetch import jobs");
        fetchError.status = response.status;
        throw fetchError;
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      const errorObj: FetchError = err instanceof Error ? err as FetchError : new Error("Failed to fetch import jobs");
      setError(errorObj);
      // Don't show toast for initial load errors - show inline error instead
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) {
      fetchJobs();
    }
  }, [workspaceId, fetchJobs]);

  // Refresh every 5 seconds when there are active jobs
  useEffect(() => {
    if (!workspaceId) return;

    const hasActiveJobs = data?.jobs.some(
      (job) => job.status === "pending" || job.status === "processing"
    );

    if (hasActiveJobs) {
      const interval = setInterval(fetchJobs, 5000);
      return () => clearInterval(interval);
    }
  }, [workspaceId, data?.jobs, fetchJobs]);

  const getStatusIcon = (status: ImportJob["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: ImportJob["status"]) => {
    const variants: Record<ImportJob["status"], "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      processing: "default",
      completed: "default",
      failed: "destructive",
      cancelled: "secondary",
    };
    return (
      <Badge variant={variants[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const calculateProgress = (job: ImportJob) => {
    if (!job.total_rows || job.total_rows === 0) return 0;
    return Math.round((job.processed_rows / job.total_rows) * 100);
  };

  if (workspaceLoading || isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            <p className="text-muted-foreground mt-2">
              {t("subtitle")}
            </p>
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    const fetchError = error as FetchError;
    const isAuthError = fetchError.status === 401 || fetchError.status === 403;
    const isServerError = fetchError.status && fetchError.status >= 500;

    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            <p className="text-muted-foreground mt-2">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            {isAuthError ? (
              <>
                <ShieldAlert className="h-12 w-12 text-yellow-600 mb-4" />
                <p className="text-lg font-medium">{t("errors.authTitle")}</p>
                <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                  {t("errors.authDescription")}
                </p>
              </>
            ) : isServerError ? (
              <>
                <AlertTriangle className="h-12 w-12 text-red-600 mb-4" />
                <p className="text-lg font-medium">{t("errors.serverTitle")}</p>
                <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                  {t("errors.serverDescription")}
                </p>
              </>
            ) : (
              <>
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">{t("errors.unavailableTitle")}</p>
                <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                  {t("errors.unavailableDescription")}
                </p>
              </>
            )}
            <Button variant="outline" onClick={() => { setError(null); setIsLoading(true); fetchJobs(); }}>
              {t("errors.tryAgain")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("subtitle")}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/imports/new">
            <Upload className="h-4 w-4 mr-2" />
            {t("newImport")}
          </Link>
        </Button>
      </div>

      <div className="grid gap-4">
        {data?.jobs.map((job) => (
          <Card key={job.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(job.status)}
                  <div>
                    <CardTitle className="text-lg">{job.file_name}</CardTitle>
                    <CardDescription>
                      {job.entity_type} • {t("job.started")}{" "}
                      {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                    </CardDescription>
                  </div>
                </div>
                {getStatusBadge(job.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {job.status === "processing" && job.total_rows && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{t("job.progress")}</span>
                      <span className="font-medium">{calculateProgress(job)}%</span>
                    </div>
                    <Progress value={calculateProgress(job)} />
                    <p className="text-xs text-muted-foreground">
                      {t("job.rowsProcessed", { processed: job.processed_rows, total: job.total_rows })}
                    </p>
                  </div>
                )}

                {(job.status === "completed" || job.status === "failed") && (
                  <div className="flex gap-6 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t("job.success")}: </span>
                      <span className="font-medium text-green-600">{job.success_count}</span>
                    </div>
                    {job.error_count > 0 && (
                      <div>
                        <span className="text-muted-foreground">{t("job.errors")}: </span>
                        <span className="font-medium text-red-600">{job.error_count}</span>
                      </div>
                    )}
                    {job.total_rows && (
                      <div>
                        <span className="text-muted-foreground">{t("job.total")}: </span>
                        <span className="font-medium">{job.total_rows}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/dashboard/imports/${job.id}`}>{t("viewDetails")}</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {data?.jobs.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">{t("empty.title")}</p>
              <p className="text-sm text-muted-foreground mb-4">
                {t("empty.description")}
              </p>
              <Button asChild>
                <Link href="/dashboard/imports/new">
                  <Upload className="h-4 w-4 mr-2" />
                  {t("newImport")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
