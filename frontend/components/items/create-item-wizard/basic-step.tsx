"use client";

import { useTranslations } from "next-intl";

import { MobileFormField, MobileFormTextarea } from "@/components/forms";
import { Button } from "@/components/ui/button";
import type { CreateItemFormData } from "./schema";

interface BasicStepProps {
  onNext: () => Promise<boolean>;
  isSubmitting: boolean;
}

export function BasicStep({ onNext, isSubmitting }: BasicStepProps) {
  const t = useTranslations("items.create");

  const handleNext = async () => {
    await onNext();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t("steps.basic")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("steps.basicDescription")}
        </p>
      </div>

      <div className="space-y-4">
        {/* SKU - required */}
        <MobileFormField<CreateItemFormData>
          name="sku"
          label={t("fields.sku")}
          required
          placeholder={t("placeholders.sku")}
          autoComplete="off"
        />

        {/* Name - required */}
        <MobileFormField<CreateItemFormData>
          name="name"
          label={t("fields.name")}
          required
          placeholder={t("placeholders.name")}
        />

        {/* Category - optional, will add select later */}
        {/* TODO: Add category select with smart defaults */}

        {/* Description - optional */}
        <MobileFormTextarea<CreateItemFormData>
          name="description"
          label={t("fields.description")}
          placeholder={t("placeholders.description")}
          rows={3}
        />
      </div>

      {/* Navigation */}
      <div className="flex justify-end pt-4 border-t">
        <Button
          type="button"
          onClick={handleNext}
          disabled={isSubmitting}
          className="min-h-[44px] min-w-[120px]"
        >
          {t("next")}
        </Button>
      </div>
    </div>
  );
}
