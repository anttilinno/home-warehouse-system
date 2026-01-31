# Phase 21: Mobile Form Improvements - Research

**Researched:** 2026-01-31
**Domain:** Mobile-optimized forms with React Hook Form, progressive disclosure, IndexedDB draft persistence, iOS keyboard handling
**Confidence:** MEDIUM-HIGH

## Summary

This research covers implementing mobile-optimized forms for a PWA using React 19, Next.js 16, React Hook Form 7.70, and Zod 4.3 (all already in the project). The primary focus areas are: multi-step wizard forms for complex Create Item flows, progressive disclosure via collapsible sections, form draft auto-save to IndexedDB, iOS keyboard handling via Visual Viewport API, and inline photo capture integration.

The most critical findings are: (1) **iOS Safari requires 16px+ font size** on inputs to prevent auto-zoom - the existing Input component uses `text-base md:text-sm` which already handles this; (2) **Visual Viewport API has known bugs in iOS 26** where `offsetTop` doesn't reset to 0 after keyboard dismissal; (3) **iOS PWA has 7-day storage eviction** for Safari but home screen apps are exempt; (4) React Hook Form's `FormProvider` and `useFormContext` are the standard pattern for multi-step forms sharing state.

**Primary recommendation:** Build mobile forms using React Hook Form with Zod validation, implement multi-step wizards using FormProvider context, add form draft persistence to IndexedDB with debounced auto-save, use Radix UI Collapsible for progressive disclosure, and handle iOS keyboard via the `react-ios-keyboard-viewport` library or manual Visual Viewport API integration.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | 7.70.0 | Form state management | Minimal re-renders, uncontrolled by default, built-in validation |
| @hookform/resolvers | 5.2.2 | Schema validation integration | Connects Zod/Yup to RHF |
| zod | 4.3.5 | Runtime type validation | TypeScript-first, composable schemas, tree-shakeable |
| idb | 8.0.3 | IndexedDB wrapper | Promise-based, typed, already used for offline storage |
| @radix-ui/react-collapsible | (via shadcn) | Progressive disclosure | Accessible, animated, composable |

### Supporting (May Need Installation)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-ios-keyboard-viewport | latest | iOS keyboard positioning | When fixed elements need to respect iOS keyboard |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-ios-keyboard-viewport | Manual Visual Viewport API | More control but more code; library handles edge cases |
| Radix Collapsible | Radix Accordion | Accordion better for multiple expandable sections |
| Multi-step with RHF context | rhf-wizard library | Library adds overhead; pattern is simple enough to build |

**Installation (if needed):**
```bash
bun add react-ios-keyboard-viewport
# Collapsible already available via shadcn/ui
```

## Architecture Patterns

### Recommended Project Structure
```
components/
├── forms/
│   ├── multi-step-form.tsx         # Generic wizard container
│   ├── form-step.tsx               # Individual step wrapper
│   ├── collapsible-section.tsx     # Progressive disclosure wrapper
│   ├── inline-photo-capture.tsx    # Photo field with camera integration
│   └── mobile-form-field.tsx       # Mobile-optimized field wrapper
├── items/
│   └── create-item-wizard/
│       ├── index.tsx               # Wizard entry point
│       ├── basic-step.tsx          # Step 1: Name, SKU, Category
│       ├── details-step.tsx        # Step 2: Brand, Model, Serial
│       └── photos-step.tsx         # Step 3: Photo capture/upload
lib/
├── hooks/
│   ├── use-form-draft.ts           # IndexedDB draft persistence
│   ├── use-ios-keyboard.ts         # Visual Viewport wrapper
│   └── use-smart-defaults.ts       # Recent selection memory
├── forms/
│   ├── draft-storage.ts            # IndexedDB CRUD for drafts
│   └── validation-schemas.ts       # Zod schemas for forms
```

