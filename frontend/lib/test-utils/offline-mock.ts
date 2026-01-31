/**
 * Offline State Mocking Utilities
 *
 * Utilities for mocking offline-related state in unit tests.
 * Provides helpers for mocking IndexedDB data and navigator.onLine status.
 */

import type { Item } from "@/lib/types/items";
import type { Location } from "@/lib/types/locations";
import type { Container } from "@/lib/types/containers";
import type { Borrower } from "@/lib/types/borrowers";
import type { Category } from "@/lib/api/categories";

// Store for mock data
let mockData: {
  items: Item[];
  locations: Location[];
  containers: Container[];
  borrowers: Borrower[];
  categories: Category[];
} = {
  items: [],
  locations: [],
  containers: [],
  borrowers: [],
  categories: [],
};

/**
 * Set up mock offline data for tests.
 * Call before importing modules that use offline-db.
 *
 * @example
 * ```ts
 * mockOfflineState({
 *   items: [createItem({ name: "Test" })],
 *   locations: [createLocation({ name: "Garage" })],
 * });
 * ```
 */
export function mockOfflineState(data: {
  items?: Item[];
  locations?: Location[];
  containers?: Container[];
  borrowers?: Borrower[];
  categories?: Category[];
}) {
  mockData = {
    items: data.items ?? [],
    locations: data.locations ?? [],
    containers: data.containers ?? [],
    borrowers: data.borrowers ?? [],
    categories: data.categories ?? [],
  };
}

/**
 * Get the mock implementation for offline-db.getAll.
 * Use with vi.mocked to set up store responses.
 *
 * @example
 * ```ts
 * vi.mocked(offlineDb.getAll).mockImplementation(getOfflineDbMockImpl());
 * ```
 */
export function getOfflineDbMockImpl() {
  return async (store: string) => {
    switch (store) {
      case "items":
        return mockData.items;
      case "locations":
        return mockData.locations;
      case "containers":
        return mockData.containers;
      case "borrowers":
        return mockData.borrowers;
      case "categories":
        return mockData.categories;
      default:
        return [];
    }
  };
}

/**
 * Mock navigator.onLine to return true (online).
 */
export function mockOnline() {
  Object.defineProperty(navigator, "onLine", {
    value: true,
    writable: true,
    configurable: true,
  });
}

/**
 * Mock navigator.onLine to return false (offline).
 */
export function mockOffline() {
  Object.defineProperty(navigator, "onLine", {
    value: false,
    writable: true,
    configurable: true,
  });
}

/**
 * Reset all offline mocks to initial state.
 * Call in afterEach hooks to clean up between tests.
 */
export function resetOfflineMocks() {
  mockData = {
    items: [],
    locations: [],
    containers: [],
    borrowers: [],
    categories: [],
  };
  // Reset navigator.onLine to true (default)
  Object.defineProperty(navigator, "onLine", {
    value: true,
    writable: true,
    configurable: true,
  });
}
