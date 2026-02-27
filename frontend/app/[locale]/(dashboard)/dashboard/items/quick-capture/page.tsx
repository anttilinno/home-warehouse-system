"use client";

import { BatchCaptureProvider } from "@/lib/contexts/batch-capture-context";
import { BatchSettingsBar } from "@/components/quick-capture/batch-settings-bar";
import { useTranslations } from "next-intl";

export default function QuickCaptureRoute() {
  return (
    <BatchCaptureProvider>
      <QuickCapturePageShell />
    </BatchCaptureProvider>
  );
}

function QuickCapturePageShell() {
  const t = useTranslations("quickCapture");
  return (
    <div className="flex flex-col h-[100dvh]">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
      </div>
      <BatchSettingsBar />
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        {/* QuickCapturePage component will replace this in Plan 02 */}
        <p>Quick Capture UI loading...</p>
      </div>
    </div>
  );
}
