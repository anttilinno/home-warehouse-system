/**
 * Item photo types for the photo management system
 */

/**
 * Thumbnail processing status
 */
export type ThumbnailStatus = 'pending' | 'processing' | 'complete' | 'failed';

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
  /** Thumbnail processing status */
  thumbnail_status: ThumbnailStatus;
  /** Error message if thumbnail generation failed */
  thumbnail_error?: string;
}

/**
 * SSE event for when thumbnails are ready
 */
export interface ThumbnailReadyEvent {
  photo_id: string;
  item_id: string;
  small_thumbnail_url?: string;
  medium_thumbnail_url?: string;
  large_thumbnail_url?: string;
}

/**
 * SSE event for when thumbnail generation fails
 */
export interface ThumbnailFailedEvent {
  photo_id: string;
  item_id: string;
  error: string;
}

/**
 * Check if a photo's thumbnails are ready
 */
export function isThumbnailReady(photo: ItemPhoto): boolean {
  return photo.thumbnail_status === 'complete';
}

/**
 * Check if a photo's thumbnails are still being processed
 */
export function isThumbnailProcessing(photo: ItemPhoto): boolean {
  return photo.thumbnail_status === 'pending' || photo.thumbnail_status === 'processing';
}

/**
 * Get the best available thumbnail URL for a photo
 * Prefers medium size, falls back to small, then original
 */
export function getBestThumbnailUrl(photo: ItemPhoto): string | null {
  if (photo.thumbnail_status !== 'complete') {
    return null;
  }
  // Use the urls object which contains all size variants
  if (photo.urls.medium) {
    return photo.urls.medium;
  }
  if (photo.urls.small) {
    return photo.urls.small;
  }
  return photo.urls.original || null;
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
