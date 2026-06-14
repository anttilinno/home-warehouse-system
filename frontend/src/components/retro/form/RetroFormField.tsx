import { useId, type ReactNode } from "react";

export interface RetroFormFieldProps {
  /** Field label — 12px UPPERCASE, wired to the control via htmlFor/id. */
  label: ReactNode;
  /** Optional hint shown below the control when no error is present. */
  hint?: ReactNode;
  /** Validation message; replaces the hint and flips the control via aria-describedby. */
  error?: ReactNode;
  /** Renders an ink `*` required marker after the label. */
  required?: boolean;
  /**
   * The control. Receives the generated control `id` and the error
   * `aria-describedby` id (or `undefined` when there is no error) so the child
   * can wire `id`, `aria-describedby`, and `aria-invalid` itself (RHF-friendly).
   */
  children: (id: string, describedBy: string | undefined) => ReactNode;
}

/**
 * Label / hint / error wrapper generalizing the inline RetroInput layout for
 * Select / Combobox / Textarea / FileInput. In-window error treatment per
 * sketch 007: a ✕-prefixed `text-danger` line replaces the hint. The required
 * marker is ink (not red) — color is reserved for the actual error.
 */
export function RetroFormField({
  label,
  hint,
  error,
  required = false,
  children,
}: RetroFormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : undefined;

  return (
    <div className="flex flex-col gap-sp-1">
      <label
        htmlFor={id}
        className="text-[12px] font-bold uppercase tracking-[0.08em] text-fg-muted"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="ml-sp-1 text-fg-ink">
            *
          </span>
        )}
      </label>
      {children(id, describedBy)}
      {error ? (
        <p id={errorId} className="text-[12px] font-semibold text-danger">
          <span aria-hidden="true">✕ </span>
          {error}
        </p>
      ) : (
        hint && (
          <p className="text-[12px] font-body text-fg-muted">{hint}</p>
        )
      )}
    </div>
  );
}
