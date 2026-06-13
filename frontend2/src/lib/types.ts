// Phase 1 (v3.0) trim: only ApiError ports forward. The auth/analytics
// shapes below landed early (retro-os sample screens, 2026-06-11) — copied
// from legacy frontend/lib/api/auth.ts + analytics.ts (same backend).

export interface ApiError {
  message?: string;
  detail?: string;
  code?: string;
}

// Subset of the backend user shape — only what the sample screens render.
// Phase 5 (Auth) re-introduces the full v3.0 User.
//
// `has_password` (added Phase 5 Plan 05) drives the Security password card
// (change-vs-set branch) AND the Connected Accounts unlink lockout guard. It is
// returned by GET /users/me (see 05-RESEARCH Interfaces / 05-UI-SPEC Identity).
export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  has_password: boolean;
  // Phase 12 (Settings) — GetMe ALSO returns the seven preference fields
  // (verified handler.go:1035-1048, all omitempty). Optional so older payloads
  // and the trimmed sample-screen User stay compatible. The preferences
  // subpages READ current values from here (the shared ["me"] query) and WRITE
  // via PATCH /users/me/preferences.
  date_format?: string;
  time_format?: string;
  thousand_separator?: string;
  decimal_separator?: string;
  language?: string;
  theme?: string;
  notification_preferences?: Record<string, boolean>;
}

// Phase 12 (Settings) — the preference payload shape for PATCH
// /users/me/preferences. All six string fields + the free-form notification
// map. Subpages send a Partial<Preferences> (only changed fields), EXCEPT
// notification_preferences which the backend replaces wholesale (send the full
// map for that field).
export interface Preferences {
  date_format: string;
  time_format: string;
  thousand_separator: string;
  decimal_separator: string;
  language: string;
  theme: string;
  notification_preferences: Record<string, boolean>;
}

