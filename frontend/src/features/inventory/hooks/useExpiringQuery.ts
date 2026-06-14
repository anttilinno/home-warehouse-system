import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { inventoryApi } from "@/lib/api/inventory";
import type { ExpiringEntry } from "@/lib/types";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 7b Plan 04 — the /inventory/expiring read. The days window is the ONLY
// URL-driven state (`?days`, default 30); it drives both the query key and the
// `?days=` round-trip to the backend (which clamps it 1..365 server-side —
// T-07b-09). Keyed UNDER the `["inventory", wsId, ...]` prefix so the Phase 6
// SSE prefix invalidation covers it without an exact key.
export const EXPIRING_DAYS_OPTIONS = [7, 30, 90, 365] as const;
export const DEFAULT_EXPIRING_DAYS = 30;

export type ExpiringDays = (typeof EXPIRING_DAYS_OPTIONS)[number];

/** Coerce the raw `?days` param to one of the allowed windows (default 30). */
export function readExpiringDays(params: URLSearchParams): ExpiringDays {
  const raw = Number(params.get("days"));
  return (EXPIRING_DAYS_OPTIONS as readonly number[]).includes(raw)
    ? (raw as ExpiringDays)
    : DEFAULT_EXPIRING_DAYS;
}

export interface UseExpiringQueryResult {
  query: UseQueryResult<{ items: ExpiringEntry[]; total: number }>;
  /** The decoded, clamped days window driving the query + the URL. */
  days: ExpiringDays;
}

/**
 * URL-param-driven expiring query. `?days` (one of 7/30/90/365, default 30)
 * drives the query key `["inventory", wsId, "expiring", days]` and the
 * `inventoryApi.expiring(wsId, days)` call. Enabled only with a workspace.
 */
export function useExpiringQuery(): UseQueryResult<{
  items: ExpiringEntry[];
  total: number;
}> &
  UseExpiringQueryResult {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const [searchParams] = useSearchParams();

  const days = useMemo(() => readExpiringDays(searchParams), [searchParams]);

  const query = useQuery({
    queryKey: ["inventory", wsId, "expiring", days],
    queryFn: () => inventoryApi.expiring(wsId as string, days),
    enabled: !!wsId,
    retry: false,
  });

  return { ...query, query, days };
}
