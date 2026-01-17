/**
 * Item photo types for the photo management system
 */

/**
 * Photo URLs at different sizes
 */
export interface PhotoUrls {
  original: string;
  small: string;
  medium: string;
  large: string;
}

/**
 * Item photo from the API
 */
export interface ItemPhoto {
  id: string;
  item_id: string;
  workspace_id: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  width: number;
  height: number;
  caption: string | null;
  is_primary: boolean;
  display_order: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  urls: PhotoUrls;
}

/**
 * Response from photo upload endpoint
 */
export interface UploadPhotoResponse {
  photo: ItemPhoto;
}

/**
 * Response from list photos endpoint
 */
export interface PhotoListResponse {
  photos: ItemPhoto[];
}

/**
 * Response from single photo endpoint
 */
export interface PhotoResponse {
  photo: ItemPhoto;
}

/**
 * Request body for updating photo caption
 */
export interface UpdateCaptionRequest {
  caption: string;
}

/**
 * Request body for reordering photos
 */
export interface ReorderPhotosRequest {
  photo_ids: string[];
}

/**
 * Available photo sizes
 */
export type PhotoSize = 'original' | 'small' | 'medium' | 'large';

/**
 * Upload progress state
 */
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Image validation result
 */
export interface ImageValidation {
  valid: boolean;
  error?: string;
}

/**
 * Image dimensions
 */
export interface ImageDimensions {
  width: number;
  height: number;
}
