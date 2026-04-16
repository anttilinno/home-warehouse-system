/**
 * Item test fixtures — re-exports taxonomy fixtures for shared utilities
 * (renderWithProviders, setupDialogMocks, TestAuthContext) and adds an
 * item-specific entity factory.
 */
import type { Item } from "@/lib/api/items";
import type { ItemPhoto } from "@/lib/api/itemPhotos";

export {
  TestAuthContext,
  renderWithProviders,
  setupDialogMocks,
} from "@/features/taxonomy/__tests__/fixtures";

export const DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";
export const NOW = "2026-04-16T12:00:00.000Z";

/**
 * makeItem — factory for Item test fixtures with sensible defaults.
 *
 * Override any field via the overrides object. Not every Item field is
 * required for most tests; the factory provides deterministic values for
 * test stability.
 */
export function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: overrides.id ?? "55555555-5555-5555-5555-555555555555",
    workspace_id: overrides.workspace_id ?? DEFAULT_WORKSPACE_ID,
    sku: overrides.sku ?? "ITEM-TEST-0001",
    name: overrides.name ?? "Test Item",
    description: overrides.description ?? null,
    category_id: overrides.category_id ?? null,
    brand: overrides.brand ?? null,
    model: overrides.model ?? null,
    image_url: overrides.image_url ?? null,
    serial_number: overrides.serial_number ?? null,
    manufacturer: overrides.manufacturer ?? null,
    barcode: overrides.barcode ?? null,
    is_insured: overrides.is_insured ?? false,
    is_archived: overrides.is_archived ?? false,
    lifetime_warranty: overrides.lifetime_warranty ?? false,
    needs_review: overrides.needs_review ?? false,
    warranty_details: overrides.warranty_details ?? null,
    purchased_from: overrides.purchased_from ?? null,
    min_stock_level: overrides.min_stock_level ?? 0,
    short_code: overrides.short_code ?? "TEST",
    obsidian_vault_path: overrides.obsidian_vault_path ?? null,
    obsidian_note_path: overrides.obsidian_note_path ?? null,
    obsidian_uri: overrides.obsidian_uri ?? null,
    created_at: overrides.created_at ?? NOW,
    updated_at: overrides.updated_at ?? NOW,
    ...overrides,
  };
}

/**
 * makeItemPhoto — factory for ItemPhoto test fixtures with sensible defaults.
 *
 * Matches the ItemPhoto interface (61-01) including thumbnail_status so gallery
 * tests can exercise pending/processing/complete/failed placeholder rendering.
 * Override any field via the overrides object.
 */
export function makeItemPhoto(overrides: Partial<ItemPhoto> = {}): ItemPhoto {
  return {
    id: "photo-aaaaaaaa-0001",
    item_id: "55555555-5555-5555-5555-555555555555",
    workspace_id: DEFAULT_WORKSPACE_ID,
    filename: "test.jpg",
    file_size: 102400,
    mime_type: "image/jpeg",
    width: 800,
    height: 600,
    display_order: 0,
    is_primary: false,
    caption: null,
    url: "https://example.com/photos/test.jpg",
    thumbnail_url: "https://example.com/photos/test_thumb.jpg",
    thumbnail_status: "complete",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}
