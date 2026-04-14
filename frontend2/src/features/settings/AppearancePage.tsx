import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { RetroPanel, RetroButton, useToast } from "@/components/retro";
import { ToggleGroup } from "./ToggleGroup";
import { useAuth } from "@/features/auth/AuthContext";
import { patch } from "@/lib/api";
import type { User } from "@/lib/types";

function resolveTheme(theme: string): string {
  if (theme === "system") {
    if (typeof window.matchMedia !== "function") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

function applyTheme(theme: string) {
  document.documentElement.setAttribute("data-theme", resolveTheme(theme));
}

export function AppearancePage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();

  // Apply theme on mount
  useEffect(() => {
    if (user?.theme) {
      applyTheme(user.theme);
    }
  }, [user?.theme]);

  // Listen to OS theme changes when system theme is active
  useEffect(() => {
    if (user?.theme === "system" && typeof window.matchMedia === "function") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [user?.theme]);

  async function handleThemeChange(theme: string) {
    try {
      await patch<User>("/users/me/preferences", { theme });
      await refreshUser();
      applyTheme(theme);
      addToast(t`CHANGES SAVED`, "success");
    } catch {
      addToast(
        t`Failed to save changes. Check your connection and try again.`,
        "error"
      );
    }
  }

  const themeOptions = [
    { label: t`LIGHT`, value: "light" },
    { label: t`DARK`, value: "dark" },
    { label: t`SYSTEM`, value: "system" },
  ];

  return (
    <div className="max-w-[600px] mx-auto p-lg flex flex-col gap-md">
      <RetroButton variant="neutral" onClick={() => navigate("/settings")}>
        {t`BACK`}
      </RetroButton>
      <RetroPanel showHazardStripe title={t`APPEARANCE`}>
        <div className="flex flex-col gap-md">
          <h3 className="font-bold uppercase text-[14px] text-retro-ink mb-md">
            {t`THEME`}
          </h3>
          <ToggleGroup
            options={themeOptions}
            value={user?.theme ?? "system"}
            onChange={handleThemeChange}
            aria-label={t`Theme`}
          />
        </div>
      </RetroPanel>
    </div>
  );
}
