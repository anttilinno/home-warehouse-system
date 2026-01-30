import { describe, it, expect } from "vitest";
import {
  createItemsFuse,
  createBorrowersFuse,
  createContainersFuse,
  createLocationsFuse,
  createCategoriesFuse,
  FuseSearchOptions,
} from "../fuse-index";
import type { Item } from "@/lib/types/items";
import type { Borrower } from "@/lib/types/borrowers";
import type { Container } from "@/lib/types/containers";
import type { Location } from "@/lib/types/locations";
import type { Category } from "@/lib/api/categories";

// Helper to create minimal test items
function createItem(partial: Partial<Item>): Item {
  return {
    id: partial.id ?? "test-id",
    workspace_id: "ws-1",
    sku: partial.sku ?? "SKU001",
    name: partial.name ?? "Test Item",
    min_stock_level: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...partial,
  };
}

function createBorrower(partial: Partial<Borrower>): Borrower {
  return {
    id: partial.id ?? "test-id",
    workspace_id: "ws-1",
    name: partial.name ?? "Test Borrower",
    is_archived: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...partial,
  };
}

function createContainer(partial: Partial<Container>): Container {
  return {
    id: partial.id ?? "test-id",
    workspace_id: "ws-1",
    name: partial.name ?? "Test Container",
    location_id: "loc-1",
    is_archived: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...partial,
  };
}

function createLocation(partial: Partial<Location>): Location {
  return {
    id: partial.id ?? "test-id",
    workspace_id: "ws-1",
    name: partial.name ?? "Test Location",
    is_archived: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...partial,
  };
}

function createCategory(partial: Partial<Category>): Category {
  return {
    id: partial.id ?? "test-id",
    name: partial.name ?? "Test Category",
    parent_category_id: null,
    description: partial.description ?? null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...partial,
  };
}

describe("FuseSearchOptions", () => {
  it("has expected default configuration", () => {
    expect(FuseSearchOptions.threshold).toBe(0.4);
    expect(FuseSearchOptions.includeScore).toBe(true);
    expect(FuseSearchOptions.includeMatches).toBe(true);
    expect(FuseSearchOptions.ignoreLocation).toBe(true);
    expect(FuseSearchOptions.minMatchCharLength).toBe(2);
  });
});

describe("createItemsFuse", () => {
  it("handles empty array", () => {
    const fuse = createItemsFuse([]);
    const results = fuse.search("test");
    expect(results).toEqual([]);
  });

  it("finds items by name with exact match", () => {
    const items = [
      createItem({ id: "1", name: "Power Drill", sku: "PD001" }),
      createItem({ id: "2", name: "Hammer", sku: "HM001" }),
    ];
    const fuse = createItemsFuse(items);
    const results = fuse.search("Power Drill");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe("Power Drill");
  });

  it("finds items with fuzzy matching (typos)", () => {
    const items = [createItem({ id: "1", name: "Power Drill" })];
    const fuse = createItemsFuse(items);
    const results = fuse.search("Powr Dril");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe("Power Drill");
  });

  it("finds items by SKU", () => {
    const items = [createItem({ id: "1", name: "Widget", sku: "WDG-12345" })];
    const fuse = createItemsFuse(items);
    const results = fuse.search("WDG-12345");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.sku).toBe("WDG-12345");
  });

  it("finds items by short_code", () => {
    const items = [createItem({ id: "1", name: "Widget", short_code: "ABC123" })];
    const fuse = createItemsFuse(items);
    const results = fuse.search("ABC123");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.short_code).toBe("ABC123");
  });

  it("prioritizes name matches over SKU matches", () => {
    const items = [
      createItem({ id: "1", name: "Widget", sku: "DRILL001" }),
      createItem({ id: "2", name: "Drill", sku: "WDG001" }),
    ];
    const fuse = createItemsFuse(items);
    const results = fuse.search("Drill");
    expect(results.length).toBe(2);
    // Name match should rank higher due to weight 2.0 vs 1.5 for SKU
    expect(results[0].item.name).toBe("Drill");
  });

  it("returns results with scores", () => {
    const items = [createItem({ id: "1", name: "Test Item" })];
    const fuse = createItemsFuse(items);
    const results = fuse.search("Test");
    expect(results[0].score).toBeDefined();
    expect(typeof results[0].score).toBe("number");
  });

  it("returns results with match indices", () => {
    const items = [createItem({ id: "1", name: "Test Item" })];
    const fuse = createItemsFuse(items);
    const results = fuse.search("Test");
    expect(results[0].matches).toBeDefined();
    expect(results[0].matches!.length).toBeGreaterThan(0);
  });
});

describe("createBorrowersFuse", () => {
  it("handles empty array", () => {
    const fuse = createBorrowersFuse([]);
    const results = fuse.search("test");
    expect(results).toEqual([]);
  });

  it("finds borrowers by name", () => {
    const borrowers = [
      createBorrower({ id: "1", name: "John Smith" }),
      createBorrower({ id: "2", name: "Jane Doe" }),
    ];
    const fuse = createBorrowersFuse(borrowers);
    const results = fuse.search("John");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe("John Smith");
  });

  it("finds borrowers by email", () => {
    const borrowers = [
      createBorrower({ id: "1", name: "John Smith", email: "john@example.com" }),
    ];
    const fuse = createBorrowersFuse(borrowers);
    const results = fuse.search("john@example");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.email).toBe("john@example.com");
  });

  it("finds borrowers by phone", () => {
    const borrowers = [
      createBorrower({ id: "1", name: "John Smith", phone: "555-1234" }),
    ];
    const fuse = createBorrowersFuse(borrowers);
    const results = fuse.search("555-1234");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.phone).toBe("555-1234");
  });

  it("finds borrowers with fuzzy matching", () => {
    const borrowers = [createBorrower({ id: "1", name: "Alexander Thompson" })];
    const fuse = createBorrowersFuse(borrowers);
    const results = fuse.search("Alexnder Tompson"); // typos
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe("Alexander Thompson");
  });

  it("prioritizes name matches over notes", () => {
    const borrowers = [
      createBorrower({ id: "1", name: "Widget Corp", notes: "Contact: John" }),
      createBorrower({ id: "2", name: "John Industries", notes: "Widget supplier" }),
    ];
    const fuse = createBorrowersFuse(borrowers);
    const results = fuse.search("John");
    // Name match (weight 2.0) should rank higher than notes match (weight 0.5)
    expect(results[0].item.name).toBe("John Industries");
  });
});

