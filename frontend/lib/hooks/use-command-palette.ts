import { useState, useEffect } from "react";

/**
 * Hook for managing command palette state and keyboard shortcuts
 * Opens command palette with Cmd+K (Mac) or Ctrl+K (Windows/Linux)
 *
 * @returns Command palette state and toggle function
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return {
    open,
    setOpen,
  };
}
