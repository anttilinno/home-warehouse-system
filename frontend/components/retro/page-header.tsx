"use client";

import { cn } from "@/lib/utils";

interface RetroPageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function RetroPageHeader({
  title,
  subtitle,
  actions,
  className,
}: RetroPageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-8 bg-primary p-4 border-4 border-border retro-shadow",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white uppercase retro-heading">
            {title}
          </h1>
          {subtitle && (
            <p className="text-white/80 retro-small mt-1">&gt; {subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
