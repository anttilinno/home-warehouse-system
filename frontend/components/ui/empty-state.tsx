import { memo } from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: React.ReactNode;
  className?: string;
}

export const EmptyState = memo(function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("py-12 text-center", className)}>
      {Icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}

      <h3 className="mb-2 text-lg font-semibold">{title}</h3>

      {description && (
        <p className="mb-4 text-sm text-muted-foreground max-w-md mx-auto">
          {description}
        </p>
      )}

      {children && (
        <div className="mb-6 space-y-2 text-sm text-muted-foreground max-w-lg mx-auto">
          {children}
        </div>
      )}

      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
});

interface EmptyStateListProps {
  items: string[];
  className?: string;
}

export const EmptyStateList = memo(function EmptyStateList({ items, className }: EmptyStateListProps) {
  return (
    <ul className={cn("space-y-2 text-left inline-block", className)}>
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-2">
          <span className="text-primary mt-0.5">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
});

interface EmptyStateBenefitsProps {
  benefits: string[];
  className?: string;
}

export const EmptyStateBenefits = memo(function EmptyStateBenefits({ benefits, className }: EmptyStateBenefitsProps) {
  return (
    <ul className={cn("space-y-2 text-left inline-block", className)}>
      {benefits.map((benefit, index) => (
        <li key={index} className="flex items-start gap-2">
          <span className="text-green-500 dark:text-green-400 mt-0.5">✓</span>
          <span>{benefit}</span>
        </li>
      ))}
    </ul>
  );
});
