"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Globe } from "lucide-react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { locales, localeNames, localeFlags, type Locale } from "@/i18n/config";
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

export function LanguageSettings() {
  const t = useTranslations("settings.language");
  const { user, refreshUser } = useAuth();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isUpdating, setIsUpdating] = useState(false);

  const currentLanguage = (user?.language || locale) as Locale;

  const handleChange = async (value: string) => {
    if (value === currentLanguage) return;
    setIsUpdating(true);
    try {
      // 1. Persist to backend
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/me/preferences`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          credentials: "include",
          body: JSON.stringify({ language: value }),
        }
      );
      await refreshUser();
      // 2. Switch locale route (causes navigation/re-render)
      router.replace(pathname, { locale: value as Locale });
    } catch {
      toast.error(t("saveError"));
      setIsUpdating(false);
    }
    // Note: setIsUpdating(false) not needed in success path - page re-renders
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={currentLanguage}
          onValueChange={handleChange}
          disabled={isUpdating}
          className="space-y-3"
        >
          {locales.map((loc) => (
            <div
              key={loc}
              className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
            >
              <RadioGroupItem value={loc} id={`lang-${loc}`} />
              <Label
                htmlFor={`lang-${loc}`}
                className="flex-1 flex items-center gap-2 cursor-pointer"
              >
                <span>{localeFlags[loc]}</span>
                <span className="font-medium">{localeNames[loc]}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
