import { forwardRef, type ButtonHTMLAttributes } from "react";

interface RetroButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "danger" | "neutral";
}

const variantClasses = {
  primary: "bg-retro-amber text-retro-ink hover:brightness-110",
  danger: "bg-retro-red text-white hover:brightness-110",
  neutral: "bg-retro-cream text-retro-ink hover:bg-retro-amber",
} as const;

const baseClasses =
  "h-[44px] px-md border-retro-thick border-retro-ink text-[14px] font-bold uppercase outline-2 outline-offset-2 outline-transparent focus-visible:outline-retro-amber";

const activeClasses =
  "shadow-retro-raised active:shadow-retro-pressed cursor-pointer";

const disabledClasses =
  "disabled:bg-retro-gray disabled:cursor-not-allowed disabled:shadow-none disabled:text-retro-cream";

const RetroButton = forwardRef<HTMLButtonElement, RetroButtonProps>(
  ({ variant = "neutral", className, children, disabled, ...props }, ref) => {
    const variantClass = variantClasses[variant];

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`${baseClasses} ${disabled ? "" : activeClasses} ${disabledClasses} ${variantClass} ${className || ""}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

RetroButton.displayName = "RetroButton";

export { RetroButton };
export type { RetroButtonProps };
