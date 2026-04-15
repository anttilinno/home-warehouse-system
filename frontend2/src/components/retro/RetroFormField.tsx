import { cloneElement, type ReactElement } from "react";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

interface RetroFormFieldProps<T extends FieldValues> {
  name: FieldPath<T>;
  control: Control<T>;
  label: string;
  helper?: string;
  children: ReactElement;
  className?: string;
}

function RetroFormField<T extends FieldValues>({
  name,
  control,
  label,
  helper,
  children,
  className,
}: RetroFormFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <div className={`flex flex-col gap-xs ${className || ""}`}>
          <label
            htmlFor={field.name}
            className="text-[14px] font-semibold uppercase tracking-wide text-retro-ink"
          >
            {label}
          </label>
          {cloneElement(children, {
            id: field.name,
            name: field.name,
            value: field.value,
            onChange: field.onChange,
            onBlur: field.onBlur,
            ref: field.ref,
            error: fieldState.error?.message,
          } as Partial<Record<string, unknown>>)}
          {fieldState.error?.message ? (
            <p className="text-[14px] text-retro-red font-mono">
              {fieldState.error.message}
            </p>
          ) : helper ? (
            <p className="text-[14px] text-retro-charcoal/70">{helper}</p>
          ) : null}
        </div>
      )}
    />
  );
}

export { RetroFormField };
export type { RetroFormFieldProps };
