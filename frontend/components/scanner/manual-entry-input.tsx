/**
 * ManualEntryInput Component
 *
 * Fallback input for manually entering barcodes when camera scanning fails.
 * Useful for damaged barcodes or devices without camera access.
 */
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ManualEntryInputProps {
  /** Called when user submits a barcode */
  onSubmit: (code: string) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Auto-focus the input on mount */
  autoFocus?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function ManualEntryInput({
  onSubmit,
  disabled = false,
  placeholder,
  autoFocus = false,
  className,
}: ManualEntryInputProps) {
  const t = useTranslations("scanner.manualEntry");
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus if requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Handle form submission
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (trimmed) {
        onSubmit(trimmed);
        setValue("");
      }
    },
    [value, onSubmit]
  );

  // Handle clear
  const handleClear = useCallback(() => {
    setValue("");
    inputRef.current?.focus();
  }, []);

  return (
    <form onSubmit={handleSubmit} className={className}>
      <Label htmlFor="manual-barcode" className="text-sm font-medium mb-2 block">
        {t("label")}
      </Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            id="manual-barcode"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder || t("placeholder")}
            disabled={disabled}
            className="pr-8"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={handleClear}
              aria-label={t("clear")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <Button type="submit" disabled={disabled || !value.trim()}>
          <Search className="h-4 w-4 mr-2" />
          {t("submit")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">{t("hint")}</p>
    </form>
  );
}

export default ManualEntryInput;
