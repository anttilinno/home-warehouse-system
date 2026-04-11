import { useState } from "react";
import { useNavigate } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { RetroPanel, RetroButton } from "@/components/retro";
import { ToggleGroup } from "./ToggleGroup";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/retro/RetroToast";
import { patch } from "@/lib/api";
import type { User } from "@/lib/types";

function formatDatePreview(format: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  switch (format) {
    case "DD/MM/YYYY":
      return `${d}/${m}/${y}`;
    case "MM/DD/YYYY":
      return `${m}/${d}/${y}`;
    default:
      return `${y}-${m}-${d}`;
  }
}

function formatTimePreview(format: string): string {
  const now = new Date();
  if (format === "12h") {
    return now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  return now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getNumberFormatValue(ts: string, ds: string): string {
  if (ts === "." && ds === ",") return "dot-comma";
  if (ts === " " && ds === ",") return "space-comma";
  return "comma-dot";
}

function formatNumberPreview(ts: string, ds: string): string {
  const parts = "1234567.89".split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ts);
  return intPart + ds + parts[1];
}

function parseNumberFormat(value: string): { thousand_separator: string; decimal_separator: string } {
  switch (value) {
    case "dot-comma":
      return { thousand_separator: ".", decimal_separator: "," };
    case "space-comma":
      return { thousand_separator: " ", decimal_separator: "," };
    default:
      return { thousand_separator: ",", decimal_separator: "." };
  }
}

export function FormatsPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();

  const [dateFormat, setDateFormat] = useState(user?.date_format ?? "YYYY-MM-DD");
  const [timeFormat, setTimeFormat] = useState(user?.time_format ?? "24h");
  const [numberFormat, setNumberFormat] = useState(
    getNumberFormatValue(
      user?.thousand_separator ?? ",",
      user?.decimal_separator ?? "."
    )
  );

  async function handleDateFormatChange(value: string) {
    setDateFormat(value);
    try {
      await patch<User>("/users/me/preferences", { date_format: value });
      await refreshUser();
      addToast(t`CHANGES SAVED`, "success");
    } catch {
      addToast(t`Failed to save changes. Check your connection and try again.`, "error");
    }
  }

  async function handleTimeFormatChange(value: string) {
    setTimeFormat(value);
    try {
      await patch<User>("/users/me/preferences", { time_format: value });
      await refreshUser();
      addToast(t`CHANGES SAVED`, "success");
    } catch {
      addToast(t`Failed to save changes. Check your connection and try again.`, "error");
    }
  }

  async function handleNumberFormatChange(value: string) {
    setNumberFormat(value);
    const { thousand_separator, decimal_separator } = parseNumberFormat(value);
    try {
      await patch<User>("/users/me/preferences", { thousand_separator, decimal_separator });
      await refreshUser();
      addToast(t`CHANGES SAVED`, "success");
    } catch {
      addToast(t`Failed to save changes. Check your connection and try again.`, "error");
    }
  }

  const dateOptions = [
    { label: "YYYY-MM-DD", value: "YYYY-MM-DD" },
    { label: "DD/MM/YYYY", value: "DD/MM/YYYY" },
    { label: "MM/DD/YYYY", value: "MM/DD/YYYY" },
  ];

  const timeOptions = [
    { label: "24H", value: "24h" },
    { label: "12H", value: "12h" },
  ];

  const numberOptions = [
    { label: "1,000.00", value: "comma-dot" },
    { label: "1.000,00", value: "dot-comma" },
    { label: "1 000,00", value: "space-comma" },
  ];

  const { thousand_separator, decimal_separator } = parseNumberFormat(numberFormat);

  return (
    <div className="max-w-[600px] mx-auto p-lg flex flex-col gap-md">
      <RetroButton variant="neutral" onClick={() => navigate("/settings")}>
        {t`BACK`}
      </RetroButton>
      <RetroPanel showHazardStripe title={t`REGIONAL FORMATS`}>
        <div className="flex flex-col gap-xl">
          {/* Date Format */}
          <div>
            <h3 className="font-bold uppercase text-[14px] text-retro-ink mb-md">
              {t`DATE FORMAT`}
            </h3>
            <ToggleGroup
              options={dateOptions}
              value={dateFormat}
              onChange={handleDateFormatChange}
              aria-label={t`Date format`}
            />
            <p
              className="font-mono text-[14px] text-retro-ink mt-sm"
              aria-live="polite"
            >
              {formatDatePreview(dateFormat)}
            </p>
          </div>

          {/* Time Format */}
          <div>
            <h3 className="font-bold uppercase text-[14px] text-retro-ink mb-md">
              {t`TIME FORMAT`}
            </h3>
            <ToggleGroup
              options={timeOptions}
              value={timeFormat}
              onChange={handleTimeFormatChange}
              aria-label={t`Time format`}
            />
            <p
              className="font-mono text-[14px] text-retro-ink mt-sm"
              aria-live="polite"
            >
              {formatTimePreview(timeFormat)}
            </p>
          </div>

          {/* Number Format */}
          <div>
            <h3 className="font-bold uppercase text-[14px] text-retro-ink mb-md">
              {t`NUMBER FORMAT`}
            </h3>
            <ToggleGroup
              options={numberOptions}
              value={numberFormat}
              onChange={handleNumberFormatChange}
              aria-label={t`Number format`}
            />
            <p
              className="font-mono text-[14px] text-retro-ink mt-sm"
              aria-live="polite"
            >
              {formatNumberPreview(thousand_separator, decimal_separator)}
            </p>
          </div>
        </div>
      </RetroPanel>
    </div>
  );
}
