"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

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
  { keys: ["Ctrl", "/"], description: "Focus global search", category: "Global" },
  { keys: ["?"], description: "Show keyboard shortcuts", category: "Global" },
  { keys: ["Esc"], description: "Close dialog or clear selection", category: "Global" },

  // Page shortcuts
  { keys: ["Ctrl", "N"], description: "Create new item (on any list page)", category: "Page Actions" },
  { keys: ["R"], description: "Refresh current page data", category: "Page Actions" },
  { keys: ["Ctrl", "A"], description: "Select all items in list", category: "Page Actions" },
  { keys: ["Ctrl", "E"], description: "Export selected items", category: "Page Actions" },

  // Command palette navigation
  { keys: ["Ctrl", "K", "then I"], description: "Create new item", category: "Command Palette" },
  { keys: ["Ctrl", "K", "then N"], description: "Create new inventory", category: "Command Palette" },
  { keys: ["Ctrl", "K", "then L"], description: "Create new loan", category: "Command Palette" },
  { keys: ["Ctrl", "K", "then B"], description: "Create new borrower", category: "Command Palette" },
  { keys: ["Ctrl", "K", "then C"], description: "Create new container", category: "Command Palette" },

  // Navigation in lists and tables
  { keys: ["↑", "↓"], description: "Navigate search results", category: "Navigation" },
  { keys: ["Enter"], description: "Open selected item", category: "Navigation" },
  { keys: ["Tab"], description: "Navigate between fields", category: "Navigation" },
];

const categories = Array.from(new Set(shortcuts.map(s => s.category)));

function ShortcutItem({ shortcut }: { shortcut: Shortcut }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{shortcut.description}</span>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, index) => (
          <React.Fragment key={index}>
            {index > 0 && <span className="text-xs text-muted-foreground">+</span>}
            <Kbd>{key}</Kbd>
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
          Press <Kbd>Esc</Kbd> to close
        </div>
      </DialogContent>
    </Dialog>
  );
}
