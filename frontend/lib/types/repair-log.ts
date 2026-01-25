export type RepairStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export type RepairPhotoType = 'BEFORE' | 'DURING' | 'AFTER';

export type AttachmentType = 'PHOTO' | 'MANUAL' | 'RECEIPT' | 'WARRANTY' | 'OTHER';

export interface RepairPhoto {
  id: string;
  repair_log_id: string;
  workspace_id: string;
  photo_type: RepairPhotoType;
  filename: string;
  thumbnail_url: string;
  full_size_url: string;
  file_size: number;
  mime_type: string;
  width: number;
  height: number;
  display_order: number;
  caption?: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface RepairAttachment {
  id: string;
  repair_log_id: string;
  file_id: string;
  attachment_type: AttachmentType;
  title?: string;
  file: {
    original_name: string;
    mime_type: string;
    size_bytes: number;
  };
  created_at: string;
}

export interface RepairCostSummary {
  currency_code: string;
  total_cents: number;
  repair_count: number;
}

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
  is_warranty_claim: boolean;
  reminder_date?: string | null;
  reminder_sent: boolean;
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
  is_warranty_claim?: boolean;
  reminder_date?: string;
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
