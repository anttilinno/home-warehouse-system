export type RepairStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface RepairLog {
  id: string;
  workspace_id: string;
  inventory_id: string;
  status: RepairStatus;
  description: string;
  repair_date: string | null;
  cost: number | null;  // in cents
  currency_code: string | null;
  service_provider: string | null;
  completed_at: string | null;
  new_condition: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepairLogListResponse {
  items: RepairLog[];
  total?: number;
  page?: number;
  total_pages?: number;
}

export interface RepairLogCreate {
  inventory_id: string;
  description: string;
  repair_date?: string;
  cost?: number;
  currency_code?: string;
  service_provider?: string;
  notes?: string;
}

export interface RepairLogUpdate {
  description?: string;
  repair_date?: string;
  cost?: number;
  currency_code?: string;
  service_provider?: string;
  notes?: string;
}

export interface RepairLogComplete {
  new_condition?: string;  // InventoryCondition value
}
