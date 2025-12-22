"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import type * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";

type IconName = keyof typeof LucideIcons;

interface AlertCardProps {
  iconName: IconName;
  title: string;
  count: number;
  variant: "warning" | "destructive" | "info";
  href: string;
}

const variantStyles = {
  warning: "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200",
  destructive: "border-l-red-500 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200",
  info: "border-l-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200",
};

export function AlertCard({ iconName, title, count, variant, href }: AlertCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "p-4 rounded-lg border-l-4 flex items-center gap-3 transition-opacity hover:opacity-80 w-full sm:w-56",
        variantStyles[variant]
      )}
    >
      <Icon name={iconName} className="w-5 h-5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xl font-bold">{count}</p>
      </div>
    </Link>
  );
}
