"use client";

import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useAuth } from "@/lib/contexts/auth-context";

function ThemeSyncer({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    if (user?.theme && user.theme !== theme) {
      setTheme(user.theme);
    }
  }, [user?.theme]); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeSyncer>{children}</ThemeSyncer>
    </NextThemesProvider>
  );
}
