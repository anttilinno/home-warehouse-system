/**
 * Barcode Detection API Polyfill Initialization
 *
 * Registers the barcode-detector polyfill for browsers that don't support
 * the native Barcode Detection API (Safari, Firefox).
 *
 * IMPORTANT: Import this module before using any scanner components.
 * The polyfill only loads on the client and only if the native API is missing.
 *
 * @see https://github.com/AEC-Lab/package-barcode-detector
 */
"use client";

let polyfillLoaded = false;

/**
 * Initialize the Barcode Detection API polyfill.
 * Safe to call multiple times - only loads once.
 */
export async function initBarcodePolyfill(): Promise<void> {
  // Skip if already loaded or not in browser
  if (polyfillLoaded || typeof window === "undefined") {
    return;
  }

  // Skip if native API is available
  if ("BarcodeDetector" in window) {
    console.log("[Scanner] Native Barcode Detection API available");
    polyfillLoaded = true;
    return;
  }

  try {
    // Dynamic import the polyfill
    await import("barcode-detector/polyfill");
    polyfillLoaded = true;
    console.log("[Scanner] Barcode Detection API polyfill registered");
  } catch (error) {
    console.error("[Scanner] Failed to load barcode polyfill:", error);
    throw new Error("Barcode scanning not supported in this browser");
  }
}

/**
 * Check if the Barcode Detection API is available (native or polyfilled).
 */
export function isBarcodeDetectionAvailable(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}
