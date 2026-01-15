"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Package,
  Archive,
  HandCoins,
  Users,
  Box,
  MapPin,
  FolderTree,
  LayoutDashboard,
  Plus,
  Search,
  Moon,
  Sun,
  Laptop,
  AlertCircle,
} from "lucide-react";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Command {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  onSelect: () => void;
  category: "navigation" | "create" | "actions";
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { setTheme } = useTheme();

  // Navigation commands
  const navigationCommands: Command[] = [
    {
      id: "nav-dashboard",
      label: "Go to Dashboard",
      icon: LayoutDashboard,
      onSelect: () => {
        router.push("/dashboard");
        onOpenChange(false);
      },
      category: "navigation",
    },
    {
      id: "nav-items",
      label: "Go to Items",
      icon: Package,
      onSelect: () => {
        router.push("/dashboard/items");
        onOpenChange(false);
      },
      category: "navigation",
    },
    {
      id: "nav-inventory",
      label: "Go to Inventory",
      icon: Archive,
      onSelect: () => {
        router.push("/dashboard/inventory");
        onOpenChange(false);
      },
      category: "navigation",
    },
    {
      id: "nav-loans",
      label: "Go to Loans",
      icon: HandCoins,
      onSelect: () => {
        router.push("/dashboard/loans");
        onOpenChange(false);
      },
      category: "navigation",
    },
    {
      id: "nav-borrowers",
      label: "Go to Borrowers",
      icon: Users,
      onSelect: () => {
        router.push("/dashboard/borrowers");
        onOpenChange(false);
      },
      category: "navigation",
    },
    {
      id: "nav-containers",
      label: "Go to Containers",
      icon: Box,
      onSelect: () => {
        router.push("/dashboard/containers");
        onOpenChange(false);
      },
      category: "navigation",
    },
    {
      id: "nav-locations",
      label: "Go to Locations",
      icon: MapPin,
      onSelect: () => {
        router.push("/dashboard/locations");
        onOpenChange(false);
      },
      category: "navigation",
    },
    {
      id: "nav-categories",
      label: "Go to Categories",
      icon: FolderTree,
      onSelect: () => {
        router.push("/dashboard/categories");
        onOpenChange(false);
      },
      category: "navigation",
    },
    {
      id: "nav-out-of-stock",
      label: "Go to Out of Stock",
      icon: AlertCircle,
      onSelect: () => {
        router.push("/dashboard/out-of-stock");
        onOpenChange(false);
      },
      category: "navigation",
    },
  ];

  // Create commands
  const createCommands: Command[] = [
    {
      id: "create-item",
      label: "Create New Item",
      icon: Plus,
      shortcut: "I",
      onSelect: () => {
        router.push("/dashboard/items?action=create");
        onOpenChange(false);
      },
      category: "create",
    },
    {
      id: "create-inventory",
      label: "Create New Inventory Entry",
      icon: Plus,
      shortcut: "N",
      onSelect: () => {
        router.push("/dashboard/inventory?action=create");
        onOpenChange(false);
      },
      category: "create",
    },
    {
      id: "create-loan",
      label: "Create New Loan",
      icon: Plus,
      shortcut: "L",
      onSelect: () => {
        router.push("/dashboard/loans?action=create");
        onOpenChange(false);
      },
      category: "create",
    },
    {
      id: "create-borrower",
      label: "Create New Borrower",
      icon: Plus,
      shortcut: "B",
      onSelect: () => {
        router.push("/dashboard/borrowers?action=create");
        onOpenChange(false);
      },
      category: "create",
    },
    {
      id: "create-container",
      label: "Create New Container",
      icon: Plus,
      shortcut: "C",
      onSelect: () => {
        router.push("/dashboard/containers?action=create");
        onOpenChange(false);
      },
      category: "create",
    },
  ];

  // Action commands
  const actionCommands: Command[] = [
    {
      id: "theme-light",
      label: "Switch to Light Theme",
      icon: Sun,
      onSelect: () => {
        setTheme("light");
        onOpenChange(false);
      },
      category: "actions",
    },
    {
      id: "theme-dark",
      label: "Switch to Dark Theme",
      icon: Moon,
      onSelect: () => {
        setTheme("dark");
        onOpenChange(false);
      },
      category: "actions",
    },
    {
      id: "theme-system",
      label: "Switch to System Theme",
      icon: Laptop,
      onSelect: () => {
        setTheme("system");
        onOpenChange(false);
      },
      category: "actions",
    },
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {navigationCommands.map((command) => (
            <CommandItem
              key={command.id}
              onSelect={command.onSelect}
              className="flex items-center gap-2"
            >
              <command.icon className="h-4 w-4" />
              <span>{command.label}</span>
              {command.shortcut && (
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                  {command.shortcut}
                </kbd>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Create">
          {createCommands.map((command) => (
            <CommandItem
              key={command.id}
              onSelect={command.onSelect}
              className="flex items-center gap-2"
            >
              <command.icon className="h-4 w-4" />
              <span>{command.label}</span>
              {command.shortcut && (
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                  ⌘{command.shortcut}
                </kbd>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Theme">
          {actionCommands.map((command) => (
            <CommandItem
              key={command.id}
              onSelect={command.onSelect}
              className="flex items-center gap-2"
            >
              <command.icon className="h-4 w-4" />
              <span>{command.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
