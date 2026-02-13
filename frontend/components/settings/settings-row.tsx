"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface SettingsRowProps {
  icon: LucideIcon;
  label: string;
  description: string;
  href: string;
  preview?: string;
}

export function SettingsRow({
  icon: Icon,
  label,
  description,
  href,
  preview,
}: SettingsRowProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-none">{label}</p>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      {preview && (
        <span className="hidden sm:block text-sm text-muted-foreground">
          {preview}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
