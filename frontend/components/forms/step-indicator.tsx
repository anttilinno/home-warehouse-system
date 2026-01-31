"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Step {
  id: string;
  title: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (index: number) => void;
  /** Allow clicking to navigate to completed steps */
  allowNavigation?: boolean;
  className?: string;
}

export function StepIndicator({
  steps,
  currentStep,
  onStepClick,
  allowNavigation = false,
  className,
}: StepIndicatorProps) {
  return (
    <nav aria-label="Progress" className={className}>
      <ol className="flex items-center gap-2" role="list">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = allowNavigation && isCompleted && onStepClick;

          return (
            <li key={step.id} className="flex items-center">
              {index > 0 && (
                <div
                  className={cn(
                    "h-0.5 w-6 sm:w-10 mx-1",
                    isCompleted ? "bg-primary" : "bg-muted"
                  )}
                  aria-hidden="true"
                />
              )}

              <button
                type="button"
                className={cn(
                  "flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md",
                  "min-h-[44px] min-w-[44px] touch-manipulation",
                  isClickable ? "cursor-pointer" : "cursor-default"
                )}
                onClick={() => isClickable && onStepClick(index)}
                disabled={!isClickable}
                aria-current={isCurrent ? "step" : undefined}
              >
                {/* Step number/check circle */}
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium shrink-0",
                    isCurrent && "bg-primary text-primary-foreground",
                    isCompleted && "bg-primary/20 text-primary",
                    !isCurrent && !isCompleted && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </span>

                {/* Step title - hidden on very small screens */}
                <span
                  className={cn(
                    "text-sm hidden sm:inline",
                    isCurrent && "font-medium text-foreground",
                    isCompleted && "text-primary",
                    !isCurrent && !isCompleted && "text-muted-foreground"
                  )}
                >
                  {step.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
