export interface Location {
  id: string;
  workspace_id: string;
  name: string;
  parent_location?: string | null;
  zone?: string | null;
  shelf?: string | null;
  bin?: string | null;
  description?: string | null;
  short_code?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocationListResponse {
  items: Location[];
  total: number;
  page: number;
  total_pages: number;
}

export interface LocationCreate {
  name: string;
  parent_location?: string;
  zone?: string;
  shelf?: string;
  bin?: string;
  description?: string;
  short_code?: string;
}

export interface LocationUpdate {
  name?: string;
  parent_location?: string;
  zone?: string;
  shelf?: string;
  bin?: string;
  description?: string;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
  short_code?: string | null;
}

export interface BreadcrumbResponse {
  breadcrumb: BreadcrumbItem[];
}
