/**
 * ScanHistoryList Component
 *
 * Displays recent scan history with timestamps.
 * Allows users to quickly access previously scanned items.
 */
"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Package, Box, MapPin, HelpCircle, Clock, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getScanHistory,
  clearScanHistory,
  type ScanHistoryEntry,
} from "@/lib/scanner";
import { useDateFormat } from "@/lib/hooks/use-date-format";

export interface ScanHistoryListProps {
  /** Called when user taps a history entry */
  onSelect: (entry: ScanHistoryEntry) => void;
  /** Maximum entries to display */
  maxEntries?: number;
  /** Additional CSS classes */
  className?: string;
}

const ENTITY_ICONS = {
  item: Package,
  container: Box,
  location: MapPin,
  unknown: HelpCircle,
} as const;

export function ScanHistoryList({
  onSelect,
  maxEntries = 10,
  className,
}: ScanHistoryListProps) {
  const t = useTranslations("scanner.history");
  const { formatDateTime } = useDateFormat();
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);

  const formatScanTimestamp = (timestamp: number): string => {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHour < 24) return `${diffHour} hr ago`;
    return formatDateTime(new Date(timestamp));
  };

  // Load history from localStorage on mount and listen for changes
  useEffect(() => {
    const loadHistory = () => {
      setHistory(getScanHistory().slice(0, maxEntries));
    };

    loadHistory();

    // Listen for storage events (from other tabs or forced refresh)
    const handleStorage = () => loadHistory();
    window.addEventListener("storage", handleStorage);

    return () => window.removeEventListener("storage", handleStorage);
  }, [maxEntries]);

  // Handle clear all
  const handleClearAll = () => {
    clearScanHistory();
    setHistory([]);
  };

  if (history.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {t("title")}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="h-8 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            {t("clearAll")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="max-h-[200px] overflow-y-auto">
          <div className="space-y-1">
            {history.map((entry) => {
              const Icon = ENTITY_ICONS[entry.entityType];
              return (
                <button
                  key={`${entry.code}-${entry.timestamp}`}
                  onClick={() => onSelect(entry)}
                  className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors text-left"
                >
                  <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {entry.entityName || entry.code}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {entry.entityType !== "unknown"
                        ? `${entry.entityType} \u2022 ${entry.code}`
                        : entry.code}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatScanTimestamp(entry.timestamp)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ScanHistoryList;
