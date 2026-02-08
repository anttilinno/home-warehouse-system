"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
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
import type { TimeFormatOption } from "@/lib/hooks/use-time-format";

const TIME_FORMAT_OPTIONS: {
  value: TimeFormatOption;
  dateFns: string;
}[] = [
  { value: "24h", dateFns: "HH:mm" },
  { value: "12h", dateFns: "h:mm a" },
];

export function TimeFormatSettings() {
  const t = useTranslations("settings.timeFormat");
  const { user, refreshUser } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  const currentFormat =
    (user?.time_format as TimeFormatOption) || "24h";

  const handleChange = async (value: string) => {
    if (value === currentFormat) return;

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
          body: JSON.stringify({ time_format: value }),
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
          <Clock className="h-5 w-5" />
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
          {TIME_FORMAT_OPTIONS.map((option) => (
            <div
              key={option.value}
              className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
            >
              <RadioGroupItem value={option.value} id={`time-${option.value}`} />
              <Label
                htmlFor={`time-${option.value}`}
                className="flex-1 flex justify-between items-center cursor-pointer"
              >
                <span className="font-medium">{t(option.value)}</span>
                <span className="text-muted-foreground text-sm">
                  {format(new Date(), option.dateFns)}
                </span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
