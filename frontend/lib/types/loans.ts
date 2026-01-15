export interface Loan {
  id: string;
  workspace_id: string;
  inventory_id: string;
  borrower_id: string;
  quantity: number;
  loaned_at: string;
  due_date?: string | null;
  returned_at?: string | null;
  notes?: string | null;
  is_active: boolean;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoanListResponse {
  items: Loan[];
}

export interface LoanCreate {
  inventory_id: string;
  borrower_id: string;
  quantity: number;
  loaned_at?: string;
  due_date?: string;
  notes?: string;
}

export interface LoanExtend {
  new_due_date: string;
}
