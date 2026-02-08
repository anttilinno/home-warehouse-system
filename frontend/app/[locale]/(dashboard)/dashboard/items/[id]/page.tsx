"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Pencil, Archive, ArchiveRestore, Package, Barcode, Tag, Shield, FileText, Clock, Camera, ImagePlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PhotoGalleryContainer } from "@/components/items/photo-gallery-container";
import { PhotoUpload } from "@/components/items/photo-upload";
import { PhotoPlaceholder } from "@/components/items/photo-placeholder";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useSSE, type SSEEvent } from "@/lib/hooks/use-sse";
import { useItemPhotos } from "@/lib/hooks/use-item-photos";
import { useDateFormat } from "@/lib/hooks/use-date-format";
import { useNumberFormat } from "@/lib/hooks/use-number-format";
import { itemsApi } from "@/lib/api";
import type { Item } from "@/lib/types/items";
import type { ItemPhoto } from "@/lib/types/item-photo";
import { cn } from "@/lib/utils";

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("items");
  const tPhotos = useTranslations("photos");
  const { workspaceId, hasPermission } = useWorkspace();
  const { formatDate } = useDateFormat();
  const { formatNumber } = useNumberFormat();
  const itemId = params.id as string;

  const [item, setItem] = useState<Item | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadSection, setShowUploadSection] = useState(false);

  // Fetch item photos
  const {
    photos,
    primaryPhoto,
    loading: photosLoading,
    refresh: refetchPhotos,
  } = useItemPhotos({ workspaceId: workspaceId || "", itemId, autoFetch: !!workspaceId });

  // Check edit permissions
  const canEdit = hasPermission("edit");

  // Load item details
  const loadItem = async () => {
    if (!itemId || !workspaceId) return;

    try {
      setIsLoading(true);
      const data = await itemsApi.get(workspaceId, itemId);
      setItem(data);
    } catch (error) {
      console.error("Failed to load item:", error);
      toast.error("Failed to load item details");
      router.push("/dashboard/items");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadItem();
  }, [itemId, workspaceId]);

  // Subscribe to SSE events for real-time updates
  useSSE({
    onEvent: (event: SSEEvent) => {
      // Handle item events
      if (event.entity_type === "item" && event.entity_id === itemId) {
        switch (event.type) {
          case "item.updated":
            loadItem();
            break;
          case "item.deleted":
            toast.info("This item has been deleted");
            router.push("/dashboard/items");
            break;
        }
      }

      // Handle photo events
      if (event.entity_type === "itemphoto") {
        const photoItemId = event.data?.item_id;
        if (photoItemId === itemId) {
          switch (event.type) {
            case "itemphoto.created":
              refetchPhotos();
              break;
            case "itemphoto.updated":
              refetchPhotos();
              break;
            case "itemphoto.deleted":
              refetchPhotos();
              break;
          }
        }
      }
    },
  });

  const handleArchive = async () => {
    if (!item || !workspaceId) return;

    try {
      if (item.is_archived) {
        await itemsApi.restore(workspaceId, item.id);
        toast.success("Item restored successfully");
      } else {
        await itemsApi.archive(workspaceId, item.id);
        toast.success("Item archived successfully");
      }
      loadItem();
    } catch (error) {
      toast.error("Failed to archive item");
    }
  };

  const handleEdit = () => {
    router.push(`/dashboard/items/${itemId}/edit`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-96 md:col-span-1" />
          <Skeleton className="h-96 md:col-span-2" />
        </div>
      </div>
    );
  }

  if (!item) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/items")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{item.name}</h1>
              {item.is_archived && (
                <Badge variant="secondary">Archived</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              SKU: {item.sku}
              {item.short_code && ` • ${item.short_code}`}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {canEdit && (
            <>
              <Button variant="outline" onClick={handleEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button variant="outline" onClick={handleArchive}>
                {item.is_archived ? (
                  <>
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                    Restore
                  </>
                ) : (
                  <>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Photo Section */}
        <Card className="md:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Photos
                </CardTitle>
                <CardDescription>
                  {photos.length} photo{photos.length !== 1 ? "s" : ""}
                </CardDescription>
              </div>
              {canEdit && photos.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUploadSection(!showUploadSection)}
                >
                  <ImagePlus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Primary Photo Display */}
            {primaryPhoto ? (
              <div className="aspect-square overflow-hidden rounded-lg border bg-muted">
                <img
                  src={primaryPhoto.urls?.medium || primaryPhoto.urls?.small || primaryPhoto.urls?.original}
                  alt={primaryPhoto.caption || item.name}
                  className="h-full w-full object-cover transition-transform hover:scale-105"
                  loading="lazy"
                />
              </div>
            ) : (
              <PhotoPlaceholder
                size="xl"
                className="w-full aspect-square"
                ariaLabel={`No photos for ${item.name}`}
              />
            )}

            {/* Photo Upload Section */}
            {canEdit && (showUploadSection || photos.length === 0) && workspaceId && (
              <PhotoUpload
                workspaceId={workspaceId}
                itemId={itemId}
                onUploadComplete={(uploadedPhotos: ItemPhoto[]) => {
                  refetchPhotos();
                  if (uploadedPhotos.length > 0) {
                    setShowUploadSection(false);
                  }
                }}
                maxFiles={10}
              />
            )}

            {/* Photo Gallery with full functionality */}
            {photos.length > 0 && workspaceId && (
              <div className="pt-2">
                <PhotoGalleryContainer
                  workspaceId={workspaceId}
                  itemId={itemId}
                  onUploadClick={canEdit ? () => setShowUploadSection(true) : undefined}
                />
              </div>
            )}

            {/* Empty state prompt for adding photos */}
            {photos.length === 0 && !canEdit && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No photos have been added to this item yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Details Section */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Item Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Description */}
            {item.description && (
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <FileText className="h-4 w-4" />
                  Description
                </h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            )}

            <Separator />

            {/* Product Information */}
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Package className="h-4 w-4" />
                Product Information
              </h3>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                {item.brand && (
                  <>
                    <dt className="text-muted-foreground">Brand</dt>
                    <dd className="font-medium">{item.brand}</dd>
                  </>
                )}
                {item.model && (
                  <>
                    <dt className="text-muted-foreground">Model</dt>
                    <dd className="font-medium">{item.model}</dd>
                  </>
                )}
                {item.manufacturer && (
                  <>
                    <dt className="text-muted-foreground">Manufacturer</dt>
                    <dd className="font-medium">{item.manufacturer}</dd>
                  </>
                )}
                {item.serial_number && (
                  <>
                    <dt className="text-muted-foreground">Serial Number</dt>
                    <dd className="font-medium font-mono">{item.serial_number}</dd>
                  </>
                )}
              </dl>
            </div>

            <Separator />

            {/* Identification */}
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Barcode className="h-4 w-4" />
                Identification
              </h3>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <dt className="text-muted-foreground">SKU</dt>
                <dd className="font-medium font-mono">{item.sku}</dd>
                {item.short_code && (
                  <>
                    <dt className="text-muted-foreground">Short Code</dt>
                    <dd className="font-medium">
                      <Badge variant="outline">{item.short_code}</Badge>
                    </dd>
                  </>
                )}
                {item.barcode && (
                  <>
                    <dt className="text-muted-foreground">Barcode</dt>
                    <dd className="font-medium font-mono">{item.barcode}</dd>
                  </>
                )}
              </dl>
            </div>

            <Separator />

            {/* Warranty & Insurance */}
            {(item.is_insured || item.lifetime_warranty || item.warranty_details) && (
              <>
                <div>
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                    <Shield className="h-4 w-4" />
                    Warranty & Insurance
                  </h3>
                  <div className="space-y-3">
                    {item.is_insured && (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Insured</Badge>
                      </div>
                    )}
                    {item.lifetime_warranty && (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Lifetime Warranty</Badge>
                      </div>
                    )}
                    {item.warranty_details && (
                      <p className="text-sm text-muted-foreground">
                        {item.warranty_details}
                      </p>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Inventory */}
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Tag className="h-4 w-4" />
                Inventory
              </h3>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <dt className="text-muted-foreground">Minimum Stock Level</dt>
                <dd className="font-medium">{formatNumber(item.min_stock_level)}</dd>
              </dl>
            </div>

            <Separator />

            {/* Metadata */}
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4" />
                Metadata
              </h3>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <dt className="text-muted-foreground">Created</dt>
                <dd className="font-medium">
                  {formatDate(item.created_at)}
                </dd>
                <dt className="text-muted-foreground">Last Updated</dt>
                <dd className="font-medium">
                  {formatDate(item.updated_at)}
                </dd>
              </dl>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
