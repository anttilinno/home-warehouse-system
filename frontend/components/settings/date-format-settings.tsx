"use client";

import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/lib/contexts/auth-context";
import { toast } from "sonner";
import { format } from "date-fns";
import type { DateFormatOption, PresetDateFormat } from "@/lib/hooks/use-date-format";

const DATE_FORMAT_OPTIONS: {
  value: PresetDateFormat;
  label: string;
  dateFns: string;
}[] = [
  { value: "MM/DD/YY", label: "MM/DD/YY", dateFns: "MM/dd/yy" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY", dateFns: "dd/MM/yyyy" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD", dateFns: "yyyy-MM-dd" },
];

const CUSTOM_FORMAT_VALUE = "CUSTOM";

export function DateFormatSettings() {
  const t = useTranslations("settings.dateFormat");
  const { user, refreshUser } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [customFormat, setCustomFormat] = useState("");
  const [customFormatError, setCustomFormatError] = useState("");

  // Current selection (default to YYYY-MM-DD if not set)
  const currentFormat =
    (user?.date_format as DateFormatOption) || "YYYY-MM-DD";

  // Determine if current format is a preset or custom
  const isPreset = DATE_FORMAT_OPTIONS.some(opt => opt.value === currentFormat);
  const selectedValue = isPreset ? currentFormat : CUSTOM_FORMAT_VALUE;

  // Initialize custom format if current format is custom
  useEffect(() => {
    if (!isPreset && !customFormat && currentFormat) {
      setCustomFormat(currentFormat);
    }
  }, [isPreset, customFormat, currentFormat]);

  // Example date for preview
  const exampleDate = new Date();

  const handleChange = async (value: string) => {
    // If selecting custom format, don't save yet - wait for user to input format
    if (value === CUSTOM_FORMAT_VALUE) {
      return;
    }

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

  const handleCustomFormatSave = async () => {
    if (!customFormat.trim()) {
      setCustomFormatError("Format cannot be empty");
      return;
    }

    // Validate format by trying to format a date
    try {
      format(exampleDate, customFormat);
      setCustomFormatError("");
    } catch {
      setCustomFormatError("Invalid date format. Use date-fns format tokens (e.g., yyyy-MM-dd)");
      return;
    }

    if (customFormat === currentFormat) return;

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
          body: JSON.stringify({ date_format: customFormat }),
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

  // Get preview for custom format
  const getCustomPreview = () => {
    if (!customFormat.trim()) return "";
    try {
      return format(exampleDate, customFormat);
    } catch {
      return "Invalid format";
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
          value={selectedValue}
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

          {/* Custom Format Option */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center space-x-3">
              <RadioGroupItem value={CUSTOM_FORMAT_VALUE} id={CUSTOM_FORMAT_VALUE} />
              <Label
                htmlFor={CUSTOM_FORMAT_VALUE}
                className="flex-1 cursor-pointer font-medium"
              >
                Custom Format
              </Label>
            </div>

            {selectedValue === CUSTOM_FORMAT_VALUE && (
              <div className="mt-3 ml-7 space-y-2">
                <Input
                  type="text"
                  placeholder="yyyy-MM-dd HH:mm"
                  value={customFormat}
                  onChange={(e) => {
                    setCustomFormat(e.target.value);
                    setCustomFormatError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCustomFormatSave();
                    }
                  }}
                  className={customFormatError ? "border-destructive" : ""}
                  disabled={isUpdating}
                />
                {customFormatError && (
                  <p className="text-xs text-destructive">{customFormatError}</p>
                )}
                {!customFormatError && customFormat && (
                  <p className="text-xs text-muted-foreground">
                    Preview: {getCustomPreview()}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Use date-fns format tokens. Examples: yyyy-MM-dd, dd/MM/yyyy HH:mm, MMM d, yyyy
                </p>
                <button
                  type="button"
                  onClick={handleCustomFormatSave}
                  disabled={isUpdating || !customFormat.trim()}
                  className="text-xs text-primary hover:underline disabled:opacity-50"
                >
                  Apply Custom Format
                </button>
              </div>
            )}
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
