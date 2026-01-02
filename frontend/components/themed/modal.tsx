"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icons";

/* ==========================================================================
   Unified Modal Component - Pure CSS theming with compound components
   ========================================================================== */

type ModalSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";

export interface ModalProps {
  children: React.ReactNode;
  open: boolean;
  onClose: () => void;
  size?: ModalSize;
  className?: string;
}

export interface ModalHeaderProps {
  title: string;
  onClose?: () => void;
  variant?: "default" | "secondary" | "danger" | "success";
  className?: string;
}

export interface ModalBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  flush?: boolean;
  compact?: boolean;
}

export interface ModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  align?: "start" | "center" | "end" | "between";
}

export interface ModalLoadingProps {
  message?: string;
}

export interface ModalPreviewProps {
  children: React.ReactNode;
  className?: string;
}

// Modal context for passing onClose to children
const ModalContext = React.createContext<{ onClose: () => void } | null>(null);

function useModalContext() {
  const context = React.useContext(ModalContext);
  if (!context) {
    throw new Error("Modal components must be used within a Modal");
  }
  return context;
}

// Size classes mapping
const sizeClasses: Record<ModalSize, string> = {
  xs: "themed-modal__content--xs",
  sm: "themed-modal__content--sm",
  md: "themed-modal__content--md",
  lg: "themed-modal__content--lg",
  xl: "themed-modal__content--xl",
  "2xl": "themed-modal__content--2xl",
  full: "themed-modal__content--full",
};

// Modal root
function ModalRoot({
  children,
  open,
  onClose,
  size = "lg",
  className,
}: ModalProps) {
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
      <div className="themed-modal" onClick={onClose}>
        <div className="themed-modal-overlay" />
        <div
          className={cn("themed-modal__content", sizeClasses[size], className)}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </ModalContext.Provider>
  );
}

// Modal header
function ModalHeader({
  title,
  onClose,
  variant = "default",
  className,
}: ModalHeaderProps) {
  const { onClose: contextOnClose } = useModalContext();
  const handleClose = onClose || contextOnClose;

  const variantClasses: Record<string, string> = {
    default: "themed-modal__header--default",
    secondary: "themed-modal__header--secondary",
    danger: "themed-modal__header--danger",
    success: "themed-modal__header--success",
  };

  return (
    <div className={cn("themed-modal__header", variantClasses[variant], className)}>
      <h2 className="themed-modal__title">{title}</h2>
      <button
        onClick={handleClose}
        className="themed-modal__close"
        type="button"
        aria-label="Close modal"
      >
        <Icon name="X" className="w-5 h-5" />
      </button>
    </div>
  );
}

// Modal body
function ModalBody({
  children,
  flush,
  compact,
  className,
  ...props
}: ModalBodyProps) {
  return (
    <div
      className={cn(
        "themed-modal__body",
        flush && "themed-modal__body--flush",
        compact && "themed-modal__body--compact",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Modal footer
function ModalFooter({
  children,
  align = "end",
  className,
  ...props
}: ModalFooterProps) {
  const alignClasses: Record<string, string> = {
    start: "themed-modal__footer--start",
    center: "themed-modal__footer--center",
    end: "themed-modal__footer--end",
    between: "themed-modal__footer--between",
  };

  return (
    <div
      className={cn("themed-modal__footer", alignClasses[align], className)}
      {...props}
    >
      {children}
    </div>
  );
}

// Loading overlay for modal
function ModalLoading({ message = "Loading..." }: ModalLoadingProps) {
  return (
    <div className="themed-modal__loading">
      <Icon name="Loader2" className="w-5 h-5 animate-spin" />
      <span className="themed-modal__loading-text">{message}</span>
    </div>
  );
}

// Preview section for confirm modals
function ModalPreview({ children, className }: ModalPreviewProps) {
  return (
    <div className={cn("themed-modal__preview", className)}>{children}</div>
  );
}

// Compose the compound component
export const Modal = Object.assign(ModalRoot, {
  Header: ModalHeader,
  Body: ModalBody,
  Footer: ModalFooter,
  Loading: ModalLoading,
  Preview: ModalPreview,
});

// Also export individual components
export {
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalLoading,
  ModalPreview,
};
