"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";

export interface FABAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

interface FABActionItemProps {
  action: FABAction;
  x: number;
  y: number;
  onTriggerHaptic?: () => void;
  onClose: () => void;
}

const itemVariants = {
  closed: {
    opacity: 0,
    scale: 0,
    transition: { duration: 0.15 },
  },
  open: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 400, damping: 25 },
  },
};

export function FABActionItem({
  action,
  x,
  y,
  onTriggerHaptic,
  onClose,
}: FABActionItemProps) {
  const handleClick = () => {
    onTriggerHaptic?.();
    action.onClick();
    onClose();
  };

  return (
    <motion.div
      variants={itemVariants}
      className="absolute"
      style={{
        // Position from center of FAB, offset by half button size (22px for 44px button)
        left: `calc(50% + ${x}px - 22px)`,
        top: `calc(50% + ${y}px - 22px)`,
      }}
    >
      <Button
        size="icon"
        variant="secondary"
        className="h-11 w-11 rounded-full shadow-lg"
        onClick={handleClick}
        role="menuitem"
        aria-label={action.label}
      >
        {action.icon}
      </Button>
    </motion.div>
  );
}
