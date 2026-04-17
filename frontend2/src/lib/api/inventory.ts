import { get } from "@/lib/api";

export interface InventoryItem {
  id: string;
  workspace_id: string;
  item_id: string;
  location_id: string;
  container_id?: string | null;
  quantity: number;
  condition: string;
  status: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryListResponse {
  items: InventoryItem[];
}

const base = (wsId: string) => `/workspaces/${wsId}/inventory`;

export const inventoryApi = {
  available: (wsId: string, itemId: string) =>
    get<InventoryListResponse>(`${base(wsId)}/available/${itemId}`),
};
