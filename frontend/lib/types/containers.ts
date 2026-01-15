export interface Container {
  id: string;
  workspace_id: string;
  name: string;
  location_id: string;
  description?: string | null;
  capacity?: string | null;
  short_code?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContainerListResponse {
  items: Container[];
  total: number;
  page: number;
  total_pages: number;
}

export interface ContainerCreate {
  name: string;
  location_id: string;
  description?: string;
  capacity?: string;
  short_code?: string;
}

export interface ContainerUpdate {
  name?: string;
  location_id?: string;
  description?: string;
  capacity?: string;
}
