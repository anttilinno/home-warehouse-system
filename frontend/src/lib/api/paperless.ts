import { del, get, put } from "@/lib/api";

// Phase 14b Plan 04 — Paperless-ngx API client (PPL-01/02/03). The backend
// surface is already live (domain `paperless`, workspace-scoped). Types are
// defined LOCALLY here (precedent: lib/api/repairs.ts) — lib/types.ts is the
// shared barrel owned by 14b-03 in the same wave, so we never edit it.
//
// LANDMINE FOUND-02: `sync_tags_enabled` is a BACKEND field name and is fine
// inside this type/object literal, but no file or directory NAME in this plan
// may contain the substrings sync / idb / offline.

/** PPL-01 connection settings. `configured=false` ⇒ no row yet (NOT an error). */
export interface PaperlessSettings {
  configured: boolean;
  base_url?: string;
  is_enabled: boolean;
  sync_tags_enabled: boolean;
  /** The api_token is write-only — the backend never returns it. */
  has_token: boolean;
  last_sync_at?: string;
  updated_at?: string;
}

/** PUT body. Omit `api_token` to keep the stored (write-only) token. */
export interface PaperlessSettingsInput {
  base_url: string;
  api_token?: string;
  is_enabled: boolean;
  sync_tags_enabled: boolean;
}

/** PPL-02 search result row. Paperless doc ids are NUMBERS. */
export interface PaperlessDocument {
  id: number;
  title: string;
  created?: string;
  original_file_name?: string;
}

/** PPL-03 resolved document (adds the download/preview/web links). */
export interface PaperlessDocumentDetails extends PaperlessDocument {
  download_url: string;
  preview_url: string;
  web_url: string;
}

export interface PaperlessSearchResponse {
  count: number;
  results: PaperlessDocument[];
}

const base = (ws: string) => `/workspaces/${ws}/paperless`;

export const paperlessApi = {
  getSettings: (ws: string) =>
    get<PaperlessSettings>(`${base(ws)}/settings`),

  saveSettings: (ws: string, body: PaperlessSettingsInput) =>
    put<PaperlessSettings>(`${base(ws)}/settings`, body),

  deleteSettings: (ws: string) => del<void>(`${base(ws)}/settings`),

  search: (ws: string, query: string, page?: number, pageSize?: number) => {
    const params = new URLSearchParams({ query });
    if (page != null) params.set("page", String(page));
    if (pageSize != null) params.set("page_size", String(pageSize));
    return get<PaperlessSearchResponse>(`${base(ws)}/search?${params.toString()}`);
  },

  resolve: (ws: string, id: number) =>
    get<PaperlessDocumentDetails>(`${base(ws)}/documents/${id}`),
};
