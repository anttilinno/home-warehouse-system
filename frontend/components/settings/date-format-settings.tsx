"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Calendar } from "lucide-react";
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
import { format } from "date-fns";
import type { DateFormatOption } from "@/lib/hooks/use-date-format";

const DATE_FORMAT_OPTIONS: {
  value: DateFormatOption;
  label: string;
  dateFns: string;
}[] = [
  { value: "MM/DD/YY", label: "MM/DD/YY", dateFns: "MM/dd/yy" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY", dateFns: "dd/MM/yyyy" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD", dateFns: "yyyy-MM-dd" },
];

export function DateFormatSettings() {
  const t = useTranslations("settings.dateFormat");
  const { user, refreshUser } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  // Current selection (default to YYYY-MM-DD if not set)
  const currentFormat =
    (user?.date_format as DateFormatOption) || "YYYY-MM-DD";

  // Example date for preview
  const exampleDate = new Date();

  const handleChange = async (value: string) => {
    if (value === currentFormat) return;

    setIsUpdating(true);
    try {
      // Use existing preferences endpoint
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/me/preferences`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          credentials: "include",
          body: JSON.stringify({ date_format: value }),
        }
      );
      await refreshUser();
      toast.success(t("saved"));
    } catch {
      toast.error(t("saveError"));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={currentFormat}
          onValueChange={handleChange}
          disabled={isUpdating}
          className="space-y-3"
        >
          {DATE_FORMAT_OPTIONS.map((option) => (
            <div
              key={option.value}
              className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
            >
              <RadioGroupItem value={option.value} id={option.value} />
              <Label
                htmlFor={option.value}
                className="flex-1 flex justify-between items-center cursor-pointer"
              >
                <span className="font-medium">{option.label}</span>
                <span className="text-muted-foreground text-sm">
                  {format(exampleDate, option.dateFns)}
                </span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
