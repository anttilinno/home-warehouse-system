import Link from "next/link";
import { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    positive: boolean;
  };
  color?: "pink" | "green" | "purple" | "orange";
  className?: string;
  href?: string;
}

const colorMap = {
  pink: "bg-pink-100 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300",
  green: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  purple: "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300",
  orange: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
};

const iconBgMap = {
  pink: "bg-pink-200/60 dark:bg-pink-900/40",
  green: "bg-emerald-200/60 dark:bg-emerald-900/40",
  purple: "bg-violet-200/60 dark:bg-violet-900/40",
  orange: "bg-amber-200/60 dark:bg-amber-900/40",
};

const iconColorMap = {
  pink: "text-pink-600 dark:text-pink-400",
  green: "text-emerald-600 dark:text-emerald-400",
  purple: "text-violet-600 dark:text-violet-400",
  orange: "text-amber-600 dark:text-amber-400",
};

export function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  color,
  className,
  href,
}: StatsCardProps) {
  const MobileContent = (
    <div
      className={cn(
        "flex sm:hidden flex-col items-center gap-1 py-2",
        className
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl",
          color ? iconBgMap[color] : "bg-primary/10"
        )}
      >
        <Icon className={cn("h-5 w-5", color ? iconColorMap[color] : "text-primary")} />
      </div>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );

  const DesktopContent = (
    <div
      className={cn(
        "hidden sm:block rounded-2xl p-5 transition-all hover:shadow-md",
        href && "cursor-pointer hover:shadow-lg",
        color ? colorMap[color] : "bg-card text-card-foreground border",
        className
      )}
    >
      <p className="text-sm font-medium opacity-80 mb-2">
        {title}
      </p>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold">{value}</p>
          {trend && (
            <span
              className={cn(
                "text-xs font-medium",
                trend.positive ? "text-green-600 dark:text-green-400" : "text-red-500"
              )}
            >
              {trend.positive ? "+" : ""}
              {trend.value}%
            </span>
          )}
        </div>
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            color ? iconBgMap[color] : "bg-primary/10"
          )}
        >
          <Icon className={cn("h-6 w-6", color ? "" : "text-primary")} />
        </div>
      </div>
      {description && (
        <p className="text-xs opacity-70 mt-1">{description}</p>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {MobileContent}
        {DesktopContent}
      </Link>
    );
  }

  return (
    <>
      {MobileContent}
      {DesktopContent}
    </>
  );
}
