"use client";

import { useState, useEffect } from "react";
import { Link, usePathname, useRouter } from "@/navigation";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/icons";
import type * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { notificationsApi } from "@/lib/api";

type IconName = keyof typeof LucideIcons;

interface SidebarProps {
  className?: string;
}

type NavItem = { type: 'item'; name: string; href: string; iconName: IconName };
type NavGroup = { type: 'group'; name: string; iconName: IconName; items: Omit<NavItem, 'type'>[] };
type NavEntry = NavItem | NavGroup;

export function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
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

  const navigationItems: NavEntry[] = [
    {
      type: 'item',
      name: t('dashboard'),
      href: "/dashboard",
      iconName: "Home",
    },
    {
      type: 'item',
      name: t('favorites'),
      href: "/dashboard/favorites",
      iconName: "Star",
    },
    {
      type: 'item',
      name: t('inventory'),
      href: "/dashboard/inventory",
      iconName: "Package",
    },
    {
      type: 'group',
      name: t('catalog'),
      iconName: "Layers",
      items: [
        { name: t('items'), href: "/dashboard/items", iconName: "Tag" },
        { name: t('categories'), href: "/dashboard/categories", iconName: "Archive" },
      ],
    },
    {
      type: 'group',
      name: t('storage'),
      iconName: "Warehouse",
      items: [
        { name: t('locations'), href: "/dashboard/locations", iconName: "MapPin" },
        { name: t('containers'), href: "/dashboard/containers", iconName: "Box" },
      ],
    },
    {
      type: 'group',
      name: t('loansGroup'),
      iconName: "HandCoins",
      items: [
        { name: t('loans'), href: "/dashboard/loans", iconName: "HandCoins" },
        { name: t('borrowers'), href: "/dashboard/borrowers", iconName: "Contact" },
      ],
    },
    {
      type: 'item',
      name: t('analytics'),
      href: "/dashboard/analytics",
      iconName: "BarChart3",
    },
    {
      type: 'item',
      name: t('import'),
      href: "/dashboard/import",
      iconName: "Upload",
    },
    {
      type: 'item',
      name: t('settings'),
      href: "/dashboard/settings",
      iconName: "Settings",
    },
  ];

  // Auto-expand group containing active page
  useEffect(() => {
    for (const entry of navigationItems) {
      if (entry.type === 'group') {
        const hasActiveChild = entry.items.some(item => pathname === item.href);
        if (hasActiveChild) {
          setExpandedGroups(prev => new Set(prev).add(entry.name));
          break;
        }
      }
    }
  }, [pathname]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

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
        "flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center border-b-2 border-border min-h-[61px]",
        isCollapsed ? "justify-center p-2" : "p-4 gap-3"
      )}>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="w-10 h-10 bg-primary shadow-sm flex items-center justify-center text-primary-foreground text-2xl border-2 border-foreground font-bold">
            H
          </div>
          {!isCollapsed && (
            <h1 className="text-3xl font-bold text-foreground tracking-wide">HMS</h1>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 overflow-y-auto">
        <ul className="space-y-1">
          {navigationItems.map((entry) => {
            if (entry.type === 'item') {
              const isActive = pathname === entry.href;

              return (
                <li key={entry.name}>
                  <Link
                    href={entry.href}
                    className={cn(
                      "flex items-center rounded-md text-sm font-medium transition-colors hover:bg-muted min-h-[40px]",
                      isCollapsed ? "justify-center px-2" : "gap-3 px-3",
                      "py-2",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/90"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon name={entry.iconName} className="w-4 h-4 flex-shrink-0" />
                    {!isCollapsed && <span>{entry.name}</span>}
                  </Link>
                </li>
              );
            }

            // Group
            const isExpanded = expandedGroups.has(entry.name);
            const hasActiveChild = entry.items.some(item => pathname === item.href);

            return (
              <li key={entry.name}>
                <button
                  onClick={() => {
                    if (isCollapsed) {
                      setIsCollapsed(false);
                      setExpandedGroups(prev => new Set(prev).add(entry.name));
                    } else {
                      toggleGroup(entry.name);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center rounded-md text-sm font-medium transition-colors hover:bg-muted min-h-[40px]",
                    isCollapsed ? "justify-center px-2" : "gap-3 px-3",
                    "py-2",
                    hasActiveChild
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon name={entry.iconName} className="w-4 h-4 flex-shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 text-left">{entry.name}</span>
                      <Icon
                        name="ChevronRight"
                        className={cn(
                          "w-4 h-4 transition-transform duration-200",
                          isExpanded && "rotate-90"
                        )}
                      />
                    </>
                  )}
                </button>
                {!isCollapsed && isExpanded && (
                  <ul className="mt-1 space-y-1">
                    {entry.items.map((item) => {
                      const isActive = pathname === item.href;

                      return (
                        <li key={item.name}>
                          <Link
                            href={item.href}
                            className={cn(
                              "flex items-center rounded-md text-sm font-medium transition-colors hover:bg-muted min-h-[36px]",
                              "gap-3 pl-7 pr-3 py-1.5",
                              isActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/90"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <Icon name={item.iconName} className="w-4 h-4 flex-shrink-0" />
                            <span>{item.name}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t-2 border-border bg-background">
        <div className="relative">
          <button
            onClick={() => !isCollapsed && setIsUserMenuOpen(!isUserMenuOpen)}
            className={cn(
              "w-full flex items-center py-4 hover:bg-muted transition-colors",
              isCollapsed ? "justify-center px-2" : "gap-3 px-4"
            )}
            disabled={isCollapsed}
          >
            <div className="relative">
              <div className="w-10 h-10 bg-primary shadow-sm flex items-center justify-center flex-shrink-0 text-primary-foreground text-xl border-2 border-foreground font-bold">
                {user ? getUserInitials(user.full_name) : '?'}
              </div>
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white text-[10px] font-bold flex items-center justify-center border-2 border-foreground shadow-sm">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-bold text-foreground truncate">
                    {user?.full_name || 'User'}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate uppercase tracking-tight">
                    {user?.email || ''}
                  </p>
                </div>
                <Icon name="ChevronDown" className="w-5 h-5 text-muted-foreground" />
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
                <Icon name="User" className="w-4 h-4" />
                <span>{t('profile')}</span>
              </Link>
              <Link
                href="/dashboard/notifications"
                onClick={() => setIsUserMenuOpen(false)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <Icon name="Bell" className="w-4 h-4" />
                <span>{t('notifications')}</span>
              </Link>
              <Link
                href="/dashboard/export"
                onClick={() => setIsUserMenuOpen(false)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <Icon name="Download" className="w-4 h-4" />
                <span>{t('export')}</span>
              </Link>
              <button
                onClick={() => {
                  logout();
                  router.push("/login");
                  setIsUserMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <Icon name="LogOut" className="w-4 h-4" />
                <span>{t('logout')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}