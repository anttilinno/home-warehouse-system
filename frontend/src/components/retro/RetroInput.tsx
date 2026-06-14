import { useId, type ComponentPropsWithRef, type ReactNode } from "react";

export interface RetroInputProps extends ComponentPropsWithRef<"input"> {
  label: ReactNode;
  /** Validation message; also flips the field to the danger treatment. */
  error?: ReactNode;
  /** Mono face for codes/emails (terminal nod, sketch 007). */
  mono?: boolean;
}

// Sunken (inverted-bevel) field with uppercase label and error state.
export function RetroInput({
  label,
  error,
  mono = false,
  className = "",
  id: idProp,
  ...props
}: RetroInputProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const errorId = `${id}-error`;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-sp-1 block text-[12px] font-bold uppercase tracking-[0.08em] text-fg-muted"
      >
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full border-2 px-[10px] py-[7px] text-[14px] text-fg-ink bevel-sunken focus:outline-3 focus:outline-offset-1 focus:outline-titlebar-blue ${
          mono ? "font-mono" : "font-body"
        } ${error ? "border-danger bg-danger-bg" : "border-border-ink bg-bg-panel"} ${className}`}
        {...props}
      />
      {error && (
        <p id={errorId} className="mt-sp-1 text-[12px] font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
