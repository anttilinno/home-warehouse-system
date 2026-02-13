"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Sun, Moon, Monitor } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/lib/contexts/auth-context";
import { toast } from "sonner";

const THEME_OPTIONS = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
] as const;

export function ThemeSettings() {
  const t = useTranslations("settings.appearance");
  const { user, refreshUser } = useAuth();
  const { setTheme } = useTheme();
  const [isUpdating, setIsUpdating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Current theme from user preferences (backend source of truth for persistence)
  const currentTheme = user?.theme || "system";

  const handleChange = async (value: string) => {
    if (value === currentTheme) return;

    // 1. Instant visual change via next-themes
    setTheme(value);

    // 2. Persist to backend
    setIsUpdating(true);
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/me/preferences`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          credentials: "include",
          body: JSON.stringify({ theme: value }),
        }
      );
      await refreshUser();
      toast.success(t("saved"));
    } catch {
      // Revert next-themes on error
      setTheme(currentTheme);
      toast.error(t("saveError"));
    } finally {
      setIsUpdating(false);
    }
  };

  if (!mounted) return null; // Prevent hydration mismatch

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={currentTheme}
          onValueChange={handleChange}
          disabled={isUpdating}
          className="space-y-3"
        >
          {THEME_OPTIONS.map(({ value, icon: Icon }) => (
            <div
              key={value}
              className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
            >
              <RadioGroupItem value={value} id={`theme-${value}`} />
              <Label
                htmlFor={`theme-${value}`}
                className="flex-1 flex items-center gap-2 cursor-pointer"
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{t(value)}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
