import type { ItemPhoto } from "@/lib/api/itemPhotos";
import { ItemPhotoTile } from "./ItemPhotoTile";

export interface ItemPhotoGridProps {
  photos: ItemPhoto[];
  onTileClick: (index: number) => void;
}

/**
 * Pure presentational responsive grid of photo tiles.
 *
 * Layout (UI-SPEC):
 *   - 3 columns on mobile (grid-cols-3)
 *   - 4 columns on large screens (lg:grid-cols-4, ≥1024px)
 *   - gap-sm (8px) on mobile, gap-md (16px) from the `sm` breakpoint up
 *
 * The grid does not own empty-state rendering — the parent gallery
 * decides whether to render this component or an empty state.
 */
export function ItemPhotoGrid({ photos, onTileClick }: ItemPhotoGridProps) {
  return (
    <div
      className="grid grid-cols-3 gap-sm sm:gap-md lg:grid-cols-4"
      role="list"
    >
      {photos.map((photo, index) => (
        <div role="listitem" key={photo.id}>
          <ItemPhotoTile
            photo={photo}
            isPrimary={photo.is_primary}
            onClick={() => onTileClick(index)}
          />
        </div>
      ))}
    </div>
  );
}
