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

export interface ActionsMenuProps {
  actions: ActionItem[];
  className?: string;
  /** Custom elements shown in desktop view before the action buttons */
  children?: React.ReactNode;
}

export function ActionsMenu({ actions, className, children }: ActionsMenuProps) {
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
    <div className={cn("themed-actions-menu", className)} ref={menuRef}>
      {children}
      {visibleActions.length > 0 && (
        <>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="themed-actions-menu__trigger"
            aria-label="Actions menu"
          >
            <Icon name="MoreVertical" className="w-4 h-4" />
          </button>

          {isOpen && (
            <div className="themed-actions-menu__panel">
              {visibleActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    action.onClick();
                    setIsOpen(false);
                  }}
                  className={cn(
                    "themed-actions-menu__item",
                    action.variant === "danger" && "themed-actions-menu__item--danger"
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
