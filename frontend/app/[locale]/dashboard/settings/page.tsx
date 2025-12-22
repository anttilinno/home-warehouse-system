"use client";

import { useTransition, useCallback } from "react";
import { Icon } from "@/components/icons";
import type * as LucideIcons from "lucide-react";

type IconName = keyof typeof LucideIcons;
import { useAuth } from "@/lib/auth";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { locales, type Locale } from "@/i18n";
import { usePathname, useRouter } from "@/navigation";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { workspacesApi, WorkspaceMember, UserSearchResult, getTranslatedErrorMessage } from "@/lib/api";

const languageNames: Record<Locale, string> = {
  en: "English",
  et: "Eesti",
  ru: "Русский",
};

const themeOptions: { value: string; iconName: IconName; labelKey: string }[] = [
  { value: "light", iconName: "Sun", labelKey: "themeLight" },
  { value: "dark", iconName: "Moon", labelKey: "themeDark" },
  { value: "retro-light", iconName: "Gamepad2", labelKey: "themeRetroLight" },
  { value: "retro-dark", iconName: "Gamepad2", labelKey: "themeRetroDark" },
];

const roleIconNames: Record<string, IconName> = {
  owner: "Crown",
  admin: "Shield",
  member: "User",
  viewer: "Eye",
};

