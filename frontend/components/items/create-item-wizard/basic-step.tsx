"use client";

import { useState, useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";

import { MobileFormField, MobileFormTextarea } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { categoriesApi, type Category } from "@/lib/api/categories";
import { useSmartDefaults } from "@/lib/hooks/use-smart-defaults";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import type { CreateItemFormData } from "./schema";

interface BasicStepProps {
  onNext: () => Promise<boolean>;
  isSubmitting: boolean;
  keyboardStyle?: React.CSSProperties;
  isKeyboardOpen?: boolean;
}

export function BasicStep({
  onNext,
  isSubmitting,
  keyboardStyle,
  isKeyboardOpen,
}: BasicStepProps) {
  const t = useTranslations("items.create");
  const { workspace } = useWorkspace();
  const { setValue, watch } = useFormContext<CreateItemFormData>();
  const { getDefault, recordSelection } = useSmartDefaults("item-category");

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const categoryId = watch("category_id");

  // Fetch categories on mount
  useEffect(() => {
    if (workspace?.id) {
      setIsLoadingCategories(true);
      categoriesApi
        .list(workspace.id)
        .then(setCategories)
        .catch(console.error)
        .finally(() => setIsLoadingCategories(false));
    }
  }, [workspace?.id]);

  // Pre-fill from smart defaults on mount (only if no value set)
  useEffect(() => {
    const defaultCat = getDefault();
    if (defaultCat && !categoryId) {
      setValue("category_id", defaultCat);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCategoryChange = (value: string) => {
    setValue("category_id", value);
    const category = categories.find((c) => c.id === value);
    recordSelection(value, category?.name);
  };

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

        {/* Category - optional, with smart defaults */}
        <div className="space-y-2">
          <Label htmlFor="category_id" className="text-base font-medium">
            {t("fields.category")}
          </Label>
          <Select
            value={categoryId || ""}
            onValueChange={handleCategoryChange}
            disabled={isLoadingCategories}
          >
            <SelectTrigger
              id="category_id"
              className="min-h-[44px] text-base"
            >
              <SelectValue placeholder={t("placeholders.category")} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem
                  key={category.id}
                  value={category.id}
                  className="min-h-[44px]"
                >
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Description - optional */}
        <MobileFormTextarea<CreateItemFormData>
          name="description"
          label={t("fields.description")}
          placeholder={t("placeholders.description")}
          rows={3}
        />
      </div>

      {/* Navigation */}
      <div
        className={cn(
          "flex justify-end pt-4 border-t",
          isKeyboardOpen &&
            "fixed left-0 right-0 bg-background px-4 pb-4 shadow-lg z-50"
        )}
        style={isKeyboardOpen ? keyboardStyle : undefined}
      >
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
