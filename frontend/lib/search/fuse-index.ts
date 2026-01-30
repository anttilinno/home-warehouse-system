/**
 * Fuse.js Index Builders
 *
 * Factory functions for creating Fuse.js search indices for each entity type.
 * These indices are designed to be memoized with useMemo in components to avoid
 * re-indexing on every render (addresses Pitfall 3-F from research).
 *
 * Usage:
 * ```tsx
 * const fuse = useMemo(() => createItemsFuse(items), [items]);
 * const results = fuse.search(query);
 * ```
 *
 * Weight rationale:
 * - name: Highest weight (2.0) - primary identifier users search for
 * - short_code/sku: High weight (1.5) - quick lookup codes
 * - secondary identifiers: Medium weight (1.0) - brand, model, zone, etc.
 * - supplementary fields: Lower weight (0.8) - serial_number, manufacturer, notes
 * - descriptions: Lower weight (0.5) - usually searched as fallback
 */

import Fuse, { type IFuseOptions } from "fuse.js";
import type { Item } from "@/lib/types/items";
import type { Borrower } from "@/lib/types/borrowers";
import type { Container } from "@/lib/types/containers";
import type { Location } from "@/lib/types/locations";
import type { Category } from "@/lib/api/categories";

/**
 * Shared Fuse options optimized for inventory search.
 *
 * Configuration choices:
 * - threshold: 0.4 allows 1-2 character typos while avoiding false positives
 * - distance: 100 searches entire field content
 * - ignoreLocation: true searches entire string, not just beginning
 * - minMatchCharLength: 2 prevents single-character noise
 */
export const FuseSearchOptions: IFuseOptions<unknown> = {
  threshold: 0.4,
  distance: 100,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
  ignoreLocation: true,
  useExtendedSearch: false,
};

/**
 * Creates a Fuse.js index for searching items.
 *
 * Search fields with weights:
 * - name (2.0): Primary identifier
 * - sku (1.5): Stock keeping unit for quick lookup
 * - short_code (1.5): QR/label code for quick lookup
 * - brand (1.0): Brand name
 * - model (1.0): Model name
 * - serial_number (0.8): Serial number (less commonly searched)
 * - manufacturer (0.8): Manufacturer name
 *
 * @param items - Array of Item objects to index
 * @returns Fuse instance configured for item search
 */
export function createItemsFuse(items: Item[]): Fuse<Item> {
  return new Fuse(items, {
    ...FuseSearchOptions,
    keys: [
      { name: "name", weight: 2 },
      { name: "sku", weight: 1.5 },
      { name: "short_code", weight: 1.5 },
      { name: "brand", weight: 1 },
      { name: "model", weight: 1 },
      { name: "serial_number", weight: 0.8 },
      { name: "manufacturer", weight: 0.8 },
    ],
  });
}

/**
 * Creates a Fuse.js index for searching borrowers.
 *
 * Search fields with weights:
 * - name (2.0): Primary identifier
 * - email (1.0): Contact email
 * - phone (1.0): Contact phone
 * - notes (0.5): Additional notes
 *
 * @param borrowers - Array of Borrower objects to index
 * @returns Fuse instance configured for borrower search
 */
export function createBorrowersFuse(borrowers: Borrower[]): Fuse<Borrower> {
  return new Fuse(borrowers, {
    ...FuseSearchOptions,
    keys: [
      { name: "name", weight: 2 },
      { name: "email", weight: 1 },
      { name: "phone", weight: 1 },
      { name: "notes", weight: 0.5 },
    ],
  });
}

/**
 * Creates a Fuse.js index for searching containers.
 *
 * Search fields with weights:
 * - name (2.0): Primary identifier
 * - short_code (1.5): QR/label code for quick lookup
 * - description (0.5): Container description
 *
 * @param containers - Array of Container objects to index
 * @returns Fuse instance configured for container search
 */
export function createContainersFuse(containers: Container[]): Fuse<Container> {
  return new Fuse(containers, {
    ...FuseSearchOptions,
    keys: [
      { name: "name", weight: 2 },
      { name: "short_code", weight: 1.5 },
      { name: "description", weight: 0.5 },
    ],
  });
}

/**
 * Creates a Fuse.js index for searching locations.
 *
 * Search fields with weights:
 * - name (2.0): Primary identifier
 * - short_code (1.5): QR/label code for quick lookup
 * - zone (1.0): Location zone
 * - shelf (1.0): Shelf identifier
 * - bin (1.0): Bin identifier
 * - description (0.5): Location description
 *
 * @param locations - Array of Location objects to index
 * @returns Fuse instance configured for location search
 */
export function createLocationsFuse(locations: Location[]): Fuse<Location> {
  return new Fuse(locations, {
    ...FuseSearchOptions,
    keys: [
      { name: "name", weight: 2 },
      { name: "short_code", weight: 1.5 },
      { name: "zone", weight: 1 },
      { name: "shelf", weight: 1 },
      { name: "bin", weight: 1 },
      { name: "description", weight: 0.5 },
    ],
  });
}

/**
 * Creates a Fuse.js index for searching categories.
 *
 * Search fields with weights:
 * - name (2.0): Primary identifier
 * - description (0.5): Category description
 *
 * @param categories - Array of Category objects to index
 * @returns Fuse instance configured for category search
 */
export function createCategoriesFuse(categories: Category[]): Fuse<Category> {
  return new Fuse(categories, {
    ...FuseSearchOptions,
    keys: [
      { name: "name", weight: 2 },
      { name: "description", weight: 0.5 },
    ],
  });
}
