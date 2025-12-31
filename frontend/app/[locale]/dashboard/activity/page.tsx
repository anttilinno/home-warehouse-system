"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { useTheme } from "next-themes";
import { Icon } from "@/components/icons";
import { activityApi, ActivityLogResponse } from "@/lib/api";
import { formatDateTime as formatDateTimeUtil } from "@/lib/date-utils";
import { NES_GREEN, NES_BLUE, NES_RED, NES_YELLOW } from "@/lib/nes-colors";
import {
  RetroPageHeader,
  RetroEmptyState,
  RetroButton,
  RetroTable,
  RetroBadge,
  RetroChip,
} from "@/components/retro";

const ENTITY_TYPES = ["ITEM", "INVENTORY", "LOCATION", "CONTAINER", "CATEGORY", "LABEL", "LOAN", "BORROWER"] as const;
const ACTION_TYPES = ["CREATE", "UPDATE", "DELETE", "MOVE", "LOAN", "RETURN"] as const;

export default function ActivityPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const t = useTranslations("activity");
  const { theme } = useTheme();
  const isRetro = theme?.startsWith("retro");

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

  const getActionColor = (action: string) => {
    if (isRetro) {
      switch (action) {
        case "CREATE": return NES_GREEN;
        case "UPDATE": return NES_BLUE;
        case "DELETE": return NES_RED;
        case "MOVE": return NES_YELLOW;
        case "LOAN": return NES_BLUE;
        case "RETURN": return NES_GREEN;
        default: return NES_BLUE;
      }
    }
    switch (action) {
      case "CREATE": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "UPDATE": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "DELETE": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "MOVE": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "LOAN": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "RETURN": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
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
          <div key={field} className={isRetro ? "retro-body" : "text-sm"}>
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
    if (isRetro) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="retro-small uppercase font-bold animate-pulse retro-heading">
            {t("loading")}
          </p>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">{t("loading")}</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error) {
    if (isRetro) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <p className="text-primary mb-4 retro-body">{error}</p>
          <RetroButton variant="primary" icon="RefreshCw" onClick={loadActivities}>
            {t("tryAgain")}
          </RetroButton>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={loadActivities}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Icon name="RefreshCw" className="h-4 w-4" />
          {t("tryAgain")}
        </button>
      </div>
    );
  }

  // Retro NES theme
  if (isRetro) {
    return (
      <>
        <RetroPageHeader
          title={t("title")}
          subtitle={t("subtitle")}
          actions={
            <button
              onClick={loadActivities}
              className="px-3 py-2 bg-white/20 text-white border-2 border-white/50 hover:bg-white/30 transition-colors flex items-center gap-2 retro-small uppercase"
            >
              <Icon name="RefreshCw" className="h-4 w-4" />
              {t("refresh")}
            </button>
          }
        />

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          <RetroChip
            selected={entityFilter === null}
            onClick={() => { setEntityFilter(null); setOffset(0); }}
          >
            {t("filters.allTypes")}
          </RetroChip>
          {ENTITY_TYPES.map((type) => (
            <RetroChip
              key={type}
              selected={entityFilter === type}
              onClick={() => { setEntityFilter(type); setOffset(0); }}
            >
              {t(`entities.${type}`)}
            </RetroChip>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <RetroChip
            selected={actionFilter === null}
            onClick={() => { setActionFilter(null); setOffset(0); }}
          >
            {t("filters.allActions")}
          </RetroChip>
          {ACTION_TYPES.map((action) => (
            <RetroChip
              key={action}
              selected={actionFilter === action}
              onClick={() => { setActionFilter(action); setOffset(0); }}
            >
              {t(`actions.${action}`)}
            </RetroChip>
          ))}
        </div>

        {activities.length === 0 ? (
          <RetroEmptyState
            icon="History"
            message={t("noActivity")}
            description={t("noActivityDescription")}
          />
        ) : (
          <RetroTable>
            <RetroTable.Head>
              <RetroTable.Row>
                <RetroTable.Th>{t("table.action")}</RetroTable.Th>
                <RetroTable.Th>{t("table.entity")}</RetroTable.Th>
                <RetroTable.Th>{t("table.user")}</RetroTable.Th>
                <RetroTable.Th align="right">{t("table.date")}</RetroTable.Th>
              </RetroTable.Row>
            </RetroTable.Head>
            <RetroTable.Body>
              {activities.map((activity) => (
                <>
                  <RetroTable.Row
                    key={activity.id}
                    clickable={hasChanges(activity.changes)}
                    onClick={() => hasChanges(activity.changes) && setExpandedId(expandedId === activity.id ? null : activity.id)}
                  >
                    <RetroTable.Td>
                      <RetroBadge variant={getActionBadgeVariant(activity.action)}>
                        {t(`actions.${activity.action}`)}
                      </RetroBadge>
                    </RetroTable.Td>
                    <RetroTable.Td>
                      <div className="flex flex-col">
                        <span className="font-medium">{t(`entities.${activity.entity_type}`)}</span>
                        {activity.entity_name && (
                          <span className="text-muted-foreground text-sm">{activity.entity_name}</span>
                        )}
                      </div>
                    </RetroTable.Td>
                    <RetroTable.Td>
                      {activity.user_name || t("unknownUser")}
                    </RetroTable.Td>
                    <RetroTable.Td align="right">
                      {formatDateTime(activity.created_at)}
                    </RetroTable.Td>
                  </RetroTable.Row>
                  {expandedId === activity.id && hasChanges(activity.changes) && (
                    <RetroTable.Row key={`${activity.id}-details`}>
                      <RetroTable.Td colSpan={4}>
                        <div className="p-4 bg-muted/50 border-t-2 border-border">
                          <h4 className="retro-heading mb-2">{t("table.changes")}</h4>
                          {renderChanges(activity.changes)}
                        </div>
                      </RetroTable.Td>
                    </RetroTable.Row>
                  )}
                </>
              ))}
            </RetroTable.Body>
          </RetroTable>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="mt-6 flex items-center justify-between">
            <div className="retro-small text-muted-foreground uppercase">
              {t("showingCount", { showing: activities.length, total })}
            </div>
            <div className="flex gap-2">
              <RetroButton
                variant="secondary"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                Previous
              </RetroButton>
              <RetroButton
                variant="secondary"
                size="sm"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
              >
                Next
              </RetroButton>
            </div>
          </div>
        )}
      </>
    );
  }

  // Standard theme
  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
        </div>
        <button
          onClick={loadActivities}
          className="px-3 py-2 border rounded-lg hover:bg-muted transition-colors flex items-center gap-2 text-sm"
        >
          <Icon name="RefreshCw" className="h-4 w-4" />
          {t("refresh")}
        </button>
      </div>

      {/* Filters */}
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

      {activities.length === 0 ? (
        <div className="bg-card p-8 rounded-lg border text-center">
          <Icon name="History" className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t("noActivity")}</h3>
          <p className="text-muted-foreground">{t("noActivityDescription")}</p>
        </div>
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
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${getActionColor(activity.action)}`}>
                        {t(`actions.${activity.action}`)}
                      </span>
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
                        <h4 className="font-medium mb-2">{t("table.changes")}</h4>
                        {renderChanges(activity.changes)}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {t("showingCount", { showing: activities.length, total })}
          </div>
          <div className="flex gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="px-3 py-1.5 border rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
              className="px-3 py-1.5 border rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}
