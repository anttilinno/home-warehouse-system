"use client";

import { useState, useEffect } from "react";

export function useWorkspace() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const id = localStorage.getItem("workspace_id");
    setWorkspaceId(id);
    setIsLoading(false);
  }, []);

  const switchWorkspace = (id: string) => {
    localStorage.setItem("workspace_id", id);
    setWorkspaceId(id);
  };

  return {
    workspaceId,
    isLoading,
    switchWorkspace,
  };
}
