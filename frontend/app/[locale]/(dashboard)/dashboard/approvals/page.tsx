"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Shield,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Package,
  MapPin,
  Box,
  FolderTree,
  Users,
  HandCoins,
  Archive,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useSSE, type SSEEvent } from "@/lib/hooks/use-sse";
import {
  pendingChangesApi,
  type PendingChange,
  type PendingChangeStatus,
  type PendingChangeEntityType,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const entityTypeIcons: Record<PendingChangeEntityType, typeof Package> = {
  item: Package,
  location: MapPin,
  container: Box,
  category: FolderTree,
  borrower: Users,
  loan: HandCoins,
  inventory: Archive,
};

function getStatusColor(status: PendingChangeStatus): string {
  switch (status) {
    case "pending":
      return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
    case "approved":
      return "bg-green-500/10 text-green-700 border-green-500/20";
    case "rejected":
      return "bg-red-500/10 text-red-700 border-red-500/20";
    default:
      return "bg-gray-500/10 text-gray-700 border-gray-500/20";
  }
}

function getActionLabel(action: string): string {
  switch (action) {
    case "create":
      return "Create";
    case "update":
      return "Update";
    case "delete":
      return "Delete";
    default:
      return action;
  }
}

function PendingChangeCard({ change }: { change: PendingChange }) {
  const t = useTranslations("approvals");
  const Icon = entityTypeIcons[change.entity_type];

  return (
    <Link href={`/dashboard/approvals/${change.id}`}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={cn("capitalize", getStatusColor(change.status))}>
                      {change.status}
                    </Badge>
                    <Badge variant="secondary" className="capitalize">
                      {getActionLabel(change.action)}
                    </Badge>
                    <span className="text-sm text-muted-foreground capitalize">
                      {change.entity_type}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Requested by <span className="font-medium text-foreground">{change.requester_name}</span>
                  </div>
                </div>

                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </div>

              {/* Timestamp */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(change.created_at).toLocaleString()}
              </div>

              {/* Review info if reviewed */}
              {change.status !== "pending" && change.reviewer_name && (
                <div className="text-xs text-muted-foreground">
                  Reviewed by <span className="font-medium">{change.reviewer_name}</span>
                  {change.reviewed_at && (
                    <> on {new Date(change.reviewed_at).toLocaleString()}</>
                  )}
                </div>
              )}

              {/* Rejection reason */}
              {change.status === "rejected" && change.rejection_reason && (
                <div className="text-sm text-destructive">
                  Reason: {change.rejection_reason}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ApprovalsListSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-6 w-1/3 bg-muted rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
                <div className="h-3 w-1/4 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ApprovalsPage() {
  const t = useTranslations("approvals");
  const { workspaceId, isLoading: workspaceLoading, currentMember } = useWorkspace();

  const [changes, setChanges] = useState<PendingChange[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState<PendingChangeStatus | "all">("pending");
  const [entityTypeFilter, setEntityTypeFilter] = useState<PendingChangeEntityType | "all">("all");

  // Check if user has permission to view approvals (owner or admin)
  const canViewApprovals = currentMember?.role === "owner" || currentMember?.role === "admin";

  const loadChanges = async () => {
    if (!workspaceId) return;

    try {
      setIsLoading(true);
      const params: { status?: PendingChangeStatus; entity_type?: PendingChangeEntityType } = {};

      if (statusFilter !== "all") {
        params.status = statusFilter;
      }
      if (entityTypeFilter !== "all") {
        params.entity_type = entityTypeFilter;
      }

      const response = await pendingChangesApi.list(workspaceId, params);
      setChanges(response.changes ?? []);
      setTotal(response.total ?? 0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load pending changes";
      toast.error("Failed to load pending changes", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (workspaceId && canViewApprovals) {
      loadChanges();
    }
  }, [workspaceId, statusFilter, entityTypeFilter, canViewApprovals]);

  // Subscribe to SSE events for real-time updates
  useSSE({
    onEvent: (event: SSEEvent) => {
      if (event.entity_type === 'pending_change') {
        loadChanges();
      }
    },
  });

  // Filter changes by search query
  const filteredChanges = useMemo(() => {
    const safeChanges = changes ?? [];
    if (!debouncedSearchQuery.trim()) {
      return safeChanges;
    }

    const query = debouncedSearchQuery.toLowerCase();
    return safeChanges.filter(
      (change) =>
        change.requester_name.toLowerCase().includes(query) ||
        change.entity_type.toLowerCase().includes(query) ||
        change.action.toLowerCase().includes(query) ||
        (change.reviewer_name && change.reviewer_name.toLowerCase().includes(query))
    );
  }, [changes, debouncedSearchQuery]);

  const safeChanges = changes ?? [];
  const pendingCount = safeChanges.filter((c) => c.status === "pending").length;

  if (workspaceLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <ApprovalsListSkeleton />
      </div>
    );
  }

  if (!canViewApprovals) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <EmptyState
          icon={Shield}
          title={t("noPermission")}
          description={t("noPermissionDescription")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("subtitle")} {pendingCount > 0 && `(${pendingCount} pending)`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("search")}
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PendingChangeStatus | "all")}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filter.allStatuses")}</SelectItem>
            <SelectItem value="pending">{t("filter.pending")}</SelectItem>
            <SelectItem value="approved">{t("filter.approved")}</SelectItem>
            <SelectItem value="rejected">{t("filter.rejected")}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={entityTypeFilter} onValueChange={(v) => setEntityTypeFilter(v as PendingChangeEntityType | "all")}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filter.allTypes")}</SelectItem>
            <SelectItem value="item">{t("filter.item")}</SelectItem>
            <SelectItem value="location">{t("filter.location")}</SelectItem>
            <SelectItem value="container">{t("filter.container")}</SelectItem>
            <SelectItem value="category">{t("filter.category")}</SelectItem>
            <SelectItem value="borrower">{t("filter.borrower")}</SelectItem>
            <SelectItem value="loan">{t("filter.loan")}</SelectItem>
            <SelectItem value="inventory">{t("filter.inventory")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Changes List */}
      {isLoading ? (
        <ApprovalsListSkeleton />
      ) : filteredChanges.length === 0 ? (
        <EmptyState
          icon={Shield}
          title={searchQuery ? t("noResults") : t("empty")}
          description={searchQuery ? t("noResultsDescription") : t("emptyDescription")}
        />
      ) : (
        <div className="space-y-4">
          {filteredChanges.map((change) => (
            <PendingChangeCard key={change.id} change={change} />
          ))}
        </div>
      )}

      {/* Stats */}
      {!isLoading && filteredChanges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("stats.title")}</CardTitle>
            <CardDescription>{t("stats.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div>
                  <div className="text-2xl font-bold">{pendingCount}</div>
                  <div className="text-sm text-muted-foreground">{t("stats.pending")}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div>
                  <div className="text-2xl font-bold">
                    {safeChanges.filter((c) => c.status === "approved").length}
                  </div>
                  <div className="text-sm text-muted-foreground">{t("stats.approved")}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <XCircle className="h-8 w-8 text-red-600" />
                <div>
                  <div className="text-2xl font-bold">
                    {safeChanges.filter((c) => c.status === "rejected").length}
                  </div>
                  <div className="text-sm text-muted-foreground">{t("stats.rejected")}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
