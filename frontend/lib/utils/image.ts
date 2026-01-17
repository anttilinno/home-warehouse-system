import type {
  ItemPhoto,
  PhotoSize,
  ImageValidation,
  ImageDimensions,
} from "../types/item-photo";

/**
 * Maximum file size in bytes (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Allowed image MIME types
 */
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

/**
 * Validate an image file for upload
 */
export function validateImageFile(file: File): ImageValidation {
  // Check file type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.`,
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File is too large (${fileSizeMB}MB). Maximum size is ${maxSizeMB}MB.`,
    };
  }

  return { valid: true };
}

/**
 * Get the URL for a specific size of a photo
 */
export function getPhotoUrl(photo: ItemPhoto, size: PhotoSize = "medium"): string {
  return photo.urls[size];
}

/**
 * Create a blob URL for previewing an image before upload
 */
export function createImagePreview(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Revoke a blob URL to free memory
 */
export function revokeImagePreview(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * Get image dimensions before upload
 */
export function getImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = createImagePreview(file);

    img.onload = () => {
      revokeImagePreview(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => {
      revokeImagePreview(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get aspect ratio as a string (e.g., "16:9", "4:3")
 */
export function getAspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);

  return `${width / divisor}:${height / divisor}`;
}

/**
 * Check if an image is portrait orientation
 */
export function isPortrait(width: number, height: number): boolean {
  return height > width;
}

/**
 * Check if an image is landscape orientation
 */
export function isLandscape(width: number, height: number): boolean {
  return width > height;
}

/**
 * Check if an image is square
 */
export function isSquare(width: number, height: number): boolean {
  return width === height;
}

/**
 * Compress an image file to reduce size
 * Returns a new File object with compressed image
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.85
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = createImagePreview(file);

    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Create canvas and draw resized image
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        revokeImagePreview(url);
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          revokeImagePreview(url);

          if (!blob) {
            reject(new Error("Failed to compress image"));
            return;
          }

          // Create new File from blob
          const compressedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now(),
          });

          resolve(compressedFile);
        },
        file.type,
        quality
      );
    };

    img.onerror = () => {
      revokeImagePreview(url);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = url;
  });
}

/**
 * Generate a thumbnail data URL for an image file
 */
export async function generateThumbnail(
  file: File,
  size: number = 150
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = createImagePreview(file);

    img.onload = () => {
      // Calculate thumbnail dimensions (square crop from center)
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        revokeImagePreview(url);
        reject(new Error("Failed to get canvas context"));
        return;
      }

      // Calculate crop area (center square)
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;

      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

      revokeImagePreview(url);
      resolve(canvas.toDataURL(file.type));
    };

    img.onerror = () => {
      revokeImagePreview(url);
      reject(new Error("Failed to load image for thumbnail"));
    };

    img.src = url;
  });
}
