"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  useForm,
  FormProvider,
  type FieldValues,
  type DefaultValues,
  type Path,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { v7 as uuidv7 } from "uuid";

import { useFormDraft } from "@/lib/hooks/use-form-draft";
import { StepIndicator, type Step } from "./step-indicator";
import { Skeleton } from "@/components/ui/skeleton";

interface MultiStepFormProps<TFormData extends FieldValues> {
  /** Zod schema for the entire form */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodType<TFormData, any, any>;
  /** Default values for the form */
  defaultValues: DefaultValues<TFormData>;
  /** Array of step definitions */
  steps: Step[];
  /** Render function for step content */
  children: (props: {
    currentStep: number;
    goNext: () => Promise<boolean>;
    goBack: () => void;
    isFirstStep: boolean;
    isLastStep: boolean;
    isSubmitting: boolean;
  }) => React.ReactNode;
  /** Called when form is submitted on last step */
  onSubmit: (data: TFormData) => Promise<void>;
  /** Called when user cancels */
  onCancel?: () => void;
  /** Form type identifier for draft persistence */
  formType: string;
  /** Optional draft ID (auto-generated if not provided) */
  draftId?: string;
  /** Fields to validate on each step (array of arrays) */
  stepFields?: Path<TFormData>[][];
  /** Additional classes */
  className?: string;
}

export function MultiStepForm<TFormData extends FieldValues>({
  schema,
  defaultValues,
  steps,
  children,
  onSubmit,
  onCancel,
  formType,
  draftId: externalDraftId,
  stepFields,
  className,
}: MultiStepFormProps<TFormData>) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Generate or use provided draft ID
  const draftIdRef = useRef(externalDraftId || uuidv7());
  const { loadDraft, saveDraft, clearDraft } = useFormDraft<
    Record<string, unknown>
  >(formType, draftIdRef.current);

  // Initialize form with shouldUnregister: false to preserve values across steps
  const methods = useForm<TFormData>({
    resolver: zodResolver(schema) as Resolver<TFormData>,
    defaultValues,
    mode: "onChange",
    shouldUnregister: false, // CRITICAL: Preserve values when steps unmount
  });

  const { reset, watch, handleSubmit, trigger } = methods;

  // Load draft on mount
  useEffect(() => {
    let mounted = true;

    async function load() {
      const draft = await loadDraft();
      if (mounted && draft) {
        reset({ ...defaultValues, ...draft } as DefaultValues<TFormData>);
      }
      if (mounted) {
        setDraftLoaded(true);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [loadDraft, reset, defaultValues]);

  // Auto-save draft on value changes (after initial load)
  useEffect(() => {
    if (!draftLoaded) return;

    const subscription = watch((data) => {
      saveDraft(data as Record<string, unknown>);
    });

    return () => subscription.unsubscribe();
  }, [watch, saveDraft, draftLoaded]);

  // Navigate to next step (validates current step first)
  const goNext = useCallback(async (): Promise<boolean> => {
    // Validate current step's fields if specified
    if (stepFields && stepFields[currentStep]) {
      const fields = stepFields[currentStep];
      const isValid = await trigger(fields);
      if (!isValid) {
        return false;
      }
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
      return true;
    }

    return false;
  }, [currentStep, steps.length, stepFields, trigger]);

  // Navigate to previous step
  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    } else {
      onCancel?.();
    }
  }, [currentStep, onCancel]);

  // Handle final form submission
  const onFormSubmit = async (data: TFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      await clearDraft();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle step click in indicator
  const handleStepClick = useCallback(
    (index: number) => {
      // Only allow going to previous steps
      if (index < currentStep) {
        setCurrentStep(index);
      }
    },
    [currentStep]
  );

  // Show skeleton while loading draft
  if (!draftLoaded) {
    return (
      <div className={className}>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onFormSubmit)} className={className}>
        {/* Step indicator */}
        <StepIndicator
          steps={steps}
          currentStep={currentStep}
          onStepClick={handleStepClick}
          allowNavigation
          className="mb-6"
        />

        {/* Step content */}
        {children({
          currentStep,
          goNext,
          goBack,
          isFirstStep,
          isLastStep,
          isSubmitting,
        })}
      </form>
    </FormProvider>
  );
}
