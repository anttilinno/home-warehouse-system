import { useId, type ComponentPropsWithRef, type ReactNode } from "react";

export interface RetroSelectProps extends ComponentPropsWithRef<"select"> {
  label: ReactNode;
  /** Validation message; also flips the field to the danger treatment. */
  error?: ReactNode;
}

/**
 * A skinned NATIVE `<select>` (not a custom listbox) — bulletproof
 * keyboard/mobile/AT behavior, zero focus-trap risk. The OS renders the option
 * panel; we skin the closed field with the shared sunken chrome + a `▾` glyph
 * affordance (pointer-events-none, ink). RHF-compatible (forwardRef via
 * ComponentPropsWithRef + name/onChange pass-through). For a styled popup list,
 * use RetroCombobox.
 */
export function RetroSelect({
  label,
  error,
  className = "",
  id: idProp,
  children,
  ...props
}: Readonly<RetroSelectProps>) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const errorId = `${id}-error`;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-sp-1 block text-12 font-bold uppercase tracking-8 text-fg-muted"
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`w-full appearance-none border-2 px-[10px] py-[7px] pr-[28px] font-body text-14 text-fg-ink bevel-sunken focus:outline-3 focus:outline-offset-1 focus:outline-titlebar-blue disabled:cursor-not-allowed disabled:opacity-50 ${
            error
              ? "border-danger bg-danger-bg"
              : "border-border-ink bg-bg-panel"
          } ${className}`}
          {...props}
        >
          {children}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-[10px] top-1/2 -translate-y-1/2 text-12 text-fg-ink"
        >
          ▾
        </span>
      </div>
      {error && (
        <p id={errorId} className="mt-sp-1 text-12 font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
