import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from "react";

export interface RetroCheckboxProps
  extends Omit<ComponentPropsWithRef<"input">, "type"> {
  label: ReactNode;
  /** Partial-selection dash state (e.g. a table header select-all). */
  indeterminate?: boolean;
}

/**
 * System-7 square checkbox: a 16×16 visual box driven by an `sr-only` native
 * checkbox (native semantics + a11y). The visual box is `aria-hidden`; the
 * whole label is the click target (≥24px hit area). Checked = pressed-bevel
 * blue with a centered ink `✓`; indeterminate = an ink `–` dash on panel-2.
 * RHF-compatible (forwardRef + name/onChange pass-through).
 */
export function RetroCheckbox({
  label,
  indeterminate = false,
  checked,
  defaultChecked,
  className = "",
  ref,
  onChange,
  ...props
}: Readonly<RetroCheckboxProps>) {
  const innerRef = useRef<HTMLInputElement>(null);
  // Mirror the native checked state so the visual box stays correct whether the
  // checkbox is controlled (`checked` prop) or uncontrolled (RHF/native).
  const [internalChecked, setInternalChecked] = useState(
    checked ?? defaultChecked ?? false,
  );

  // Native checkboxes carry the indeterminate flag only via the DOM property.
  useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const setRefs = (node: HTMLInputElement | null) => {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  const isChecked = checked ?? internalChecked;
  const boxState = indeterminate
    ? "border-border-ink bg-bg-panel-2"
    : isChecked
      ? "border-border-ink bg-titlebar-blue bevel-pressed"
      : "border-border-ink bg-bg-panel bevel-sunken";

  return (
    <label
      className={`inline-flex min-h-[24px] cursor-pointer items-center gap-sp-1 text-14 text-fg-ink has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 ${className}`}
    >
      <input
        ref={setRefs}
        type="checkbox"
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={(e) => {
          setInternalChecked(e.target.checked);
          onChange?.(e);
        }}
        className="sr-only"
        {...props}
      />
      <span
        aria-hidden="true"
        className={`flex h-[16px] w-[16px] flex-none items-center justify-center border-2 text-12 leading-none text-fg-ink ${boxState}`}
      >
        {indeterminate ? "–" : isChecked ? "✓" : ""}
      </span>
      <span>{label}</span>
    </label>
  );
}
