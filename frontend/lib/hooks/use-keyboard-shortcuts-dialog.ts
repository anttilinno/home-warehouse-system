import { useState, useEffect } from "react";

/**
 * Hook for managing keyboard shortcuts help dialog state
 * Opens dialog with Ctrl+/ or ? key
 *
 * @returns Dialog state and toggle function
 */
export function useKeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+/ or Cmd+/
      if (e.key === "/" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      // ? key (Shift+/)
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Don't open if user is typing in an input field
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }

        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    open,
    setOpen,
  };
}
