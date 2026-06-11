// Paperless-ngx DMS integration types. Mirrors the backend
// internal/domain/paperless handler DTOs.

export interface PaperlessSettings {
  configured: boolean;
  base_url?: string;
  sync_tags_enabled?: boolean;
  is_enabled?: boolean;
  has_token?: boolean;
  last_sync_at?: string | null;
  updated_at?: string;
}

export interface PaperlessSettingsInput {
  base_url: string;
  // Omit to keep the stored token; send a value to replace it.
  api_token?: string;
  sync_tags_enabled: boolean;
  is_enabled: boolean;
}

export interface PaperlessDocument {
  id: number;
  title: string;
  created?: string | null;
  original_file_name?: string | null;
}

export interface PaperlessSearchResponse {
  count: number;
  results: PaperlessDocument[];
}

export interface PaperlessDocumentDetails {
  id: number;
  title: string;
  created?: string | null;
  original_file_name?: string | null;
  download_url: string;
  preview_url: string;
  web_url: string;
}
