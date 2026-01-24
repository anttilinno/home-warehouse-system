"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import {
  LayoutDashboard,
  Package,
  MapPin,
  Box,
  FolderTree,
  HandCoins,
  Users,
  BarChart3,
  Settings,
  PackageX,
  FileUp,
  ShieldCheck,
  Clock,
  History,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { UserMenu } from "./user-menu";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { pendingChangesApi } from "@/lib/api";
import { pollingIntervals } from "@/lib/config/constants";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavClick?: () => void;
}

export function Sidebar({ collapsed, onToggle, onNavClick }: SidebarProps) {
  const t = useTranslations("dashboard.nav");
  const pathname = usePathname();
  const { workspaceId, currentMember } = useWorkspace();

  const [pendingCount, setPendingCount] = useState(0);
  const [myPendingCount, setMyPendingCount] = useState(0);

  // Check if user can view approvals (owner or admin)
  const canViewApprovals = currentMember?.role === "owner" || currentMember?.role === "admin";

  // Load pending count for admins/owners
  useEffect(() => {
    const loadPendingCount = async () => {
      if (!workspaceId || !canViewApprovals) return;

      try {
        const count = await pendingChangesApi.getPendingCount(workspaceId);
        setPendingCount(count);
      } catch (error) {
        // Silently fail - not critical
        console.error("Failed to load pending count:", error);
      }
    };

    loadPendingCount();

    // Refresh every 30 seconds
    const interval = setInterval(loadPendingCount, pollingIntervals.pendingCount);
    return () => clearInterval(interval);
  }, [workspaceId, canViewApprovals]);

  // Load my pending count for all users
  useEffect(() => {
    const loadMyPendingCount = async () => {
      if (!workspaceId) return;

      try {
        const count = await pendingChangesApi.getMyPendingCount(workspaceId);
        setMyPendingCount(count);
      } catch (error) {
        // Silently fail - not critical
        console.error("Failed to load my pending count:", error);
      }
    };

    loadMyPendingCount();

    // Refresh every 30 seconds
    const interval = setInterval(loadMyPendingCount, pollingIntervals.pendingCount);
    return () => clearInterval(interval);
  }, [workspaceId]);

  const navItems = [
    { icon: LayoutDashboard, label: t("dashboard"), href: "/dashboard" },
    { icon: Package, label: t("items"), href: "/dashboard/items" },
    { icon: MapPin, label: t("locations"), href: "/dashboard/locations" },
    { icon: Box, label: t("containers"), href: "/dashboard/containers" },
    { icon: FolderTree, label: t("categories"), href: "/dashboard/categories" },
    { icon: HandCoins, label: t("loans"), href: "/dashboard/loans" },
    { icon: Users, label: t("borrowers"), href: "/dashboard/borrowers" },
    { icon: BarChart3, label: t("analytics"), href: "/dashboard/analytics" },
    { icon: PackageX, label: t("outOfStock"), href: "/dashboard/out-of-stock" },
    { icon: FileUp, label: t("imports"), href: "/dashboard/imports" },
  ];

  // Add approvals link if user can view them
  if (canViewApprovals) {
    navItems.push({
      icon: ShieldCheck,
      label: t("approvals"),
      href: "/dashboard/approvals",
    });
  }

  // Add My Changes for all users
  navItems.push({
    icon: Clock,
    label: t("myChanges"),
    href: "/dashboard/my-changes",
  });

  // Add Sync History for all users
  navItems.push({
    icon: History,
    label: t("syncHistory"),
    href: "/dashboard/sync-history",
  });

  const bottomItems = [
    { icon: Settings, label: t("settings"), href: "/dashboard/settings" },
  ];

  const NavLink = ({
    item,
  }: {
    item: { icon: typeof LayoutDashboard; label: string; href: string };
  }) => {
    // For /dashboard, only match exactly. For other routes, also match child paths.
    const isActive = item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === item.href || pathname.startsWith(item.href + "/");
    const Icon = item.icon;
    const showApprovalsBadge = item.href === "/dashboard/approvals" && pendingCount > 0;
    const showMyChangesBadge = item.href === "/dashboard/my-changes" && myPendingCount > 0;
    const showBadge = showApprovalsBadge || showMyChangesBadge;
    const badgeCount = showApprovalsBadge ? pendingCount : myPendingCount;

    const link = (
      <Link
        href={item.href}
        onClick={onNavClick}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          collapsed && "justify-center px-2"
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1">{item.label}</span>
            {showBadge && (
              <Badge
                variant="secondary"
                className="h-5 min-w-5 px-1 text-xs bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30"
              >
                {badgeCount}
              </Badge>
            )}
          </>
        )}
        {collapsed && showBadge && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[10px] font-bold text-white">
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <div className="relative">{link}</div>
          </TooltipTrigger>
          <TooltipContent side="right">
            {item.label}
            {showBadge && ` (${badgeCount})`}
          </TooltipContent>
        </Tooltip>
      );
    }

    return link;
  };

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-card transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo - click to collapse */}
        <div
          className={cn(
            "flex h-16 items-center border-b px-4",
            collapsed && "justify-center px-2"
          )}
        >
          <button
            onClick={onToggle}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <span className="text-lg font-bold">Home Warehouse</span>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        {/* Bottom section */}
        <div className="border-t p-3 space-y-1">
          {bottomItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}

          {/* User menu */}
          <div
            className={cn(
              "pt-2",
              collapsed && "flex justify-center"
            )}
          >
            <UserMenu collapsed={collapsed} />
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
