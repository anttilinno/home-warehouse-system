"use client";

import { cn } from "@/lib/utils";

export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className={cn(
          "fixed left-4 top-4 z-50",
          "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        )}
      >
        Skip to main content
      </a>
      <a
        href="#navigation"
        className={cn(
          "fixed left-4 top-16 z-50",
          "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        )}
      >
        Skip to navigation
      </a>
    </div>
  );
}
