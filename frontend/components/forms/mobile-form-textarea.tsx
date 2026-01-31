"use client";

import {
  useFormContext,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface MobileFormTextareaProps<
  TFieldValues extends FieldValues = FieldValues,
> {
  /** Field name (must match form schema) */
  name: FieldPath<TFieldValues>;
  /** Visible label above input */
  label: string;
  /** Whether field is required */
  required?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Additional classes for container */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Number of visible rows */
  rows?: number;
}

export function MobileFormTextarea<
  TFieldValues extends FieldValues = FieldValues,
>({
  name,
  label,
  required,
  placeholder,
  className,
  disabled,
  rows = 3,
}: MobileFormTextareaProps<TFieldValues>) {
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
      <Label htmlFor={name} className="text-base font-medium">
        {label}
        {required && (
          <span className="ml-1 text-destructive" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only">(required)</span>}
      </Label>

      <Textarea
        id={name}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={cn(
          "text-base", // 16px to prevent iOS zoom
          "min-h-[88px]" // At least 2x 44px for touch
        )}
        aria-invalid={errorMessage ? "true" : "false"}
        aria-describedby={errorMessage ? errorId : undefined}
        {...register(name)}
      />

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