### Pattern 1: Multi-Step Form with FormProvider
**What:** Share form state across multiple step components using React Hook Form context.
**When to use:** Complex forms with 3+ logical sections (Create Item wizard).
**Example:**
```typescript
// Source: https://react-hook-form.com/advanced-usage
// components/forms/multi-step-form.tsx
"use client";

import { useState, useCallback } from "react";
import { useForm, FormProvider, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

interface MultiStepFormProps<T extends z.ZodType> {
  schema: T;
  defaultValues: z.infer<T>;
  steps: React.ComponentType<{ onNext: () => void; onBack: () => void }>[];
  onSubmit: (data: z.infer<T>) => Promise<void>;
  onDraftChange?: (data: Partial<z.infer<T>>) => void;
}

export function MultiStepForm<T extends z.ZodType>({
  schema,
  defaultValues,
  steps,
  onSubmit,
  onDraftChange,
}: MultiStepFormProps<T>) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const methods = useForm<z.infer<T>>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onChange",
    shouldUnregister: false, // CRITICAL: Preserve values across steps
  });

  const { handleSubmit, watch } = methods;

  // Auto-save draft on changes
  useEffect(() => {
    const subscription = watch((data) => {
      onDraftChange?.(data as Partial<z.infer<T>>);
    });
    return () => subscription.unsubscribe();
  }, [watch, onDraftChange]);

  const goNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, steps.length]);

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const onFormSubmit = async (data: z.infer<T>) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const StepComponent = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <StepComponent onNext={goNext} onBack={goBack} />
        {isLastStep && (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Create Item"}
          </Button>
        )}
      </form>
    </FormProvider>
  );
}
```

### Pattern 2: useFormContext in Step Components
**What:** Access form methods in deeply nested step components without prop drilling.
**When to use:** Each step component needs to register fields and access form state.
**Example:**
```typescript
// Source: https://react-hook-form.com/advanced-usage
// components/items/create-item-wizard/basic-step.tsx
"use client";

import { useFormContext } from "react-hook-form";
import type { ItemCreate } from "@/lib/types/items";

export function BasicStep({ onNext }: { onNext: () => void; onBack: () => void }) {
  const {
    register,
    formState: { errors },
    trigger,
  } = useFormContext<ItemCreate>();

  const handleNext = async () => {
    // Validate only this step's fields before proceeding
    const isValid = await trigger(["sku", "name", "category_id"]);
    if (isValid) {
      onNext();
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          {...register("name")}
          className="text-base" // 16px to prevent iOS zoom
          aria-invalid={errors.name ? "true" : "false"}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <Button type="button" onClick={handleNext}>
        Next
      </Button>
    </div>
  );
}
```

### Pattern 3: Collapsible Progressive Disclosure
**What:** Hide advanced fields behind expandable section to reduce cognitive load.
**When to use:** Forms with 10+ fields where some are rarely used.
**Example:**
```typescript
// Source: https://ui.shadcn.com/docs/components/collapsible
// components/forms/collapsible-section.tsx
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between rounded-lg border p-4",
            "min-h-[44px] touch-manipulation", // 44px touch target
            "hover:bg-muted/50 transition-colors"
          )}
        >
          <div className="text-left">
            <h3 className="font-medium">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <ChevronDown
            className={cn(
              "h-5 w-5 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 px-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

### Pattern 4: IndexedDB Form Draft Persistence
**What:** Auto-save form state to IndexedDB with debouncing; restore on return.
**When to use:** Any form where users might navigate away or lose connection.
**Example:**
```typescript
// Source: Based on existing offline-db.ts patterns
// lib/hooks/use-form-draft.ts
"use client";

import { useEffect, useCallback, useRef } from "react";
import { getDB } from "@/lib/db/offline-db";

const DRAFT_STORE = "formDrafts";
const DEBOUNCE_MS = 1000;

interface FormDraft {
  id: string;
  formType: string;
  data: Record<string, unknown>;
  savedAt: number;
}

