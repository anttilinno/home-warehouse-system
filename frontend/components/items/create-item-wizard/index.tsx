"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { MultiStepForm, type Step } from "@/components/forms";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { itemsApi } from "@/lib/api";
import { BasicStep } from "./basic-step";
import { DetailsStep } from "./details-step";
import { PhotosStep } from "./photos-step";
import {
  createItemSchema,
  createItemDefaults,
  stepFields,
  type CreateItemFormData,
} from "./schema";

export function CreateItemWizard() {
  const t = useTranslations("items.create");
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const [capturedPhotos, setCapturedPhotos] = useState<File[]>([]);

  const steps: Step[] = [
    { id: "basic", title: t("steps.basic") },
    { id: "details", title: t("steps.details") },
    { id: "photos", title: t("steps.photos") },
  ];

  const handleSubmit = useCallback(
    async (data: CreateItemFormData) => {
      if (!workspaceId) {
        toast.error(t("errors.noWorkspace"));
        return;
      }

      try {
        // Create the item
        const item = await itemsApi.create(workspaceId, {
          sku: data.sku,
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
          short_code: data.short_code || undefined,
        });

        // Upload photos if any
        if (capturedPhotos.length > 0) {
          const { itemPhotosApi } = await import("@/lib/api/item-photos");
          for (const photo of capturedPhotos) {
            try {
              await itemPhotosApi.uploadItemPhoto(workspaceId, item.id, photo);
            } catch (err) {
              console.error("Failed to upload photo:", err);
              // Continue with other photos
            }
          }
        }

        toast.success(t("success"));
        router.push(`/dashboard/items/${item.id}`);
      } catch (error) {
        console.error("Failed to create item:", error);
        toast.error(t("errors.createFailed"));
      }
    },
    [workspaceId, capturedPhotos, t, router]
  );

  const handleCancel = useCallback(() => {
    router.push("/dashboard/items");
  }, [router]);

  return (
    <MultiStepForm
      schema={createItemSchema}
      defaultValues={createItemDefaults}
      steps={steps}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      formType="createItem"
      stepFields={stepFields}
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
            />
          )}
          {currentStep === 2 && (
            <PhotosStep
              onBack={goBack}
              isSubmitting={isSubmitting}
              onPhotosChange={setCapturedPhotos}
              keyboardStyle={keyboardStyle}
              isKeyboardOpen={isKeyboardOpen}
            />
          )}
        </>
      )}
    </MultiStepForm>
  );
}

export default CreateItemWizard;
