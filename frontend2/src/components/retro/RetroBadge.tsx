import type { ReactNode } from "react";

interface RetroBadgeProps {
  variant?: "neutral" | "success" | "danger" | "warning" | "info";
  className?: string;
  children: ReactNode;
}

const variantClasses = {
  neutral: "bg-retro-gray text-white",
  success: "bg-retro-green text-white",
  danger: "bg-retro-red text-white",
  warning: "bg-retro-amber text-retro-ink",
  info: "bg-retro-blue text-white",
} as const;

function RetroBadge({
  variant = "neutral",
  className,
  children,
}: RetroBadgeProps) {
  return (
    <span
      className={`inline-flex items-center border-retro-thick border-retro-ink text-[12px] font-bold uppercase py-[2px] px-sm leading-[1.2] ${variantClasses[variant]} ${className || ""}`}
    >
      {children}
    </span>
  );
}

export { RetroBadge };
export type { RetroBadgeProps };