// Phase 12 (Settings) — GET /workspaces/{wsId}/members → { items: Member[] }.
// email/full_name are optional: they arrive enriched per Plan 12-01's
// MemberResponse change; the type tolerates absence so MSW fixtures and the
// real API agree before/after that backend enrichment lands.
export interface Member {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  email?: string;
  full_name?: string;
  invited_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthTokenResponse {
  token: string;
  refresh_token: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: string;
  is_personal: boolean;
}

// --- Auth account-management surfaces (Phase 5 Plan 05) ---

// GET /users/me/sessions → SessionResponse[]. device_info is a PARSED UA label
// (ParseDeviceInfo, e.g. "Chrome on Linux"); is_current is wired via Plan 01's
// CurrentSession middleware.
export interface SessionResponse {
  id: string;
  device_info: string;
  ip_address?: string;
  last_active_at: string;
  created_at: string;
  is_current: boolean;
}

// GET /users/me/can-delete → blocking_workspaces lists the workspaces where the
// user is the sole owner (the server-authoritative delete block).
export interface BlockingWorkspace {
  id: string;
  name: string;
  slug: string;
}

export interface CanDeleteResponse {
  can_delete: boolean;
  blocking_workspaces: BlockingWorkspace[];
}

// GET /auth/oauth/accounts → { accounts: OAuthAccount[] }.
export interface OAuthAccount {
  provider: string;
  display_name?: string;
  email?: string;
}

export interface OAuthAccountsResponse {
  accounts: OAuthAccount[];
}

export interface DashboardStats {
  total_items: number;
  total_inventory: number;
  total_locations: number;
  total_containers: number;
  active_loans: number;
  overdue_loans: number;
  low_stock_items: number;
  total_categories: number;
  total_borrowers: number;
}

export interface RecentActivity {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// --- Items + Photos (Phase 7 Plan 01) ---
//
// Typed only for the fields this phase reads. Huma injects a `$schema` key into
// every list envelope (07-RESEARCH Pitfall 7) — we deliberately do NOT model it
// and do NOT assert exact key sets. Absolute backend URLs (primary_photo_*_url,
// Photo.url/thumbnail_url) are rewritten to `/api`-relative at the API mapper
// boundary (07-RESEARCH Pattern 2 / Pitfall 1) before any <img> consumer sees
// them — so by the time these reach a component the *_url fields are relative.

// GET /items, GET /items/{id} (ItemResponse). Optional fields mirror the
// backend `omitempty`/pointer fields; min_stock_level + short_code are always
// present.
export interface Item {
  id: string;
  workspace_id: string;
  sku: string;
  name: string;
  description?: string;
  category_id?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  barcode?: string;
  is_insured?: boolean;
  is_archived?: boolean;
  // Backend serializes NeedsReview via the by-barcode ItemResponse (handler.go:659);
  // the v3.0 type was trimmed and lacked it (Pitfall 3). Optional: absent on older
  // payloads → undefined. Drives SCAN-11 quick-action review gating.
  needs_review?: boolean;
  min_stock_level: number;
  short_code: string;
  // ABSOLUTE on the wire; rewritten to /api-relative by itemsApi mappers.
  primary_photo_thumbnail_url?: string;
  primary_photo_url?: string;
  created_at: string;
  updated_at: string;
}

// GET /items list envelope (Huma also injects `$schema` — ignored).
export interface ItemListResponse {
  items: Item[];
  total: number;
  page: number;
  total_pages: number;
}

// PhotoResponse. url + thumbnail_url are ABSOLUTE on the wire and rewritten to
// /api-relative by photosApi mappers.
export interface Photo {
  id: string;
  item_id: string;
  workspace_id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  width: number;
  height: number;
  display_order: number;
  is_primary: boolean;
  caption?: string;
  url: string;
  thumbnail_url: string;
  thumbnail_status: string;
  created_at: string;
  updated_at: string;
}

// POST /items/{id}/photos/check-duplicate result entry. thumbnail_url is
// ABSOLUTE on the wire and rewritten by photosApi.checkDuplicate.
export interface DuplicateInfo {
  photo_id: string;
  item_id: string;
  filename: string;
  similarity_pct: number;
  thumbnail_url?: string;
}

export interface DuplicateCheckResult {
  has_duplicates: boolean;
  duplicates: DuplicateInfo[];
}

// LabelResponse (GET /labels items, GET /items/{id}/labels label_ids reference
// these).
export interface Label {
  id: string;
  workspace_id: string;
  name: string;
  color?: string;
  description?: string;
  // Phase 10 Plan 01 (TAX-07) — manager fields. Older Phase-7 read paths
  // (getItemLabelIds/attach/detach) ignore these; the label manager surfaces
  // archived state and timestamps.
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

// LoanResponse (GET /items/{item_id}/loans → { items: Loan[] }). Partitioned
// client-side on is_active (07-RESEARCH Open Question 2). Field names verified
// from loan/handler.go LoanResponse.
export interface Loan {
  id: string;
  workspace_id: string;
  inventory_id: string;
  borrower_id: string;
  quantity: number;
  loaned_at: string;
  due_date?: string;
  returned_at?: string;
  notes?: string;
  is_active: boolean;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
  item: {
    id: string;
    name: string;
    primary_photo_thumbnail_url?: string;
  };
  borrower: {
    id: string;
    name: string;
  };
}

// --- Inventory + Movements (Phase 7b Plan 01) ---
//
// Source: backend/internal/domain/warehouse/inventory/entity.go +
// movement/entity.go (07b-RESEARCH "Inventory enum unions", VERIFIED from source
// AND live curl). Huma injects a `$schema` key into envelopes — deliberately NOT
// modelled (Pitfall 7). Inventory/movement responses carry NO absolute URLs, so
// there is no toProxyUrl mapper at the API boundary (unlike items/photos).

// Condition enum (7, fixed). Order matches entity.go for form select options.
export type Condition =
  | "NEW"
  | "EXCELLENT"
  | "GOOD"
  | "FAIR"
  | "POOR"
  | "DAMAGED"
  | "FOR_REPAIR";

// Status enum (7, fixed). Order matches entity.go for form select options.
export type InventoryStatus =
  | "AVAILABLE"
  | "IN_USE"
  | "RESERVED"
  | "ON_LOAN"
  | "IN_TRANSIT"
  | "DISPOSED"
  | "MISSING";

// InventoryResponse. date_acquired/warranty_expires/expiration_date are full
// RFC3339 timestamps, omitted when nil (Pitfall 4 — distinct from the expiring
// projection's YYYY-MM-DD `date`). purchase_price is in cents.
export interface Inventory {
  id: string;
  workspace_id: string;
  item_id: string;
  location_id: string;
  container_id?: string;
  quantity: number;
  condition: Condition;
  status: InventoryStatus;
  date_acquired?: string; // RFC3339
  purchase_price?: number; // cents
  currency_code?: string; // ISO, <=3 chars
  warranty_expires?: string; // RFC3339
  expiration_date?: string; // RFC3339
  notes?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

// ONLY the top-level GET /inventory carries the full envelope. The scoped reads
// (by-item/by-location/by-container) and ALL movement reads return a BARE
// { items } with NO total/page/total_pages (Pitfall 1).
export interface InventoryListResponse {
  items: Inventory[];
  total: number;
  page: number;
  total_pages: number;
}

// GET /inventory/expiring projection. `date` is a plain YYYY-MM-DD string (NOT
// RFC3339 — Pitfall 4); `kind` discriminates expiration vs warranty.
export interface ExpiringEntry {
  inventory_id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  kind: "expiration" | "warranty";
  date: string; // YYYY-MM-DD
}

// GET /movements (3 scopes). moved_by is always null currently (no user
// attribution wired backend-side). Movement rows are created ONLY by a move
// action (Pitfall 3).
export interface Movement {
  id: string;
  workspace_id: string;
  inventory_id: string;
  from_location_id?: string;
  from_container_id?: string;
  to_location_id?: string;
  to_container_id?: string;
  quantity: number;
  moved_by?: string;
  reason?: string;
  created_at: string;
}

// --- Repairs + Maintenance (Phase 10b Plan 01) ---
//
// Source: backend repairlog/handler.go + maintenance/handler.go (10b-RESEARCH
// §interfaces, VERIFIED from source + live curl 2026-06-13). `status` is
// SERVER-authoritative — repairStatus() reads it directly, never date math
// (override / OQ6). `cost` / total_cost_cents are CENTS ints (T-10b-01); the UI
// renders them via formatCents and NEVER round-trips floats to the API.

// RepairResponse status union (3, fixed). PENDING → IN_PROGRESS (start) →
// COMPLETED (complete). The repair lifecycle is driven by start/complete POSTs,
// never by a PATCH of `status`.
export type RepairStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

// RepairResponse (repairlog/handler.go). cost is CENTS (int), omitted when nil.
export interface Repair {
  id: string;
  workspace_id: string;
  inventory_id: string;
  status: RepairStatus;
  description: string;
  repair_date?: string; // RFC3339
  cost?: number; // cents
  currency_code?: string;
  service_provider?: string;
  completed_at?: string; // RFC3339
  new_condition?: Condition;
  notes?: string;
  is_warranty_claim: boolean;
  reminder_date?: string;
  created_at?: string;
  updated_at?: string;
}

// GET /inventory/{id}/repair-cost → { items: RepairCostSummary[] }. ONE row per
// currency — NEVER cross-currency summed (grouped server-side). total_cost_cents
// is CENTS; render with formatCents(total_cost_cents, currency_code).
export interface RepairCostSummary {
  currency_code?: string;
  total_cost_cents: number;
  repair_count: number;
}

// Repair photo type (3, fixed) — the multipart `photo_type` field (Pitfall 1).
export type RepairPhotoType = "BEFORE" | "DURING" | "AFTER";

// Repair photo. url + thumbnail_url are ABSOLUTE on the wire and rewritten via
// toProxyUrl at the repairPhotosApi mapper boundary (mirrors Photo).
export interface RepairPhoto {
  id: string;
  repair_log_id: string;
  photo_type: RepairPhotoType;
  caption?: string;
  url: string;
  thumbnail_url: string;
  created_at: string;
}

// Repair attachment kind (5, fixed) — the `attachment_type` link field.
export type AttachmentType =
  | "PHOTO"
  | "MANUAL"
  | "RECEIPT"
  | "WARRANTY"
  | "OTHER";

// RepairAttachment (LINK-ONLY — registers an existing file_id; no byte storage
// path, OQ3). List rows carry the resolved file metadata.
export interface RepairAttachment {
  id: string;
  repair_log_id: string;
  file_id: string;
  attachment_type: AttachmentType;
  title?: string;
  file_name?: string;
  file_mime_type?: string;
  file_size_bytes?: number;
}

// MaintenanceSchedule (maintenance/handler.go). next_due is YYYY-MM-DD.
export interface MaintenanceSchedule {
  id: string;
  title: string;
  notes?: string;
  interval_days: number;
  next_due: string; // YYYY-MM-DD
  last_completed_at?: string;
}

// GET /maintenance/due → { items: DueSchedule[] }. is_overdue is a SERVER flag
// (never computed client-side); each row carries the resolved item identity.
export interface DueSchedule extends MaintenanceSchedule {
  item_id: string;
  item_name: string;
  is_overdue: boolean;
}
