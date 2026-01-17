import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhotoPlaceholderProps {
  /**
   * Size variant for the placeholder
   */
  size?: "sm" | "md" | "lg" | "xl";
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Accessible label for screen readers
   */
  ariaLabel?: string;
}

const sizeClasses = {
  sm: "h-12 w-12",
  md: "h-24 w-24",
  lg: "h-48 w-48",
  xl: "h-64 w-64",
};

const iconSizeClasses = {
  sm: "h-6 w-6",
  md: "h-12 w-12",
  lg: "h-24 w-24",
  xl: "h-32 w-32",
};

/**
 * PhotoPlaceholder component
 *
 * Displays a placeholder icon for items without photos.
 * Supports multiple sizes and consistent styling with photo components.
 */
export function PhotoPlaceholder({
  size = "md",
  className,
  ariaLabel = "No photo available",
}: PhotoPlaceholderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg bg-muted",
        sizeClasses[size],
        className
      )}
      role="img"
      aria-label={ariaLabel}
    >
      <Package
        className={cn(
          "text-muted-foreground",
          iconSizeClasses[size]
        )}
        aria-hidden="true"
      />
    </div>
  );
}
