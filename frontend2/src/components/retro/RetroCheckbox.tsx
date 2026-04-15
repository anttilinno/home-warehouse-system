import {
  forwardRef,
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type Ref,
} from "react";

interface RetroCheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
  indeterminate?: boolean;
}

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (node: T | null) => {
    refs.forEach((r) => {
      if (!r) return;
      if (typeof r === "function") r(node);
      else (r as { current: T | null }).current = node;
    });
  };
}

const RetroCheckbox = forwardRef<HTMLInputElement, RetroCheckboxProps>(
  ({ label, error, indeterminate, className, ...rest }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = Boolean(indeterminate);
      }
    }, [indeterminate]);

    return (
      <label
        className={`inline-flex items-center gap-sm min-h-[44px] min-w-[44px] cursor-pointer ${
          className || ""
        }`}
      >
        <span
          className={`relative inline-block w-[24px] h-[24px] border-retro-thick ${
            error ? "border-retro-red" : "border-retro-ink"
          } bg-retro-cream peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-retro-amber`}
        >
          <input
            ref={mergeRefs(inputRef, ref)}
            type="checkbox"
            className="absolute inset-0 opacity-0 peer cursor-pointer"
            {...rest}
          />
          <span className="pointer-events-none absolute inset-1 hidden peer-checked:block bg-retro-amber" />
        </span>
        <span className="text-[16px] text-retro-ink">{label}</span>
      </label>
    );
  }
);

RetroCheckbox.displayName = "RetroCheckbox";

export { RetroCheckbox };
export type { RetroCheckboxProps };
