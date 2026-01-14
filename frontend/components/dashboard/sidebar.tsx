"use client";

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
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { UserMenu } from "./user-menu";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const t = useTranslations("dashboard.nav");
  const pathname = usePathname();

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
  ];

  const bottomItems = [
    { icon: Settings, label: t("settings"), href: "/dashboard/settings" },
  ];

  const NavLink = ({
    item,
  }: {
    item: { icon: typeof LayoutDashboard; label: string; href: string };
  }) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    const Icon = item.icon;

    const link = (
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          collapsed && "justify-center px-2"
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
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
