import { useCallback } from "react";
import { get } from "@/lib/api";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 10 Plan 02 — SHARED imperative usage-count fetcher. Created HERE for the
// TAX-02 category archive warning; the W3 Containers tab (10-03) reuses it for
// the TAX-06 container delete-cascade warning, hence the domain-generic
// `kind` discriminator.
//
// IMPERATIVE (returns fetchCount, NOT a hook-per-row) — mirrors the borrowers
// OQ7 no-fan-out discipline: the count is fetched ONLY when a destructive
// dialog opens, never eagerly per tree row. It reads the PAGINATED `.total`
// from a limit=1 list read:
//   kind="category"  → GET /items?category_id={id}&limit=1
//   kind="container" → GET /inventory?container_id={id}&limit=1
// limit is clamped to 1 (we only need the count, not the rows).

export type UsageKind = "category" | "container";

interface PaginatedTotal {
  total: number;
}

/**
 * Returns an imperative `fetchCount(kind, id)` resolving the assigned-item count
 * for a taxonomy node, read from the paginated `.total` of a `limit=1` list
 * query. The W3 Containers tab consumes the SAME signature via `kind="container"`.
 */
export function useUsageCount() {
  const { currentWorkspaceId: wsId } = useWorkspace();

  const fetchCount = useCallback(
    async (kind: UsageKind, id: string): Promise<number> => {
      const ws = wsId as string;
      // limit clamped to 1 — we only read `.total`, never the rows.
      const path =
        kind === "category"
          ? `/workspaces/${ws}/items?category_id=${encodeURIComponent(id)}&limit=1`
          : `/workspaces/${ws}/inventory?container_id=${encodeURIComponent(id)}&limit=1`;
      const res = await get<PaginatedTotal>(path);
      return res.total ?? 0;
    },
    [wsId],
  );

  return { fetchCount };
}
