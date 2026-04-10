import { forwardRef, type ReactNode } from "react";

interface RetroCardProps {
  className?: string;
  children: ReactNode;
}

const RetroCard = forwardRef<HTMLDivElement, RetroCardProps>(
  ({ className, children }, ref) => {
    return (
      <div
        ref={ref}
        className={`border-retro-thick border-retro-ink bg-retro-cream shadow-retro-raised p-md ${className || ""}`}
      >
        {children}
      </div>
    );
  }
);

RetroCard.displayName = "RetroCard";

export { RetroCard };
export type { RetroCardProps };
