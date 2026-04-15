import { forwardRef, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { HazardStripe } from "./HazardStripe";

interface RetroEmptyStateProps {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  showHazardStripe?: boolean;
  className?: string;
}

const RetroEmptyState = forwardRef<HTMLDivElement, RetroEmptyStateProps>(
  ({ title, body, action, showHazardStripe, className }, ref) => {
    const { t } = useLingui();
    return (
      <div
        ref={ref}
        className={`border-retro-thick border-retro-ink bg-retro-cream shadow-retro-raised p-3xl flex flex-col items-center text-center gap-lg ${className || ""}`}
      >
        {showHazardStripe && <HazardStripe className="w-full mb-md" />}
        <h2 className="text-[20px] font-bold uppercase text-retro-ink">
          {title}
        </h2>
        <div className="text-[16px] text-retro-ink">
          {body ?? t`Create your first entry to populate this list.`}
        </div>
        {action && <div>{action}</div>}
      </div>
    );
  }
);

RetroEmptyState.displayName = "RetroEmptyState";

export { RetroEmptyState };
export type { RetroEmptyStateProps };
