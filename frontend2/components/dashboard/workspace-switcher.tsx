"use client";

import { useTranslations } from "next-intl";
import { ChevronsUpDown, Plus, Check } from "lucide-react";

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

export function WorkspaceSwitcher() {
  const t = useTranslations("dashboard.workspace");

  // TODO: Get actual workspaces from context/API
  const workspaces = [
    { id: "1", name: "My Home", role: "owner" },
    { id: "2", name: "Garage", role: "admin" },
    { id: "3", name: "Family Shared", role: "member" },
  ];
  const currentWorkspace = workspaces[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-[200px] justify-between"
          role="combobox"
        >
          <span className="truncate">{currentWorkspace.name}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]">
        <DropdownMenuLabel>{t("workspaces")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            className="flex items-center justify-between"
          >
            <span className="truncate">{workspace.name}</span>
            {workspace.id === currentWorkspace.id && (
              <Check className="h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Plus className="mr-2 h-4 w-4" />
          {t("createNew")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
