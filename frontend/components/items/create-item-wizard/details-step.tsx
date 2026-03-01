"use client";

import { useState, useEffect, useCallback } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Loader2, ScanBarcode } from "lucide-react";

import {
  MobileFormField,
  MobileFormTextarea,
  CollapsibleSection,
} from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useSmartDefaults } from "@/lib/hooks/use-smart-defaults";
import { BarcodeScanner } from "@/components/scanner";
import type { CreateItemFormData } from "./schema";

interface DetailsStepProps {
  onNext: () => Promise<boolean>;
  onBack: () => void;
  isSubmitting: boolean;
  keyboardStyle?: React.CSSProperties;
  isKeyboardOpen?: boolean;
  /** When true, renders a submit button instead of "Next" */
  isLastStep?: boolean;
  /** Label for the submit button (used when isLastStep is true) */
  submitLabel?: string;
  /** Label shown while submitting (used when isLastStep is true) */
  submittingLabel?: string;
}

export function DetailsStep({
  onNext,
  onBack,
  isSubmitting,
  keyboardStyle,
  isKeyboardOpen,
  isLastStep,
  submitLabel,
  submittingLabel,
}: DetailsStepProps) {
  const t = useTranslations("items.create");
  const { watch, setValue } = useFormContext<CreateItemFormData>();

  // Smart defaults hooks for remembering recent selections
  const brandDefaults = useSmartDefaults("item-brand");
  const manufacturerDefaults = useSmartDefaults("item-manufacturer");
  const purchasedFromDefaults = useSmartDefaults("item-purchased-from");

  const [scannerOpen, setScannerOpen] = useState(false);

  const handleBarcodeScan = useCallback((results: { rawValue: string }[]) => {
    if (results.length > 0 && results[0].rawValue) {
      setValue("barcode", results[0].rawValue);
      setScannerOpen(false);
    }
  }, [setValue]);

  const isInsured = watch("is_insured");
  const lifetimeWarranty = watch("lifetime_warranty");
  const brand = watch("brand");
  const manufacturer = watch("manufacturer");
  const purchasedFrom = watch("purchased_from");

  // Pre-fill from smart defaults on mount (only if fields are empty)
  useEffect(() => {
    const defaultBrand = brandDefaults.getDefault();
    if (defaultBrand && !brand) {
      setValue("brand", defaultBrand);
    }
    const defaultManufacturer = manufacturerDefaults.getDefault();
    if (defaultManufacturer && !manufacturer) {
      setValue("manufacturer", defaultManufacturer);
    }
    const defaultPurchasedFrom = purchasedFromDefaults.getDefault();
    if (defaultPurchasedFrom && !purchasedFrom) {
      setValue("purchased_from", defaultPurchasedFrom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t("steps.details")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("steps.detailsDescription")}
        </p>
      </div>

      {/* Product details - always visible */}
      <div className="space-y-4">
        <MobileFormField<CreateItemFormData>
          name="brand"
          label={t("fields.brand")}
          placeholder={t("placeholders.brand")}
          onBlur={(e) => e.target.value && brandDefaults.recordSelection(e.target.value)}
        />

        <MobileFormField<CreateItemFormData>
          name="model"
          label={t("fields.model")}
          placeholder={t("placeholders.model")}
        />

        <MobileFormField<CreateItemFormData>
          name="manufacturer"
          label={t("fields.manufacturer")}
          placeholder={t("placeholders.manufacturer")}
          onBlur={(e) => e.target.value && manufacturerDefaults.recordSelection(e.target.value)}
        />
      </div>

      {/* Identification - collapsible */}
      <CollapsibleSection
        title={t("sections.identification")}
        description={t("sections.identificationDescription")}
      >
        <div className="space-y-4">
          <MobileFormField<CreateItemFormData>
            name="serial_number"
            label={t("fields.serialNumber")}
            placeholder={t("placeholders.serialNumber")}
          />

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <MobileFormField<CreateItemFormData>
                name="barcode"
                label={t("fields.barcode")}
                placeholder={t("placeholders.barcode")}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="min-h-[44px] min-w-[44px] shrink-0"
              onClick={() => setScannerOpen(true)}
              aria-label={t("scanBarcode")}
            >
              <ScanBarcode className="h-5 w-5" />
            </Button>
          </div>

          <MobileFormField<CreateItemFormData>
            name="short_code"
            label={t("fields.shortCode")}
            placeholder={t("placeholders.shortCode")}
          />
        </div>
      </CollapsibleSection>

      {/* Purchase info - collapsible */}
      <CollapsibleSection
        title={t("sections.purchase")}
        description={t("sections.purchaseDescription")}
      >
        <div className="space-y-4">
          <MobileFormField<CreateItemFormData>
            name="purchased_from"
            label={t("fields.purchasedFrom")}
            placeholder={t("placeholders.purchasedFrom")}
            onBlur={(e) => e.target.value && purchasedFromDefaults.recordSelection(e.target.value)}
          />

          <MobileFormField<CreateItemFormData>
            name="min_stock_level"
            label={t("fields.minStockLevel")}
            inputMode="numeric"
            type="text"
            placeholder="0"
          />
        </div>
      </CollapsibleSection>

      {/* Warranty & Insurance - collapsible */}
      <CollapsibleSection
        title={t("sections.warranty")}
        description={t("sections.warrantyDescription")}
      >
        <div className="space-y-4">
          {/* Is Insured checkbox */}
          <div className="flex items-center space-x-3 min-h-[44px]">
            <Checkbox
              id="is_insured"
              checked={isInsured}
              onCheckedChange={(checked) =>
                setValue("is_insured", checked === true)
              }
              className="h-5 w-5"
            />
            <Label
              htmlFor="is_insured"
              className="text-base font-normal cursor-pointer"
            >
              {t("fields.isInsured")}
            </Label>
          </div>

          {/* Lifetime Warranty checkbox */}
          <div className="flex items-center space-x-3 min-h-[44px]">
            <Checkbox
              id="lifetime_warranty"
              checked={lifetimeWarranty}
              onCheckedChange={(checked) =>
                setValue("lifetime_warranty", checked === true)
              }
              className="h-5 w-5"
            />
            <Label
              htmlFor="lifetime_warranty"
              className="text-base font-normal cursor-pointer"
            >
              {t("fields.lifetimeWarranty")}
            </Label>
          </div>

          {/* Warranty Details */}
          <MobileFormTextarea<CreateItemFormData>
            name="warranty_details"
            label={t("fields.warrantyDetails")}
            placeholder={t("placeholders.warrantyDetails")}
            rows={2}
          />
        </div>
      </CollapsibleSection>

      {/* Barcode Scanner Sheet */}
      <Sheet open={scannerOpen} onOpenChange={setScannerOpen}>
        <SheetContent side="bottom" className="h-[70vh] p-0">
          <SheetHeader className="px-4 pt-4">
            <SheetTitle>{t("scanBarcode")}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <BarcodeScanner
              onScan={handleBarcodeScan}
              paused={!scannerOpen}
              className="h-full"
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Navigation */}
      <div
        className={cn(
          "flex justify-between pt-4 border-t",
          isKeyboardOpen &&
            "fixed left-0 right-0 bg-background px-4 pb-4 shadow-lg z-50"
        )}
        style={isKeyboardOpen ? keyboardStyle : undefined}
      >
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
          className="min-h-[44px] min-w-[100px]"
        >
          {t("back")}
        </Button>
        <Button
          type={isLastStep ? "submit" : "button"}
          onClick={isLastStep ? undefined : onNext}
          disabled={isSubmitting}
          className="min-h-[44px] min-w-[120px]"
        >
          {isLastStep && isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {submittingLabel || t("next")}
            </>
          ) : (
            isLastStep ? (submitLabel || t("next")) : t("next")
          )}
        </Button>
      </div>
    </div>
  );
}
