"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DeclutterGroupBy } from "@/lib/types/declutter";

interface DeclutterFiltersProps {
  thresholdDays: number;
  groupBy: DeclutterGroupBy;
  onThresholdChange: (days: number) => void;
  onGroupByChange: (groupBy: DeclutterGroupBy) => void;
}

export function DeclutterFilters({
  thresholdDays,
  groupBy,
  onThresholdChange,
  onGroupByChange,
}: DeclutterFiltersProps) {
  const t = useTranslations("declutter.filters");

  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{t("threshold")}:</span>
        <Select
          value={thresholdDays.toString()}
          onValueChange={(v) => onThresholdChange(parseInt(v, 10))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="90">{t("days90")}</SelectItem>
            <SelectItem value="180">{t("days180")}</SelectItem>
            <SelectItem value="365">{t("days365")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{t("groupBy")}:</span>
        <Select
          value={groupBy || "none"}
          onValueChange={(v) => onGroupByChange(v === "none" ? "" : (v as DeclutterGroupBy))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("none")}</SelectItem>
            <SelectItem value="category">{t("category")}</SelectItem>
            <SelectItem value="location">{t("location")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
