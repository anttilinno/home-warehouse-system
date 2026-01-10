'use client';

import { useState, useEffect, useCallback } from 'react';
import { useScanner, type ScanResult } from '@/lib/scanner/use-scanner';
import { importsApi, type BarcodeProduct } from '@/lib/api';
import { Icon } from '@/components/icons';
import { Button } from '@/components/themed';
import { cn } from '@/lib/utils';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess?: (result: ScanResult, product?: BarcodeProduct | null) => void;
  lookupBarcode?: boolean;
}

const SCANNER_ELEMENT_ID = 'barcode-scanner-viewport';

export function BarcodeScanner({
  isOpen,
  onClose,
  onScanSuccess,
  lookupBarcode = true,
}: BarcodeScannerProps) {
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupResult, setLookupResult] = useState<BarcodeProduct | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const handleScan = useCallback(async (result: ScanResult) => {
    // Prevent duplicate scans
    if (lastScan?.text === result.text) return;

    setLastScan(result);

    if (lookupBarcode) {
      setIsLookingUp(true);
      try {
        const response = await importsApi.lookupBarcode(result.text);
        if ('found' in response && response.found === false) {
          setLookupResult(null);
          onScanSuccess?.(result, null);
        } else {
          setLookupResult(response as BarcodeProduct);
          onScanSuccess?.(result, response as BarcodeProduct);
        }
      } catch (err) {
        console.error('Barcode lookup failed:', err);
        setLookupResult(null);
        onScanSuccess?.(result, null);
      } finally {
        setIsLookingUp(false);
      }
    } else {
      onScanSuccess?.(result);
    }
  }, [lastScan, lookupBarcode, onScanSuccess]);

  const {
    isScanning,
    hasPermission,
    error,
    availableCameras,
    startScanning,
    stopScanning,
    toggleCamera,
    switchCamera,
  } = useScanner(SCANNER_ELEMENT_ID, {
    onScan: handleScan,
  });

  // Start scanning when modal opens (this will also request permission if needed)
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startScanning();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, startScanning]);

  // Stop scanning when modal closes
  useEffect(() => {
    if (!isOpen) {
      stopScanning();
      setLastScan(null);
      setLookupResult(null);
      setShowManualInput(false);
      setManualInput('');
    }
  }, [isOpen, stopScanning]);

  const handleManualSubmit = async () => {
    if (!manualInput.trim()) return;

    const result: ScanResult = {
      text: manualInput.trim(),
      format: 'MANUAL',
    };

    await handleScan(result);
  };

  const handleReset = () => {
    setLastScan(null);
    setLookupResult(null);
    startScanning();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-background to-transparent">
        <h2 className="text-lg font-bold">Scan Barcode</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-background/80 hover:bg-background"
        >
          <Icon name="X" className="w-6 h-6" />
        </button>
      </div>

      {/* Scanner viewport */}
      <div className="h-full flex flex-col items-center justify-center">
        {/* Always render viewport div so scanner can attach to it */}
        <div className={cn(
          "relative w-full max-w-md aspect-square",
          hasPermission !== true && "invisible absolute"
        )}>
          <div
            id={SCANNER_ELEMENT_ID}
            className={cn(
              "w-full h-full",
              lastScan && "opacity-50"
            )}
          />

          {/* Scanning overlay */}
          {isScanning && !lastScan && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-2 border-primary rounded-lg">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {isLookingUp && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <div className="text-center">
                <Icon name="Loader2" className="w-8 h-8 mx-auto mb-2 animate-spin" />
                <p>Looking up barcode...</p>
              </div>
            </div>
          )}
        </div>

        {hasPermission === null && (
          <div className="text-center p-8">
            <Icon name="Camera" className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Requesting Camera Access</h3>
            <p className="text-muted-foreground mb-4">
              Please allow camera access when prompted to scan barcodes.
            </p>
          </div>
        )}

        {hasPermission === false && (
          <div className="text-center p-8">
            <Icon name="CameraOff" className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Camera Access Required</h3>
            <p className="text-muted-foreground mb-4">
              Please allow camera access to scan barcodes.
            </p>
<Button onClick={() => startScanning()}>
              Try Again
            </Button>
          </div>
        )}

        {error && !isScanning && hasPermission !== false && hasPermission !== null && (
          <div className="text-center p-8">
            <Icon name="AlertCircle" className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h3 className="text-lg font-medium mb-2">Scanner Error</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => startScanning()}>
              Retry
            </Button>
          </div>
        )}

        {hasPermission === true && !error && (
          <>

            {/* Scan result */}
            {lastScan && !isLookingUp && (
              <div className="w-full max-w-md mt-4 p-4 bg-card rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="Check" className="w-5 h-5 text-green-500" />
                  <span className="font-medium">Scanned: {lastScan.text}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Format: {lastScan.format}
                </p>

                {lookupBarcode && (
                  lookupResult ? (
                    <div className="p-3 bg-muted rounded-md mb-3">
                      <p className="font-medium">{lookupResult.name || 'Unknown product'}</p>
                      {lookupResult.brand && (
                        <p className="text-sm text-muted-foreground">Brand: {lookupResult.brand}</p>
                      )}
                      {lookupResult.category && (
                        <p className="text-sm text-muted-foreground">Category: {lookupResult.category}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mb-3">
                      Product not found in database.
                    </p>
                  )
                )}

                <div className="flex gap-2">
                  <Button variant="secondary" onClick={handleReset} className="flex-1">
                    Scan Again
                  </Button>
                  <Button onClick={onClose} className="flex-1">
                    Done
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background to-transparent">
        <div className="flex items-center justify-center gap-4 max-w-md mx-auto">
          {availableCameras.length > 1 && (
            <button
              onClick={toggleCamera}
              className="p-3 rounded-full bg-card border hover:bg-muted"
              disabled={!isScanning}
            >
              <Icon name="SwitchCamera" className="w-6 h-6" />
            </button>
          )}

          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className="p-3 rounded-full bg-card border hover:bg-muted"
          >
            <Icon name="Keyboard" className="w-6 h-6" />
          </button>
        </div>

        {/* Manual input */}
        {showManualInput && (
          <div className="mt-4 max-w-md mx-auto">
            <div className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                placeholder="Enter barcode manually..."
                className="flex-1 px-3 py-2 border rounded-md bg-background"
                autoFocus
              />
              <Button onClick={handleManualSubmit} disabled={!manualInput.trim()}>
                Lookup
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
