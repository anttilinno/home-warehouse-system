import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { locationApi } from "@/lib/api/location";
import { containerApi } from "@/lib/api/container";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { RetroComboboxOption } from "@/components/retro";

// Phase 10 Plan 03 — debounced /search query hook backing the Taxonomy
// SearchPicker. Domain-generic over locations|containers; calls
// locationApi.search / containerApi.search (the api already unwraps the BARE
// { items } envelope, Pitfall 2; limit clamped ≤100, Pitfall 3) and maps the
// rows to RetroComboboxOption[] { value:id, label:name }.
//
// The query key is PREFIXED by domain (Lock #4): [domain, wsId, "search", q] —
// so a domain mutation/SSE invalidate of ["locations", wsId] / ["containers",
// wsId] also covers the search cache. The typed query is debounced ~250ms so
// keystrokes don't fan out a request each.
//
// An empty query is a no-fetch state (the hook still resolves to [] until the
// debounced query has length>0) — the picker shows whatever the last results
// were; the consumer drives a sensible initial fetch by seeding the query.

const DEBOUNCE_MS = 250;

export type SearchDomain = "locations" | "containers";

interface NamedRow {
  id: string;
  name: string;
}

export interface UseTaxonomySearchResult {
  options: RetroComboboxOption[];
  isLoading: boolean;
}

export function useTaxonomySearch(
  domain: SearchDomain,
  query: string,
): UseTaxonomySearchResult {
  const { currentWorkspaceId: wsId } = useWorkspace();

  // Debounce the typed query so each keystroke doesn't fire a /search request.
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const trimmed = debounced.trim();

  const result = useQuery({
    // PREFIXED by domain (Lock #4) so domain invalidation covers the search cache.
    queryKey: [domain, wsId, "search", trimmed],
    queryFn: () => {
      const search =
        domain === "locations" ? locationApi.search : containerApi.search;
      // The api unwraps the BARE { items } envelope to a plain row array.
      return search(wsId as string, trimmed) as Promise<NamedRow[]>;
    },
    enabled: !!wsId && trimmed.length > 0,
    retry: false,
  });

  const options = useMemo<RetroComboboxOption[]>(
    () => (result.data ?? []).map((r) => ({ value: r.id, label: r.name })),
    [result.data],
  );

  return { options, isLoading: result.isLoading && trimmed.length > 0 };
}
