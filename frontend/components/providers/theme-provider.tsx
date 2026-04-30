"use client";

import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useAuth } from "@/lib/contexts/auth-context";

const THEME_STORAGE_KEY = "theme";

/** Fire-and-forget save of theme preference to the backend. */
export function persistThemeToBackend(value: string) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (!token) return;
  fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/preferences`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
    body: JSON.stringify({ theme: value }),
  }).catch(() => {});
}

function ThemeSyncer({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { setTheme } = useTheme();

  useEffect(() => {
    if (!user?.theme) return;

    // Only sync from backend when no local preference exists yet (first login/new device).
    // After that, localStorage (managed by next-themes) is the device-local source of truth.
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (!storedTheme) {
      setTheme(user.theme);
    }
  }, [user?.theme, setTheme]);

  return <>{children}</>;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute={["class", "data-theme"]}
      defaultTheme="light"
      enableSystem
      themes={["light", "dark", "retro-terminal"]}
      disableTransitionOnChange
    >
      <ThemeSyncer>{children}</ThemeSyncer>
    </NextThemesProvider>
  );
}
