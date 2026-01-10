'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeScanType, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export type ScanResult = {
  text: string;
  format: string;
};

export type CameraFacing = 'environment' | 'user';

export interface UseScannerOptions {
  onScan?: (result: ScanResult) => void;
  onError?: (error: string) => void;
  formats?: Html5QrcodeSupportedFormats[];
  /** When true, immediately request camera permission. Default: false */
  requestPermission?: boolean;
}

const DEFAULT_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.ITF,
];

export function useScanner(elementId: string, options: UseScannerOptions = {}) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('environment');
  const [availableCameras, setAvailableCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const permissionRequestedRef = useRef(false);
  const { onScan, onError, formats = DEFAULT_FORMATS, requestPermission = false } = options;

  // Request camera permission and get available cameras
  const requestCameraPermission = useCallback(async () => {
    if (permissionRequestedRef.current && hasPermission !== null) {
      return hasPermission;
    }
    
    permissionRequestedRef.current = true;
    
    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setAvailableCameras(devices.map(d => ({ id: d.id, label: d.label || `Camera ${d.id}` })));
        setHasPermission(true);
        return true;
      } else {
        setHasPermission(false);
        setError('No cameras found');
        return false;
      }
    } catch (err) {
      console.error('Error getting cameras:', err);
      setHasPermission(false);
      setError('Camera permission denied');
      return false;
    }
  }, [hasPermission]);

  // Only request permission when explicitly enabled via requestPermission option
  useEffect(() => {
    if (requestPermission) {
      requestCameraPermission();
    }
  }, [requestPermission, requestCameraPermission]);

  const startScanning = useCallback(async (cameraId?: string) => {
    if (scannerRef.current?.isScanning) {
      return;
    }

    try {
      setError(null);

      // Request permission if not already done
      if (!permissionRequestedRef.current) {
        const granted = await requestCameraPermission();
        if (!granted) {
          return;
        }
        // Wait for next frame to ensure DOM is updated after permission granted
        await new Promise(resolve => requestAnimationFrame(resolve));
      }

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(elementId, {
          formatsToSupport: formats,
          verbose: false,
        });
      }

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
      };

      const targetCameraId = cameraId || currentCameraId;

      if (targetCameraId) {
        await scannerRef.current.start(
          targetCameraId,
          config,
          (decodedText, result) => {
            const scanResult: ScanResult = {
              text: decodedText,
              format: result.result.format?.formatName || 'UNKNOWN',
            };
            onScan?.(scanResult);
          },
          () => {} // Ignore scan failures (no QR code in frame)
        );
        setCurrentCameraId(targetCameraId);
      } else {
        // Use facing mode
        await scannerRef.current.start(
          { facingMode: cameraFacing },
          config,
          (decodedText, result) => {
            const scanResult: ScanResult = {
              text: decodedText,
              format: result.result.format?.formatName || 'UNKNOWN',
            };
            onScan?.(scanResult);
          },
          () => {}
        );
      }

      setIsScanning(true);
      setHasPermission(true);
      setError(null);  // Clear any previous errors on successful start
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start scanner';
      setError(errorMessage);
      onError?.(errorMessage);
      setIsScanning(false);
    }
  }, [elementId, formats, cameraFacing, currentCameraId, onScan, onError, requestCameraPermission]);

  const stopScanning = useCallback(async () => {
    if (scannerRef.current?.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setIsScanning(false);
  }, []);

  const toggleCamera = useCallback(async () => {
    const newFacing: CameraFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(newFacing);

    if (isScanning) {
      await stopScanning();
      // Small delay to ensure camera is released
      setTimeout(() => {
        startScanning();
      }, 300);
    }
  }, [cameraFacing, isScanning, stopScanning, startScanning]);

  const switchCamera = useCallback(async (cameraId: string) => {
    setCurrentCameraId(cameraId);

    if (isScanning) {
      await stopScanning();
      setTimeout(() => {
        startScanning(cameraId);
      }, 300);
    }
  }, [isScanning, stopScanning, startScanning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
      scannerRef.current = null;
    };
  }, []);

  return {
    isScanning,
    hasPermission,
    error,
    cameraFacing,
    availableCameras,
    currentCameraId,
    startScanning,
    stopScanning,
    toggleCamera,
    switchCamera,
    requestCameraPermission,
  };
}
