"use client";

import { Icon } from "@/components/icons";
import type * as LucideIcons from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Link, useRouter } from "@/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  dashboardApi,
  DashboardExtendedStats,
  InventorySummary,
  tokenStorage,
  locationsApi,
  Location,
  workspacesApi,
  UserSearchResult,
  getTranslatedErrorMessage,
} from "@/lib/api";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { NES_GREEN, NES_BLUE, NES_RED, NES_YELLOW } from "@/lib/nes-colors";
import {
  RetroTable,
  RetroModal,
  RetroButton,
  RetroFormGroup,
  RetroLabel,
  RetroInput,
  RetroSelect,
  RetroBadge,
} from "@/components/retro";

type IconName = keyof typeof LucideIcons;

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading, currentWorkspace } = useAuth();
  const router = useRouter();
  const t = useTranslations("dashboard");
  const tSettings = useTranslations("settings");
  const tErrors = useTranslations("errors");
  const { theme, setTheme } = useTheme();
  const isRetro = theme?.startsWith("retro");
  const [stats, setStats] = useState<DashboardExtendedStats | null>(null);
  const [recentItems, setRecentItems] = useState<InventorySummary[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite member state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<UserSearchResult[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Invite member handlers (must be before conditional returns)
  const loadAvailableUsers = useCallback(async () => {
    if (!currentWorkspace) return;
    setIsLoadingUsers(true);
    try {
      const users = await workspacesApi.searchUsers(currentWorkspace.id);
      setAvailableUsers(users);
      setFilteredUsers(users);
    } catch (err) {
      console.error("Failed to load users:", err);
      setAvailableUsers([]);
      setFilteredUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredUsers(availableUsers);
      return;
    }
    const query = searchQuery.toLowerCase();
    const filtered = availableUsers.filter(
      (user) =>
        user.full_name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
    setFilteredUsers(filtered);
  }, [searchQuery, availableUsers]);

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setInviteEmail(user.email);
    setShowDropdown(false);
    setSearchQuery("");
  };

  const handleClearSelection = () => {
    setSelectedUser(null);
    setInviteEmail("");
    setSearchQuery("");
  };

  const handleOpenInviteModal = () => {
    setShowInviteModal(true);
    loadAvailableUsers();
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;
    setIsInviting(true);
    setInviteError(null);

    try {
      await workspacesApi.inviteMember(currentWorkspace.id, {
        email: inviteEmail,
        role: inviteRole,
      });
      setShowInviteModal(false);
      setInviteEmail("");
      setInviteRole("member");
      setSelectedUser(null);
      setSearchQuery("");
    } catch (err) {
      setInviteError(getTranslatedErrorMessage(err instanceof Error ? err.message : "Unknown error", (key) => tErrors(key)));
    } finally {
      setIsInviting(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && error?.includes("Authentication required")) {
      router.push("/login");
    }
  }, [error, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && error) {
      if (error.includes("401") || error.includes("Unauthorized")) {
        tokenStorage.removeToken();
        router.push("/login");
      }
    }
  }, [error, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsData, recentData, locationsData] = await Promise.all([
        dashboardApi.getExtendedStats(),
        dashboardApi.getRecentlyModified(5),
        locationsApi.list().catch(() => []),
      ]);
      setStats(statsData);
      setRecentItems(recentData.slice(0, 5));
      setLocations(locationsData.slice(0, 3));
      setError(null);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load dashboard data";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            {t("tryAgain")}
          </button>
        </div>
      </div>
    );
  }

  const formatCurrency = (cents: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // NES color constants (Tailwind can't resolve CSS vars in arbitrary values)

  // NES-style dashboard for retro themes
  if (isRetro) {
    return (
      <>
        {/* Header */}
        <header className="dashboard-header">
          <div>
            <h1 className="dashboard-header__title">{t("title")}</h1>
            <p className="dashboard-header__subtitle">
              &gt; SELECT * FROM INVENTORY WHERE STATUS = 'ACTIVE'
            </p>
          </div>
          <div className="dashboard-header__actions">
            <RetroButton
              variant="secondary"
              size="icon"
              onClick={() => setTheme(theme === "retro-dark" ? "retro-light" : "retro-dark")}
              title={theme === "retro-dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              <Icon name={theme === "retro-dark" ? "Sun" : "Moon"} className="w-4 h-4" />
            </RetroButton>
            <Link href="/dashboard/inventory/new">
              <RetroButton variant="info">
                <Icon name="Plus" className="w-3 h-3" />
                <span>{t("newItem")}</span>
              </RetroButton>
            </Link>
          </div>
        </header>

        {/* Stats Grid - NES Style */}
        <div className="dashboard-stats">
          {/* Total Items */}
          <Link href="/dashboard/inventory" className="dashboard-stat">
            <div className="retro-stat-card__icon">
              <Icon name="Package" className="w-5 h-5" />
            </div>
            <div className="dashboard-stat__label">{t("totalItems")}</div>
            <div>
              <span className="dashboard-stat__value">
                {stats?.total_items.toLocaleString() || "0"}
              </span>
              <span className="dashboard-stat__indicator dashboard-stat__indicator--positive">
                ▲ {t("inStock")}
              </span>
            </div>
          </Link>

          {/* Low Stock */}
          <Link href="/dashboard/inventory?filter=low-stock" className="dashboard-stat">
            <div className="retro-stat-card__icon">
              <Icon name="AlertTriangle" className="w-5 h-5 text-primary" />
            </div>
            <div className="dashboard-stat__label">{t("lowStock")}</div>
            <div>
              <span className="dashboard-stat__value text-primary">
                {stats?.low_stock_count || 0}
              </span>
              {(stats?.low_stock_count || 0) > 0 && (
                <span className="dashboard-stat__indicator dashboard-stat__indicator--negative animate-pulse">
                  !!! {t("urgent")} !!!
                </span>
              )}
            </div>
          </Link>

          {/* Active Loans */}
          <Link href="/dashboard/loans" className="dashboard-stat">
            <div className="retro-stat-card__icon">
              <Icon name="Users" className="w-5 h-5" />
            </div>
            <div className="dashboard-stat__label">{t("activeLoans")}</div>
            <div>
              <span className="dashboard-stat__value">
                {stats?.active_loans || 0}
              </span>
              {(stats?.overdue_loans_count || 0) > 0 || (stats?.due_soon_loans_count || 0) > 0 ? (
                <div className="flex gap-1 flex-wrap">
                  {(stats?.overdue_loans_count || 0) > 0 && (
                    <RetroBadge variant="danger" size="sm">
                      {stats?.overdue_loans_count}<span className="dashboard-stat__badge-text"> {t("overdue")}</span>
                    </RetroBadge>
                  )}
                  {(stats?.due_soon_loans_count || 0) > 0 && (
                    <RetroBadge variant="warning" size="sm">
                      {stats?.due_soon_loans_count}<span className="dashboard-stat__badge-text"> {t("dueSoon")}</span>
                    </RetroBadge>
                  )}
                </div>
              ) : (
                <RetroBadge variant="success" size="sm">
                  ▲ {t("allGood")}
                </RetroBadge>
              )}
            </div>
          </Link>

          {/* Total Value */}
          <Link href="/dashboard/analytics" className="dashboard-stat">
            <div className="retro-stat-card__icon">
              <Icon name="DollarSign" className="w-5 h-5" />
            </div>
            <div className="dashboard-stat__label">{t("score")}</div>
            <div>
              <span className="dashboard-stat__value">
                {stats ? formatCurrency(stats.total_inventory_value, stats.currency_code) : "€0"}
              </span>
              <span className="dashboard-stat__indicator text-muted-foreground">
                {t("credits")}
              </span>
            </div>
          </Link>
        </div>

        {/* Main Content Grid */}
        <div className="dashboard-content">
          {/* Left Column - Recent Activity */}
          <div className="dashboard-main">
            {/* Recent Activity Table */}
            <div className="dashboard-activity">
              <div className="dashboard-activity__header">
                <div className="flex items-center gap-2">
                  <Icon name="History" className="w-3 h-3" />
                  <h2 className="retro-heading">{t("recentActivity")}</h2>
                </div>
                <Link href="/dashboard/inventory" className="retro-small hover:text-primary underline">
                  {t("viewAll")}
                </Link>
              </div>
              <div className="dashboard-activity__body">
                <RetroTable>
                  <RetroTable.Head>
                    <RetroTable.Row>
                      <RetroTable.Th compact>{t("item")}</RetroTable.Th>
                      <RetroTable.Th compact>{t("action")}</RetroTable.Th>
                      <RetroTable.Th compact>{t("location")}</RetroTable.Th>
                      <RetroTable.Th compact align="right">{t("time")}</RetroTable.Th>
                    </RetroTable.Row>
                  </RetroTable.Head>
                  <RetroTable.Body>
                    {recentItems.length === 0 ? (
                      <RetroTable.Row>
                        <RetroTable.Td colSpan={4} muted className="text-center">
                          {t("noRecentItems")}
                        </RetroTable.Td>
                      </RetroTable.Row>
                    ) : (
                      recentItems.map((item, index) => (
                        <RetroTable.Row
                          key={item.id}
                          clickable
                          onClick={() => router.push(`/dashboard/inventory/${item.id}`)}
                        >
                          <RetroTable.Td compact>
                            <div className="flex items-center gap-2">
                              <div className="retro-item-icon retro-item-icon--blue">
                                <Icon name="Package" className="w-4 h-4" />
                              </div>
                              <span className="truncate max-w-[120px] text-xs">{item.item_name}</span>
                            </div>
                          </RetroTable.Td>
                          <RetroTable.Td compact>
                            <RetroBadge
                              variant={index % 3 === 0 ? "success" : index % 3 === 1 ? "danger" : "muted"}
                              size="sm"
                              className="retro-badge--action"
                            >
                              {index % 3 === 0 ? t("checkIn") : index % 3 === 1 ? t("loaned") : t("added")}
                            </RetroBadge>
                          </RetroTable.Td>
                          <RetroTable.Td compact muted truncate>
                            {item.location_name}
                          </RetroTable.Td>
                          <RetroTable.Td compact muted align="right">
                            {formatRelativeTime(item.updated_at)}
                          </RetroTable.Td>
                        </RetroTable.Row>
                      ))
                    )}
                  </RetroTable.Body>
                </RetroTable>
              </div>
            </div>
          </div>

          {/* Right Column - Quick Actions & Storage */}
          <div className="dashboard-aside">
            {/* Quick Actions */}
            <div className="retro-section">
              <div className="retro-card__header">
                <Icon name="Zap" className="w-3 h-3" style={{ color: NES_BLUE }} />
                <h2 className="retro-heading">{t("quickActions")}</h2>
              </div>
              <div className="retro-card__body">
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/dashboard/app" className="retro-action-card retro-action-card--info">
                    <Icon name="QrCode" className="dashboard-action__icon" />
                    <span className="retro-small">{t("scan")}</span>
                  </Link>
                  <Link href="/dashboard/analytics" className="retro-action-card retro-action-card--success">
                    <Icon name="FileText" className="dashboard-action__icon" />
                    <span className="retro-small">{t("report")}</span>
                  </Link>
                  <Link href="/dashboard/import" className="retro-action-card">
                    <Icon name="Upload" className="dashboard-action__icon" />
                    <span className="retro-small">{t("import")}</span>
                  </Link>
                  <button onClick={handleOpenInviteModal} className="retro-action-card retro-action-card--danger">
                    <Icon name="UserPlus" className="dashboard-action__icon" />
                    <span className="retro-small">{t("invite")}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Storage HP */}
            <div className="dashboard-gauge">
              <div className="dashboard-gauge__header">
                <h2 className="retro-heading">{t("storageHP")}</h2>
                <RetroBadge variant="primary" size="sm">HQ</RetroBadge>
              </div>
              <div className="dashboard-gauge__body">
                {locations.length === 0 ? (
                  <p className="retro-small text-muted-foreground">{t("noLocations")}</p>
                ) : (
                  locations.map((location, index) => {
                    const capacity = 100;
                    const used = Math.min((location.inventory_count || 0), capacity);
                    const percentage = Math.round((used / capacity) * 100);
                    const fillClass = index === 0 ? "dashboard-gauge__fill--healthy" :
                                      index === 1 ? "dashboard-gauge__fill--warning" :
                                      "dashboard-gauge__fill--critical";

                    return (
                      <div key={location.id} className="mb-3">
                        <div className="dashboard-gauge__label">
                          <span className="truncate max-w-[100px]">{location.name}</span>
                          <span>{used}/{capacity}</span>
                        </div>
                        <div className="dashboard-gauge__bar">
                          <div
                            className={`dashboard-gauge__fill ${fillClass}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
                <p className="retro-small text-muted-foreground border-t border-dashed border-muted pt-2">
                  &gt; TIP: {t("storageTip")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Invite Member Modal */}
        <RetroModal open={showInviteModal} onClose={() => setShowInviteModal(false)} size="md">
          <RetroModal.Header title={tSettings("inviteMember")} />
          <RetroModal.Body>
            <form onSubmit={handleInviteMember} className="space-y-4" id="invite-form">
              <RetroFormGroup>
                <RetroLabel required>{tSettings("email")}</RetroLabel>
                {selectedUser ? (
                  <div className="retro-selected-user">
                    <div className="flex-1">
                      <p className="font-bold retro-small">{selectedUser.full_name}</p>
                      <p className="retro-small text-muted-foreground">{selectedUser.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Icon name="X" className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <RetroInput
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      placeholder={tSettings("searchOrEnterEmail")}
                    />
                    {isLoadingUsers && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <span className="retro-small text-muted-foreground">...</span>
                      </div>
                    )}
                    {showDropdown && !isLoadingUsers && (
                      <div className="retro-dropdown">
                        {filteredUsers.length > 0 ? (
                          filteredUsers.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => handleSelectUser(user)}
                              className="retro-dropdown__item"
                            >
                              <p className="font-bold retro-small">{user.full_name}</p>
                              <p className="retro-small text-muted-foreground">{user.email}</p>
                            </button>
                          ))
                        ) : availableUsers.length === 0 ? (
                          <div className="retro-dropdown__empty">
                            {tSettings("noUsersToInvite")}
                          </div>
                        ) : searchQuery ? (
                          <button
                            type="button"
                            onClick={() => {
                              setInviteEmail(searchQuery);
                              setShowDropdown(false);
                            }}
                            className="retro-dropdown__item"
                          >
                            <p className="font-bold retro-small">{tSettings("useEmail")}: {searchQuery}</p>
                            <p className="retro-small text-muted-foreground">{tSettings("userNotRegistered")}</p>
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
                {!selectedUser && inviteEmail && (
                  <div className="retro-selected-preview">
                    <div className="flex-1">
                      <p className="retro-small">{tSettings("willInvite")}: <span className="font-bold">{inviteEmail}</span></p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInviteEmail("")}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Icon name="X" className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <p className="retro-hint">{tSettings("searchUsersHint")}</p>
              </RetroFormGroup>

              <RetroFormGroup>
                <RetroLabel>{tSettings("role")}</RetroLabel>
                <RetroSelect
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="admin">{tSettings("roleAdmin")}</option>
                  <option value="member">{tSettings("roleMember")}</option>
                  <option value="viewer">{tSettings("roleViewer")}</option>
                </RetroSelect>
              </RetroFormGroup>

              {inviteError && (
                <p className="retro-error">{inviteError}</p>
              )}
            </form>
          </RetroModal.Body>
          <RetroModal.Footer>
            <RetroButton
              type="button"
              variant="secondary"
              onClick={() => setShowInviteModal(false)}
            >
              {tSettings("cancel")}
            </RetroButton>
            <RetroButton
              type="submit"
              form="invite-form"
              variant="primary"
              disabled={isInviting || !inviteEmail.trim()}
            >
              {isInviting ? tSettings("inviting") : tSettings("invite")}
            </RetroButton>
          </RetroModal.Footer>
        </RetroModal>
      </>
    );
  }

  // Standard dashboard for non-retro themes
  const statCards: { name: string; value: string; iconName: IconName; href: string }[] = [
    { name: t("totalItems"), value: stats?.total_items.toLocaleString() || "0", iconName: "Box", href: "/dashboard/inventory" },
    { name: t("locations"), value: stats?.total_locations.toString() || "0", iconName: "MapPin", href: "/dashboard/locations" },
    { name: t("activeLoans"), value: stats?.active_loans.toString() || "0", iconName: "Users", href: "/dashboard/loans" },
    { name: t("categories"), value: stats?.total_categories.toString() || "0", iconName: "Archive", href: "/dashboard/categories" },
  ];

  const standardHasAlerts =
    (stats?.low_stock_count || 0) > 0 ||
    (stats?.expiring_soon_count || 0) > 0 ||
    (stats?.warranty_expiring_count || 0) > 0 ||
    (stats?.overdue_loans_count || 0) > 0;

  return (
    <>
      <div className="mb-8 border-l-4 border-primary pl-4 py-1">
        <h1 className="text-4xl font-bold text-foreground leading-none">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {statCards.map((stat) => (
          <Link
            key={stat.name}
            href={stat.href}
            title={stat.name}
            className="bg-card p-3 border-2 border-border shadow-sm h-20 flex items-center justify-center hover:bg-muted hover:border-primary transition-colors rounded-lg"
          >
            <div className="flex items-center justify-center gap-3">
              <Icon name={stat.iconName} className="w-6 h-6 text-primary flex-shrink-0" />
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
            </div>
          </Link>
        ))}
        {/* Total Value Card */}
        <Link
          href="/dashboard/inventory"
          title={t("totalValue")}
          className="bg-card p-3 border-2 border-border shadow-sm h-20 flex items-center justify-center col-span-2 md:col-span-1 hover:bg-muted hover:border-primary transition-colors rounded-lg"
        >
          <div className="flex items-center justify-center gap-3">
            <Icon name="DollarSign" className="w-6 h-6 text-primary flex-shrink-0" />
            <p className="text-2xl font-bold text-foreground">
              {stats ? formatCurrency(stats.total_inventory_value, stats.currency_code) : "€0"}
            </p>
          </div>
        </Link>
      </div>

      {/* Alerts Section */}
      {standardHasAlerts && (
        <div className="mb-8">
          <div className="flex flex-wrap justify-center gap-4">
            {(stats?.low_stock_count || 0) > 0 && (
              <Link
                href="/dashboard/inventory?filter=low-stock"
                className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg border border-yellow-200"
              >
                <Icon name="AlertTriangle" className="w-4 h-4" />
                <span className="font-medium">{stats?.low_stock_count} {t("lowStock")}</span>
              </Link>
            )}
            {(stats?.expiring_soon_count || 0) > 0 && (
              <Link
                href="/dashboard/inventory?filter=expiring"
                className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg border border-yellow-200"
              >
                <Icon name="Clock" className="w-4 h-4" />
                <span className="font-medium">{stats?.expiring_soon_count} {t("expiringSoon")}</span>
              </Link>
            )}
            {(stats?.warranty_expiring_count || 0) > 0 && (
              <Link
                href="/dashboard/inventory?filter=warranty"
                className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-lg border border-blue-200"
              >
                <Icon name="Shield" className="w-4 h-4" />
                <span className="font-medium">{stats?.warranty_expiring_count} {t("warrantyExpiring")}</span>
              </Link>
            )}
            {(stats?.overdue_loans_count || 0) > 0 && (
              <Link
                href="/dashboard/loans?filter=overdue"
                className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-800 rounded-lg border border-red-200"
              >
                <Icon name="AlertCircle" className="w-4 h-4" />
                <span className="font-medium">{stats?.overdue_loans_count} {t("overdueLoans")}</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Recently Modified Section */}
      <div className="bg-card p-6 border-2 border-border shadow-sm rounded-lg">
        <h3 className="text-xl font-bold mb-6 border-b border-border pb-2 flex items-center gap-2">
          <Icon name="History" className="w-5 h-5" />
          {t("recentlyModified")}
        </h3>
        {recentItems.length === 0 ? (
          <p className="text-muted-foreground">{t("noRecentItems")}</p>
        ) : (
          <div className="space-y-3">
            {recentItems.map((item) => (
              <div key={item.id} onClick={() => router.push(`/dashboard/inventory/${item.id}`)} className="border border-border bg-background p-3 hover:bg-muted transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-2 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-bold text-base hover:text-primary transition-colors">
                    {item.item_name}
                  </h4>
                  <div className="text-xs text-muted-foreground flex gap-3 mt-1">
                    <span>{item.location_name}</span>
                    <span className="text-muted-foreground/50">•</span>
                    <span>{item.item_sku}</span>
                  </div>
                </div>
                <div className="flex items-end md:items-center justify-between md:justify-end gap-4">
                  <span className="text-2xl font-bold leading-none">{item.quantity}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(item.updated_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
