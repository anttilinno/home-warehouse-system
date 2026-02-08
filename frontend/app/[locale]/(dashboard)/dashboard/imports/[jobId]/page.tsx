"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useDateFormat } from "@/lib/hooks/use-date-format";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";

interface ImportJob {
  id: string;
  entity_type: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  file_name: string;
  file_size_bytes: number;
  total_rows: number | null;
  processed_rows: number;
  success_count: number;
  error_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

interface ImportError {
  id: string;
  row_number: number;
  field_name: string | null;
  error_message: string;
  row_data: Record<string, unknown>;
}

interface ImportErrorsResponse {
  errors: ImportError[];
  total: number;
}

export default function ImportJobDetailPage() {
  const params = useParams();
  const { workspaceId, isLoading: workspaceLoading } = useWorkspace();
  const { formatDateTime } = useDateFormat();
  const jobId = params.jobId as string;

  const [job, setJob] = useState<ImportJob | null>(null);
  const [errorsData, setErrorsData] = useState<ImportErrorsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  // Fetch job data
  const fetchJob = useCallback(async () => {
    if (!workspaceId || !jobId) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/workspaces/${workspaceId}/imports/jobs/${jobId}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Failed to fetch job");
      const data = await response.json();
      setJob(data);
      return data;
    } catch (err) {
      toast.error("Failed to load import job", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, jobId]);

  // Fetch errors
  const fetchErrors = useCallback(async () => {
    if (!workspaceId || !jobId) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/workspaces/${workspaceId}/imports/jobs/${jobId}/errors`,
        { credentials: "include" }
      );
      if (!response.ok) return;
      const data = await response.json();
      setErrorsData(data);
    } catch {
      // Silently fail for errors fetch
    }
  }, [workspaceId, jobId]);

  // Initial load
  useEffect(() => {
    if (workspaceId && jobId) {
      fetchJob();
    }
  }, [workspaceId, jobId, fetchJob]);

  // Fetch errors when job is completed/failed
  useEffect(() => {
    if (job && (job.status === "completed" || job.status === "failed")) {
      fetchErrors();
    }
  }, [job?.status, fetchErrors]);

  // Set up SSE for real-time updates
  useEffect(() => {
    if (!job || !workspaceId) return;

    // Only subscribe to SSE if job is pending or processing
    if (job.status !== "pending" && job.status !== "processing") {
      return;
    }

    setIsLive(true);
    // Include token as query param since EventSource can't send Authorization header
    let sseUrl = `${process.env.NEXT_PUBLIC_API_URL}/workspaces/${workspaceId}/sse`;
    const token = apiClient.getToken();
    if (token) {
      sseUrl += `?token=${encodeURIComponent(token)}`;
    }
    const eventSource = new EventSource(sseUrl, { withCredentials: true });

    eventSource.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "import.progress" && data.data.id === jobId) {
          setJob((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: data.data.status,
              processed_rows: data.data.processed_rows,
              success_count: data.data.success_count,
              error_count: data.data.error_count,
              total_rows: data.data.total_rows || prev.total_rows,
            };
          });

          // If completed or failed, close connection
          if (data.data.status === "completed" || data.data.status === "failed") {
            eventSource.close();
            setIsLive(false);
          }
        }
      } catch (err) {
        console.error("Failed to parse SSE message:", err);
      }
    });

    eventSource.addEventListener("error", (error) => {
      console.error("SSE error:", error);
      eventSource.close();
      setIsLive(false);
    });

    return () => {
      eventSource.close();
      setIsLive(false);
    };
  }, [job?.status, workspaceId, jobId]);

  const calculateProgress = () => {
    if (!job?.total_rows || job.total_rows === 0) return 0;
    return Math.round((job.processed_rows / job.total_rows) * 100);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (workspaceLoading || isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/imports">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Imports
            </Link>
          </Button>
        </div>

        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="h-6 w-24" />
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-4 w-full" />
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Import job not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/imports">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Imports
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{job.file_name}</h1>
          <p className="text-muted-foreground mt-2">
            {job.entity_type} import • {formatFileSize(job.file_size_bytes)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <Badge variant="outline" className="animate-pulse">
              <div className="h-2 w-2 bg-green-500 rounded-full mr-2" />
              Live
            </Badge>
          )}
          <Badge
            variant={
              job.status === "completed"
                ? "default"
                : job.status === "failed"
                ? "destructive"
                : "default"
            }
          >
            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
          </Badge>
        </div>
      </div>

      {/* Progress Card */}
      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
          <CardDescription>
            Started {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {job.status === "processing" && job.total_rows && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing rows...</span>
                <span className="font-medium">{calculateProgress()}%</span>
              </div>
              <Progress value={calculateProgress()} className="h-2" />
              <p className="text-sm text-muted-foreground">
                {job.processed_rows} of {job.total_rows} rows processed
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Rows</p>
              <p className="text-2xl font-bold">{job.total_rows || "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Successful</p>
              <p className="text-2xl font-bold text-green-600">{job.success_count}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Errors</p>
              <p className="text-2xl font-bold text-red-600">{job.error_count}</p>
            </div>
          </div>

          {job.started_at && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Started: </span>
                <span>{formatDateTime(job.started_at)}</span>
              </div>
              {job.completed_at && (
                <div>
                  <span className="text-muted-foreground">Completed: </span>
                  <span>{formatDateTime(job.completed_at)}</span>
                </div>
              )}
            </div>
          )}

          {job.error_message && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{job.error_message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Errors Card */}
      {errorsData && errorsData.errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Import Errors ({errorsData.errors.length})</CardTitle>
            <CardDescription>Rows that failed to import</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errorsData.errors.map((error) => (
                  <TableRow key={error.id}>
                    <TableCell className="font-medium">{error.row_number}</TableCell>
                    <TableCell>
                      <code className="text-xs">{error.field_name || "-"}</code>
                    </TableCell>
                    <TableCell className="text-red-600">{error.error_message}</TableCell>
                    <TableCell>
                      <code className="text-xs">
                        {JSON.stringify(error.row_data).slice(0, 50)}...
                      </code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
