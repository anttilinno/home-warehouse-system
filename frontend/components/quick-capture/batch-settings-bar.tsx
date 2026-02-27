"use client";

import { FolderOpen, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBatchCapture } from "@/lib/contexts/batch-capture-context";
import { cn } from "@/lib/utils";

interface BatchSettingsBarProps {
  onCategoryTap?: () => void;
  onLocationTap?: () => void;
}

export function BatchSettingsBar({
  onCategoryTap,
  onLocationTap,
}: BatchSettingsBarProps) {
  const { settings, categoryName, locationName } = useBatchCapture();

  const hasCategory = settings.categoryId !== null;
  const hasLocation = settings.locationId !== null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "rounded-full text-xs h-7",
          hasCategory && "bg-primary/10 border-primary/30"
        )}
        onClick={onCategoryTap}
      >
        <FolderOpen className="h-3 w-3 mr-1" />
        {categoryName ?? "Category"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "rounded-full text-xs h-7",
          hasLocation && "bg-primary/10 border-primary/30"
        )}
        onClick={onLocationTap}
      >
        <MapPin className="h-3 w-3 mr-1" />
        {locationName ?? "Location"}
      </Button>
    </div>
  );
}
