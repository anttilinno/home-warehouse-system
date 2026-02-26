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
  PackageX,
  FileUp,
  ShieldCheck,
  Clock,
  History,
  Trash2,
  ClipboardList,
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
import { PawPrint } from "@/components/shared/paw-print";
import { KittenMascot } from "@/components/shared/pet-mascots";

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
  const [logoWiggle, setLogoWiggle] = useState(false);

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
    { icon: ClipboardList, label: t("inventory"), href: "/dashboard/inventory" },
    { icon: MapPin, label: t("locations"), href: "/dashboard/locations" },
    { icon: Box, label: t("containers"), href: "/dashboard/containers" },
    { icon: FolderTree, label: t("categories"), href: "/dashboard/categories" },
    { icon: HandCoins, label: t("loans"), href: "/dashboard/loans" },
    { icon: Users, label: t("borrowers"), href: "/dashboard/borrowers" },
    { icon: BarChart3, label: t("analytics"), href: "/dashboard/analytics" },
    { icon: Trash2, label: t("declutter"), href: "/dashboard/declutter" },
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

  const bottomItems: { icon: typeof LayoutDashboard; label: string; href: string }[] = [];

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
          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          collapsed && "justify-center px-2"
        )}
      >
        <Icon className="h-5 w-5 shrink-0 transition-transform group-hover:animate-wiggle" />
        {!collapsed && (
          <>
            <span className="flex-1">{item.label}</span>
            {showBadge && (
              <Badge
                variant="secondary"
                className="h-5 min-w-5 px-1 text-xs bg-orange-400/20 text-orange-700 dark:text-orange-300 hover:bg-orange-400/30"
              >
                {badgeCount}
              </Badge>
            )}
          </>
        )}
        {collapsed && showBadge && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-400 text-[10px] font-bold text-white">
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
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-card transition-all duration-300 overflow-hidden",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Paw print watermark background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden -z-0">
          <PawPrint
            size={80}
            className="absolute -bottom-2 -right-4 text-primary opacity-[0.04] rotate-[-20deg]"
          />
          <PawPrint
            size={50}
            className="absolute top-1/3 -left-3 text-primary opacity-[0.03] rotate-[15deg]"
          />
          {!collapsed && (
            <PawPrint
              size={35}
              className="absolute top-2/3 right-6 text-primary opacity-[0.03] rotate-[40deg]"
            />
          )}
        </div>

        {/* Logo - click to collapse */}
        <div
          className={cn(
            "relative z-10 flex h-16 items-center border-b px-4",
            collapsed && "justify-center px-2"
          )}
        >
          <button
            onClick={onToggle}
            onMouseEnter={() => setLogoWiggle(true)}
            onAnimationEnd={() => setLogoWiggle(false)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
              <PawPrint
                size={20}
                className={`text-primary-foreground ${logoWiggle ? "animate-wiggle" : ""}`}
              />
            </div>
            {!collapsed && (
              <span className="text-lg font-bold font-[family-name:var(--font-quicksand)]">
                Home Warehouse
              </span>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="relative z-10 flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        {/* Bottom section */}
        <div className="relative z-10 p-3 space-y-1">
          {bottomItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}

          {/* Pet mascot */}
          {!collapsed && (
            <div className="flex justify-center py-2">
              <KittenMascot size={48} className="text-primary opacity-30" />
            </div>
          )}

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
