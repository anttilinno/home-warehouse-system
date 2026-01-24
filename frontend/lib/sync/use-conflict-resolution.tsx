"use client";

/**
 * Conflict Resolution Hook
 *
 * Provides React context for managing sync conflicts:
 * - Queue of pending conflicts requiring user decision
 * - Toast notifications for auto-resolved (LWW) conflicts
 * - Integration point for SyncManager resolution callbacks
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type { MutationEntityType } from "@/lib/db/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Resolution strategy for conflicts.
 * - 'local': Keep the client's version
 * - 'server': Use the server's version
 * - 'merged': Custom merge of both versions
 */
export type ConflictResolution = "local" | "server" | "merged";

/**
 * A pending conflict that requires user decision.
 */
export interface PendingConflict {
  /** Unique ID for this conflict instance */
  id: string;
  /** Type of entity in conflict */
  entityType: MutationEntityType;
  /** ID of the conflicting entity */
  entityId: string;
  /** Human-readable name for display (e.g., "Power Drill") */
  entityName?: string;
  /** Local (client) data */
  localData: Record<string, unknown>;
  /** Server data */
  serverData: Record<string, unknown>;
  /** Fields that have conflicting values */
  conflictFields: string[];
  /** When the conflict was detected */
  timestamp: number;
}

/**
 * Context value type for conflict resolution
 */
export interface ConflictResolutionContextType {
  /** Queue of pending conflicts (FIFO) */
  pendingConflicts: PendingConflict[];
  /** Current conflict being displayed (first in queue) */
  currentConflict: PendingConflict | null;
  /** Number of pending conflicts */
  conflictCount: number;
  /** Add a new conflict to the queue */
  addConflict: (conflict: Omit<PendingConflict, "id" | "timestamp">) => void;
  /** Resolve a conflict with the chosen strategy */
  resolveConflict: (
    id: string,
    resolution: ConflictResolution,
    mergedData?: Record<string, unknown>
  ) => void;
  /** Dismiss a conflict without resolving */
  dismissConflict: (id: string) => void;
  /** Show toast for auto-resolved (LWW) conflict */
  showAutoResolvedToast: (entityType: string, entityName: string) => void;
  /** Show toast for critical conflict queued for review */
  showCriticalConflictToast: (entityType: string, entityName: string) => void;
}

/**
 * Props for the ConflictResolutionProvider
 */
export interface ConflictResolutionProviderProps {
  children: ReactNode;
  /** Callback when a conflict is resolved - for SyncManager integration */
  onResolve?: (
    conflict: PendingConflict,
    resolution: ConflictResolution,
    resolvedData?: Record<string, unknown>
  ) => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

const ConflictResolutionContext =
  createContext<ConflictResolutionContextType | null>(null);

// ============================================================================
// Provider
// ============================================================================

/**
 * Provider component for conflict resolution context.
 *
 * Manages a FIFO queue of conflicts and provides toast notification helpers.
 * Wrap your app with this provider to enable conflict resolution UI.
 */
export function ConflictResolutionProvider({
  children,
  onResolve,
}: ConflictResolutionProviderProps) {
  const [pendingConflicts, setPendingConflicts] = useState<PendingConflict[]>(
    []
  );

  // Track toast IDs for cleanup on unmount
  const toastIdsRef = useRef<Set<string | number>>(new Set());

  // Current conflict is first in queue (FIFO)
  const currentConflict =
    pendingConflicts.length > 0 ? pendingConflicts[0] : null;

  // Add a new conflict to the queue
  const addConflict = useCallback(
    (conflict: Omit<PendingConflict, "id" | "timestamp">) => {
      const newConflict: PendingConflict = {
        ...conflict,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };

      setPendingConflicts((prev) => [...prev, newConflict]);
    },
    []
  );

  // Resolve a conflict - remove from queue and call callback
  const resolveConflict = useCallback(
    async (
      id: string,
      resolution: ConflictResolution,
      mergedData?: Record<string, unknown>
    ) => {
      const conflict = pendingConflicts.find((c) => c.id === id);
      if (!conflict) return;

      // Remove from queue
      setPendingConflicts((prev) => prev.filter((c) => c.id !== id));

      // Call resolution callback if provided
      if (onResolve) {
        try {
          await onResolve(conflict, resolution, mergedData);
        } catch (error) {
          console.error("[ConflictResolution] onResolve callback failed:", error);
        }
      }
    },
    [pendingConflicts, onResolve]
  );

  // Dismiss a conflict without resolving
  const dismissConflict = useCallback((id: string) => {
    setPendingConflicts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Show toast for auto-resolved (LWW) conflict
  const showAutoResolvedToast = useCallback(
    (entityType: string, entityName: string) => {
      const toastId = toast.info("Changes merged", {
        description: `Your edits to '${entityName}' were merged with server changes`,
        duration: 4000,
      });
      if (toastId) toastIdsRef.current.add(toastId);
    },
    []
  );

  // Show toast for critical conflict queued for review
  const showCriticalConflictToast = useCallback(
    (entityType: string, entityName: string) => {
      const toastId = toast.warning("Review required", {
        description: `Changes to '${entityName}' need your attention`,
        duration: 10000,
        action: {
          label: "Review",
          onClick: () => {
            // Scroll to top / focus dialog - the dialog will show automatically
            // since currentConflict will be set
            window.scrollTo({ top: 0, behavior: "smooth" });
          },
        },
      });
      if (toastId) toastIdsRef.current.add(toastId);
    },
    []
  );

  // Cleanup toasts on unmount
  useEffect(() => {
    const toastIds = toastIdsRef.current;
    return () => {
      // Dismiss all toasts created by this provider
      toastIds.forEach((id) => {
        toast.dismiss(id);
      });
      toastIds.clear();
    };
  }, []);

  const value: ConflictResolutionContextType = {
    pendingConflicts,
    currentConflict,
    conflictCount: pendingConflicts.length,
    addConflict,
    resolveConflict,
    dismissConflict,
    showAutoResolvedToast,
    showCriticalConflictToast,
  };

  return (
    <ConflictResolutionContext.Provider value={value}>
      {children}
    </ConflictResolutionContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access conflict resolution context.
 *
 * Must be used within a ConflictResolutionProvider.
 *
 * @returns ConflictResolutionContextType
 * @throws Error if used outside provider
 */
export function useConflictResolution(): ConflictResolutionContextType {
  const context = useContext(ConflictResolutionContext);

  if (!context) {
    throw new Error(
      "useConflictResolution must be used within a ConflictResolutionProvider"
    );
  }

  return context;
}
