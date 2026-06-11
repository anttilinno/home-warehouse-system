export interface MaintenanceSchedule {
  id: string;
  workspace_id: string;
  inventory_id: string;
  title: string;
  notes?: string | null;
  interval_days: number;
  next_due: string; // YYYY-MM-DD
  last_completed_at?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceScheduleListResponse {
  items: MaintenanceSchedule[];
  total: number;
}

export interface DueMaintenanceSchedule extends MaintenanceSchedule {
  item_id: string;
  item_name: string;
  is_overdue: boolean;
}

export interface DueMaintenanceListResponse {
  items: DueMaintenanceSchedule[];
  total: number;
}

export interface MaintenanceScheduleCreate {
  inventory_id: string;
  title: string;
  notes?: string;
  interval_days: number;
  next_due: string; // ISO datetime
}

export interface MaintenanceScheduleUpdate {
  title?: string;
  notes?: string;
  interval_days?: number;
  next_due?: string; // ISO datetime
  is_active?: boolean;
}

export interface MaintenanceScheduleComplete {
  notes?: string;
}
