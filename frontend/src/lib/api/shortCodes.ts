import { get, HttpError } from "@/lib/api";

// Resolve a scanned/typed short code to the entity that owns it, inside the
// current workspace. The JSON sibling of the browser-facing `/r/{code}`
// redirect — same registry (warehouse.short_codes), but usable from the SPA
// without a page load.
//
// Two consumers: the scan funnel (which otherwise only resolves ITEMS by
// barcode, so an existing location/container label reads NOT FOUND), and the
// create forms (turning "short code already exists" into a link to the owner).
//
// 404 → null (unknown code, or a code owned by another workspace — the server
// makes those indistinguishable on purpose). Every other error rethrows.

export type ShortCodeEntityType = "item" | "location" | "container";

export interface ShortCodeMatch {
  entity_type: ShortCodeEntityType;
  entity_id: string;
  name: string;
}

export const shortCodesApi = {
  async resolve(wsId: string, code: string): Promise<ShortCodeMatch | null> {
    try {
      // Path-injection guard (T-07-02); NO client-side case normalization —
      // short codes are case-sensitive and the server is the authority.
      return await get<ShortCodeMatch>(
        `/workspaces/${wsId}/short-codes/${encodeURIComponent(code)}`,
      );
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) return null;
      throw err;
    }
  },
};

// Where a resolved match lives in the v3 route table. Containers and locations
// have no detail route (list-only), so they deep-link via the tab's ?focus=.
export function shortCodeEntityPath(match: ShortCodeMatch): string {
  switch (match.entity_type) {
    case "item":
      return `/items/${match.entity_id}`;
    case "location":
      return `/taxonomy?tab=locations&focus=${match.entity_id}`;
    case "container":
      return `/taxonomy?tab=containers&focus=${match.entity_id}`;
  }
}
