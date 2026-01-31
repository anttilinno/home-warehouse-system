"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  /** Section title displayed in trigger */
  title: string;
  /** Optional description below title */
  description?: string;
  /** Whether section starts expanded */
  defaultOpen?: boolean;
  /** Section content */
  children: React.ReactNode;
  /** Additional classes for container */
  className?: string;
}

export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  children,
  className,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn("space-y-2", className)}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between rounded-lg border p-4",
            "min-h-[44px] touch-manipulation", // 44px touch target (FORM-03)
            "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "transition-colors"
          )}
          aria-expanded={isOpen}
        >
          <div className="text-left">
            <h3 className="text-base font-medium">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 px-1 pt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