export function useFormDraft<T extends Record<string, unknown>>(
  formType: string,
  draftId: string
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load draft on mount
  const loadDraft = useCallback(async (): Promise<T | null> => {
    try {
      const db = await getDB();
      // Note: formDrafts store would need to be added to OfflineDBSchema
      const draft = await db.get(DRAFT_STORE, draftId) as FormDraft | undefined;
      return draft?.data as T | null;
    } catch (error) {
      console.warn("[FormDraft] Failed to load:", error);
      return null;
    }
  }, [draftId]);

  // Save draft with debounce
  const saveDraft = useCallback(
    (data: Partial<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(async () => {
        try {
          const db = await getDB();
          const draft: FormDraft = {
            id: draftId,
            formType,
            data: data as Record<string, unknown>,
            savedAt: Date.now(),
          };
          await db.put(DRAFT_STORE, draft);
        } catch (error) {
          console.warn("[FormDraft] Failed to save:", error);
        }
      }, DEBOUNCE_MS);
    },
    [draftId, formType]
  );

  // Clear draft on successful submit
  const clearDraft = useCallback(async () => {
    try {
      const db = await getDB();
      await db.delete(DRAFT_STORE, draftId);
    } catch (error) {
      console.warn("[FormDraft] Failed to clear:", error);
    }
  }, [draftId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { loadDraft, saveDraft, clearDraft };
}
```

### Pattern 5: iOS Keyboard Handling with Visual Viewport
**What:** Adjust fixed elements when iOS keyboard appears to prevent content hiding.
**When to use:** Forms with fixed submit buttons or floating elements.
**Example:**
```typescript
// Source: https://github.com/RyoSogawa/react-ios-keyboard-viewport
// Alternative: Manual implementation
// lib/hooks/use-ios-keyboard.ts
"use client";

import { useState, useEffect, useCallback } from "react";

interface ViewportOffset {
  top: number;
  height: number;
  keyboardHeight: number;
}

export function useIOSKeyboard() {
  const [offset, setOffset] = useState<ViewportOffset>({
    top: 0,
    height: 0,
    keyboardHeight: 0,
  });
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    // Only run on iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!isIOS || typeof visualViewport === "undefined") {
      return;
    }

    const handleResize = () => {
      const vv = visualViewport!;
      const windowHeight = window.innerHeight;
      const keyboardHeight = windowHeight - vv.height;

      setOffset({
        top: vv.offsetTop,
        height: vv.height,
        keyboardHeight: Math.max(0, keyboardHeight),
      });
      setIsKeyboardOpen(keyboardHeight > 100); // Threshold to detect keyboard
    };

    visualViewport.addEventListener("resize", handleResize);
    visualViewport.addEventListener("scroll", handleResize);

    // Initial check
    handleResize();

    return () => {
      visualViewport?.removeEventListener("resize", handleResize);
      visualViewport?.removeEventListener("scroll", handleResize);
    };
  }, []);

  // Style generator for fixed bottom elements
  const getFixedBottomStyle = useCallback((): React.CSSProperties => {
    if (!isKeyboardOpen) {
      return { position: "fixed", bottom: 0 };
    }
    return {
      position: "fixed",
      bottom: offset.keyboardHeight,
      transition: "bottom 0.1s ease-out",
    };
  }, [isKeyboardOpen, offset.keyboardHeight]);

  return { offset, isKeyboardOpen, getFixedBottomStyle };
}
```

### Pattern 6: Mobile-Optimized Input with Keyboard Hints
**What:** Use inputMode attribute to trigger appropriate mobile keyboards.
**When to use:** All mobile form inputs.
**Example:**
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inputmode
// components/forms/mobile-form-field.tsx

// Numeric fields (quantity, stock level)
<Input
  inputMode="numeric"
  pattern="[0-9]*"
  className="text-base" // Prevent iOS zoom
/>

// Email fields
<Input
  type="email"
  inputMode="email"
  autoComplete="email"
  className="text-base"
/>

// Phone fields
<Input
  type="tel"
  inputMode="tel"
  autoComplete="tel"
  className="text-base"
/>

// Decimal/price fields
<Input
  inputMode="decimal"
  pattern="[0-9]*[.,]?[0-9]*"
  className="text-base"
/>

// Search fields
<Input
  type="search"
  inputMode="search"
  className="text-base"
/>
```

### Anti-Patterns to Avoid
- **Placeholder-only labels:** Always show a visible label above the input; placeholders disappear on focus.
- **Font size under 16px on inputs:** iOS Safari auto-zooms on focus for smaller fonts.
- **Using type="number" for all numeric inputs:** Use inputMode="numeric" instead for better mobile UX.
- **Unmounting form on step change:** Use shouldUnregister: false to preserve values.
- **Synchronous draft saves:** Always debounce IndexedDB writes to prevent performance issues.
- **Fixed bottom elements without Visual Viewport handling:** iOS keyboard hides them.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form state management | Custom useState for each field | React Hook Form | Handles validation, touched states, dirty tracking |
| Schema validation | Manual if/else checks | Zod with zodResolver | Type-safe, composable, reusable schemas |
| Multi-step state sharing | Prop drilling or custom context | FormProvider + useFormContext | Built into RHF, tested pattern |
| Collapsible sections | Custom show/hide with CSS | Radix UI Collapsible | Accessible, animated, handles focus |
| iOS keyboard detection | Custom resize listeners | react-ios-keyboard-viewport | Handles edge cases, iOS-specific bugs |
| IndexedDB operations | Raw IndexedDB API | idb library | Promise-based, typed, cleaner API |

**Key insight:** Form handling has decades of edge cases around validation timing, error display, keyboard management, and accessibility. React Hook Form and Radix UI have solved these; custom implementations inevitably rediscover the same problems.

