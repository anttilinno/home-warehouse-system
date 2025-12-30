"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icons";
import type * as LucideIcons from "lucide-react";

type IconName = keyof typeof LucideIcons;

export interface ActionItem {
  icon: IconName;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
  hidden?: boolean;
}

interface RetroActionsMenuProps {
  actions: ActionItem[];
  className?: string;
  /** Custom elements shown in desktop view before the action buttons */
  children?: React.ReactNode;
}

export function RetroActionsMenu({ actions, className, children }: RetroActionsMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const visibleActions = actions.filter((a) => !a.hidden);

  // Close menu when clicking outside
  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className={cn("retro-actions-menu", className)} ref={menuRef}>
      {/* Always visible custom children (e.g., FavoriteButton) */}
      {children}

      {/* Three-dot menu for all other actions */}
      {visibleActions.length > 0 && (
        <>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="retro-icon-btn"
            aria-label="Actions menu"
          >
            <Icon name="MoreVertical" className="w-4 h-4" />
          </button>

          {isOpen && (
            <div className="retro-actions-menu__panel">
              {visibleActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    action.onClick();
                    setIsOpen(false);
                  }}
                  className={cn(
                    "retro-actions-menu__item",
                    action.variant === "danger" && "retro-actions-menu__item--danger"
                  )}
                >
                  <Icon name={action.icon} className="w-4 h-4" />
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
