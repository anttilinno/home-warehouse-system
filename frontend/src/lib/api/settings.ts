import { del, downloadBlob, get, patch, post, postMultipart } from "@/lib/api";
import type { Member, Preferences, User } from "@/lib/types";

// Phase 12 Plan 02 — typed settingsApi over api.ts, the single contract surface
// every Settings subpage imports (mirrors the photos.ts module shape). Covers
// the profile (PATCH /users/me), preferences (partial PATCH /users/me/preferences),
// avatar multipart (field name MUST be "avatar"), workspace members CRUD, and the
// admin-gated full-workspace export. GetMe is the SSOT for every current value
// (read via the shared ["me"] query). No URL rewriting needed — avatar_url is
// already /api-relative (GetMe returns "/api/users/me/avatar").

export const settingsApi = {
  getMe(): Promise<User> {
    return get<User>("/users/me");
  },

  updateMe(body: { full_name?: string; email?: string }): Promise<User> {
    return patch<User>("/users/me", body);
  },

  // Partial PATCH — send only changed fields (omitempty). The exception is
  // notification_preferences, which the backend replaces wholesale: callers
  // must send the FULL map for that field.
  updatePreferences(body: Partial<Preferences>): Promise<User> {
    return patch<User>("/users/me/preferences", body);
  },

  // Multipart avatar upload. Field name MUST be "avatar" (verified
  // handler.go:694 r.FormFile("avatar")). Returns the full updated user.
  uploadAvatar(file: File): Promise<User> {
    const form = new FormData();
    form.append("avatar", file);
    return postMultipart<User>("/users/me/avatar", form);
  },

  deleteAvatar(): Promise<void> {
    return del("/users/me/avatar");
  },

  listMembers(wsId: string): Promise<{ items: Member[] }> {
    return get<{ items: Member[] }>(`/workspaces/${wsId}/members`);
  },

  addMemberByEmail(
    wsId: string,
    body: { email: string; role: string },
  ): Promise<Member> {
    return post<Member>(`/workspaces/${wsId}/members`, body);
  },

  updateMemberRole(
    wsId: string,
    userId: string,
    role: string,
  ): Promise<Member> {
    return patch<Member>(`/workspaces/${wsId}/members/${userId}`, { role });
  },

  removeMember(wsId: string, userId: string): Promise<void> {
    return del(`/workspaces/${wsId}/members/${userId}`);
  },

  exportWorkspace(
    wsId: string,
    format: "xlsx" | "json" = "xlsx",
  ): Promise<void> {
    return downloadBlob(
      `/workspaces/${wsId}/export/workspace?format=${format}`,
      `workspace-backup.${format}`,
    );
  },
};
