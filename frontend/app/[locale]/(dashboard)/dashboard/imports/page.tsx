"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow } from "date-fns";
import { FileText, Clock, CheckCircle2, XCircle, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { useWorkspace } from "@/lib/hooks/use-workspace";

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
  const { workspace } = useWorkspace();

  const { data, isLoading, error } = useQuery<ImportJobsResponse>({
    queryKey: ["import-jobs", workspace?.slug],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/workspace/${workspace?.slug}/imports/jobs`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) throw new Error("Failed to fetch import jobs");
      return response.json();
    },
    enabled: !!workspace?.slug,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-600">Failed to load import jobs</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Import Jobs</h1>
          <p className="text-muted-foreground mt-2">
            Manage and monitor your bulk import operations
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/imports/new">
            <Upload className="h-4 w-4 mr-2" />
            New Import
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
                      {job.entity_type} • Started{" "}
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
                      <span>Progress</span>
                      <span className="font-medium">{calculateProgress(job)}%</span>
                    </div>
                    <Progress value={calculateProgress(job)} />
                    <p className="text-xs text-muted-foreground">
                      {job.processed_rows} of {job.total_rows} rows processed
                    </p>
                  </div>
                )}

                {(job.status === "completed" || job.status === "failed") && (
                  <div className="flex gap-6 text-sm">
                    <div>
                      <span className="text-muted-foreground">Success: </span>
                      <span className="font-medium text-green-600">{job.success_count}</span>
                    </div>
                    {job.error_count > 0 && (
                      <div>
                        <span className="text-muted-foreground">Errors: </span>
                        <span className="font-medium text-red-600">{job.error_count}</span>
                      </div>
                    )}
                    {job.total_rows && (
                      <div>
                        <span className="text-muted-foreground">Total: </span>
                        <span className="font-medium">{job.total_rows}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/dashboard/imports/${job.id}`}>View Details</Link>
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
              <p className="text-lg font-medium">No import jobs yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Start by creating your first import
              </p>
              <Button asChild>
                <Link href="/dashboard/imports/new">
                  <Upload className="h-4 w-4 mr-2" />
                  New Import
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
