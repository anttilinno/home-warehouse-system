import { useEffect, useRef, useCallback } from "react";

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean; // Command key on Mac
  description: string;
  action: (event: KeyboardEvent) => void;
  preventDefault?: boolean;
}

export interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
  ignoreInputFields?: boolean;
}

/**
 * Detects if user is on Mac (for Cmd vs Ctrl)
 */
function isMac(): boolean {
  if (typeof window === "undefined") return false;
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
}

/**
 * Checks if the event target is an input field
 */
function isInputField(target: EventTarget | null): boolean {
  if (!target) return false;
  const element = target as HTMLElement;
  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT" ||
    element.isContentEditable
  );
}

/**
 * Checks if a keyboard event matches a shortcut definition
 */
function matchesShortcut(
  event: KeyboardEvent,
  shortcut: KeyboardShortcut
): boolean {
  // Check key match (case-insensitive)
  if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) {
    return false;
  }

  // On Mac, ctrl maps to metaKey (Cmd), on other platforms it's ctrlKey
  const mac = isMac();
  const ctrlPressed = mac ? event.metaKey : event.ctrlKey;
  const metaPressed = mac ? event.ctrlKey : event.metaKey;

  // Check modifiers
  const ctrlMatch = shortcut.ctrl ? ctrlPressed : !ctrlPressed;
  const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
  const altMatch = shortcut.alt ? event.altKey : !event.altKey;
  const metaMatch = shortcut.meta ? metaPressed : !metaPressed;

  return ctrlMatch && shiftMatch && altMatch && metaMatch;
}

/**
 * Hook for managing keyboard shortcuts with automatic cleanup
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts({
 *   shortcuts: [
 *     {
 *       key: 'k',
 *       ctrl: true,
 *       description: 'Open command palette',
 *       action: () => setCommandPaletteOpen(true),
 *       preventDefault: true,
 *     },
 *     {
 *       key: 'n',
 *       ctrl: true,
 *       description: 'Create new item',
 *       action: () => router.push('/items/new'),
 *     },
 *   ],
 *   enabled: true,
 *   ignoreInputFields: true,
 * });
 * ```
 */
export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
  ignoreInputFields = true,
}: UseKeyboardShortcutsOptions) {
  // Use ref to avoid recreating handler on every render
  const shortcutsRef = useRef(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore shortcuts when typing in input fields
      if (ignoreInputFields && isInputField(event.target)) {
        return;
      }

      // Check each shortcut
      for (const shortcut of shortcutsRef.current) {
        if (matchesShortcut(event, shortcut)) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.action(event);
          // Only trigger the first matching shortcut
          break;
        }
      }
    },
    [enabled, ignoreInputFields]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
}

/**
 * Helper function to format keyboard shortcut for display
 * Converts modifier keys to platform-specific symbols
 *
 * @example
 * ```tsx
 * formatShortcut({ key: 'k', ctrl: true }) // Returns ['Ctrl', 'K'] or ['⌘', 'K'] on Mac
 * ```
 */
export function formatShortcut(shortcut: KeyboardShortcut): string[] {
  const keys: string[] = [];
  const mac = isMac();

  if (shortcut.ctrl) {
    keys.push(mac ? "⌘" : "Ctrl");
  }
  if (shortcut.shift) {
    keys.push("Shift");
  }
  if (shortcut.alt) {
    keys.push(mac ? "⌥" : "Alt");
  }
  if (shortcut.meta) {
    keys.push(mac ? "Ctrl" : "⊞ Win");
  }

  // Capitalize the key for display
  const displayKey = shortcut.key.length === 1
    ? shortcut.key.toUpperCase()
    : shortcut.key;
  keys.push(displayKey);

  return keys;
}
