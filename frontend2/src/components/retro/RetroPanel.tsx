import { forwardRef, type ReactNode } from "react";
import { HazardStripe } from "./HazardStripe";

interface RetroPanelProps {
  title?: string;
  showClose?: boolean;
  onClose?: () => void;
  showHazardStripe?: boolean;
  className?: string;
  children: ReactNode;
}

const RetroPanel = forwardRef<HTMLDivElement, RetroPanelProps>(
  (
    { title, showClose, onClose, showHazardStripe, className, children },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`bg-retro-cream border-retro-thick border-retro-ink shadow-retro-raised p-lg relative ${className || ""}`}
      >
        {showClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-sm right-sm w-[24px] h-[24px] bg-retro-red border-retro-thick border-retro-ink flex items-center justify-center text-white text-[12px] font-bold leading-none cursor-pointer hover:brightness-110"
          >
            X
          </button>
        )}
        {showHazardStripe && <HazardStripe className="mb-md" />}
        {title && (
          <h2 className="text-[20px] font-bold uppercase text-retro-ink mb-md">
            {title}
          </h2>
        )}
        {children}
      </div>
    );
  }
);

RetroPanel.displayName = "RetroPanel";

export { RetroPanel };
export type { RetroPanelProps };