## Common Pitfalls

### Pitfall 1: iOS Safari Auto-Zoom on Input Focus
**What goes wrong:** Page zooms in when user taps a form field on iPhone.
**Why it happens:** iOS Safari zooms to ensure readability when input font-size is under 16px.
**How to avoid:**
- Set all input/textarea/select to `text-base` (16px) on mobile
- Use responsive classes: `text-base md:text-sm` for desktop optimization
- Never use `maximum-scale=1` in viewport meta (breaks accessibility)
**Warning signs:** Users complain about "page jumps" or "zooms when typing"

### Pitfall 2: Form Values Lost on Step Navigation
**What goes wrong:** User fills Step 1, goes to Step 2, returns to Step 1, values are gone.
**Why it happens:** React Hook Form unregisters fields when components unmount by default.
**How to avoid:**
- Set `shouldUnregister: false` in useForm options
- Use FormProvider to share state across step components
- Test multi-step navigation thoroughly
**Warning signs:** Values disappear when changing tabs or steps

### Pitfall 3: iOS Keyboard Hides Fixed Submit Button
**What goes wrong:** User scrolls to bottom of form, taps submit, keyboard covers the button.
**Why it happens:** iOS Safari's Visual Viewport shrinks but Layout Viewport doesn't; fixed elements anchor to Layout Viewport.
**How to avoid:**
- Use Visual Viewport API to detect keyboard
- Adjust fixed element positioning when keyboard is open
- Consider inline submit buttons instead of fixed bottom
**Warning signs:** Users can't find submit button when keyboard is open

### Pitfall 4: IndexedDB Draft Not Restored
**What goes wrong:** User leaves form, returns, draft is not loaded.
**Why it happens:** Draft loading is async; form renders with defaults before draft loads.
**How to avoid:**
- Load draft before rendering form (show skeleton while loading)
- Use `useEffect` with draft as dependency to reset form values
- Test with slow IndexedDB simulation
**Warning signs:** Form flashes empty then fills with draft

### Pitfall 5: Visual Viewport Bug on iOS 26
**What goes wrong:** After keyboard dismissal, fixed elements remain offset.
**Why it happens:** Known iOS 26 bug where `visualViewport.offsetTop` doesn't reset to 0.
**How to avoid:**
- Add fallback: reset offset on blur events
- Listen for focusout events as secondary trigger
- Test on actual iOS 26 device, not just simulators
**Warning signs:** Header/footer misaligned after keyboard use

### Pitfall 6: iOS PWA Storage Eviction
**What goes wrong:** User opens PWA after a week, drafts are gone.
**Why it happens:** Safari has 7-day storage eviction for web apps (not home screen installed PWAs).
**How to avoid:**
- Use `navigator.storage.persist()` to request persistent storage
- Warn users about potential data loss in Safari tab mode
- Prioritize home screen installation prompts
**Warning signs:** Works fine initially, data disappears after days

## Code Examples

Verified patterns from official sources:

