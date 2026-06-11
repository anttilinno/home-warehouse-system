import { apiClient } from "./client";
import type {
  PaperlessSettings,
  PaperlessSettingsInput,
  PaperlessSearchResponse,
  PaperlessDocumentDetails,
} from "../types/paperless";

export const paperlessApi = {
  /** Get the workspace's Paperless settings (configured=false when unset). */
  getSettings: async (workspaceId: string): Promise<PaperlessSettings> => {
    return apiClient.get<PaperlessSettings>(
      `/workspaces/${workspaceId}/paperless/settings`
    );
  },

  /** Create or update the workspace's Paperless settings. */
  saveSettings: async (
    workspaceId: string,
    input: PaperlessSettingsInput
  ): Promise<PaperlessSettings> => {
    return apiClient.put<PaperlessSettings>(
      `/workspaces/${workspaceId}/paperless/settings`,
      input
    );
  },

  /** Remove the workspace's Paperless configuration. */
  deleteSettings: async (workspaceId: string): Promise<void> => {
    await apiClient.delete(`/workspaces/${workspaceId}/paperless/settings`);
  },

  /** Fulltext-search the connected Paperless instance. */
  search: async (
    workspaceId: string,
    query: string,
    params?: { page?: number; pageSize?: number }
  ): Promise<PaperlessSearchResponse> => {
    const qs = new URLSearchParams({ query });
    if (params?.page) qs.append("page", params.page.toString());
    if (params?.pageSize) qs.append("page_size", params.pageSize.toString());
    return apiClient.get<PaperlessSearchResponse>(
      `/workspaces/${workspaceId}/paperless/search?${qs.toString()}`
    );
  },

  /** Resolve a document id to its title and download/preview/web URLs. */
  resolveDocument: async (
    workspaceId: string,
    documentId: number
  ): Promise<PaperlessDocumentDetails> => {
    return apiClient.get<PaperlessDocumentDetails>(
      `/workspaces/${workspaceId}/paperless/documents/${documentId}`
    );
  },
};
