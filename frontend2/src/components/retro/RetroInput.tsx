import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

interface RetroInputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  error?: string;
}

const RetroInput = forwardRef<HTMLInputElement, RetroInputProps>(
  ({ icon, error, className, ...rest }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <span
            className="absolute left-sm top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <input
          ref={ref}
          className={`w-full h-[40px] border-retro-thick ${error ? "border-retro-red" : "border-retro-ink"} bg-retro-cream font-mono text-[14px] text-retro-ink placeholder:text-retro-gray ${icon ? "pl-[40px]" : "pl-sm"} pr-sm outline-2 outline-offset-2 outline-transparent focus:outline-retro-amber disabled:bg-retro-gray disabled:cursor-not-allowed ${className || ""}`}
          {...rest}
        />
        {error && (
          <p className="text-retro-red text-[12px] mt-xs">{error}</p>
        )}
      </div>
    );
  }
);

RetroInput.displayName = "RetroInput";

export { RetroInput };
export type { RetroInputProps };
