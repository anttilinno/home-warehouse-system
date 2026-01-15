export interface Borrower {
  id: string;
  workspace_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface BorrowerListResponse {
  items: Borrower[];
  total: number;
  page: number;
  total_pages: number;
}

export interface BorrowerCreate {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface BorrowerUpdate {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
}
