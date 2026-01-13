"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ChevronsUpDown, Plus, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { authApi, type Workspace } from "@/lib/api";
import { useWorkspace } from "@/lib/hooks/use-workspace";

export function WorkspaceSwitcher() {
  const t = useTranslations("dashboard.workspace");
  const { workspaceId, switchWorkspace } = useWorkspace();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      setIsLoading(true);
      const data = await authApi.getWorkspaces();
      setWorkspaces(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load workspaces";
      toast.error("Failed to load workspaces", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchWorkspace = async (workspace: Workspace) => {
    if (workspace.id === workspaceId) return;

    setIsSwitching(true);
    try {
      switchWorkspace(workspace.id);
      toast.success("Workspace switched", {
        description: `Now viewing "${workspace.name}"`,
      });
      // Reload the page to refresh data
      window.location.reload();
    } catch (error) {
      toast.error("Failed to switch workspace");
      setIsSwitching(false);
    }
  };

  const currentWorkspace = workspaces.find((w) => w.id === workspaceId);

  if (isLoading) {
    return (
      <Button variant="outline" className="w-[200px]" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        <span>Loading...</span>
      </Button>
    );
  }

  if (!currentWorkspace) {
    return (
      <Button variant="outline" className="w-[200px]" disabled>
        <span>No workspace</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-[200px] justify-between"
          role="combobox"
          disabled={isSwitching}
        >
          {isSwitching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span>Switching...</span>
            </>
          ) : (
            <>
              <span className="truncate">{currentWorkspace.name}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[220px]">
        <DropdownMenuLabel>{t("workspaces")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            className="flex items-center justify-between cursor-pointer"
            onClick={() => handleSwitchWorkspace(workspace)}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="truncate">{workspace.name}</span>
              {workspace.id === currentWorkspace.id && (
                <Check className="h-4 w-4 text-primary shrink-0" />
              )}
            </div>
            <Badge variant="secondary" className="text-xs shrink-0">
              {workspace.role}
            </Badge>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Plus className="mr-2 h-4 w-4" />
          {t("createNew")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
