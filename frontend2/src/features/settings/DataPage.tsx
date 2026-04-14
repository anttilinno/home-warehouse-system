import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { RetroPanel, RetroButton } from "@/components/retro";
import { HazardStripe } from "@/components/retro/HazardStripe";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/retro/RetroToast";
import { post } from "@/lib/api";
import type { ImportResult } from "@/lib/types";

export function DataPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { workspaceId } = useAuth();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/export/workspace?format=json`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "workspace-export.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast(t`EXPORT COMPLETE`, "success");
    } catch {
      addToast(t`Failed to export workspace`, "error");
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix (e.g., "data:application/json;base64,")
          const base64 = result.split(",")[1] || result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await post<ImportResult>(
        `/workspaces/${workspaceId}/import/workspace`,
        { format: "json", data: base64Data }
      );

      if (result && result.failed > 0) {
        addToast(
          t`IMPORT COMPLETE` + ` (${result.succeeded}/${result.total_rows})`,
          "info"
        );
      } else {
        addToast(t`IMPORT COMPLETE`, "success");
      }
    } catch {
      addToast(t`IMPORT FAILED`, "error");
    } finally {
      setImporting(false);
      e.target.value = ""; // Reset file input
    }
  }

  return (
    <div className="max-w-[600px] mx-auto p-lg flex flex-col gap-md">
      <RetroButton variant="neutral" onClick={() => navigate("/settings")}>
        {t`BACK`}
      </RetroButton>
      <RetroPanel showHazardStripe title={t`DATA`}>
        <div className="flex flex-col gap-xl">
          {/* Export section */}
          <div>
            <h3 className="font-bold uppercase text-[14px] text-retro-ink">
              {t`EXPORT WORKSPACE`}
            </h3>
            <p className="text-[14px] text-retro-ink mb-md">
              {t`Download all workspace data as a JSON file.`}
            </p>
            <RetroButton
              variant="neutral"
              onClick={handleExport}
              disabled={exporting || !workspaceId}
            >
              {exporting ? t`EXPORTING...` : t`EXPORT`}
            </RetroButton>
          </div>

          <HazardStripe />

          {/* Import section */}
          <div>
            <h3 className="font-bold uppercase text-[14px] text-retro-ink">
              {t`IMPORT WORKSPACE`}
            </h3>
            <p className="text-[14px] text-retro-ink mb-md">
              {t`Upload a workspace JSON file to import data.`}
            </p>
            <RetroButton
              variant="neutral"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing || !workspaceId}
            >
              {importing ? t`IMPORTING...` : t`IMPORT`}
            </RetroButton>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              aria-label={t`Import workspace file`}
              className="hidden"
              onChange={handleImport}
            />
          </div>
        </div>
      </RetroPanel>
    </div>
  );
}
