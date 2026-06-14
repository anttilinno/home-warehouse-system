import { del, get, patch, post } from "@/lib/api";
import type { DueSchedule, MaintenanceSchedule } from "@/lib/types";

// Phase 10b Plan 01 — maintenance schedule api. Mirrors loans.ts envelope
// discipline: lists return BARE { items } (huma's `$schema` NOT modelled). The
// top-level list paginates → { items, total }; scoped reads (by-inventory, due)
// return a BARE { items }. `is_overdue` on a DueSchedule is a SERVER flag —
// never recomputed client-side.

// CreateScheduleBody (maintenance/handler.go:312-320). interval_days >= 1;
// next_due is a date string.
export interface CreateScheduleBody {
  inventory_id: string; // REQUIRED
  title: string; // REQUIRED, 1..200
  notes?: string;
  interval_days: number; // REQUIRED, >= 1
  next_due: string; // date (YYYY-MM-DD)
}

export interface UpdateScheduleBody {
  title?: string;
  notes?: string;
  interval_days?: number;
  next_due?: string;
}

export const maintenanceApi = {
  // Top-level list — paginated. limit is capped at 100 (server max).
  list: (ws: string, opts?: { page?: number; limit?: number }) => {
    const page = opts?.page ?? 1;
    const limit = Math.min(opts?.limit ?? 50, 100);
    return get<{ items: MaintenanceSchedule[]; total: number }>(
      `/workspaces/${ws}/maintenance?page=${page}&limit=${limit}`,
    );
  },
  byInventory: (ws: string, invId: string) =>
    get<{ items: MaintenanceSchedule[] }>(
      `/workspaces/${ws}/inventory/${invId}/maintenance`,
    ),
  // Due/overdue projection — BARE { items: DueSchedule[] }. Optional `days`
  // horizon query (server default when omitted).
  due: (ws: string, days?: number) =>
    get<{ items: DueSchedule[] }>(
      `/workspaces/${ws}/maintenance/due${days != null ? `?days=${days}` : ""}`,
    ),
  get: (ws: string, id: string) =>
    get<MaintenanceSchedule>(`/workspaces/${ws}/maintenance/${id}`),
  create: (ws: string, body: CreateScheduleBody) =>
    post<MaintenanceSchedule>(`/workspaces/${ws}/maintenance`, body),
  update: (ws: string, id: string, body: UpdateScheduleBody) =>
    patch<MaintenanceSchedule>(`/workspaces/${ws}/maintenance/${id}`, body),
  complete: (ws: string, id: string, notes?: string) =>
    post<MaintenanceSchedule>(`/workspaces/${ws}/maintenance/${id}/complete`, {
      notes,
    }),
  del: (ws: string, id: string) =>
    del<void>(`/workspaces/${ws}/maintenance/${id}`),
};
