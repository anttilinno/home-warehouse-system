import * as React from "react";
import { cn } from "@/lib/utils";

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

/**
 * Kbd component for displaying keyboard shortcuts in a visually consistent way
 *
 * @example
 * ```tsx
 * <Kbd>Ctrl</Kbd>
 * <Kbd>K</Kbd>
 * ```
 */
export function Kbd({ children, className, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100",
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
