"use client";

import { useEffect, useCallback, useRef } from "react";
import { getDB } from "@/lib/db/offline-db";
import type { FormDraft } from "@/lib/db/types";

const DEBOUNCE_MS = 1000;

/**
 * Hook for persisting form drafts to IndexedDB.
 * Enables draft recovery across sessions/reloads.
 *
 * @param formType - Type of form (e.g., "item-create", "inventory-edit")
 * @param draftId - Unique identifier for this draft instance
 * @returns { loadDraft, saveDraft, clearDraft }
 */
export function useFormDraft<T extends Record<string, unknown>>(
  formType: string,
  draftId: string
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load draft from IndexedDB
  const loadDraft = useCallback(async (): Promise<T | null> => {
    try {
      const db = await getDB();
      const draft = await db.get("formDrafts", draftId);
      if (draft && draft.formType === formType) {
        return draft.data as T;
      }
      return null;
    } catch (error) {
      console.warn("[FormDraft] Failed to load:", error);
      return null;
    }
  }, [draftId, formType]);

  // Save draft with debounce
  const saveDraft = useCallback(
    (data: Partial<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(async () => {
        try {
          const db = await getDB();
          const draft: FormDraft = {
            id: draftId,
            formType,
            data: data as Record<string, unknown>,
            savedAt: Date.now(),
          };
          await db.put("formDrafts", draft);
        } catch (error) {
          console.warn("[FormDraft] Failed to save:", error);
        }
      }, DEBOUNCE_MS);
    },
    [draftId, formType]
  );

  // Clear draft on successful submit
  const clearDraft = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    try {
      const db = await getDB();
      await db.delete("formDrafts", draftId);
    } catch (error) {
      console.warn("[FormDraft] Failed to clear:", error);
    }
  }, [draftId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { loadDraft, saveDraft, clearDraft };
}
