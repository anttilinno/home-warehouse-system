/**
 * Scan Page
 *
 * Single-page scan flow for barcode and QR code scanning.
 *
 * CRITICAL FOR IOS PWA:
 * - Scanner component stays MOUNTED throughout the flow
 * - Quick actions overlay on top of scanner (don't navigate away)
 * - This prevents iOS from re-requesting camera permissions
 *
 * @see 19-RESEARCH.md Pattern 1: Single-Page Scan Flow for iOS PWA
 */
"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScanLine, Keyboard, History } from "lucide-react";
import type { IDetectedBarcode } from "@yudiel/react-qr-scanner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarcodeScanner,
  QuickActionMenu,
  ManualEntryInput,
  ScanHistoryList,
  type QuickAction,
} from "@/components/scanner";
import {
  lookupByShortCode,
  addToScanHistory,
  createHistoryEntry,
  initAudioContext,
  triggerScanFeedback,
  type EntityMatch,
  type ScanHistoryEntry,
} from "@/lib/scanner";
import { cn } from "@/lib/utils";

export default function ScanPage() {
  const t = useTranslations("scanner");
  const router = useRouter();

  // Scanner state
  const [isPaused, setIsPaused] = useState(false);
  const [currentMatch, setCurrentMatch] = useState<EntityMatch | null>(null);
  const [activeTab, setActiveTab] = useState("scan");

  // Initialize audio context on first user interaction
  useEffect(() => {
    const handleInteraction = () => {
      initAudioContext();
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
    };

    document.addEventListener("click", handleInteraction);
    document.addEventListener("touchstart", handleInteraction);

    return () => {
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
    };
  }, []);

  // Handle successful scan
  const handleScan = useCallback(
    async (results: IDetectedBarcode[]) => {
      if (results.length === 0 || isPaused) return;

      const firstResult = results[0];
      const code = firstResult.rawValue;
      const format = firstResult.format || "unknown";

      if (!code) return;

      // Pause scanner while processing
      setIsPaused(true);

      try {
        // Look up the code in IndexedDB
        const match = await lookupByShortCode(code);

        // Trigger feedback
        triggerScanFeedback();

        // Add to history
        const historyEntry = createHistoryEntry(code, format, match);
        addToScanHistory(historyEntry);

        // Show result
        setCurrentMatch(match);

        // Show toast
        if (match.type !== "not_found") {
          toast.success(t("feedback.found", { name: match.entity.name }));
        } else {
          toast.info(t("feedback.notFound"));
        }
      } catch (error) {
        console.error("[ScanPage] Lookup failed:", error);
        toast.error("Failed to look up code");
        setIsPaused(false);
      }
    },
    [isPaused, t]
  );

  // Handle scanner error
  const handleScanError = useCallback((error: unknown) => {
    console.error("[ScanPage] Scanner error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    toast.error("Scanner error", { description: message });
  }, []);

  // Handle closing action menu (resume scanning)
  const handleCloseActionMenu = useCallback(() => {
    setCurrentMatch(null);
    setIsPaused(false);
  }, []);

  // Handle quick action selection
  const handleAction = useCallback(
    (action: QuickAction) => {
      if (!currentMatch || currentMatch.type === "not_found") return;

      const entity = currentMatch.entity;

      switch (action) {
        case "view":
          // Navigate to entity detail
          if (currentMatch.type === "item") {
            router.push(`/dashboard/items/${entity.id}`);
          } else if (currentMatch.type === "container") {
            router.push(`/dashboard/containers?selected=${entity.id}`);
          } else if (currentMatch.type === "location") {
            router.push(`/dashboard/locations?selected=${entity.id}`);
          }
          break;

        case "loan":
          // Navigate to loans page with item pre-selected
          if (currentMatch.type === "item") {
            router.push(`/dashboard/loans/new?item=${entity.id}`);
          }
          break;

        case "move":
          // Navigate to move flow (TODO: implement move dialog)
          toast.info("Move feature coming soon");
          handleCloseActionMenu();
          break;

        case "repair":
          // Navigate to repair log
          if (currentMatch.type === "item") {
            router.push(`/dashboard/items/${entity.id}?tab=repairs`);
          }
          break;

        default:
          handleCloseActionMenu();
      }
    },
    [currentMatch, router, handleCloseActionMenu]
  );

  // Handle manual entry submission
  const handleManualSubmit = useCallback(
    async (code: string) => {
      try {
        const match = await lookupByShortCode(code);

        // Add to history
        const historyEntry = createHistoryEntry(code, "manual", match);
        addToScanHistory(historyEntry);

        // Show result in scan tab
        setCurrentMatch(match);
        setActiveTab("scan");
        setIsPaused(true);

        if (match.type !== "not_found") {
          toast.success(t("feedback.found", { name: match.entity.name }));
        } else {
          toast.info(t("feedback.notFound"));
        }
      } catch (error) {
        console.error("[ScanPage] Manual lookup failed:", error);
        toast.error("Failed to look up code");
      }
    },
    [t]
  );

  // Handle history item selection
  const handleHistorySelect = useCallback(async (entry: ScanHistoryEntry) => {
    // Re-lookup to get fresh data
    try {
      const match = await lookupByShortCode(entry.code);
      setCurrentMatch(match);
      setActiveTab("scan");
      setIsPaused(true);
    } catch (error) {
      console.error("[ScanPage] History lookup failed:", error);
      toast.error("Failed to look up code");
    }
  }, []);

  // Handle tab change
  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value);
      // Resume scanning when switching back to scan tab
      if (value === "scan" && !currentMatch) {
        setIsPaused(false);
      }
    },
    [currentMatch]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      {/* Main content */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="scan" className="flex items-center gap-2">
                <ScanLine className="h-4 w-4" />
                {t("tabs.scan")}
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <Keyboard className="h-4 w-4" />
                {t("tabs.manual")}
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                {t("tabs.history")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="scan" className="mt-0">
              {/* Scanner with action menu overlay */}
              <div className="relative">
                <BarcodeScanner
                  onScan={handleScan}
                  onError={handleScanError}
                  paused={isPaused}
                  className="rounded-lg"
                />

                {/* Quick action menu overlay */}
                {currentMatch && (
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <QuickActionMenu
                      match={currentMatch}
                      onAction={handleAction}
                      onClose={handleCloseActionMenu}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="manual" className="mt-0">
              <div className="py-8">
                <ManualEntryInput onSubmit={handleManualSubmit} autoFocus />
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <ScanHistoryList onSelect={handleHistorySelect} maxEntries={10} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
