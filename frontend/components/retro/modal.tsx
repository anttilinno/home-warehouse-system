"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icons";

/* ==========================================================================
   RetroModal - Compound component for retro-styled modals

   Usage:
   <RetroModal open={isOpen} onClose={handleClose} size="md">
     <RetroModal.Header title="Modal Title" />
     <RetroModal.Body>
       Modal content goes here
     </RetroModal.Body>
     <RetroModal.Footer>
       <RetroButton variant="secondary" onClick={handleClose}>Cancel</RetroButton>
       <RetroButton variant="primary" onClick={handleSave}>Save</RetroButton>
     </RetroModal.Footer>
   </RetroModal>
   ========================================================================== */

type ModalSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";

interface RetroModalProps {
  children: React.ReactNode;
  open: boolean;
  onClose: () => void;
  size?: ModalSize;
  className?: string;
}

interface RetroModalHeaderProps {
  title: string;
  onClose?: () => void;
  variant?: "default" | "secondary" | "danger" | "success";
  className?: string;
}

interface RetroModalBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  flush?: boolean;
  compact?: boolean;
}

interface RetroModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  align?: "start" | "center" | "end" | "between";
}

// Modal context for passing onClose to children
const ModalContext = React.createContext<{ onClose: () => void } | null>(null);

function useModalContext() {
  const context = React.useContext(ModalContext);
  if (!context) {
    throw new Error("Modal components must be used within a RetroModal");
  }
  return context;
}

// Size classes mapping
const sizeClasses: Record<ModalSize, string> = {
  xs: "retro-modal--xs",
  sm: "retro-modal--sm",
  md: "retro-modal--md",
  lg: "retro-modal--lg",
  xl: "retro-modal--xl",
  "2xl": "retro-modal--2xl",
  full: "retro-modal--full",
};

// Modal root
function RetroModalRoot({
  children,
  open,
  onClose,
  size = "lg",
  className,
}: RetroModalProps) {
  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <ModalContext.Provider value={{ onClose }}>
      <div className="retro-modal-overlay" onClick={onClose}>
        <div className="retro-modal-backdrop" />
        <div
          className={cn("retro-modal", sizeClasses[size], className)}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </ModalContext.Provider>
  );
}

// Modal header
function RetroModalHeader({
  title,
  onClose,
  variant = "default",
  className,
}: RetroModalHeaderProps) {
  const context = useModalContext();
  const handleClose = onClose || context.onClose;

  return (
    <div
      className={cn(
        "retro-modal__header",
        variant === "secondary" && "retro-modal__header--secondary",
        variant === "danger" && "retro-modal__header--danger",
        variant === "success" && "retro-modal__header--success",
        className
      )}
    >
      <h2 className="retro-modal__title">{title}</h2>
      <button
        onClick={handleClose}
        className="retro-modal__close"
        type="button"
        aria-label="Close modal"
      >
        <Icon name="X" className="w-5 h-5" />
      </button>
    </div>
  );
}

// Modal body
function RetroModalBody({
  children,
  flush,
  compact,
  className,
  ...props
}: RetroModalBodyProps) {
  return (
    <div
      className={cn(
        "retro-modal__body",
        flush && "retro-modal__body--flush",
        compact && "retro-modal__body--compact",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Modal footer
function RetroModalFooter({
  children,
  align = "end",
  className,
  ...props
}: RetroModalFooterProps) {
  const alignClasses: Record<string, string> = {
    start: "retro-modal__footer--start",
    center: "retro-modal__footer--center",
    between: "retro-modal__footer--between",
  };

  return (
    <div
      className={cn(
        "retro-modal__footer",
        align !== "end" && alignClasses[align],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Loading overlay for modal
interface RetroModalLoadingProps {
  message?: string;
}

function RetroModalLoading({ message = "Loading..." }: RetroModalLoadingProps) {
  return (
    <div className="retro-modal__loading">
      <span className="retro-modal__loading-text">{message}</span>
    </div>
  );
}

// Preview section for confirm modals
interface RetroModalPreviewProps {
  children: React.ReactNode;
  className?: string;
}

function RetroModalPreview({ children, className }: RetroModalPreviewProps) {
  return (
    <div className={cn("retro-modal__preview", className)}>{children}</div>
  );
}

// Compose the compound component
export const RetroModal = Object.assign(RetroModalRoot, {
  Header: RetroModalHeader,
  Body: RetroModalBody,
  Footer: RetroModalFooter,
  Loading: RetroModalLoading,
  Preview: RetroModalPreview,
});

// Also export individual components
export {
  RetroModalHeader,
  RetroModalBody,
  RetroModalFooter,
  RetroModalLoading,
  RetroModalPreview,
};
