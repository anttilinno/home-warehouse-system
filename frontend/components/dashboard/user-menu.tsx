"use client";

import { Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/contexts/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

interface UserMenuProps {
  collapsed?: boolean;
}

export function UserMenu({ collapsed = false }: UserMenuProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        className={cn(
          "relative h-auto p-2 rounded-lg flex items-center",
          collapsed ? "w-10 justify-center" : "w-full justify-start gap-3"
        )}
      >
        <Skeleton className="h-8 w-8 rounded-full" />
        {!collapsed && (
          <div className="flex flex-col gap-1 items-start">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-2 w-24" />
          </div>
        )}
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const initials = user.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <Link
      href="/dashboard/settings"
      className={cn(
        "group relative flex items-center rounded-lg p-2 transition-all duration-200",
        "hover:bg-muted active:scale-[0.97]",
        collapsed ? "w-10 justify-center" : "w-full gap-3"
      )}
    >
      <div className="relative">
        <Avatar className="h-8 w-8 ring-2 ring-transparent transition-all duration-200 group-hover:ring-primary/20">
          <AvatarImage
            src={user.avatar_url || undefined}
            alt={user.full_name}
          />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-card p-[2px]">
          <Settings className="h-3 w-3 text-muted-foreground transition-transform duration-300 group-hover:rotate-90" />
        </div>
      </div>
      {!collapsed && (
        <div className="flex flex-col items-start text-left min-w-0">
          <span className="text-sm font-medium truncate max-w-[140px]">
            {user.full_name}
          </span>
          <span className="text-xs text-muted-foreground truncate max-w-[140px]">
            {user.email}
          </span>
        </div>
      )}
    </Link>
  );
}
