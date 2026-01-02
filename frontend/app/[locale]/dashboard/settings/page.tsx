"use client";

import { useCallback } from "react";
import { Icon } from "@/components/icons";
import type * as LucideIcons from "lucide-react";

type IconName = keyof typeof LucideIcons;
import { useAuth } from "@/lib/auth";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { workspacesApi, WorkspaceMember, UserSearchResult, getTranslatedErrorMessage, ApiErrorWithCode } from "@/lib/api";
import { Link } from "@/navigation";
import { cn } from "@/lib/utils";
import { NES_GREEN, NES_BLUE, NES_RED } from "@/lib/nes-colors";
import { useThemed, useThemedClasses } from "@/lib/themed";

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
  const themed = useThemed();
  const classes = useThemedClasses();

  const {
    PageHeader,
    Button,
    Modal,
    FormGroup,
    Label,
    Input,
    Textarea,
    Select,
    Error,
  } = themed;

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
    } catch (e) {
      const err = e as Error;
      const errorCode = (err as unknown as ApiErrorWithCode).code ?? undefined;
      setCreateError(getTranslatedErrorMessage(err.message || "Unknown error", (key) => tErrors(key), errorCode));
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
    } catch (e) {
      const err = e as Error;
      const errorCode = (err as unknown as ApiErrorWithCode).code ?? undefined;
      setInviteError(getTranslatedErrorMessage(err.message || "Unknown error", (key) => tErrors(key), errorCode));
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
    } catch (e) {
      const err = e as Error;
      const errorCode = (err as unknown as ApiErrorWithCode).code ?? undefined;
      setDeleteError(getTranslatedErrorMessage(err.message || "Unknown error", (key) => tErrors(key), errorCode));
    } finally {
      setIsDeleting(false);
    }
  };

  if (authLoading) {
    return (
      <div className={cn(
        "flex items-center justify-center min-h-[400px]",
        classes.isRetro && "retro-body"
      )}>
        {classes.isRetro ? (
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

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />

      <div className="grid gap-6 w-full">
        {/* Workspace Card */}
        <div className={cn(
          "bg-card p-6",
          classes.isRetro ? "border-4 border-border retro-shadow" : "rounded-lg border shadow-sm"
        )}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={cn(
              "flex items-center gap-2",
              classes.isRetro
                ? "text-sm font-bold uppercase retro-heading text-foreground"
                : "text-lg font-semibold text-foreground"
            )}>
              <Icon name="Building2" className="w-5 h-5" />
              {t("workspace")}
            </h3>
            <button
              onClick={() => setShowCreateModal(true)}
              className={cn(
                "flex items-center gap-2",
                classes.isRetro
                  ? "px-3 py-1.5 border-4 border-border bg-muted text-primary retro-small uppercase font-bold retro-body retro-shadow-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  : "px-3 py-1.5 text-sm font-medium text-primary hover:text-primary/80 border border-primary/30 hover:border-primary rounded-lg transition-colors"
              )}
            >
              <Icon name="Plus" className="w-4 h-4" />
              {t("createWorkspace")}
            </button>
          </div>
          <p className={cn(
            "mb-4",
            classes.isRetro
              ? "retro-small uppercase text-muted-foreground retro-body"
              : "text-sm text-muted-foreground"
          )}>
            {t("workspaceDescription")}
          </p>

          {currentWorkspace && (
            <div className={cn(
              "mb-4 p-4",
              classes.isRetro
                ? "bg-muted/50 border-4 border-dashed border-border"
                : "bg-muted/50 rounded-lg"
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn(
                    "text-foreground",
                    classes.isRetro ? "font-bold retro-body retro-small" : "font-medium"
                  )}>
                    {currentWorkspace.name}
                  </p>
                  <p className={cn(
                    "text-muted-foreground",
                    classes.isRetro ? "retro-small uppercase retro-body" : "text-sm"
                  )}>
                    {t("role")}: {t(`role${currentWorkspace.role.charAt(0).toUpperCase() + currentWorkspace.role.slice(1)}`)}
                  </p>
                </div>
                <div className={cn(
                  "px-2 py-1 font-medium",
                  classes.isRetro
                    ? "border-4 border-border retro-small font-bold uppercase retro-body text-white"
                    : "bg-primary/10 text-primary text-xs rounded"
                )}
                  style={classes.isRetro ? { backgroundColor: NES_GREEN } : undefined}
                >
                  {t("current")}
                </div>
              </div>
              {currentWorkspace.description && (
                <p className={cn(
                  "mt-2 text-muted-foreground",
                  classes.isRetro ? "retro-small retro-body" : "text-sm"
                )}>
                  {currentWorkspace.description}
                </p>
              )}

              {canManageMembers && (
                <div className={cn(
                  "mt-4 pt-4",
                  classes.isRetro
                    ? "border-t-4 border-dashed border-border"
                    : "border-t border-border"
                )}>
                  <button
                    onClick={handleShowMembers}
                    className={cn(
                      "flex items-center gap-2 font-medium text-primary hover:text-primary/80 transition-colors",
                      classes.isRetro
                        ? "retro-small uppercase font-bold retro-body"
                        : "text-sm"
                    )}
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
              <p className={cn(
                "font-medium text-foreground mb-2",
                classes.isRetro ? "retro-small uppercase font-bold retro-body" : "text-sm"
              )}>
                {t("switchWorkspace")}
              </p>
              <div className="space-y-2">
                {workspaces
                  .filter((w) => w.id !== currentWorkspace?.id)
                  .map((workspace) => (
                    <button
                      key={workspace.id}
                      onClick={() => handleWorkspaceChange(workspace.id)}
                      className={cn(
                        "w-full p-3 text-left transition-colors",
                        classes.isRetro
                          ? "border-4 border-border hover:bg-muted/50"
                          : "rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50"
                      )}
                    >
                      <p className={cn(
                        "text-foreground",
                        classes.isRetro ? "font-bold retro-body retro-small" : "font-medium"
                      )}>
                        {workspace.name}
                      </p>
                      <p className={cn(
                        "text-muted-foreground",
                        classes.isRetro ? "retro-small uppercase retro-body" : "text-sm"
                      )}>
                        {t("role")}: {t(`role${workspace.role.charAt(0).toUpperCase() + workspace.role.slice(1)}`)}
                      </p>
                    </button>
                  ))}
              </div>
            </>
          )}

          {workspaces.length <= 1 && (
            <p className={cn(
              "text-muted-foreground italic",
              classes.isRetro ? "retro-small uppercase retro-body" : "text-sm"
            )}>
              {t("singleWorkspace")}
            </p>
          )}
        </div>

        {/* Danger Zone */}
        {canDeleteWorkspace && (
          <div className={cn(
            "bg-card p-6",
            classes.isRetro
              ? "border-4 retro-shadow"
              : "rounded-lg border border-destructive/30 shadow-sm"
          )}
            style={classes.isRetro ? { borderColor: NES_RED } : undefined}
          >
            <h3 className={cn(
              "mb-4 flex items-center gap-2",
              classes.isRetro
                ? "text-sm font-bold uppercase retro-heading"
                : "text-lg font-semibold text-destructive"
            )}
              style={classes.isRetro ? { color: NES_RED } : undefined}
            >
              <Icon name="AlertTriangle" className="w-5 h-5" />
              {t("dangerZone")}
            </h3>
            <p className={cn(
              "mb-4 text-muted-foreground",
              classes.isRetro ? "retro-small uppercase retro-body" : "text-sm"
            )}>
              {t("dangerZoneDescription")}
            </p>

            <div className={cn(
              "p-4",
              classes.isRetro
                ? "border-4 border-dashed"
                : "bg-destructive/5 rounded-lg border border-destructive/20"
            )}
              style={classes.isRetro ? { borderColor: NES_RED, backgroundColor: 'rgba(206, 55, 43, 0.1)' } : undefined}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={cn(
                    "font-medium text-foreground",
                    classes.isRetro ? "font-bold retro-body retro-small" : ""
                  )}>{t("deleteWorkspace")}</p>
                  <p className={cn(
                    "mt-1 text-muted-foreground",
                    classes.isRetro ? "retro-small uppercase retro-body" : "text-sm"
                  )}>
                    {t("deleteWorkspaceWarning")}
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className={cn(
                    "whitespace-nowrap",
                    classes.isRetro
                      ? "px-4 py-2 border-4 border-border text-white retro-small uppercase font-bold retro-body retro-shadow-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                      : "px-4 py-2 text-sm font-medium text-destructive-foreground bg-destructive hover:bg-destructive/90 rounded-lg transition-colors"
                  )}
                  style={classes.isRetro ? { backgroundColor: NES_RED } : undefined}
                >
                  {t("deleteWorkspace")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Integrations Card */}
        <div className={cn(
          "bg-card p-6",
          classes.isRetro ? "border-4 border-border retro-shadow" : "rounded-lg border shadow-sm"
        )}>
          <h3 className={cn(
            "mb-4 flex items-center gap-2",
            classes.isRetro
              ? "text-sm font-bold uppercase retro-heading text-foreground"
              : "text-lg font-semibold text-foreground"
          )}>
            <Icon name="Plug" className="w-5 h-5" />
            {t("integrations")}
          </h3>
          <p className={cn(
            "mb-4 text-muted-foreground",
            classes.isRetro ? "retro-small uppercase retro-body" : "text-sm"
          )}>
            {t("integrationsDescription")}
          </p>

          <Link
            href="/dashboard/settings/docspell"
            className={cn(
              "flex items-center justify-between p-4 transition-colors",
              classes.isRetro
                ? "border-4 border-border hover:bg-muted/50"
                : "rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 flex items-center justify-center",
                classes.isRetro
                  ? "border-4 border-border"
                  : "rounded-lg bg-primary/10"
              )}
                style={classes.isRetro ? { backgroundColor: NES_BLUE } : undefined}
              >
                <Icon name="FileText" className={cn("w-5 h-5", classes.isRetro ? "text-white" : "text-primary")} />
              </div>
              <div>
                <p className={cn(
                  "text-foreground",
                  classes.isRetro ? "font-bold retro-body retro-small" : "font-medium"
                )}>{t("docspellTitle")}</p>
                <p className={cn(
                  "text-muted-foreground",
                  classes.isRetro ? "retro-small uppercase retro-body" : "text-sm"
                )}>{t("docspellDescription")}</p>
              </div>
            </div>
            <Icon name="ChevronRight" className="w-5 h-5 text-muted-foreground" />
          </Link>
        </div>

        {/* About Card */}
        <div className={cn(
          "bg-card p-6",
          classes.isRetro ? "border-4 border-border retro-shadow" : "rounded-lg border shadow-sm"
        )}>
          <h3 className={cn(
            "mb-4 flex items-center gap-2",
            classes.isRetro
              ? "text-sm font-bold uppercase retro-heading text-foreground"
              : "text-lg font-semibold text-foreground"
          )}>
            <Icon name="Settings" className="w-5 h-5" />
            {t("about")}
          </h3>
          <div className={cn(
            "space-y-2",
            classes.isRetro ? "retro-small uppercase" : "text-sm"
          )}>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("appName")}</span>
              <span className={cn("text-foreground", classes.isRetro ? "font-bold" : "font-medium")}>Home Warehouse System</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("version")}</span>
              <span className={cn("text-foreground", classes.isRetro ? "font-bold" : "font-medium")}>1.0.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Create Workspace Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <Modal.Header title={t("createWorkspace")} onClose={() => setShowCreateModal(false)} />
        <form onSubmit={handleCreateWorkspace}>
          <Modal.Body>
            <FormGroup>
              <Label>{t("workspaceName")} *</Label>
              <Input
                type="text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                required
                placeholder={t("workspaceNamePlaceholder")}
              />
            </FormGroup>

            <FormGroup>
              <Label>{t("workspaceDescriptionLabel")}</Label>
              <Textarea
                value={newWorkspaceDescription}
                onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                rows={3}
                placeholder={t("workspaceDescriptionPlaceholder")}
              />
            </FormGroup>

            {createError && <Error>{createError}</Error>}
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={isCreating || !newWorkspaceName.trim()}>
              {isCreating ? t("creating") : t("create")}
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Members Modal */}
      <Modal open={showMembersModal} onClose={() => setShowMembersModal(false)} size="lg">
        <Modal.Header title={t("workspaceMembers")} onClose={() => setShowMembersModal(false)} />
        <Modal.Body>
          <div className="mb-4">
            <Button variant="primary" onClick={handleOpenInviteModal}>
              <Icon name="UserPlus" className="w-4 h-4" />
              {t("inviteMember")}
            </Button>
          </div>

          {isLoadingMembers ? (
            <div className="flex justify-center py-8">
              {classes.isRetro ? (
                <div className="retro-body text-muted-foreground">Loading...</div>
              ) : (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              )}
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
                    className={cn(
                      "flex items-center justify-between p-3",
                      classes.isRetro
                        ? "bg-muted/50 border-4 border-dashed border-border"
                        : "bg-muted/50 rounded-lg"
                    )}
                  >
                    <div>
                      <p className={cn(
                        "text-foreground",
                        classes.isRetro ? "font-bold retro-body" : "font-medium"
                      )}>{member.full_name}</p>
                      <p className={cn(
                        "text-muted-foreground",
                        classes.isRetro ? "retro-body text-sm" : "text-sm"
                      )}>{member.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex items-center gap-2 px-2 py-1 text-sm",
                        classes.isRetro
                          ? "border-4 border-border bg-background retro-body"
                          : "bg-background rounded"
                      )}>
                        <Icon name={roleIconName} className="w-4 h-4 text-muted-foreground" />
                        <span className="text-foreground">
                          {t(`role${member.role.charAt(0).toUpperCase() + member.role.slice(1)}`)}
                        </span>
                      </div>
                      {canRemove && (
                        showRemoveConfirm === member.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="xs"
                              variant="danger"
                              onClick={() => handleRemoveMember(member.id)}
                              disabled={isRemoving}
                            >
                              {isRemoving ? t("removing") : t("confirm")}
                            </Button>
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => setShowRemoveConfirm(null)}
                            >
                              {t("cancel")}
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowRemoveConfirm(member.id)}
                            className={cn(
                              classes.isRetro
                                ? "retro-icon-btn retro-icon-btn--danger"
                                : "text-muted-foreground hover:text-destructive transition-colors"
                            )}
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
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowMembersModal(false)}>
            {t("close")}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Invite Member Modal */}
      <Modal open={showInviteModal} onClose={() => setShowInviteModal(false)}>
        <Modal.Header title={t("inviteMember")} onClose={() => setShowInviteModal(false)} />
        <form onSubmit={handleInviteMember}>
          <Modal.Body>
            <FormGroup>
              <Label>{t("email")} *</Label>
              {selectedUser ? (
                <div className={cn(
                  "flex items-center gap-2 px-3 py-2",
                  classes.isRetro
                    ? "border-4 border-border bg-muted/50"
                    : "border border-border rounded-lg bg-muted/50"
                )}>
                  <div className="flex-1">
                    <p className={cn(
                      "text-foreground",
                      classes.isRetro ? "font-bold retro-body" : "font-medium text-sm"
                    )}>{selectedUser.full_name}</p>
                    <p className={cn(
                      "text-muted-foreground",
                      classes.isRetro ? "retro-body text-sm" : "text-xs"
                    )}>{selectedUser.email}</p>
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
                  <Input
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
                      {classes.isRetro ? (
                        <div className="retro-body text-muted-foreground">...</div>
                      ) : (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      )}
                    </div>
                  )}
                  {showDropdown && !isLoadingUsers && (
                    <div className={cn(
                      "absolute z-10 w-full mt-1 bg-card max-h-48 overflow-y-auto",
                      classes.isRetro
                        ? "border-4 border-border retro-shadow"
                        : "border border-border rounded-lg shadow-lg"
                    )}>
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => handleSelectUser(user)}
                            className={cn(
                              "w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors",
                              classes.isRetro
                                ? "border-b-4 border-dashed border-border last:border-b-0"
                                : ""
                            )}
                          >
                            <p className={cn(
                              "text-foreground",
                              classes.isRetro ? "font-bold retro-body" : "font-medium text-sm"
                            )}>{user.full_name}</p>
                            <p className={cn(
                              "text-muted-foreground",
                              classes.isRetro ? "retro-body text-sm" : "text-xs"
                            )}>{user.email}</p>
                          </button>
                        ))
                      ) : availableUsers.length === 0 ? (
                        <div className={cn(
                          "px-3 py-2 text-muted-foreground",
                          classes.isRetro ? "retro-body" : "text-sm"
                        )}>
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
                          <p className={cn(
                            "text-foreground",
                            classes.isRetro ? "font-bold retro-body" : "font-medium text-sm"
                          )}>{t("useEmail")}: {searchQuery}</p>
                          <p className={cn(
                            "text-muted-foreground",
                            classes.isRetro ? "retro-body text-sm" : "text-xs"
                          )}>{t("userNotRegistered")}</p>
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
              {!selectedUser && inviteEmail && (
                <div className={cn(
                  "mt-2 flex items-center gap-2 px-3 py-2",
                  classes.isRetro
                    ? "border-4 border-dashed"
                    : "border border-primary/30 rounded-lg bg-primary/5"
                )}
                  style={classes.isRetro ? { borderColor: NES_GREEN, backgroundColor: 'rgba(146, 204, 65, 0.1)' } : undefined}
                >
                  <div className="flex-1">
                    <p className={cn(
                      "text-foreground",
                      classes.isRetro ? "retro-body" : "text-sm"
                    )}>{t("willInvite")}: <span className="font-medium">{inviteEmail}</span></p>
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
              <p className={cn(
                "mt-1 text-muted-foreground",
                classes.isRetro ? "text-xs retro-body" : "text-xs"
              )}>
                {t("searchUsersHint")}
              </p>
            </FormGroup>

            <FormGroup>
              <Label>{t("role")}</Label>
              <Select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="admin">{t("roleAdmin")}</option>
                <option value="member">{t("roleMember")}</option>
                <option value="viewer">{t("roleViewer")}</option>
              </Select>
            </FormGroup>

            {inviteError && <Error>{inviteError}</Error>}
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" variant="secondary" onClick={() => setShowInviteModal(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={isInviting || !inviteEmail.trim()}>
              {isInviting ? t("inviting") : t("invite")}
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Delete Workspace Confirmation Modal */}
      {currentWorkspace && (
        <Modal open={showDeleteConfirm} onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteConfirmText("");
          setDeleteError(null);
        }}>
          <Modal.Header
            title={t("deleteWorkspace")}
            onClose={() => {
              setShowDeleteConfirm(false);
              setDeleteConfirmText("");
              setDeleteError(null);
            }}
            variant="danger"
          />
          <Modal.Body>
            <p className={cn(
              "text-foreground",
              classes.isRetro ? "retro-body" : ""
            )}>
              {t("deleteWorkspaceConfirmMessage")}
            </p>
            <p className={cn(
              "text-muted-foreground",
              classes.isRetro ? "retro-body" : ""
            )}>
              {t("deleteWorkspaceConfirmTypeName", { name: currentWorkspace.name })}
            </p>

            <Input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={currentWorkspace.name}
            />

            {deleteError && <Error>{deleteError}</Error>}
          </Modal.Body>
          <Modal.Footer>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteConfirmText("");
                setDeleteError(null);
              }}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteWorkspace}
              disabled={isDeleting || deleteConfirmText !== currentWorkspace.name}
            >
              {isDeleting ? t("deleting") : t("deleteWorkspace")}
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </>
  );
}
