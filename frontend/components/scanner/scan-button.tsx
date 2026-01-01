'use client';

import { useState } from 'react';
import { BarcodeScanner } from './barcode-scanner';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { ScanResult } from '@/lib/scanner/use-scanner';
import type { BarcodeProduct } from '@/lib/api';

interface ScanButtonProps {
  className?: string;
  onScanSuccess?: (result: ScanResult, product?: BarcodeProduct | null) => void;
  lookupBarcode?: boolean;
}

export function ScanButton({ className, onScanSuccess, lookupBarcode = true }: ScanButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleScanSuccess = (result: ScanResult, product?: BarcodeProduct | null) => {
    onScanSuccess?.(result, product);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-40",
          "w-14 h-14 rounded-full",
          "bg-primary text-primary-foreground",
          "shadow-lg hover:shadow-xl",
          "flex items-center justify-center",
          "transition-all duration-200",
          "hover:scale-105 active:scale-95",
          "border-2 border-foreground",
          className
        )}
        aria-label="Scan barcode"
      >
        <Icon name="ScanBarcode" className="w-6 h-6" />
      </button>

      <BarcodeScanner
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onScanSuccess={handleScanSuccess}
        lookupBarcode={lookupBarcode}
      />
    </>
  );
}
