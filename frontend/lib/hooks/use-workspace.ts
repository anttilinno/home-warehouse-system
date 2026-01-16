"use client";

import { useState, useEffect } from "react";
import { authApi, type Workspace } from "@/lib/api/auth";

export interface WorkspaceMember {
  role: "owner" | "admin" | "member" | "viewer";
}

export function useWorkspace() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [currentMember, setCurrentMember] = useState<WorkspaceMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadWorkspace = async () => {
      const id = localStorage.getItem("workspace_id");
      setWorkspaceId(id);

      if (id) {
        try {
          // Load workspaces to get the current one with role
          const workspaces = await authApi.getWorkspaces();
          const current = workspaces.find((w) => w.id === id);

          if (current) {
            setWorkspace(current);
            setCurrentMember({ role: current.role as WorkspaceMember["role"] });
          }
        } catch (error) {
          console.error("Failed to load workspace:", error);
        }
      }

      setIsLoading(false);
    };

    loadWorkspace();
  }, []);

  const switchWorkspace = (id: string) => {
    localStorage.setItem("workspace_id", id);
    setWorkspaceId(id);

    // Reload to get the new workspace info
    window.location.reload();
  };

  return {
    workspaceId,
    workspace,
    currentMember,
    isLoading,
    switchWorkspace,
  };
}
