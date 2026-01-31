"use client";

import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";

import {
  MobileFormField,
  MobileFormTextarea,
  CollapsibleSection,
} from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useSmartDefaults } from "@/lib/hooks/use-smart-defaults";
import type { CreateItemFormData } from "./schema";

interface DetailsStepProps {
  onNext: () => Promise<boolean>;
  onBack: () => void;
  isSubmitting: boolean;
}

export function DetailsStep({
  onNext,
  onBack,
  isSubmitting,
}: DetailsStepProps) {
  const t = useTranslations("items.create");
  const { watch, setValue } = useFormContext<CreateItemFormData>();

  // Smart defaults hooks for remembering recent selections
  const brandDefaults = useSmartDefaults("item-brand");
  const manufacturerDefaults = useSmartDefaults("item-manufacturer");
  const purchasedFromDefaults = useSmartDefaults("item-purchased-from");

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

          <MobileFormField<CreateItemFormData>
            name="barcode"
            label={t("fields.barcode")}
            placeholder={t("placeholders.barcode")}
          />

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

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
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
          type="button"
          onClick={onNext}
          disabled={isSubmitting}
          className="min-h-[44px] min-w-[120px]"
        >
          {t("next")}
        </Button>
      </div>
    </div>
  );
}
