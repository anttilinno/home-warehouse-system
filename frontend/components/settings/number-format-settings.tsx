"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Hash } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/contexts/auth-context";
import { toast } from "sonner";
import type {
  ThousandSeparator,
  DecimalSeparator,
} from "@/lib/hooks/use-number-format";

const THOUSAND_SEPARATOR_OPTIONS: {
  value: ThousandSeparator;
  labelKey: string;
}[] = [
  { value: ",", labelKey: "comma" },
  { value: ".", labelKey: "period" },
  { value: " ", labelKey: "space" },
];

const DECIMAL_SEPARATOR_OPTIONS: {
  value: DecimalSeparator;
  labelKey: string;
}[] = [
  { value: ".", labelKey: "decimalPeriod" },
  { value: ",", labelKey: "decimalComma" },
];

const hasConflict = (newThousand: string, newDecimal: string): boolean => {
  return newThousand === newDecimal;
};

export function NumberFormatSettings() {
  const t = useTranslations("settings.numberFormat");
  const { user, refreshUser } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [conflictError, setConflictError] = useState("");

  const thousandSep =
    (user?.thousand_separator as ThousandSeparator) || ",";
  const decimalSep =
    (user?.decimal_separator as DecimalSeparator) || ".";

  const previewNumber = useMemo(() => {
    const integer = "1234567";
    const decimal = "89";
    const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
    return `${formatted}${decimalSep}${decimal}`;
  }, [thousandSep, decimalSep]);

  const handleThousandChange = async (value: string) => {
    if (hasConflict(value, decimalSep)) {
      setConflictError(t("conflictError"));
      return;
    }

    setConflictError("");
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
          body: JSON.stringify({ thousand_separator: value }),
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

  const handleDecimalChange = async (value: string) => {
    if (hasConflict(thousandSep, value)) {
      setConflictError(t("conflictError"));
      return;
    }

    setConflictError("");
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
          body: JSON.stringify({ decimal_separator: value }),
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
          <Hash className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Thousand Separator */}
          <div className="space-y-2">
            <Label>{t("thousandSeparator")}</Label>
            <Select
              value={thousandSep}
              onValueChange={handleThousandChange}
              disabled={isUpdating}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THOUSAND_SEPARATOR_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Decimal Separator */}
          <div className="space-y-2">
            <Label>{t("decimalSeparator")}</Label>
            <Select
              value={decimalSep}
              onValueChange={handleDecimalChange}
              disabled={isUpdating}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DECIMAL_SEPARATOR_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conflict Error */}
          {conflictError && (
            <p className="text-sm text-destructive">{conflictError}</p>
          )}

          {/* Live Preview */}
          <div className="rounded-lg border p-3 bg-muted/50">
            <p className="text-sm text-muted-foreground mb-1">{t("preview")}</p>
            <p className="text-lg font-mono">{previewNumber}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
