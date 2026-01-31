"use client";

import {
  useFormContext,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type InputMode =
  | "text"
  | "numeric"
  | "decimal"
  | "email"
  | "tel"
  | "search"
  | "url"
  | "none";

interface MobileFormFieldProps<TFieldValues extends FieldValues = FieldValues> {
  /** Field name (must match form schema) */
  name: FieldPath<TFieldValues>;
  /** Visible label above input */
  label: string;
  /** Whether field is required */
  required?: boolean;
  /** Input type attribute */
  type?: "text" | "email" | "tel" | "password" | "url";
  /** Mobile keyboard type hint */
  inputMode?: InputMode;
  /** Placeholder text */
  placeholder?: string;
  /** Additional classes for container */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Pattern for validation */
  pattern?: string;
  /** Autocomplete hint */
  autoComplete?: string;
  /** Min value for numeric inputs */
  min?: number;
  /** Max value for numeric inputs */
  max?: number;
}

export function MobileFormField<
  TFieldValues extends FieldValues = FieldValues,
>({
  name,
  label,
  required,
  type = "text",
  inputMode,
  placeholder,
  className,
  disabled,
  pattern,
  autoComplete,
  min,
  max,
}: MobileFormFieldProps<TFieldValues>) {
  const {
    register,
    formState: { errors },
  } = useFormContext<TFieldValues>();

  // Get nested error (supports dot notation like "address.city")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const error = name.split(".").reduce<any>((obj, key) => obj?.[key], errors);
  const errorMessage = error?.message as string | undefined;
  const errorId = `${name}-error`;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Always-visible label (FORM-04) */}
      <Label htmlFor={name} className="text-base font-medium">
        {label}
        {required && (
          <span className="ml-1 text-destructive" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only">(required)</span>}
      </Label>

      {/* Input with mobile optimizations */}
      <Input
        id={name}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        disabled={disabled}
        pattern={pattern}
        autoComplete={autoComplete}
        min={min}
        max={max}
        className={cn(
          "text-base", // 16px to prevent iOS zoom (FORM-08)
          "min-h-[44px]" // 44px touch target (FORM-03)
        )}
        aria-invalid={errorMessage ? "true" : "false"}
        aria-describedby={errorMessage ? errorId : undefined}
        {...register(name, {
          valueAsNumber:
            inputMode === "numeric" || inputMode === "decimal"
              ? true
              : undefined,
        })}
      />

      {/* Inline validation error (FORM-05) */}
      {errorMessage && (
        <p
          id={errorId}
          className="flex items-center gap-1.5 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </p>
      )}
    </div>
  );
}
