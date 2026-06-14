import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { itemsApi } from "@/lib/api/items";
import { borrowersApi } from "@/lib/api/borrowers";
import { locationApi } from "@/lib/api/location";
import { containerApi } from "@/lib/api/container";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// §4 parity — debounced (250ms) live entity search across the 4 domains that
// expose a /search endpoint: items / borrowers / locations / containers.
// Mirrors useTaxonomySearch.ts (DEBOUNCE_MS=250, timer cleared on change).
//
// Query keys are PREFIXED by domain (Lock #4): [domain, wsId, "search", q] — so
// a workspace switch never serves stale-tenant rows (T-16-02) and a domain
// mutation/invalidate also covers the search cache. Each query is `enabled` only
// when the trimmed query is >=2 chars AND a wsId is present, so a missing
// workspace never fans out a cross-tenant request. `limit` is clamped small (5,
// well under the backend's 100 cap → no 422 storm, T-16-05).

const DEBOUNCE_MS = 250;
const SEARCH_LIMIT = 5; // clamp <=100 (backend 422 over)
const MIN_QUERY_LENGTH = 2;

/** A normalized search hit: id + display name (entity names rendered as text — T-16-03). */
export interface EntityHit {
  id: string;
  name: string;
}

export interface EntitySearchResult {
  items: EntityHit[];
  borrowers: EntityHit[];
  locations: EntityHit[];
  containers: EntityHit[];
  isFetching: boolean;
}

const EMPTY: EntityHit[] = [];

export function useEntitySearch(query: string): EntitySearchResult {
  const { currentWorkspaceId: wsId } = useWorkspace();

  // Debounce the typed query — the timer id lives in a ref (no per-keystroke
  // re-subscribe / fan-out, Pitfall 2).
  const [debounced, setDebounced] = useState(query);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [query]);

  const trimmed = debounced.trim();
  const enabled = !!wsId && trimmed.length >= MIN_QUERY_LENGTH;

  const itemsQuery = useQuery({
    queryKey: ["items", wsId, "search", trimmed],
    queryFn: () =>
      itemsApi.list(wsId as string, { search: trimmed, limit: SEARCH_LIMIT }),
    enabled,
    retry: false,
  });

  const borrowersQuery = useQuery({
    queryKey: ["borrowers", wsId, "search", trimmed],
    queryFn: () => borrowersApi.search(wsId as string, trimmed, SEARCH_LIMIT),
    enabled,
    retry: false,
  });

  const locationsQuery = useQuery({
    queryKey: ["locations", wsId, "search", trimmed],
    queryFn: () => locationApi.search(wsId as string, trimmed, SEARCH_LIMIT),
    enabled,
    retry: false,
  });

  const containersQuery = useQuery({
    queryKey: ["containers", wsId, "search", trimmed],
    queryFn: () => containerApi.search(wsId as string, trimmed, SEARCH_LIMIT),
    enabled,
    retry: false,
  });

  const items = useMemo<EntityHit[]>(
    () =>
      (itemsQuery.data?.items ?? EMPTY).map((row) => ({
        id: row.id,
        name: row.name,
      })),
    [itemsQuery.data],
  );
  const borrowers = useMemo<EntityHit[]>(
    () =>
      (borrowersQuery.data ?? EMPTY).map((row) => ({
        id: row.id,
        name: row.name,
      })),
    [borrowersQuery.data],
  );
  const locations = useMemo<EntityHit[]>(
    () =>
      (locationsQuery.data ?? EMPTY).map((row) => ({
        id: row.id,
        name: row.name,
      })),
    [locationsQuery.data],
  );
  const containers = useMemo<EntityHit[]>(
    () =>
      (containersQuery.data ?? EMPTY).map((row) => ({
        id: row.id,
        name: row.name,
      })),
    [containersQuery.data],
  );

  return {
    items,
    borrowers,
    locations,
    containers,
    isFetching:
      itemsQuery.isFetching ||
      borrowersQuery.isFetching ||
      locationsQuery.isFetching ||
      containersQuery.isFetching,
  };
}
