"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BatchSettingsBar } from "@/components/quick-capture/batch-settings-bar";
import { CapturePhotoStrip } from "@/components/quick-capture/capture-photo-strip";
import { BatchCaptureProvider, useBatchCapture } from "@/lib/contexts/batch-capture-context";
import { useAutoSKU } from "@/lib/hooks/use-auto-sku";
import { useCapturePhotos } from "@/lib/hooks/use-capture-photos";
import { useOfflineMutation } from "@/lib/hooks/use-offline-mutation";
import { triggerHaptic } from "@/lib/hooks/use-haptic";
import { initAudioContext, playSuccessBeep } from "@/lib/scanner/feedback";
import { validateImageFile, compressImage } from "@/lib/utils/image";
import { getAll } from "@/lib/db/offline-db";
import type { Category } from "@/lib/api/categories";
import type { Location } from "@/lib/types/locations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CapturedPhotoLocal {
  id: string;
  blob: Blob;
  preview: string; // Object URL
}

// ---------------------------------------------------------------------------
// Route wrapper
// ---------------------------------------------------------------------------

export default function QuickCaptureRoute() {
  return (
    <BatchCaptureProvider>
      <QuickCapturePage />
    </BatchCaptureProvider>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

function QuickCapturePage() {
  const t = useTranslations("quickCapture");
  const router = useRouter();

  // ---- State ----
  const [photos, setPhotos] = useState<CapturedPhotoLocal[]>([]);
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ---- Hooks ----
  const { generateSKU } = useAutoSKU();
  const { storePhoto } = useCapturePhotos();
  const {
    settings,
    captureCount,
    incrementCaptureCount,
    setCategoryId,
    setLocationId,
  } = useBatchCapture();
  const { mutate, isPending } = useOfflineMutation<Record<string, unknown>>({
    entity: "items",
    operation: "create",
  });

  // ---- AudioContext initialization on first user gesture (iOS) ----
  useEffect(() => {
    const handler = () => {
      initAudioContext();
      document.removeEventListener("click", handler);
      document.removeEventListener("touchstart", handler);
    };
    document.addEventListener("click", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  // ---- Auto-trigger camera on mount (best-effort, may be blocked) ----
  useEffect(() => {
    const timer = setTimeout(() => {
      cameraInputRef.current?.click();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // ---- Object URL cleanup on unmount ----
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Camera capture handler ----
  const handleCapture = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset the input so the same file can be re-selected
      e.target.value = "";
      if (!file) return;

      const validation = validateImageFile(file);
      if (!validation.valid) return;

      try {
        const compressed = await compressImage(file, 1920, 1920, 0.85);
        const preview = URL.createObjectURL(compressed);
        const id = crypto.randomUUID();

        setPhotos((prev) => [...prev, { id, blob: compressed, preview }]);

        // Auto-focus name input after first photo
        setTimeout(() => nameInputRef.current?.focus(), 100);
      } catch {
        // Compression failed -- skip this photo silently
      }
    },
    []
  );

  // ---- Photo removal ----
  const handleRemovePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo) URL.revokeObjectURL(photo.preview);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  // ---- Take photo trigger ----
  const handleTakePhoto = useCallback(() => {
    cameraInputRef.current?.click();
  }, []);

  // ---- Save flow ----
  const handleSave = useCallback(async () => {
    if (!name.trim() || photos.length === 0 || isSaving) return;
    setIsSaving(true);

    try {
      const sku = generateSKU();
      // Note: location_id is not part of the items API — it belongs to inventory.
      // We only send fields the items endpoint accepts.
      const payload: Record<string, unknown> = {
        sku,
        name: name.trim(),
        needs_review: true,
      };
      if (settings.categoryId) payload.category_id = settings.categoryId;

      const tempId = await mutate(payload);

      // Store photos in IndexedDB linked to tempId
      for (const photo of photos) {
        await storePhoto(tempId, photo.blob);
      }

      // Feedback
      triggerHaptic("success");
      playSuccessBeep();
      incrementCaptureCount();

      // Reset form for next item
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPhotos([]);
      setName("");

      // Re-trigger camera for next capture
      setTimeout(() => cameraInputRef.current?.click(), 100);
    } finally {
      setIsSaving(false);
    }
  }, [name, photos, isSaving, generateSKU, mutate, settings, storePhoto, incrementCaptureCount]);

  // ---- Load categories/locations for sheets ----
  const openCategorySheet = useCallback(() => {
    getAll<Category>("categories").then(setCategories);
    setCategorySheetOpen(true);
  }, []);

  const openLocationSheet = useCallback(() => {
    getAll<Location>("locations").then(setLocations);
    setLocationSheetOpen(true);
  }, []);

  // ---- Derived state ----
  const canSave = name.trim().length > 0 && photos.length > 0 && !isSaving && !isPending;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">{t("title")}</h1>
          {captureCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {t("capturedCount", { count: captureCount })}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/items")}
          className="gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("done")}
        </Button>
      </div>

      {/* Batch settings */}
      <BatchSettingsBar
        onCategoryTap={openCategorySheet}
        onLocationTap={openLocationSheet}
      />

      {/* Photo strip */}
      <div className="flex-shrink-0 px-4 py-3">
        <CapturePhotoStrip
          photos={photos.map((p) => ({ id: p.id, preview: p.preview }))}
          onTakePhoto={handleTakePhoto}
          onRemovePhoto={handleRemovePhoto}
        />
      </div>

      {/* Name input */}
      <div className="flex-shrink-0 px-4">
        <Input
          ref={nameInputRef}
          type="text"
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSave) {
              handleSave();
            }
          }}
          autoComplete="off"
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save button */}
      <div className="flex-shrink-0 px-4 pb-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <Button
          className="w-full"
          size="lg"
          disabled={!canSave}
          onClick={handleSave}
        >
          {isSaving || isPending ? t("saving") : t("save")}
        </Button>
      </div>

      {/* Hidden camera input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleCapture}
      />

      {/* Category Sheet */}
      <Sheet open={categorySheetOpen} onOpenChange={setCategorySheetOpen}>
        <SheetContent side="bottom" className="max-h-[60vh]">
          <SheetHeader>
            <SheetTitle>{t("selectCategory")}</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto py-2">
            <button
              type="button"
              className="flex w-full items-center px-4 text-left text-muted-foreground"
              style={{ minHeight: 44 }}
              onClick={() => {
                setCategoryId(null);
                setCategorySheetOpen(false);
              }}
            >
              {t("noneSelected")}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="flex w-full items-center px-4 text-left"
                style={{ minHeight: 44 }}
                onClick={() => {
                  setCategoryId(cat.id);
                  setCategorySheetOpen(false);
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Location Sheet */}
      <Sheet open={locationSheetOpen} onOpenChange={setLocationSheetOpen}>
        <SheetContent side="bottom" className="max-h-[60vh]">
          <SheetHeader>
            <SheetTitle>{t("selectLocation")}</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto py-2">
            <button
              type="button"
              className="flex w-full items-center px-4 text-left text-muted-foreground"
              style={{ minHeight: 44 }}
              onClick={() => {
                setLocationId(null);
                setLocationSheetOpen(false);
              }}
            >
              {t("noneSelected")}
            </button>
            {locations.map((loc) => (
              <button
                key={loc.id}
                type="button"
                className="flex w-full items-center px-4 text-left"
                style={{ minHeight: 44 }}
                onClick={() => {
                  setLocationId(loc.id);
                  setLocationSheetOpen(false);
                }}
              >
                {loc.name}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
