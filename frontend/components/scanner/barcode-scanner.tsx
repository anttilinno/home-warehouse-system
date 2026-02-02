/**
 * BarcodeScanner Component
 *
 * Camera-based barcode and QR code scanner using @yudiel/react-qr-scanner.
 * Handles polyfill initialization, torch detection, and iOS-safe pause/resume.
 *
 * CRITICAL: For iOS PWA compatibility:
 * - Keep this component MOUNTED (use paused prop, don't unmount)
 * - Page navigation remounts the component and triggers permission re-request
 *
 * @see 19-RESEARCH.md Pattern 1: Single-Page Scan Flow for iOS PWA
 */
"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Loader2,
  Flashlight,
  FlashlightOff,
  Camera,
  AlertCircle,
} from "lucide-react";
import type { IDetectedBarcode } from "@yudiel/react-qr-scanner";
import type { BarcodeFormat } from "barcode-detector";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { initBarcodePolyfill, SUPPORTED_FORMATS } from "@/lib/scanner";
import { cn } from "@/lib/utils";

// Dynamic import to avoid SSR issues with camera APIs
const Scanner = dynamic(
  () => import("@yudiel/react-qr-scanner").then((mod) => mod.Scanner),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-black/90">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    ),
  }
);

export interface BarcodeScannerProps {
  /** Called when a barcode is successfully scanned */
  onScan: (result: IDetectedBarcode[]) => void;
  /** Called when an error occurs */
  onError?: (error: unknown) => void;
  /** Whether scanning is paused (camera stays mounted) */
  paused?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
  /** Barcode formats to detect (defaults to SUPPORTED_FORMATS) */
  formats?: BarcodeFormat[];
}

/**
 * Detect if torch (flashlight) is supported on the device.
 * Only works in Chromium browsers, not iOS Safari.
 */
async function checkTorchSupport(): Promise<boolean> {
  try {
    // Skip on iOS - torch not supported in Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      return false;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });

    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & {
      torch?: boolean;
    };

    // Clean up stream
    stream.getTracks().forEach((t) => t.stop());

    return capabilities?.torch === true;
  } catch {
    return false;
  }
}

export function BarcodeScanner({
  onScan,
  onError,
  paused = false,
  className,
  formats = [...SUPPORTED_FORMATS] as BarcodeFormat[],
}: BarcodeScannerProps) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize polyfill and check torch support on mount
  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        // Initialize barcode detection polyfill
        await initBarcodePolyfill();

        // Check if torch is supported
        const hasTorch = await checkTorchSupport();
        if (mounted) {
          setTorchSupported(hasTorch);
          setIsInitializing(false);
        }
      } catch (error) {
        if (mounted) {
          const message =
            error instanceof Error
              ? error.message
              : "Scanner initialization failed";
          setInitError(message);
          setIsInitializing(false);
          onError?.(error instanceof Error ? error : new Error(message));
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, [onError]);

  // Handle scanner errors
  const handleError = useCallback(
    (error: unknown) => {
      console.error("[BarcodeScanner] Error:", error);

      // Check for permission denied
      if (error instanceof Error) {
        if (
          error.name === "NotAllowedError" ||
          error.message.includes("Permission denied")
        ) {
          setPermissionDenied(true);
        }
      }

      onError?.(error);
    },
    [onError]
  );

  // Toggle torch
  const toggleTorch = useCallback(() => {
    setTorchEnabled((prev) => !prev);
  }, []);

  // Show loading state
  if (isInitializing) {
    return (
      <div
        className={cn(
          "relative w-full aspect-[3/4] bg-black rounded-lg overflow-hidden flex items-center justify-center",
          className
        )}
      >
        <div className="text-center text-white">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-sm">Initializing scanner...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (initError || permissionDenied) {
    return (
      <div
        className={cn(
          "relative w-full aspect-[3/4] bg-muted rounded-lg overflow-hidden flex items-center justify-center p-4",
          className
        )}
      >
        <Alert variant="destructive" className="max-w-sm">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {permissionDenied ? "Camera Access Denied" : "Scanner Error"}
          </AlertTitle>
          <AlertDescription>
            {permissionDenied
              ? "Please allow camera access in your browser settings to use the scanner."
              : initError}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full aspect-[3/4] bg-black rounded-lg overflow-hidden",
        className
      )}
    >
      {/* Scanner */}
      <Scanner
        onScan={onScan}
        onError={handleError}
        paused={paused}
        formats={formats}
        scanDelay={200}
        allowMultiple={false}
        components={{
          torch: torchSupported && torchEnabled,
          finder: true,
        }}
        sound={false} // We handle audio feedback separately
        styles={{
          container: {
            width: "100%",
            height: "100%",
          },
          video: {
            objectFit: "cover",
          },
        }}
        constraints={{
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }}
      />

      {/* Pause overlay */}
      {paused && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
          <div className="text-center text-white">
            <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm opacity-70">Scanner paused</p>
          </div>
        </div>
      )}

      {/* Torch toggle button - only show when supported and not paused */}
      {torchSupported && !paused && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-4 right-4 h-12 w-12 rounded-full shadow-lg"
          onClick={toggleTorch}
          aria-label={torchEnabled ? "Turn off flashlight" : "Turn on flashlight"}
        >
          {torchEnabled ? (
            <Flashlight className="h-5 w-5" />
          ) : (
            <FlashlightOff className="h-5 w-5" />
          )}
        </Button>
      )}

      {/* Scanning indicator */}
      {!paused && (
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-xs text-white font-medium">Scanning</span>
        </div>
      )}
    </div>
  );
}

export default BarcodeScanner;