### Complete Create Item Wizard Structure
```typescript
// Source: Based on https://react-hook-form.com/advanced-usage + shadcn patterns
// components/items/create-item-wizard/index.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { v7 as uuidv7 } from "uuid";

import { useFormDraft } from "@/lib/hooks/use-form-draft";
import { BasicStep } from "./basic-step";
import { DetailsStep } from "./details-step";
import { PhotosStep } from "./photos-step";

const createItemSchema = z.object({
  // Step 1: Basic
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Name is required"),
  category_id: z.string().optional(),
  description: z.string().optional(),
  // Step 2: Details (in CollapsibleSection or separate step)
  brand: z.string().optional(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  serial_number: z.string().optional(),
  barcode: z.string().optional(),
  min_stock_level: z.coerce.number().min(0).default(0),
  // Step 3: Advanced (in CollapsibleSection)
  is_insured: z.boolean().default(false),
  lifetime_warranty: z.boolean().default(false),
  warranty_details: z.string().optional(),
});

type CreateItemFormData = z.infer<typeof createItemSchema>;

export function CreateItemWizard({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: CreateItemFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations("items.create");
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const draftId = useRef(uuidv7()).current;
  const { loadDraft, saveDraft, clearDraft } = useFormDraft<CreateItemFormData>(
    "createItem",
    draftId
  );

  const methods = useForm<CreateItemFormData>({
    resolver: zodResolver(createItemSchema),
    defaultValues: {
      sku: "",
      name: "",
      description: "",
      brand: "",
      model: "",
      min_stock_level: 0,
      is_insured: false,
      lifetime_warranty: false,
    },
    mode: "onChange",
    shouldUnregister: false,
  });

  const { reset, watch, handleSubmit } = methods;

  // Load draft on mount
  useEffect(() => {
    async function load() {
      const draft = await loadDraft();
      if (draft) {
        reset(draft);
      }
      setDraftLoaded(true);
    }
    load();
  }, [loadDraft, reset]);

  // Auto-save draft on changes
  useEffect(() => {
    if (!draftLoaded) return;
    const subscription = watch((data) => {
      saveDraft(data as Partial<CreateItemFormData>);
    });
    return () => subscription.unsubscribe();
  }, [watch, saveDraft, draftLoaded]);

  const handleFormSubmit = async (data: CreateItemFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      await clearDraft();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!draftLoaded) {
    return <FormSkeleton />;
  }

  const steps = [
    { id: "basic", title: t("steps.basic"), component: BasicStep },
    { id: "details", title: t("steps.details"), component: DetailsStep },
    { id: "photos", title: t("steps.photos"), component: PhotosStep },
  ];

  const StepComponent = steps[currentStep].component;

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Step indicators */}
        <nav aria-label="Progress">
          <ol className="flex items-center gap-2">
            {steps.map((step, index) => (
              <li key={step.id} className="flex items-center">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                    index === currentStep
                      ? "bg-primary text-primary-foreground"
                      : index < currentStep
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {index + 1}
                </span>
                <span className="ml-2 text-sm hidden sm:inline">{step.title}</span>
              </li>
            ))}
          </ol>
        </nav>

        {/* Current step */}
        <StepComponent
          onNext={() => setCurrentStep((s) => Math.min(s + 1, steps.length - 1))}
          onBack={() => setCurrentStep((s) => Math.max(s - 1, 0))}
          isLastStep={currentStep === steps.length - 1}
          isSubmitting={isSubmitting}
        />

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={currentStep === 0 ? onCancel : () => setCurrentStep((s) => s - 1)}
            className="min-h-[44px] min-w-[44px]"
          >
            {currentStep === 0 ? t("cancel") : t("back")}
          </Button>
          {currentStep < steps.length - 1 ? (
            <Button
              type="button"
              onClick={() => setCurrentStep((s) => s + 1)}
              className="min-h-[44px] min-w-[44px]"
            >
              {t("next")}
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] min-w-[44px]"
            >
              {isSubmitting ? t("creating") : t("create")}
            </Button>
          )}
        </div>
      </form>
    </FormProvider>
  );
}
```

### Inline Validation Error Display
```typescript
// Source: https://react-hook-form.com/ + accessible error pattern
// components/forms/form-field.tsx
"use client";

import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  inputMode?: "text" | "numeric" | "decimal" | "email" | "tel" | "search";
  placeholder?: string;
  className?: string;
}

export function FormField({
  name,
  label,
  required,
  type = "text",
  inputMode,
  placeholder,
  className,
}: FormFieldProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  const error = errors[name];
  const errorId = `${name}-error`;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={name}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        className="text-base" // Prevent iOS zoom
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? errorId : undefined}
        {...register(name)}
      />
      {error && (
        <p
          id={errorId}
          className="text-sm text-destructive flex items-center gap-1"
          role="alert"
        >
          <AlertCircle className="h-3.5 w-3.5" />
          {error.message as string}
        </p>
      )}
    </div>
  );
}
```

