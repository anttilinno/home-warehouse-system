"use client";

import { useState, useEffect } from "react";
import { Link, usePathname, useRouter } from "@/navigation";
import { useTranslations } from "next-intl";
import {
  Package,
  MapPin,
  Users,
  Settings,
  Menu,
  X,
  Home,
  BarChart3,
  Archive,
  User,
  LogOut,
  ChevronUp,
  ChevronDown,
  Box,
  Tag,
  HandCoins,
  Contact,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { notificationsApi } from "@/lib/api";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('nav');
  const { logout, user, isAuthenticated } = useAuth();

  // Fetch unread notification count
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchUnreadCount = async () => {
      try {
        const response = await notificationsApi.getUnreadCount();
        setUnreadCount(response.unread_count);
      } catch (error) {
        console.error("Failed to fetch unread count:", error);
      }
    };

    fetchUnreadCount();
    // Poll every 60 seconds for new notifications
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const navigationItems = [
    {
      name: t('dashboard'),
      href: "/dashboard",
      icon: Home,
    },
    {
      name: t('inventory'),
      href: "/dashboard/inventory",
      icon: Package,
    },
    {
      name: t('locations'),
      href: "/dashboard/locations",
      icon: MapPin,
    },
    {
      name: t('containers'),
      href: "/dashboard/containers",
      icon: Box,
    },
    {
      name: t('items'),
      href: "/dashboard/items",
      icon: Tag,
    },
    {
      name: t('borrowers'),
      href: "/dashboard/borrowers",
      icon: Contact,
    },
    {
      name: t('loans'),
      href: "/dashboard/loans",
      icon: HandCoins,
    },
    {
      name: t('categories'),
      href: "/dashboard/categories",
      icon: Archive,
    },
    {
      name: t('analytics'),
      href: "/dashboard/analytics",
      icon: BarChart3,
    },
    {
      name: t('settings'),
      href: "/dashboard/settings",
      icon: Settings,
    },
  ];

  // Get user initials for avatar
  const getUserInitials = (fullName: string | undefined | null) => {
    if (!fullName) return '?';
    return fullName
      .split(' ')
      .map(name => name.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-card border-r border-border transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center border-b border-border min-h-[61px]",
        isCollapsed ? "justify-center p-2" : "p-4"
      )}>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
        >
          <Package className="w-5 h-5 text-primary" />
          {!isCollapsed && (
            <h2 className="text-lg font-semibold text-foreground">HMS</h2>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-md text-sm font-medium transition-colors hover:bg-muted min-h-[40px]",
                    isCollapsed ? "justify-center px-2" : "gap-3 px-3",
                    "py-2",
                    isActive
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!isCollapsed && <span>{item.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border">
        <div className="relative">
          <button
            onClick={() => !isCollapsed && setIsUserMenuOpen(!isUserMenuOpen)}
            className={cn(
              "w-full flex items-center py-2 hover:bg-muted transition-colors",
              isCollapsed ? "justify-center px-2" : "gap-3 px-3"
            )}
            disabled={isCollapsed}
          >
            <div className="relative">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-primary-foreground">
                  {user ? getUserInitials(user.full_name) : '?'}
                </span>
              </div>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email || ''}
                  </p>
                </div>
                {isUserMenuOpen ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </>
            )}
          </button>

          {/* User Menu Dropdown */}
          {!isCollapsed && isUserMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-card border border-border rounded-md shadow-lg">
              <Link
                href="/dashboard/profile"
                onClick={() => setIsUserMenuOpen(false)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <User className="w-4 h-4" />
                <span>{t('profile')}</span>
              </Link>
              <Link
                href="/dashboard/notifications"
                onClick={() => setIsUserMenuOpen(false)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <Bell className="w-4 h-4" />
                <span>{t('notifications')}</span>
              </Link>
              <button
                onClick={() => {
                  logout();
                  router.push("/login");
                  setIsUserMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('logout')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}