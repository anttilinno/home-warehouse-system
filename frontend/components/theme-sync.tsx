"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth";

/**
 * Synchronizes the user's saved theme preference from the database
 * with the next-themes provider on initial login/page load only.
 * After initial sync, user changes via UI take precedence until saved.
 */
export function ThemeSync() {
  const { user, isAuthenticated } = useAuth();
  const { setTheme } = useTheme();
  const hasAppliedTheme = useRef(false);

  useEffect(() => {
    // Only apply theme ONCE on initial load when user is authenticated
    // This prevents overriding user's UI selections before they save
    if (isAuthenticated && user?.theme && !hasAppliedTheme.current) {
      hasAppliedTheme.current = true;
      if (user.theme !== "system") {
        setTheme(user.theme);
      }
    }

    // Reset the flag when user logs out so theme is applied on next login
    if (!isAuthenticated) {
      hasAppliedTheme.current = false;
    }
  }, [isAuthenticated, user?.theme, setTheme]);

  return null;
}
