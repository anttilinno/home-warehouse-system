"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ArrowLeft, Plus, Loader } from "lucide-react";
import { toast } from "sonner";
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
import { useAuth } from "@/lib/contexts/auth-context";
import { useAutoSKU } from "@/lib/hooks/use-auto-sku";
import { useCapturePhotos } from "@/lib/hooks/use-capture-photos";
import { useOfflineMutation } from "@/lib/hooks/use-offline-mutation";
import { triggerHaptic } from "@/lib/hooks/use-haptic";
import { useIsStandalone } from "@/lib/hooks/use-standalone";
import { initAudioContext, playSuccessBeep } from "@/lib/scanner/feedback";
import { validateImageFile, compressImage } from "@/lib/utils/image";
import { getAll, put } from "@/lib/db/offline-db";
import { categoriesApi } from "@/lib/api/categories";
import { locationsApi } from "@/lib/api/locations";
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
  const { workspaceId } = useAuth();

  // ---- State ----
  const [photos, setPhotos] = useState<CapturedPhotoLocal[]>([]);
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [creatingLocation, setCreatingLocation] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const newCategoryInputRef = useRef<HTMLInputElement>(null);
  const newLocationInputRef = useRef<HTMLInputElement>(null);
  const isStandalone = useIsStandalone();

  // ---- Hooks ----
  const { generateSKU } = useAutoSKU();
  const { storePhoto } = useCapturePhotos();
  const {
    settings,
    captureCount,
    incrementCaptureCount,
    resetSettings,
    setCategoryId,
    setLocationId,
    addSessionThumbnail,
    clearSessionThumbnails,
    sessionThumbnails,
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

  // ---- Lifecycle logging ----
  const mountId = useRef(Math.random().toString(36).slice(2, 10));
  useEffect(() => {
    console.log(`[QuickCapture:${mountId.current}] mounted, standalone=${isStandalone}`);
    return () => console.log(`[QuickCapture:${mountId.current}] unmounted`);
  }, [isStandalone]);

  // ---- Auto-trigger camera on mount (best-effort, may be blocked) ----
  useEffect(() => {
    console.log(`[QuickCapture:${mountId.current}] auto-triggering camera`);
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
      const tag = `[QuickCapture:${mountId.current}]`;
      console.log(`${tag} onChange fired, files=${e.target.files?.length ?? 0}`);

      const file = e.target.files?.[0];
      // Reset the input so the same file can be re-selected
      e.target.value = "";
      if (!file) {
        console.warn(`${tag} no file in input`);
        return;
      }

      console.log(`${tag} file: name=${file.name} type=${file.type} size=${file.size}`);

      const validation = validateImageFile(file);
      if (!validation.valid) {
        console.warn(`${tag} validation failed:`, validation.error);
        return;
      }

      try {
        console.log(`${tag} compressing…`);
        const compressed = await compressImage(file, 1920, 1920, 0.85);
        console.log(`${tag} compressed: size=${compressed.size} type=${compressed.type}`);
        const preview = URL.createObjectURL(compressed);
        const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);

        setPhotos((prev) => {
          console.log(`${tag} setPhotos: prev=${prev.length} → ${prev.length + 1}`);
          return [...prev, { id, blob: compressed, preview }];
        });

        // Auto-focus name input after first photo
        setTimeout(() => nameInputRef.current?.focus(), 100);
      } catch (err) {
        console.error(`${tag} compression error:`, err);
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
    console.log(`[QuickCapture:${mountId.current}] takePhoto clicked, inputRef exists=${!!cameraInputRef.current}`);
    cameraInputRef.current?.click();
  }, []);

  // ---- Save flow ----
  const handleSave = useCallback(async () => {
    const tag = `[QuickCapture:${mountId.current}]`;
    console.log(`${tag} save: name="${name.trim()}" photos=${photos.length} isSaving=${isSaving}`);
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
        min_stock_level: 0,
      };
      if (settings.categoryId) payload.category_id = settings.categoryId;

      console.log(`${tag} mutating with sku=${sku}`);
      const tempId = await mutate(payload);
      console.log(`${tag} mutate returned tempId=${tempId}`);

      // Store photos in IndexedDB linked to tempId
      for (const photo of photos) {
        console.log(`${tag} storing photo id=${photo.id} size=${photo.blob.size}`);
        await storePhoto(tempId, photo.blob);
      }

      // Feedback
      triggerHaptic("success");
      playSuccessBeep();
      incrementCaptureCount();

      // Capture summary thumbnail from first photo before object URLs are revoked
      if (photos[0]) {
        const summaryThumb = URL.createObjectURL(photos[0].blob);
        addSessionThumbnail(summaryThumb);
      }

      // Reset form for next item
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPhotos([]);
      setName("");
      console.log(`${tag} save complete, resetting form`);

      // Re-trigger camera for next capture
      setTimeout(() => cameraInputRef.current?.click(), 100);
    } catch (err) {
      console.error(`${tag} save error:`, err);
    } finally {
      setIsSaving(false);
    }
  }, [name, photos, isSaving, generateSKU, mutate, settings, storePhoto, incrementCaptureCount, addSessionThumbnail]);

  // ---- Load categories/locations for sheets ----
  const openCategorySheet = useCallback(() => {
    getAll<Category>("categories").then(setCategories);
    setCategorySheetOpen(true);
  }, []);

  const openLocationSheet = useCallback(() => {
    getAll<Location>("locations").then(setLocations);
    setLocationSheetOpen(true);
  }, []);

  // ---- Done / Session summary ----
  const handleDone = useCallback(() => {
    if (captureCount > 0) {
      setSummaryOpen(true);
    } else {
      router.push("/dashboard/items");
    }
  }, [captureCount, router]);

  const handleDismissSummary = useCallback(() => {
    setSummaryOpen(false);
    clearSessionThumbnails();
    resetSettings();
    router.push("/dashboard/items");
  }, [clearSessionThumbnails, resetSettings, router]);

  // ---- Create category handler ----
  const handleCreateCategory = useCallback(async (name: string) => {
    if (!workspaceId || !name.trim()) return;

    try {
      setCreatingCategory(true);
      const newCategory = await categoriesApi.create(workspaceId, {
        name: name.trim(),
      });

      // Add to IndexedDB cache so the context can resolve the name
      await put("categories", newCategory);

      setCategories((prev) => [...prev, newCategory]);
      setCategoryId(newCategory.id);
      setCategorySearch("");
      setCategorySheetOpen(false);
      toast.success("Category created", { duration: 2000 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create category";
      toast.error(message);
    } finally {
      setCreatingCategory(false);
    }
  }, [workspaceId, setCategoryId]);

  // ---- Create location handler ----
  const handleCreateLocation = useCallback(async (name: string) => {
    if (!workspaceId || !name.trim()) return;

    try {
      setCreatingLocation(true);
      const newLocation = await locationsApi.create(workspaceId, {
        name: name.trim(),
      });

      // Add to IndexedDB cache so the context can resolve the name
      await put("locations", newLocation);

      setLocations((prev) => [...prev, newLocation]);
      setLocationId(newLocation.id);
      setLocationSearch("");
      setLocationSheetOpen(false);
      toast.success("Location created", { duration: 2000 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create location";
      toast.error(message);
    } finally {
      setCreatingLocation(false);
    }
  }, [workspaceId, setLocationId]);

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
          onClick={handleDone}
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
      {/* In standalone PWA mode, omit capture to prevent the OS from
          suspending the webview when the native camera opens */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture={isStandalone ? undefined : "environment"}
        className="sr-only"
        onChange={handleCapture}
      />

      {/* Category Sheet */}
      <Sheet open={categorySheetOpen} onOpenChange={setCategorySheetOpen}>
        <SheetContent side="bottom" className="max-h-[60vh] flex flex-col">
          <SheetHeader>
            <SheetTitle>{t("selectCategory")}</SheetTitle>
          </SheetHeader>
          <div className="px-4 py-2 flex-shrink-0">
            <Input
              ref={newCategoryInputRef}
              type="text"
              placeholder="Search or type to create..."
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              disabled={creatingCategory}
              autoComplete="off"
            />
          </div>
          <div className="overflow-y-auto py-2 flex-1">
            {categorySearch === "" ? (
              <>
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
                    className="flex w-full items-center px-4 text-left hover:bg-accent"
                    style={{ minHeight: 44 }}
                    onClick={() => {
                      setCategoryId(cat.id);
                      setCategorySheetOpen(false);
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
              </>
            ) : (
              <>
                {categories
                  .filter((cat) =>
                    cat.name.toLowerCase().includes(categorySearch.toLowerCase())
                  )
                  .map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className="flex w-full items-center px-4 text-left hover:bg-accent"
                      style={{ minHeight: 44 }}
                      onClick={() => {
                        setCategoryId(cat.id);
                        setCategorySearch("");
                        setCategorySheetOpen(false);
                      }}
                    >
                      {cat.name}
                    </button>
                  ))}
                {categories.every(
                  (cat) =>
                    !cat.name.toLowerCase().includes(categorySearch.toLowerCase())
                ) && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 text-left text-primary font-medium hover:bg-accent"
                    style={{ minHeight: 44 }}
                    onClick={() =>
                      handleCreateCategory(categorySearch)
                    }
                    disabled={creatingCategory}
                  >
                    {creatingCategory ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Create "{categorySearch}"
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Session Summary Sheet */}
      <Sheet open={summaryOpen} onOpenChange={(open) => { if (!open) handleDismissSummary(); }}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>{t("sessionSummary")}</SheetTitle>
          </SheetHeader>
          <div className="py-4">
            <p className="text-center text-lg font-semibold">
              {t("sessionSummaryDescription", { count: captureCount })}
            </p>
            {sessionThumbnails.length > 0 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                {sessionThumbnails.slice(0, 8).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className="h-16 w-16 rounded-md object-cover shrink-0"
                  />
                ))}
                {captureCount > 8 && (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                    +{captureCount - 8}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2 pb-4">
            <Button variant="outline" className="flex-1" onClick={() => setSummaryOpen(false)}>
              {t("sessionSummaryCapture")}
            </Button>
            <Button className="flex-1" onClick={handleDismissSummary}>
              {t("sessionSummaryContinue")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Location Sheet */}
      <Sheet open={locationSheetOpen} onOpenChange={setLocationSheetOpen}>
        <SheetContent side="bottom" className="max-h-[60vh] flex flex-col">
          <SheetHeader>
            <SheetTitle>{t("selectLocation")}</SheetTitle>
          </SheetHeader>
          <div className="px-4 py-2 flex-shrink-0">
            <Input
              ref={newLocationInputRef}
              type="text"
              placeholder="Search or type to create..."
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              disabled={creatingLocation}
              autoComplete="off"
            />
          </div>
          <div className="overflow-y-auto py-2 flex-1">
            {locationSearch === "" ? (
              <>
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
                    className="flex w-full items-center px-4 text-left hover:bg-accent"
                    style={{ minHeight: 44 }}
                    onClick={() => {
                      setLocationId(loc.id);
                      setLocationSheetOpen(false);
                    }}
                  >
                    {loc.name}
                  </button>
                ))}
              </>
            ) : (
              <>
                {locations
                  .filter((loc) =>
                    loc.name.toLowerCase().includes(locationSearch.toLowerCase())
                  )
                  .map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      className="flex w-full items-center px-4 text-left hover:bg-accent"
                      style={{ minHeight: 44 }}
                      onClick={() => {
                        setLocationId(loc.id);
                        setLocationSearch("");
                        setLocationSheetOpen(false);
                      }}
                    >
                      {loc.name}
                    </button>
                  ))}
                {locations.every(
                  (loc) =>
                    !loc.name.toLowerCase().includes(locationSearch.toLowerCase())
                ) && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 text-left text-primary font-medium hover:bg-accent"
                    style={{ minHeight: 44 }}
                    onClick={() =>
                      handleCreateLocation(locationSearch)
                    }
                    disabled={creatingLocation}
                  >
                    {creatingLocation ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Create "{locationSearch}"
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
