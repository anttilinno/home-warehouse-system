import { get, post, patch, del } from "@/lib/api";

// Phase 14 Plan 03 — wishlistApi (WISH-01/02). MIRRORS lib/api/category.ts but
// the LIST envelope is `{ items, total }` (wishlist/handler.go:253 — verified
// 2026-06-13): a paged list, NOT the bare { items } that loans/categories use.
// Single-entity routes return a WishlistItem.
//
// Status is a closed enum (wanted | ordered | acquired). `list` appends
// `?status=` ONLY when a status is supplied (omit = all). There is NO separate
// "acquire" endpoint — marking an item acquired is a PATCH with {status:"acquired"}
// (optionally acquired_item_id). An illegal transition returns 409
// (ErrInvalidStatusTransition); the api passes the HttpError through unswallowed
// so the form can surface it calmly.

export type WishlistStatus = "wanted" | "ordered" | "acquired";

// Backend WishlistItemResponse — the fields the table/form actually read.
export interface WishlistItem {
  id: string;
  name: string;
  notes?: string;
  url?: string;
  /** CENTS (integer). Format via @/lib/utils/money formatCents. */
  price_estimate?: number;
  currency_code?: string;
  priority: number; // 1..5
  desired_category_id?: string;
  status: WishlistStatus;
  acquired_item_id?: string;
  created_at: string;
}

export interface WishlistCreate {
  name: string; // required, 1..200
  notes?: string;
  url?: string; // ≤2000
  /** CENTS (integer ≥ 0). */
  price_estimate?: number;
  currency_code?: string; // ^[A-Z]{3}$
  priority?: number; // 1..5, default 3
  desired_category_id?: string;
}

// All create fields optional + the transition fields (status, acquired_item_id).
export type WishlistUpdate = Partial<WishlistCreate> & {
  status?: WishlistStatus;
  acquired_item_id?: string;
};

export interface WishlistListResponse {
  items: WishlistItem[];
  total: number;
}

export const wishlistApi = {
  // PAGED { items, total } envelope (NOT bare). `?status=` is appended only when
  // a status is supplied (omit = all statuses). limit default 50 / max 100.
  list: (
    ws: string,
    status?: WishlistStatus,
  ): Promise<WishlistListResponse> => {
    const suffix = status ? `?status=${status}` : "";
    return get<WishlistListResponse>(`/workspaces/${ws}/wishlist${suffix}`);
  },
  create: (ws: string, body: WishlistCreate): Promise<WishlistItem> =>
    post<WishlistItem>(`/workspaces/${ws}/wishlist`, body),
  update: (
    ws: string,
    id: string,
    body: WishlistUpdate,
  ): Promise<WishlistItem> =>
    patch<WishlistItem>(`/workspaces/${ws}/wishlist/${id}`, body),
  remove: (ws: string, id: string): Promise<void> =>
    del<void>(`/workspaces/${ws}/wishlist/${id}`),
};
