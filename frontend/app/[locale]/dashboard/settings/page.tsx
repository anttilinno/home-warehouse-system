"use client";

import { useCallback } from "react";
import { Icon } from "@/components/icons";
import type * as LucideIcons from "lucide-react";

type IconName = keyof typeof LucideIcons;
import { useAuth } from "@/lib/auth";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { workspacesApi, WorkspaceMember, UserSearchResult, getTranslatedErrorMessage } from "@/lib/api";
import { Link } from "@/navigation";
import { cn } from "@/lib/utils";
import { NES_GREEN, NES_BLUE, NES_RED, NES_YELLOW } from "@/lib/nes-colors";
import {
  RetroPageHeader,
  RetroButton,
  RetroModal,
  RetroFormGroup,
  RetroLabel,
  RetroInput,
  RetroTextarea,
  RetroSelect,
  RetroError,
} from "@/components/retro";

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
  const { theme } = useTheme();
  const isRetro = theme?.startsWith("retro");

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

  // Remove member state
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string | null>(null);

  // Delete workspace state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

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
  const canDeleteWorkspace = canManageMembers && currentWorkspace && !currentWorkspace.is_personal;

  const handleRemoveMember = async (memberId: string) => {
    if (!currentWorkspace) return;
    setRemovingMemberId(memberId);
    try {
      await workspacesApi.removeMember(currentWorkspace.id, memberId);
      setShowRemoveConfirm(null);
      loadMembers();
    } catch (err) {
      console.error("Failed to remove member:", err);
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!currentWorkspace || currentWorkspace.is_personal) return;
    if (deleteConfirmText !== currentWorkspace.name) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await workspacesApi.delete(currentWorkspace.id);
      // Refresh workspaces and switch to another one
      await refreshWorkspaces();
      const remainingWorkspaces = workspaces.filter(w => w.id !== currentWorkspace.id);
      if (remainingWorkspaces.length > 0) {
        setCurrentWorkspace(remainingWorkspaces[0]);
      }
      window.location.reload();
    } catch (err) {
      setDeleteError(getTranslatedErrorMessage(err instanceof Error ? err.message : "Unknown error", (key) => tErrors(key)));
    } finally {
      setIsDeleting(false);
    }
  };

  if (authLoading) {
    return (
      <div className={cn(
        "flex items-center justify-center min-h-[400px]",
        isRetro && "retro-body"
      )}>
        {isRetro ? (
          <div className="retro-small uppercase text-muted-foreground">{t("title")}...</div>
        ) : (
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        )}
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Retro theme UI
  if (isRetro) {
    return (
      <>
        <RetroPageHeader
          title={t("title")}
          subtitle={t("subtitle")}
        />

        <div className="grid gap-6 w-full">
          {/* Workspace Card */}
          <div className="bg-card p-6 border-4 border-border retro-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase retro-heading text-foreground flex items-center gap-2">
                <Icon name="Building2" className="w-5 h-5" />
                {t("workspace")}
              </h3>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 border-4 border-border bg-muted text-primary retro-small uppercase font-bold retro-body retro-shadow-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                <Icon name="Plus" className="w-4 h-4" />
                {t("createWorkspace")}
              </button>
            </div>
            <p className="retro-small uppercase text-muted-foreground mb-4 retro-body">
              {t("workspaceDescription")}
            </p>

            {currentWorkspace && (
              <div className="mb-4 p-4 bg-muted/50 border-4 border-dashed border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-foreground retro-body retro-small">
                      {currentWorkspace.name}
                    </p>
                    <p className="retro-small uppercase text-muted-foreground retro-body">
                      {t("role")}: {t(`role${currentWorkspace.role.charAt(0).toUpperCase() + currentWorkspace.role.slice(1)}`)}
                    </p>
                  </div>
                  <div className="px-2 py-1 border-4 border-border retro-small font-bold uppercase retro-body" style={{ backgroundColor: NES_GREEN, color: 'white' }}>
                    {t("current")}
                  </div>
                </div>
                {currentWorkspace.description && (
                  <p className="mt-2 retro-small text-muted-foreground retro-body">
                    {currentWorkspace.description}
                  </p>
                )}

                {canManageMembers && (
                  <div className="mt-4 pt-4 border-t-4 border-dashed border-border">
                    <button
                      onClick={handleShowMembers}
                      className="flex items-center gap-2 retro-small uppercase font-bold retro-body text-primary hover:text-primary/80 transition-colors"
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
                <p className="retro-small uppercase font-bold text-foreground mb-2 retro-body">
                  {t("switchWorkspace")}
                </p>
                <div className="space-y-2">
                  {workspaces
                    .filter((w) => w.id !== currentWorkspace?.id)
                    .map((workspace) => (
                      <button
                        key={workspace.id}
                        onClick={() => handleWorkspaceChange(workspace.id)}
                        className="w-full p-3 text-left border-4 border-border hover:bg-muted/50 transition-colors"
                      >
                        <p className="font-bold text-foreground retro-body retro-small">
                          {workspace.name}
                        </p>
                        <p className="retro-small uppercase text-muted-foreground retro-body">
                          {t("role")}: {t(`role${workspace.role.charAt(0).toUpperCase() + workspace.role.slice(1)}`)}
                        </p>
                      </button>
                    ))}
                </div>
              </>
            )}

            {workspaces.length <= 1 && (
              <p className="retro-small uppercase text-muted-foreground italic retro-body">
                {t("singleWorkspace")}
              </p>
            )}
          </div>

          {/* Danger Zone */}
          {canDeleteWorkspace && (
            <div className="bg-card p-6 border-4 retro-shadow" style={{ borderColor: NES_RED }}>
              <h3 className="text-sm font-bold uppercase retro-heading mb-4 flex items-center gap-2" style={{ color: NES_RED }}>
                <Icon name="AlertTriangle" className="w-5 h-5" />
                {t("dangerZone")}
              </h3>
              <p className="retro-small uppercase text-muted-foreground mb-4 retro-body">
                {t("dangerZoneDescription")}
              </p>

              <div className="p-4 border-4 border-dashed" style={{ borderColor: NES_RED, backgroundColor: 'rgba(206, 55, 43, 0.1)' }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-bold text-foreground retro-body retro-small">{t("deleteWorkspace")}</p>
                    <p className="retro-small uppercase text-muted-foreground mt-1 retro-body">
                      {t("deleteWorkspaceWarning")}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 border-4 border-border text-white retro-small uppercase font-bold retro-body retro-shadow-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all whitespace-nowrap"
                    style={{ backgroundColor: NES_RED }}
                  >
                    {t("deleteWorkspace")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Integrations Card */}
          <div className="bg-card p-6 border-4 border-border retro-shadow">
            <h3 className="text-sm font-bold uppercase retro-heading text-foreground mb-4 flex items-center gap-2">
              <Icon name="Plug" className="w-5 h-5" />
              {t("integrations")}
            </h3>
            <p className="retro-small uppercase text-muted-foreground mb-4 retro-body">
              {t("integrationsDescription")}
            </p>

            <Link
              href="/dashboard/settings/docspell"
              className="flex items-center justify-between p-4 border-4 border-border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 border-4 border-border flex items-center justify-center" style={{ backgroundColor: NES_BLUE }}>
                  <Icon name="FileText" className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-foreground retro-body retro-small">{t("docspellTitle")}</p>
                  <p className="retro-small uppercase text-muted-foreground retro-body">{t("docspellDescription")}</p>
                </div>
              </div>
              <Icon name="ChevronRight" className="w-5 h-5 text-muted-foreground" />
            </Link>
          </div>

          {/* About Card */}
          <div className="bg-card p-6 border-4 border-border retro-shadow">
            <h3 className="text-sm font-bold uppercase retro-heading text-foreground mb-4 flex items-center gap-2">
              <Icon name="Settings" className="w-5 h-5" />
              {t("about")}
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between retro-small uppercase">
                <span className="text-muted-foreground">{t("appName")}</span>
                <span className="text-foreground font-bold">Home Warehouse System</span>
              </div>
              <div className="flex justify-between retro-small uppercase">
                <span className="text-muted-foreground">{t("version")}</span>
                <span className="text-foreground font-bold">1.0.0</span>
              </div>
            </div>
          </div>
        </div>

        {/* Create Workspace Modal */}
        <RetroModal open={showCreateModal} onClose={() => setShowCreateModal(false)}>
          <RetroModal.Header title={t("createWorkspace")} onClose={() => setShowCreateModal(false)} />
          <form onSubmit={handleCreateWorkspace}>
            <RetroModal.Body>
              <RetroFormGroup>
                <RetroLabel>{t("workspaceName")} *</RetroLabel>
                <RetroInput
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  required
                  placeholder={t("workspaceNamePlaceholder")}
                />
              </RetroFormGroup>

              <RetroFormGroup>
                <RetroLabel>{t("workspaceDescriptionLabel")}</RetroLabel>
                <RetroTextarea
                  value={newWorkspaceDescription}
                  onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                  rows={3}
                  placeholder={t("workspaceDescriptionPlaceholder")}
                />
              </RetroFormGroup>

              {createError && <RetroError>{createError}</RetroError>}
            </RetroModal.Body>
            <RetroModal.Footer>
              <RetroButton type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                {t("cancel")}
              </RetroButton>
              <RetroButton type="submit" variant="primary" disabled={isCreating || !newWorkspaceName.trim()}>
                {isCreating ? t("creating") : t("create")}
              </RetroButton>
            </RetroModal.Footer>
          </form>
        </RetroModal>

        {/* Members Modal */}
        <RetroModal open={showMembersModal} onClose={() => setShowMembersModal(false)} size="lg">
          <RetroModal.Header title={t("workspaceMembers")} onClose={() => setShowMembersModal(false)} />
          <RetroModal.Body>
            <div className="mb-4">
              <RetroButton variant="primary" onClick={handleOpenInviteModal}>
                <Icon name="UserPlus" className="w-4 h-4" />
                {t("inviteMember")}
              </RetroButton>
            </div>

            {isLoadingMembers ? (
              <div className="flex justify-center py-8">
                <div className="retro-body text-muted-foreground">Loading...</div>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {members.map((member) => {
                  const roleIconName = roleIconNames[member.role] || "User";
                  const canRemove = canManageMembers && member.role !== "owner";
                  const isRemoving = removingMemberId === member.id;
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-muted/50 border-4 border-dashed border-border"
                    >
                      <div>
                        <p className="font-bold text-foreground retro-body">{member.full_name}</p>
                        <p className="retro-body text-sm text-muted-foreground">{member.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-2 py-1 border-4 border-border bg-background retro-body text-sm">
                          <Icon name={roleIconName} className="w-4 h-4 text-muted-foreground" />
                          <span className="text-foreground">
                            {t(`role${member.role.charAt(0).toUpperCase() + member.role.slice(1)}`)}
                          </span>
                        </div>
                        {canRemove && (
                          showRemoveConfirm === member.id ? (
                            <div className="flex items-center gap-1">
                              <RetroButton
                                size="xs"
                                variant="danger"
                                onClick={() => handleRemoveMember(member.id)}
                                disabled={isRemoving}
                              >
                                {isRemoving ? t("removing") : t("confirm")}
                              </RetroButton>
                              <RetroButton
                                size="xs"
                                variant="secondary"
                                onClick={() => setShowRemoveConfirm(null)}
                              >
                                {t("cancel")}
                              </RetroButton>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowRemoveConfirm(member.id)}
                              className="retro-icon-btn retro-icon-btn--danger"
                              title={t("removeMember")}
                            >
                              <Icon name="UserMinus" className="w-4 h-4" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </RetroModal.Body>
          <RetroModal.Footer>
            <RetroButton variant="secondary" onClick={() => setShowMembersModal(false)}>
              {t("close")}
            </RetroButton>
          </RetroModal.Footer>
        </RetroModal>

        {/* Invite Member Modal */}
        <RetroModal open={showInviteModal} onClose={() => setShowInviteModal(false)}>
          <RetroModal.Header title={t("inviteMember")} onClose={() => setShowInviteModal(false)} />
          <form onSubmit={handleInviteMember}>
            <RetroModal.Body>
              <RetroFormGroup>
                <RetroLabel>{t("email")} *</RetroLabel>
                {selectedUser ? (
                  <div className="flex items-center gap-2 px-3 py-2 border-4 border-border bg-muted/50">
                    <div className="flex-1">
                      <p className="font-bold text-foreground retro-body">{selectedUser.full_name}</p>
                      <p className="retro-body text-sm text-muted-foreground">{selectedUser.email}</p>
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
                      placeholder={t("searchOrEnterEmail")}
                    />
                    {isLoadingUsers && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="retro-body text-muted-foreground">...</div>
                      </div>
                    )}
                    {showDropdown && !isLoadingUsers && (
                      <div className="absolute z-10 w-full mt-1 bg-card border-4 border-border retro-shadow max-h-48 overflow-y-auto">
                        {filteredUsers.length > 0 ? (
                          filteredUsers.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => handleSelectUser(user)}
                              className="w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors border-b-4 border-dashed border-border last:border-b-0"
                            >
                              <p className="font-bold text-foreground retro-body">{user.full_name}</p>
                              <p className="retro-body text-sm text-muted-foreground">{user.email}</p>
                            </button>
                          ))
                        ) : availableUsers.length === 0 ? (
                          <div className="px-3 py-2 retro-body text-muted-foreground">
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
                            <p className="font-bold text-foreground retro-body">{t("useEmail")}: {searchQuery}</p>
                            <p className="retro-body text-sm text-muted-foreground">{t("userNotRegistered")}</p>
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
                {!selectedUser && inviteEmail && (
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 border-4 border-dashed" style={{ borderColor: NES_GREEN, backgroundColor: 'rgba(146, 204, 65, 0.1)' }}>
                    <div className="flex-1">
                      <p className="retro-body text-foreground">{t("willInvite")}: <span className="font-bold">{inviteEmail}</span></p>
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
                <p className="mt-1 text-xs text-muted-foreground retro-body">
                  {t("searchUsersHint")}
                </p>
              </RetroFormGroup>

              <RetroFormGroup>
                <RetroLabel>{t("role")}</RetroLabel>
                <RetroSelect
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="admin">{t("roleAdmin")}</option>
                  <option value="member">{t("roleMember")}</option>
                  <option value="viewer">{t("roleViewer")}</option>
                </RetroSelect>
              </RetroFormGroup>

              {inviteError && <RetroError>{inviteError}</RetroError>}
            </RetroModal.Body>
            <RetroModal.Footer>
              <RetroButton type="button" variant="secondary" onClick={() => setShowInviteModal(false)}>
                {t("cancel")}
              </RetroButton>
              <RetroButton type="submit" variant="primary" disabled={isInviting || !inviteEmail.trim()}>
                {isInviting ? t("inviting") : t("invite")}
              </RetroButton>
            </RetroModal.Footer>
          </form>
        </RetroModal>

        {/* Delete Workspace Confirmation Modal */}
        {currentWorkspace && (
          <RetroModal open={showDeleteConfirm} onClose={() => {
            setShowDeleteConfirm(false);
            setDeleteConfirmText("");
            setDeleteError(null);
          }}>
            <RetroModal.Header
              title={t("deleteWorkspace")}
              onClose={() => {
                setShowDeleteConfirm(false);
                setDeleteConfirmText("");
                setDeleteError(null);
              }}
              variant="danger"
            />
            <RetroModal.Body>
              <p className="retro-body text-foreground">
                {t("deleteWorkspaceConfirmMessage")}
              </p>
              <p className="retro-body text-muted-foreground">
                {t("deleteWorkspaceConfirmTypeName", { name: currentWorkspace.name })}
              </p>

              <RetroInput
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={currentWorkspace.name}
              />

              {deleteError && <RetroError>{deleteError}</RetroError>}
            </RetroModal.Body>
            <RetroModal.Footer>
              <RetroButton
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                  setDeleteError(null);
                }}
              >
                {t("cancel")}
              </RetroButton>
              <RetroButton
                variant="danger"
                onClick={handleDeleteWorkspace}
                disabled={isDeleting || deleteConfirmText !== currentWorkspace.name}
              >
                {isDeleting ? t("deleting") : t("deleteWorkspace")}
              </RetroButton>
            </RetroModal.Footer>
          </RetroModal>
        )}
      </>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 w-full">
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

        {/* Danger Zone - only show for non-personal workspaces where user is owner/admin */}
        {canDeleteWorkspace && (
          <div className="bg-card p-6 rounded-lg border border-destructive/30 shadow-sm">
            <h3 className="text-lg font-semibold text-destructive mb-4 flex items-center gap-2">
              <Icon name="AlertTriangle" className="w-5 h-5" />
              {t("dangerZone")}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("dangerZoneDescription")}
            </p>

            <div className="p-4 bg-destructive/5 rounded-lg border border-destructive/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground">{t("deleteWorkspace")}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("deleteWorkspaceWarning")}
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 text-sm font-medium text-destructive-foreground bg-destructive hover:bg-destructive/90 rounded-lg transition-colors whitespace-nowrap"
                >
                  {t("deleteWorkspace")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Integrations */}
        <div className="bg-card p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Icon name="Plug" className="w-5 h-5" />
            {t("integrations")}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t("integrationsDescription")}
          </p>

          <Link
            href="/dashboard/settings/docspell"
            className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon name="FileText" className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{t("docspellTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("docspellDescription")}</p>
              </div>
            </div>
            <Icon name="ChevronRight" className="w-5 h-5 text-muted-foreground" />
          </Link>
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
                  const canRemove = canManageMembers && member.role !== "owner";
                  const isRemoving = removingMemberId === member.id;
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-foreground">{member.full_name}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-2 py-1 bg-background rounded text-sm">
                          <Icon name={roleIconName} className="w-4 h-4 text-muted-foreground" />
                          <span className="text-foreground">
                            {t(`role${member.role.charAt(0).toUpperCase() + member.role.slice(1)}`)}
                          </span>
                        </div>
                        {canRemove && (
                          showRemoveConfirm === member.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleRemoveMember(member.id)}
                                disabled={isRemoving}
                                className="px-2 py-1 text-xs font-medium text-destructive-foreground bg-destructive hover:bg-destructive/90 rounded transition-colors disabled:opacity-50"
                              >
                                {isRemoving ? t("removing") : t("confirm")}
                              </button>
                              <button
                                onClick={() => setShowRemoveConfirm(null)}
                                className="px-2 py-1 text-xs font-medium text-foreground bg-muted hover:bg-muted/80 rounded transition-colors"
                              >
                                {t("cancel")}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowRemoveConfirm(member.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              title={t("removeMember")}
                            >
                              <Icon name="UserMinus" className="w-4 h-4" />
                            </button>
                          )
                        )}
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

      {/* Delete Workspace Confirmation Modal */}
      {showDeleteConfirm && currentWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-destructive flex items-center gap-2">
                <Icon name="AlertTriangle" className="w-5 h-5" />
                {t("deleteWorkspace")}
              </h3>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                  setDeleteError(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <Icon name="X" className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-foreground">
                {t("deleteWorkspaceConfirmMessage")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("deleteWorkspaceConfirmTypeName", { name: currentWorkspace.name })}
              </p>

              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-destructive/50"
                placeholder={currentWorkspace.name}
              />

              {deleteError && (
                <p className="text-sm text-destructive">{deleteError}</p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText("");
                    setDeleteError(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleDeleteWorkspace}
                  disabled={isDeleting || deleteConfirmText !== currentWorkspace.name}
                  className="px-4 py-2 text-sm font-medium text-destructive-foreground bg-destructive hover:bg-destructive/90 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isDeleting ? t("deleting") : t("deleteWorkspace")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
