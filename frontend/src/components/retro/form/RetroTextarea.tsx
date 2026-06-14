import { useId, type ComponentPropsWithRef, type ReactNode } from "react";

export interface RetroTextareaProps
  extends ComponentPropsWithRef<"textarea"> {
  label: ReactNode;
  /** Validation message; also flips the field to the danger treatment. */
  error?: ReactNode;
  /** Mono face (Plex Mono) for code/notes, mirroring RetroInput's `mono`. */
  mono?: boolean;
}

/**
 * Sunken multi-line field, same chrome as RetroInput. `min-h-[88px] resize-y`.
 * RHF-compatible (forwardRef + name/onChange pass-through). Error flips to the
 * shared danger treatment.
 */
export function RetroTextarea({
  label,
  error,
  mono = false,
  className = "",
  id: idProp,
  ...props
}: RetroTextareaProps) {
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
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`min-h-[88px] w-full resize-y border-2 px-[10px] py-[7px] text-[14px] text-fg-ink bevel-sunken focus:outline-3 focus:outline-offset-1 focus:outline-titlebar-blue disabled:cursor-not-allowed disabled:opacity-50 ${
          mono ? "font-mono" : "font-body"
        } ${
          error ? "border-danger bg-danger-bg" : "border-border-ink bg-bg-panel"
        } ${className}`}
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
