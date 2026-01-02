"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("themed-page-header", className)}>
      <div className="themed-page-header__top">
        <div className="themed-page-header__title-group">
          <h1 className="themed-page-header__title">{title}</h1>
          {subtitle && (
            <p className="themed-page-header__subtitle">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="themed-page-header__actions">{actions}</div>
        )}
      </div>
    </div>
  );
}
