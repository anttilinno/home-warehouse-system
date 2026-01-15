"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  // Global shortcuts
  { keys: ["Ctrl", "K"], description: "Open command palette", category: "Global" },
  { keys: ["Ctrl", "/"], description: "Show keyboard shortcuts", category: "Global" },
  { keys: ["?"], description: "Show keyboard shortcuts", category: "Global" },
  { keys: ["Esc"], description: "Close dialog or cancel action", category: "Global" },

  // Navigation shortcuts
  { keys: ["Ctrl", "F"], description: "Focus search", category: "Navigation" },

  // Command palette shortcuts
  { keys: ["Ctrl", "K"], description: "Go to Dashboard", category: "Command Palette" },
  { keys: ["Ctrl", "K"], description: "Go to any page", category: "Command Palette" },
  { keys: ["Ctrl", "K", "then I"], description: "Create new item", category: "Command Palette" },
  { keys: ["Ctrl", "K", "then N"], description: "Create new inventory", category: "Command Palette" },
  { keys: ["Ctrl", "K", "then L"], description: "Create new loan", category: "Command Palette" },
  { keys: ["Ctrl", "K", "then B"], description: "Create new borrower", category: "Command Palette" },
  { keys: ["Ctrl", "K", "then C"], description: "Create new container", category: "Command Palette" },

  // Table shortcuts
  { keys: ["↑", "↓"], description: "Navigate table rows", category: "Tables" },
  { keys: ["Enter"], description: "Open selected item", category: "Tables" },

  // Form shortcuts
  { keys: ["Ctrl", "Enter"], description: "Submit form", category: "Forms" },
  { keys: ["Esc"], description: "Cancel and close", category: "Forms" },
  { keys: ["Tab"], description: "Navigate form fields", category: "Forms" },
];

const categories = Array.from(new Set(shortcuts.map(s => s.category)));

function KeyboardKey({ children }: { children: string }) {
  return (
    <Badge
      variant="outline"
      className="px-2 py-1 font-mono text-xs font-normal"
    >
      {children}
    </Badge>
  );
}

function ShortcutItem({ shortcut }: { shortcut: Shortcut }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{shortcut.description}</span>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, index) => (
          <React.Fragment key={index}>
            {index > 0 && <span className="text-xs text-muted-foreground">+</span>}
            <KeyboardKey>{key}</KeyboardKey>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * KeyboardShortcutsDialog displays available keyboard shortcuts grouped by category
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <KeyboardShortcutsDialog open={open} onOpenChange={setOpen} />
 * ```
 */
export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  // Detect Mac for displaying ⌘ instead of Ctrl
  const isMac = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Use these keyboard shortcuts to navigate faster
            {isMac && " (⌘ is used instead of Ctrl on Mac)"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category} className="space-y-2">
              <h3 className="font-semibold text-sm">{category}</h3>
              <div className="space-y-1">
                {shortcuts
                  .filter((s) => s.category === category)
                  .map((shortcut, index) => (
                    <ShortcutItem key={index} shortcut={shortcut} />
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center pt-4 text-xs text-muted-foreground">
          Press <KeyboardKey>Esc</KeyboardKey> to close
        </div>
      </DialogContent>
    </Dialog>
  );
}