export default function SettingsPage() {
  const { isAuthenticated, isLoading: authLoading, currentWorkspace, workspaces, setCurrentWorkspace, refreshWorkspaces } = useAuth();
  const t = useTranslations("settings");
  const tErrors = useTranslations();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  // Workspace creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Members management state
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Invite member state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // User search state
  const [availableUsers, setAvailableUsers] = useState<UserSearchResult[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const switchLanguage = (newLocale: Locale) => {
    startTransition(() => {
      router.replace(pathname, { locale: newLocale });
    });
  };

  const handleWorkspaceChange = (workspaceId: string) => {
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (workspace) {
      setCurrentWorkspace(workspace);
      // Reload the page to fetch new workspace data
      window.location.reload();
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError(null);

    try {
      const workspace = await workspacesApi.create({
        name: newWorkspaceName,
        description: newWorkspaceDescription || null,
      });
      setShowCreateModal(false);
      setNewWorkspaceName("");
      setNewWorkspaceDescription("");
      // Refresh workspaces and switch to the new one
      await refreshWorkspaces();
      setCurrentWorkspace(workspace);
      window.location.reload();
    } catch (err) {
      setCreateError(getTranslatedErrorMessage(err instanceof Error ? err.message : "Unknown error", (key) => tErrors(key)));
    } finally {
      setIsCreating(false);
    }
  };

  const loadMembers = useCallback(async () => {
    if (!currentWorkspace) return;
    setIsLoadingMembers(true);
    try {
      const data = await workspacesApi.getMembers(currentWorkspace.id);
      setMembers(data);
    } catch (err) {
      console.error("Failed to load members:", err);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [currentWorkspace]);

  const handleShowMembers = () => {
    setShowMembersModal(true);
    loadMembers();
  };

  // Load available users when invite modal opens
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

  // Filter users locally based on search query
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
      setAvailableUsers([]);
      setFilteredUsers([]);
      // Refresh members list
      loadMembers();
    } catch (err) {
      setInviteError(getTranslatedErrorMessage(err instanceof Error ? err.message : "Unknown error", (key) => tErrors(key)));
    } finally {
      setIsInviting(false);
    }
  };

  const canManageMembers = currentWorkspace?.role === "owner" || currentWorkspace?.role === "admin";

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* Appearance */}
        <div className="bg-card p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Icon name="Palette" className="w-5 h-5" />
            {t("appearance")}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t("appearanceDescription")}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {themeOptions.map((themeOption) => {
              const isActive = mounted && theme === themeOption.value;

              return (
                <button
                  key={themeOption.value}
                  onClick={() => setTheme(themeOption.value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Icon name={themeOption.iconName} className={`w-6 h-6 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium text-center ${isActive ? "text-primary" : "text-foreground"}`}>
                    {t(themeOption.labelKey)}
                  </span>
                  {isActive && (
                    <Icon name="Check" className="w-4 h-4 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Language */}
        <div className="bg-card p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Icon name="Globe" className="w-5 h-5" />
            {t("language")}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t("languageDescription")}
          </p>

          <div className="grid grid-cols-3 gap-3">
            {locales.map((l) => {
              const isActive = locale === l;

              return (
                <button
                  key={l}
                  onClick={() => switchLanguage(l)}
                  disabled={isPending}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors disabled:opacity-50 ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <span className={`text-lg font-medium ${isActive ? "text-primary" : "text-foreground"}`}>
                    {l.toUpperCase()}
                  </span>
                  <span className={`text-sm ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                    {languageNames[l]}
                  </span>
                  {isActive && (
                    <Icon name="Check" className="w-4 h-4 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Workspace */}
        <div className="bg-card p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Icon name="Building2" className="w-5 h-5" />
              {t("workspace")}
            </h3>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary hover:text-primary/80 border border-primary/30 hover:border-primary rounded-lg transition-colors"
            >
              <Icon name="Plus" className="w-4 h-4" />
              {t("createWorkspace")}
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {t("workspaceDescription")}
          </p>

          {currentWorkspace && (
            <div className="mb-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    {currentWorkspace.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("role")}: {t(`role${currentWorkspace.role.charAt(0).toUpperCase() + currentWorkspace.role.slice(1)}`)}
                  </p>
                </div>
                <div className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded">
                  {t("current")}
                </div>
              </div>
              {currentWorkspace.description && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {currentWorkspace.description}
                </p>
              )}

              {/* Members management for owners/admins */}
              {canManageMembers && (
                <div className="mt-4 pt-4 border-t border-border">
                  <button
                    onClick={handleShowMembers}
                    className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    <Icon name="Users" className="w-4 h-4" />
                    {t("manageMembers")}
                  </button>
                </div>
              )}
            </div>
          )}

          {workspaces.length > 1 && (
            <>
              <p className="text-sm font-medium text-foreground mb-2">
                {t("switchWorkspace")}
              </p>
              <div className="space-y-2">
                {workspaces
                  .filter((w) => w.id !== currentWorkspace?.id)
                  .map((workspace) => (
                    <button
                      key={workspace.id}
                      onClick={() => handleWorkspaceChange(workspace.id)}
                      className="w-full p-3 text-left rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors"
                    >
                      <p className="font-medium text-foreground">
                        {workspace.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("role")}: {t(`role${workspace.role.charAt(0).toUpperCase() + workspace.role.slice(1)}`)}
                      </p>
                    </button>
                  ))}
              </div>
            </>
          )}

          {workspaces.length <= 1 && (
            <p className="text-sm text-muted-foreground italic">
              {t("singleWorkspace")}
            </p>
          )}
        </div>

        {/* About */}
        <div className="bg-card p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Icon name="Settings" className="w-5 h-5" />
            {t("about")}
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("appName")}</span>
              <span className="text-foreground font-medium">Home Warehouse System</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("version")}</span>
              <span className="text-foreground font-medium">1.0.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">{t("createWorkspace")}</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Icon name="X" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t("workspaceName")} *
                </label>
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder={t("workspaceNamePlaceholder")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t("workspaceDescriptionLabel")}
                </label>
                <textarea
                  value={newWorkspaceDescription}
                  onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder={t("workspaceDescriptionPlaceholder")}
                />
              </div>

              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newWorkspaceName.trim()}
                  className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isCreating ? t("creating") : t("create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg shadow-lg w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">{t("workspaceMembers")}</h3>
              <button
                onClick={() => setShowMembersModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Icon name="X" className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <button
                onClick={handleOpenInviteModal}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors"
              >
                <Icon name="UserPlus" className="w-4 h-4" />
                {t("inviteMember")}
              </button>
            </div>

            {isLoadingMembers ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {members.map((member) => {
                  const roleIconName = roleIconNames[member.role] || "User";
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-foreground">{member.full_name}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1 bg-background rounded text-sm">
                        <Icon name={roleIconName} className="w-4 h-4 text-muted-foreground" />
                        <span className="text-foreground">
                          {t(`role${member.role.charAt(0).toUpperCase() + member.role.slice(1)}`)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowMembersModal(false)}
                className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
              >
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">{t("inviteMember")}</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Icon name="X" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInviteMember} className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t("email")} *
                </label>
                {selectedUser ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-muted/50">
                    <div className="flex-1">
                      <p className="font-medium text-foreground text-sm">{selectedUser.full_name}</p>
                      <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
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
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder={t("searchOrEnterEmail")}
                    />
                    {isLoadingUsers && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      </div>
                    )}
                    {showDropdown && !isLoadingUsers && (
                      <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredUsers.length > 0 ? (
                          filteredUsers.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => handleSelectUser(user)}
                              className="w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                            >
                              <p className="font-medium text-foreground text-sm">{user.full_name}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </button>
                          ))
                        ) : availableUsers.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            {t("noUsersToInvite")}
                          </div>
                        ) : searchQuery ? (
                          <button
                            type="button"
                            onClick={() => {
                              setInviteEmail(searchQuery);
                              setShowDropdown(false);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                          >
                            <p className="font-medium text-foreground text-sm">{t("useEmail")}: {searchQuery}</p>
                            <p className="text-xs text-muted-foreground">{t("userNotRegistered")}</p>
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
                {!selectedUser && inviteEmail && (
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 border border-primary/30 rounded-lg bg-primary/5">
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{t("willInvite")}: <span className="font-medium">{inviteEmail}</span></p>
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
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("searchUsersHint")}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t("role")}
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="admin">{t("roleAdmin")}</option>
                  <option value="member">{t("roleMember")}</option>
                  <option value="viewer">{t("roleViewer")}</option>
                </select>
              </div>

              {inviteError && (
                <p className="text-sm text-destructive">{inviteError}</p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isInviting || !inviteEmail.trim()}
                  className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isInviting ? t("inviting") : t("invite")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