### Inline Photo Capture Integration
```typescript
// Source: Based on Phase 19 barcode-scanner.tsx + photo-upload.tsx patterns
// components/forms/inline-photo-capture.tsx
"use client";

import { useState, useCallback } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { createImagePreview, compressImage } from "@/lib/utils/image";

interface InlinePhotoCaptureProps {
  onCapture: (file: File, preview: string) => void;
  onRemove: () => void;
  preview?: string;
  label?: string;
}

export function InlinePhotoCapture({
  onCapture,
  onRemove,
  preview,
  label = "Add Photo",
}: InlinePhotoCaptureProps) {
  const [showCamera, setShowCamera] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCapture = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      try {
        // Compress if large
        const processed =
          file.size > 2 * 1024 * 1024
            ? await compressImage(file, 1920, 1920, 0.85)
            : file;
        const previewUrl = createImagePreview(processed);
        onCapture(processed, previewUrl);
      } finally {
        setIsProcessing(false);
        setShowCamera(false);
      }
    },
    [onCapture]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleCapture(file);
      }
      // Reset input
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [handleCapture]
  );

  if (preview) {
    return (
      <div className="relative aspect-square w-32 rounded-lg overflow-hidden border">
        <img src={preview} alt="Captured" className="w-full h-full object-cover" />
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute top-1 right-1 h-8 w-8"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] min-w-[44px]"
          onClick={() => setShowCamera(true)}
          disabled={isProcessing}
        >
          <Camera className="h-4 w-4 mr-2" />
          {label}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] min-w-[44px]"
          onClick={() => inputRef.current?.click()}
          disabled={isProcessing}
        >
          <ImagePlus className="h-4 w-4 mr-2" />
          Gallery
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="sr-only"
        />
      </div>

      <Dialog open={showCamera} onOpenChange={setShowCamera}>
        <DialogContent className="max-w-lg p-0">
          <CameraCapture
            onCapture={handleCapture}
            onCancel={() => setShowCamera(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Controlled inputs with useState | React Hook Form uncontrolled | 2020+ | Fewer re-renders, better mobile perf |
| Manual validation with if/else | Zod schema validation | 2022+ | Type safety, composable schemas |
| Fixed bottom with CSS position | Visual Viewport API | iOS 13+ (2019) | Keyboard-aware positioning |
| localStorage for drafts | IndexedDB with idb | 2020+ | Larger storage, structured data |
| Placeholder as label | Floating/visible labels | WCAG 2.1 (2018) | Accessibility compliance |
| Small touch targets | 44px minimum | Apple HIG, Material | Mobile usability |

**Deprecated/outdated:**
- **Formik:** Still works but React Hook Form has better performance and smaller bundle
- **redux-form:** Largely abandoned; RHF is the standard
- **maximum-scale=1 for zoom prevention:** Breaks accessibility; use 16px fonts instead
- **onResize for keyboard detection:** Visual Viewport API is more accurate

## Open Questions

Things that couldn't be fully resolved:

1. **iOS 26 Visual Viewport Bug Workaround**
   - What we know: visualViewport.offsetTop doesn't reset to 0 after keyboard dismissal
   - What's unclear: Whether this is fixed in iOS 26.x point releases
   - Recommendation: Test on actual iOS 26 device; implement blur-event fallback

2. **IndexedDB formDrafts Store Addition**
   - What we know: Current OfflineDBSchema doesn't have a formDrafts store
   - What's unclear: Whether to add new store or reuse syncMeta
   - Recommendation: Add formDrafts store in DB_VERSION 4 migration

3. **Smart Defaults Implementation**
   - What we know: Should remember last used category/location
   - What's unclear: How long to persist, what to store (ID vs full object)
   - Recommendation: Store last 5 selections per field in localStorage

4. **Camera Permission in Form Context**
   - What we know: iOS PWA camera permissions are volatile (Phase 19)
   - What's unclear: Whether inline photo capture will trigger permission re-request
   - Recommendation: Use dialog modal pattern to keep camera context; test extensively

## Sources

### Primary (HIGH confidence)
- [React Hook Form Advanced Usage](https://react-hook-form.com/advanced-usage) - Multi-step form patterns
- [shadcn/ui Collapsible](https://ui.shadcn.com/docs/components/collapsible) - Progressive disclosure
- [MDN inputmode](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inputmode) - Mobile keyboard types
- [MDN VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport) - Keyboard detection API

### Secondary (MEDIUM confidence)
- [CSS-Tricks 16px Input Zoom](https://css-tricks.com/16px-or-larger-text-prevents-ios-form-zoom/) - iOS zoom prevention
- [react-ios-keyboard-viewport GitHub](https://github.com/RyoSogawa/react-ios-keyboard-viewport) - iOS keyboard hook
- [LogRocket Multi-Step Form Guide](https://blog.logrocket.com/building-reusable-multi-step-form-react-hook-form-zod/) - Implementation patterns

### Tertiary (LOW confidence)
- iOS 26 Visual Viewport bug reports - Apple Developer Forums (needs device validation)
- PWA iOS storage eviction timelines - Community reports (varies by iOS version)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, well-documented
- Architecture: HIGH - Patterns from official React Hook Form docs
- Pitfalls: MEDIUM - iOS-specific issues need device testing
- Visual Viewport handling: MEDIUM - iOS 26 bug reported but unverified

**Research date:** 2026-01-31
**Valid until:** 30 days (iOS behavior may change with point releases)
