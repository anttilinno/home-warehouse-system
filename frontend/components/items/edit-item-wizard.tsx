"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { MultiStepForm, type Step } from "@/components/forms";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { itemsApi } from "@/lib/api";
import { BasicStep } from "./create-item-wizard/basic-step";
import { DetailsStep } from "./create-item-wizard/details-step";
import {
  createItemSchema,
  createItemDefaults,
  stepFields,
  type CreateItemFormData,
} from "./create-item-wizard/schema";

interface EditItemWizardProps {
  itemId: string;
}

export function EditItemWizard({ itemId }: EditItemWizardProps) {
  const t = useTranslations("items.edit");
  const tCreate = useTranslations("items.create");
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const [initialValues, setInitialValues] = useState<CreateItemFormData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load item data
  useEffect(() => {
    if (!workspaceId || !itemId) return;

    itemsApi
      .get(workspaceId, itemId)
      .then((item) => {
        setInitialValues({
          sku: item.sku,
          name: item.name,
          category_id: item.category_id || undefined,
          description: item.description || "",
          brand: item.brand || "",
          model: item.model || "",
          manufacturer: item.manufacturer || "",
          serial_number: item.serial_number || "",
          barcode: item.barcode || "",
          purchased_from: item.purchased_from || "",
          min_stock_level: item.min_stock_level,
          is_insured: item.is_insured || false,
          lifetime_warranty: item.lifetime_warranty || false,
          warranty_details: item.warranty_details || "",
          short_code: item.short_code || "",
        });
      })
      .catch((error) => {
        console.error("Failed to load item:", error);
        toast.error(t("errors.loadFailed"));
        router.push(`/dashboard/items/${itemId}`);
      })
      .finally(() => setIsLoading(false));
  }, [workspaceId, itemId, router, t]);

  // Only 2 steps for edit (no photos step - managed from detail page)
  const steps: Step[] = [
    { id: "basic", title: tCreate("steps.basic") },
    { id: "details", title: tCreate("steps.details") },
  ];

  // Edit-specific step fields (same validation, just 2 steps)
  const editStepFields = stepFields.slice(0, 2);

  const handleSubmit = useCallback(
    async (data: CreateItemFormData) => {
      if (!workspaceId) {
        toast.error(tCreate("errors.noWorkspace"));
        return;
      }

      try {
        await itemsApi.update(workspaceId, itemId, {
          name: data.name,
          description: data.description || undefined,
          category_id: data.category_id || undefined,
          brand: data.brand || undefined,
          model: data.model || undefined,
          manufacturer: data.manufacturer || undefined,
          serial_number: data.serial_number || undefined,
          barcode: data.barcode || undefined,
          is_insured: data.is_insured,
          lifetime_warranty: data.lifetime_warranty,
          warranty_details: data.warranty_details || undefined,
          purchased_from: data.purchased_from || undefined,
          min_stock_level: data.min_stock_level,
        });

        toast.success(t("success"));
        router.push(`/dashboard/items/${itemId}`);
      } catch (error) {
        console.error("Failed to update item:", error);
        toast.error(t("errors.updateFailed"));
      }
    },
    [workspaceId, itemId, t, tCreate, router]
  );

  const handleCancel = useCallback(() => {
    router.push(`/dashboard/items/${itemId}`);
  }, [router, itemId]);

  if (isLoading || !initialValues) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <MultiStepForm
      schema={createItemSchema}
      defaultValues={initialValues}
      steps={steps}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      formType="editItem"
      draftId={itemId}
      stepFields={editStepFields}
      className="max-w-2xl mx-auto"
    >
      {({
        currentStep,
        goNext,
        goBack,
        isSubmitting,
        keyboardStyle,
        isKeyboardOpen,
      }) => (
        <>
          {currentStep === 0 && (
            <BasicStep
              onNext={goNext}
              isSubmitting={isSubmitting}
              keyboardStyle={keyboardStyle}
              isKeyboardOpen={isKeyboardOpen}
            />
          )}
          {currentStep === 1 && (
            <DetailsStep
              onNext={goNext}
              onBack={goBack}
              isSubmitting={isSubmitting}
              keyboardStyle={keyboardStyle}
              isKeyboardOpen={isKeyboardOpen}
              isLastStep
              submitLabel={t("save")}
              submittingLabel={t("saving")}
            />
          )}
        </>
      )}
    </MultiStepForm>
  );
}
