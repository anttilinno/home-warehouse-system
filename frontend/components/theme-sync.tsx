"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth";

/**
 * Synchronizes the user's saved theme preference from the database
 * with the next-themes provider. This component should be rendered
 * inside both ThemeProvider and AuthProvider.
 */
export function ThemeSync() {
  const { user, isAuthenticated } = useAuth();
  const { setTheme } = useTheme();

  useEffect(() => {
    // Apply user's saved theme when authenticated
    if (isAuthenticated && user?.theme && user.theme !== "system") {
      setTheme(user.theme);
    }
  }, [isAuthenticated, user?.theme, setTheme]);

  return null;
}
