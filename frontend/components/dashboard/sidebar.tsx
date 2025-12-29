"use client";

import { useState, useEffect, useRef } from "react";
import { Link, usePathname, useRouter } from "@/navigation";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/icons";
import type * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { notificationsApi } from "@/lib/api";
import { useTheme } from "next-themes";
import { NES_GREEN, NES_BLUE, NES_RED } from "@/lib/nes-colors";

type IconName = keyof typeof LucideIcons;

interface SidebarProps {
  className?: string;
}

type NavItem = { type: 'item'; name: string; href: string; iconName: IconName };
type NavDivider = { type: 'divider'; label: string };
type NavGroup = { type: 'group'; name: string; iconName: IconName; items: Omit<NavItem, 'type'>[] };
type NavEntry = NavItem | NavGroup | NavDivider;

export function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('nav');
  const { logout, user, isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const isRetro = theme?.startsWith("retro");
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu when clicking outside
  useEffect(() => {
    if (!isUserMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isUserMenuOpen]);

  // NES color constants (Tailwind can't resolve CSS vars in arbitrary values)

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
    { type: 'divider', label: 'Library' },
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
    { type: 'divider', label: 'System' },
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

  // Retro NES-style sidebar
  if (isRetro) {
    return (
      <div
        className={cn(
          "flex flex-col h-full bg-sidebar border-r-4 border-border transition-all duration-300",
          isCollapsed ? "w-16" : "w-72",
          className
        )}
      >
        {/* Header - Red background with HMS logo */}
        <div className={cn(
          "flex items-center border-b-4 border-border bg-primary text-white min-h-[64px]",
          isCollapsed ? "justify-center p-2" : "p-4 gap-4"
        )}>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-4 hover:opacity-80 transition-opacity"
          >
            <div className="w-12 h-12 bg-white flex items-center justify-center border-4 border-border retro-shadow">
              <Icon name="Gamepad2" className="w-6 h-6 text-foreground" />
            </div>
            {!isCollapsed && (
              <span className="text-lg font-bold tracking-tight pt-1 font-[family-name:var(--font-nes)]">HMS</span>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto space-y-2">
          {navigationItems.map((entry, index) => {
            if (entry.type === 'divider') {
              if (isCollapsed) return null;
              return (
                <div key={`divider-${index}`} className="pt-4 pb-2 px-4 flex items-center gap-2">
                  <div className="h-[2px] flex-1 bg-foreground/20" />
                  <p className="retro-small text-muted-foreground uppercase font-bold font-[family-name:var(--font-nes)]">{entry.label}</p>
                  <div className="h-[2px] flex-1 bg-foreground/20" />
                </div>
              );
            }

            if (entry.type === 'item') {
              const isActive = pathname === entry.href;

              return (
                <Link
                  key={entry.name}
                  href={entry.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 transition-all relative",
                    isCollapsed && "justify-center px-2",
                    isActive
                      ? "bg-card border-4 border-border retro-shadow"
                      : "border-4 border-transparent hover:bg-card hover:border-border hover:retro-shadow"
                  )}
                >
                  {isActive && !isCollapsed && (
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-primary" />
                  )}
                  <Icon
                    name={entry.iconName}
                    className={cn(
                      "w-5 h-5 flex-shrink-0",
                      isActive ? "text-foreground" : "text-muted-foreground"
                    )}
                  />
                  {!isCollapsed && (
                    <span className={cn(
                      "retro-small uppercase font-bold font-[family-name:var(--font-nes)]",
                      isActive ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {entry.name}
                    </span>
                  )}
                </Link>
              );
            }

            // Group
            const isExpanded = expandedGroups.has(entry.name);
            const hasActiveChild = entry.items.some(item => pathname === item.href);

            return (
              <div key={entry.name}>
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
                    "w-full flex items-center gap-3 px-4 py-2 transition-all",
                    isCollapsed && "justify-center px-2",
                    "border-4 border-transparent hover:bg-card hover:border-border hover:retro-shadow"
                  )}
                >
                  <Icon
                    name={entry.iconName}
                    className={cn(
                      "w-5 h-5 flex-shrink-0",
                      hasActiveChild ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  {!isCollapsed && (
                    <>
                      <span className={cn(
                        "flex-1 text-left retro-small uppercase font-bold pt-0.5 font-[family-name:var(--font-nes)]",
                        hasActiveChild ? "text-primary" : "text-muted-foreground"
                      )}>
                        {entry.name}
                      </span>
                      <Icon
                        name="ChevronRight"
                        className={cn(
                          "w-4 h-4 transition-transform duration-200 text-muted-foreground",
                          isExpanded && "rotate-90"
                        )}
                      />
                    </>
                  )}
                </button>
                {!isCollapsed && isExpanded && (
                  <div className="mt-1 space-y-1 ml-2">
                    {entry.items.map((item) => {
                      const isActive = pathname === item.href;

                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 px-4 py-2 transition-all relative",
                            isActive
                              ? "bg-card border-4 border-border retro-shadow"
                              : "border-4 border-transparent hover:bg-card hover:border-border hover:retro-shadow"
                          )}
                        >
                          {isActive && (
                            <div className="absolute left-0 top-0 bottom-0 w-2 bg-primary" />
                          )}
                          <Icon
                            name={item.iconName}
                            className={cn(
                              "w-4 h-4 flex-shrink-0",
                              isActive ? "text-foreground" : "text-muted-foreground"
                            )}
                          />
                          <span className={cn(
                            "retro-small uppercase font-bold pt-0.5 font-[family-name:var(--font-nes)]",
                            isActive ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {item.name}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer - User area */}
        <div className="border-t-4 border-border bg-card p-4">
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => !isCollapsed && setIsUserMenuOpen(!isUserMenuOpen)}
              className={cn(
                "w-full flex items-center p-2 hover:bg-muted transition-colors border-2 border-transparent hover:border-border",
                isCollapsed ? "justify-center" : "gap-3"
              )}
              disabled={isCollapsed}
            >
              <div className="relative">
                <div
                  className="w-10 h-10 text-white text-xs font-bold flex items-center justify-center border-4 border-border font-[family-name:var(--font-nes)]"
                  style={{ backgroundColor: NES_BLUE }}
                >
                  P1
                </div>
                {unreadCount > 0 && (
                  <div className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-white text-xs flex items-center justify-center font-bold border-2 border-card font-[family-name:var(--font-nes)]">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </div>
                )}
              </div>
              {!isCollapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="retro-small font-bold truncate pt-1 font-[family-name:var(--font-nes)] uppercase">
                      {user?.full_name || 'Player 1'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate font-[family-name:var(--font-pixel)]">
                      LVL 99 USER
                    </p>
                  </div>
                  <Icon name="ChevronUp" className="w-5 h-5 text-foreground" />
                </>
              )}
            </button>

            {/* User Menu Dropdown */}
            {!isCollapsed && isUserMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-card border-4 border-border retro-shadow">
                <Link
                  href="/dashboard/profile"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2 retro-small uppercase font-bold hover:bg-muted transition-colors border-b-2 border-dashed border-muted font-[family-name:var(--font-nes)]"
                >
                  <Icon name="User" className="w-4 h-4" />
                  <span className="pt-0.5">{t('profile')}</span>
                </Link>
                <Link
                  href="/dashboard/notifications"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2 retro-small uppercase font-bold hover:bg-muted transition-colors border-b-2 border-dashed border-muted font-[family-name:var(--font-nes)]"
                >
                  <Icon name="Bell" className="w-4 h-4" />
                  <span className="pt-0.5">{t('notifications')}</span>
                  {unreadCount > 0 && (
                    <span className="ml-auto bg-primary text-white text-xs px-1.5 py-0.5 font-bold">
                      {unreadCount}
                    </span>
                  )}
                </Link>
                <Link
                  href="/dashboard/export"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2 retro-small uppercase font-bold hover:bg-muted transition-colors border-b-2 border-dashed border-muted font-[family-name:var(--font-nes)]"
                >
                  <Icon name="Download" className="w-4 h-4" />
                  <span className="pt-0.5">{t('export')}</span>
                </Link>
                <button
                  onClick={() => {
                    logout();
                    router.push("/login");
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 retro-small uppercase font-bold hover:bg-muted transition-colors text-primary font-[family-name:var(--font-nes)]"
                >
                  <Icon name="LogOut" className="w-4 h-4" />
                  <span className="pt-0.5">{t('logout')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Standard sidebar for non-retro themes
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
          <div className="w-10 h-10 bg-primary shadow-sm flex items-center justify-center text-primary-foreground text-2xl border-2 border-foreground font-bold rounded-md">
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
          {navigationItems.map((entry, index) => {
            if (entry.type === 'divider') {
              return null; // Hide dividers in standard theme
            }

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
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => !isCollapsed && setIsUserMenuOpen(!isUserMenuOpen)}
            className={cn(
              "w-full flex items-center py-4 hover:bg-muted transition-colors",
              isCollapsed ? "justify-center px-2" : "gap-3 px-4"
            )}
            disabled={isCollapsed}
          >
            <div className="relative">
              <div className="w-10 h-10 bg-primary shadow-sm flex items-center justify-center flex-shrink-0 text-primary-foreground text-xl border-2 border-foreground font-bold rounded-md">
                {user ? getUserInitials(user.full_name) : '?'}
              </div>
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white retro-small font-bold flex items-center justify-center border-2 border-foreground shadow-sm rounded-full">
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
                  <p className="retro-small text-muted-foreground truncate uppercase tracking-tight">
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