describe("createContainersFuse", () => {
  it("handles empty array", () => {
    const fuse = createContainersFuse([]);
    const results = fuse.search("test");
    expect(results).toEqual([]);
  });

  it("finds containers by name", () => {
    const containers = [
      createContainer({ id: "1", name: "Blue Toolbox" }),
      createContainer({ id: "2", name: "Red Bin" }),
    ];
    const fuse = createContainersFuse(containers);
    const results = fuse.search("Toolbox");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe("Blue Toolbox");
  });

  it("finds containers by short_code", () => {
    const containers = [
      createContainer({ id: "1", name: "Storage Box", short_code: "BOX-A1" }),
    ];
    const fuse = createContainersFuse(containers);
    const results = fuse.search("BOX-A1");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.short_code).toBe("BOX-A1");
  });

  it("finds containers with fuzzy matching", () => {
    const containers = [createContainer({ id: "1", name: "Electronics Drawer" })];
    const fuse = createContainersFuse(containers);
    const results = fuse.search("Electroncis Drawr"); // typos
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe("Electronics Drawer");
  });

  it("prioritizes name over description", () => {
    const containers = [
      createContainer({
        id: "1",
        name: "Parts Bin",
        description: "Contains tools",
      }),
      createContainer({
        id: "2",
        name: "Tool Storage",
        description: "Parts bin overflow",
      }),
    ];
    const fuse = createContainersFuse(containers);
    const results = fuse.search("Tool");
    // Name match should rank higher
    expect(results[0].item.name).toBe("Tool Storage");
  });
});

describe("createLocationsFuse", () => {
  it("handles empty array", () => {
    const fuse = createLocationsFuse([]);
    const results = fuse.search("test");
    expect(results).toEqual([]);
  });

  it("finds locations by name", () => {
    const locations = [
      createLocation({ id: "1", name: "Garage" }),
      createLocation({ id: "2", name: "Basement" }),
    ];
    const fuse = createLocationsFuse(locations);
    const results = fuse.search("Garage");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe("Garage");
  });

  it("finds locations by zone", () => {
    const locations = [
      createLocation({ id: "1", name: "Shelf A", zone: "North Wing" }),
    ];
    const fuse = createLocationsFuse(locations);
    const results = fuse.search("North Wing");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.zone).toBe("North Wing");
  });

  it("finds locations by shelf", () => {
    const locations = [
      createLocation({ id: "1", name: "Storage", shelf: "Shelf-3B" }),
    ];
    const fuse = createLocationsFuse(locations);
    const results = fuse.search("Shelf-3B");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.shelf).toBe("Shelf-3B");
  });

  it("finds locations by bin", () => {
    const locations = [createLocation({ id: "1", name: "Workbench", bin: "Bin-42" })];
    const fuse = createLocationsFuse(locations);
    const results = fuse.search("Bin-42");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.bin).toBe("Bin-42");
  });

  it("finds locations by short_code", () => {
    const locations = [
      createLocation({ id: "1", name: "Workshop", short_code: "WRK-001" }),
    ];
    const fuse = createLocationsFuse(locations);
    const results = fuse.search("WRK-001");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.short_code).toBe("WRK-001");
  });

  it("finds locations with fuzzy matching", () => {
    const locations = [createLocation({ id: "1", name: "Workshop Storage" })];
    const fuse = createLocationsFuse(locations);
    const results = fuse.search("Workship Stoarge"); // typos
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe("Workshop Storage");
  });
});

describe("createCategoriesFuse", () => {
  it("handles empty array", () => {
    const fuse = createCategoriesFuse([]);
    const results = fuse.search("test");
    expect(results).toEqual([]);
  });

  it("finds categories by name", () => {
    const categories = [
      createCategory({ id: "1", name: "Power Tools" }),
      createCategory({ id: "2", name: "Hand Tools" }),
    ];
    const fuse = createCategoriesFuse(categories);
    const results = fuse.search("Power Tools");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe("Power Tools");
  });

  it("finds categories by description", () => {
    const categories = [
      createCategory({
        id: "1",
        name: "Electronics",
        description: "Computers, phones, and gadgets",
      }),
    ];
    const fuse = createCategoriesFuse(categories);
    const results = fuse.search("gadgets");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe("Electronics");
  });

  it("finds categories with fuzzy matching", () => {
    const categories = [createCategory({ id: "1", name: "Automotive Parts" })];
    const fuse = createCategoriesFuse(categories);
    const results = fuse.search("Automotve Prts"); // typos
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe("Automotive Parts");
  });

  it("prioritizes name over description", () => {
    const categories = [
      createCategory({
        id: "1",
        name: "Tools Category",
        description: "Workshop equipment",
      }),
      createCategory({
        id: "2",
        name: "Workshop Equipment",
        description: "Various tools",
      }),
    ];
    const fuse = createCategoriesFuse(categories);
    const results = fuse.search("Workshop");
    // Name match (weight 2.0) should rank higher than description (0.5)
    expect(results[0].item.name).toBe("Workshop Equipment");
  });
});
