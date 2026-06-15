import { del, get, patch, post } from "@/lib/api";
import type { Condition, Repair, RepairCostSummary } from "@/lib/types";

// Phase 10b Plan 01 — repair lifecycle api. Mirrors loans.ts envelope discipline
// EXACTLY: lists return BARE { items } (or { items, total } where the backend
// paginates) — huma's `$schema` key is deliberately NOT modelled (Pitfall 4).
// Single-entity routes return a decorated Repair.
//
// COST IS CENTS (int) end-to-end (T-10b-01) — never send floats. The lifecycle
// is driven by the start/complete POSTs; `update` PATCHes editable metadata only
// and MUST NOT include `status`.

// CreateRepairBody (repairlog/handler.go:416-428). inventory_id + description
// required; cost is CENTS (int) when present.
export interface CreateRepairBody {
  inventory_id: string; // REQUIRED
  description: string; // REQUIRED, min 1
  repair_date?: string; // RFC3339
  cost?: number; // CENTS int
  currency_code?: string;
  service_provider?: string;
  notes?: string;
  is_warranty_claim?: boolean;
  reminder_date?: string;
}

// PATCH body — editable metadata only. NO `status` (lifecycle is start/complete).
export interface UpdateRepairBody {
  description?: string;
  repair_date?: string;
  cost?: number; // CENTS int
  currency_code?: string;
  service_provider?: string;
  notes?: string;
}

export const repairsApi = {
  // Per-inventory list — backend paginates → { items, total }.
  byInventory: (ws: string, invId: string) =>
    get<{ items: Repair[]; total: number }>(
      `/workspaces/${ws}/inventory/${invId}/repairs`,
    ),
  // Cost rollup — BARE { items }, one row per currency (NEVER cross-currency sum).
  cost: (ws: string, invId: string) =>
    get<{ items: RepairCostSummary[] }>(
      `/workspaces/${ws}/inventory/${invId}/repair-cost`,
    ),
  get: (ws: string, id: string) =>
    get<Repair>(`/workspaces/${ws}/repairs/${id}`),
  create: (ws: string, body: CreateRepairBody) =>
    post<Repair>(`/workspaces/${ws}/repairs`, body),
  update: (ws: string, id: string, body: UpdateRepairBody) =>
    patch<Repair>(`/workspaces/${ws}/repairs/${id}`, body),
  start: (ws: string, id: string) =>
    post<Repair>(`/workspaces/${ws}/repairs/${id}/start`),
  complete: (ws: string, id: string, new_condition?: Condition) =>
    post<Repair>(`/workspaces/${ws}/repairs/${id}/complete`, { new_condition }),
  del: (ws: string, id: string) => del<void>(`/workspaces/${ws}/repairs/${id}`),
};
