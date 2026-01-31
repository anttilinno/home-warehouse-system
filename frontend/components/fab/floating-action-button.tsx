"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FABActionItem, type FABAction } from "./fab-action-item";
import { triggerHaptic } from "@/lib/hooks/use-haptic";

interface FloatingActionButtonProps {
  actions: FABAction[];
  /** Distance from center to action items in pixels */
  radius?: number;
  /** Starting angle in radians (default: -PI/2 = top) */
  startAngle?: number;
  /** Arc span in radians (default: PI/2 = 90 degrees) */
  arcAngle?: number;
}

const containerVariants = {
  closed: {
    transition: { staggerChildren: 0.05, staggerDirection: -1 },
  },
  open: {
    transition: { delayChildren: 0.1, staggerChildren: 0.07 },
  },
};

export function FloatingActionButton({
  actions,
  radius = 80,
  startAngle = -Math.PI / 2,
  arcAngle = Math.PI / 2,
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => {
    triggerHaptic("tap");
    setIsOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        close();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-fab-container]")) {
        close();
      }
    };

    // Delay to avoid closing immediately on open click
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isOpen, close]);

  // Calculate positions for each action using polar coordinates
  const getActionPosition = (index: number) => {
    const itemCount = actions.length;
    // Distribute items evenly across the arc
    const angle =
      itemCount === 1
        ? startAngle
        : startAngle - (arcAngle / (itemCount - 1)) * index;

    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  };

  return (
    <div
      data-fab-container
      className="fixed bottom-4 right-4 z-50 md:hidden"
      role="group"
      aria-label="Quick actions"
    >
      <motion.div
        initial={false}
        animate={isOpen ? "open" : "closed"}
        variants={containerVariants}
        className="relative"
      >
        {/* Radial action items */}
        <div role="menu" aria-label="Quick actions menu" hidden={!isOpen}>
          {actions.map((action, index) => {
            const { x, y } = getActionPosition(index);
            return (
              <FABActionItem
                key={action.id}
                action={action}
                x={x}
                y={y}
                onTriggerHaptic={() => triggerHaptic("tap")}
                onClose={close}
              />
            );
          })}
        </div>

        {/* Main FAB button - 56px standard size */}
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={toggle}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label={isOpen ? "Close quick actions" : "Open quick actions"}
        >
          <motion.div
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Plus className="h-6 w-6" />
          </motion.div>
        </Button>
      </motion.div>
    </div>
  );
}

export type { FABAction };
