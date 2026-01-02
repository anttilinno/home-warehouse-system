"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { Icon } from "@/components/icons";
import { activityApi, ActivityLogResponse } from "@/lib/api";
import { formatDateTime as formatDateTimeUtil } from "@/lib/date-utils";
import { useThemed, useThemedClasses } from "@/lib/themed";

const ENTITY_TYPES = ["ITEM", "INVENTORY", "LOCATION", "CONTAINER", "CATEGORY", "LABEL", "LOAN", "BORROWER"] as const;
const ACTION_TYPES = ["CREATE", "UPDATE", "DELETE", "MOVE", "LOAN", "RETURN"] as const;

export default function ActivityPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const t = useTranslations("activity");
  const themed = useThemed();
  const classes = useThemedClasses();

  const { PageHeader, Button, Table, EmptyState, Badge, Chip } = themed;

  const [activities, setActivities] = useState<ActivityLogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [entityFilter, setEntityFilter] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const limit = 50;

  const loadActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await activityApi.list({
        limit,
        offset,
        entity_type: entityFilter || undefined,
        action: actionFilter || undefined,
      });
      setActivities(response.items);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadActivities();
    }
  }, [isAuthenticated, offset, entityFilter, actionFilter]);

  const formatDateTime = (dateString: string) => {
    return formatDateTimeUtil(dateString, user?.date_format);
  };

  const getActionBadgeVariant = (action: string): "success" | "info" | "danger" | "warning" | "muted" => {
    switch (action) {
      case "CREATE": return "success";
      case "UPDATE": return "info";
      case "DELETE": return "danger";
      case "MOVE": return "warning";
      case "LOAN": return "info";
      case "RETURN": return "success";
      default: return "muted";
    }
  };

  const hasChanges = (changes: Record<string, { old: unknown; new: unknown }> | null): boolean => {
    return !!changes && Object.keys(changes).length > 0;
  };

  const renderChanges = (changes: Record<string, { old: unknown; new: unknown }> | null) => {
    if (!hasChanges(changes)) return null;

    return (
      <div className="space-y-2">
        {Object.entries(changes!).map(([field, { old: oldVal, new: newVal }]) => (
          <div key={field} className={classes.bodyText}>
            <span className="font-medium">{field}:</span>{" "}
            <span className="text-muted-foreground">
              {String(oldVal ?? "—")}
            </span>
            <span className="mx-2">→</span>
            <span className="font-medium">
              {String(newVal ?? "—")}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className={classes.loadingText}>
          {t("loading")}
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className={`${classes.errorText} mb-4`}>{error}</p>
        <Button variant="primary" icon="RefreshCw" onClick={loadActivities}>
          {t("tryAgain")}
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          classes.isRetro ? (
            <button
              onClick={loadActivities}
              className="px-3 py-2 bg-white/20 text-white border-2 border-white/50 hover:bg-white/30 transition-colors flex items-center gap-2 retro-small uppercase"
            >
              <Icon name="RefreshCw" className="h-4 w-4" />
              {t("refresh")}
            </button>
          ) : (
            <button
              onClick={loadActivities}
              className="px-3 py-2 border rounded-lg hover:bg-muted transition-colors flex items-center gap-2 text-sm"
            >
              <Icon name="RefreshCw" className="h-4 w-4" />
              {t("refresh")}
            </button>
          )
        }
      />

      {/* Filters */}
      {classes.isRetro ? (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            <Chip
              selected={entityFilter === null}
              onClick={() => { setEntityFilter(null); setOffset(0); }}
            >
              {t("filters.allTypes")}
            </Chip>
            {ENTITY_TYPES.map((type) => (
              <Chip
                key={type}
                selected={entityFilter === type}
                onClick={() => { setEntityFilter(type); setOffset(0); }}
              >
                {t(`entities.${type}`)}
              </Chip>
            ))}
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            <Chip
              selected={actionFilter === null}
              onClick={() => { setActionFilter(null); setOffset(0); }}
            >
              {t("filters.allActions")}
            </Chip>
            {ACTION_TYPES.map((action) => (
              <Chip
                key={action}
                selected={actionFilter === action}
                onClick={() => { setActionFilter(action); setOffset(0); }}
              >
                {t(`actions.${action}`)}
              </Chip>
            ))}
          </div>
        </>
      ) : (
        <div className="mb-4 flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">{t("table.entity")}:</label>
            <select
              value={entityFilter || ""}
              onChange={(e) => { setEntityFilter(e.target.value || null); setOffset(0); }}
              className="border rounded-lg px-3 py-1.5 text-sm bg-background"
            >
              <option value="">{t("filters.allTypes")}</option>
              {ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>{t(`entities.${type}`)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">{t("table.action")}:</label>
            <select
              value={actionFilter || ""}
              onChange={(e) => { setActionFilter(e.target.value || null); setOffset(0); }}
              className="border rounded-lg px-3 py-1.5 text-sm bg-background"
            >
              <option value="">{t("filters.allActions")}</option>
              {ACTION_TYPES.map((action) => (
                <option key={action} value={action}>{t(`actions.${action}`)}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {activities.length === 0 ? (
        <EmptyState
          icon="History"
          message={t("noActivity")}
          description={t("noActivityDescription")}
        />
      ) : (
        classes.isRetro ? (
          <Table>
            <Table.Head>
              <Table.Row>
                <Table.Th>{t("table.action")}</Table.Th>
                <Table.Th>{t("table.entity")}</Table.Th>
                <Table.Th>{t("table.user")}</Table.Th>
                <Table.Th align="right">{t("table.date")}</Table.Th>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {activities.map((activity) => (
                <>
                  <Table.Row
                    key={activity.id}
                    clickable={hasChanges(activity.changes)}
                    onClick={() => hasChanges(activity.changes) && setExpandedId(expandedId === activity.id ? null : activity.id)}
                  >
                    <Table.Td>
                      <Badge variant={getActionBadgeVariant(activity.action)}>
                        {t(`actions.${activity.action}`)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <div className="flex flex-col">
                        <span className="font-medium">{t(`entities.${activity.entity_type}`)}</span>
                        {activity.entity_name && (
                          <span className="text-muted-foreground text-sm">{activity.entity_name}</span>
                        )}
                      </div>
                    </Table.Td>
                    <Table.Td>
                      {activity.user_name || t("unknownUser")}
                    </Table.Td>
                    <Table.Td align="right">
                      {formatDateTime(activity.created_at)}
                    </Table.Td>
                  </Table.Row>
                  {expandedId === activity.id && hasChanges(activity.changes) && (
                    <Table.Row key={`${activity.id}-details`}>
                      <Table.Td colSpan={4}>
                        <div className="p-4 bg-muted/50 border-t-2 border-border">
                          <h4 className={`${classes.heading} mb-2`}>{t("table.changes")}</h4>
                          {renderChanges(activity.changes)}
                        </div>
                      </Table.Td>
                    </Table.Row>
                  )}
                </>
              ))}
            </Table.Body>
          </Table>
        ) : (
          <div className="bg-card rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium">{t("table.action")}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">{t("table.entity")}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">{t("table.user")}</th>
                  <th className="text-right px-4 py-3 text-sm font-medium">{t("table.date")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activities.map((activity) => (
                  <>
                    <tr
                      key={activity.id}
                      className={hasChanges(activity.changes) ? "hover:bg-muted/30 cursor-pointer transition-colors" : ""}
                      onClick={() => hasChanges(activity.changes) && setExpandedId(expandedId === activity.id ? null : activity.id)}
                    >
                      <td className="px-4 py-3">
                        <Badge variant={getActionBadgeVariant(activity.action)}>
                          {t(`actions.${activity.action}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium">{t(`entities.${activity.entity_type}`)}</span>
                          {activity.entity_name && (
                            <span className="text-sm text-muted-foreground">{activity.entity_name}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {activity.user_name || t("unknownUser")}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                        {formatDateTime(activity.created_at)}
                      </td>
                    </tr>
                    {expandedId === activity.id && hasChanges(activity.changes) && (
                      <tr key={`${activity.id}-details`}>
                        <td colSpan={4} className="px-4 py-4 bg-muted/20 border-t">
                          <h4 className={`${classes.heading} mb-2`}>{t("table.changes")}</h4>
                          {renderChanges(activity.changes)}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="mt-6 flex items-center justify-between">
          <div className={classes.smallText}>
            {t("showingCount", { showing: activities.length, total })}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
