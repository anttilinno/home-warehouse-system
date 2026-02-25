import { vi, describe, it, expect, beforeEach } from "vitest";

import {
  convertToCSV,
  downloadCSV,
  exportToCSV,
  generateFilename,
  type ColumnDefinition,
} from "../csv-export";

// ---------- convertToCSV ----------

describe("convertToCSV", () => {
  interface Item {
    name: string;
    price: number;
    category: { name: string };
  }

  const columns: ColumnDefinition<Item>[] = [
    { key: "name", label: "Name" },
    { key: "price", label: "Price" },
  ];

  it("generates headers from column labels", () => {
    const csv = convertToCSV<Item>([], columns);
    expect(csv).toBe("Name,Price");
  });

  it("generates data rows with matching values", () => {
    const data: Item[] = [
      { name: "Widget", price: 9.99, category: { name: "Tools" } },
    ];
    const csv = convertToCSV(data, columns);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Name,Price");
    expect(lines[1]).toBe("Widget,9.99");
  });

  it("resolves nested dot-notation keys", () => {
    const data: Item[] = [
      { name: "Widget", price: 5, category: { name: "Gadgets" } },
    ];
    const nestedColumns: ColumnDefinition<Item>[] = [
      { key: "category.name", label: "Category" },
    ];
    const csv = convertToCSV(data, nestedColumns);
    expect(csv).toBe("Category\nGadgets");
  });

  it("applies formatter functions", () => {
    const data: Item[] = [
      { name: "Widget", price: 10, category: { name: "" } },
    ];
    const formatted: ColumnDefinition<Item>[] = [
      {
        key: "price",
        label: "Price",
        formatter: (value: number) => `$${value.toFixed(2)}`,
      },
    ];
    const csv = convertToCSV(data, formatted);
    expect(csv).toBe("Price\n$10.00");
  });

  describe("field escaping", () => {
    it("converts null and undefined values to empty string", () => {
      const data = [{ name: null as unknown as string, price: 0, category: { name: "" } }];
      const csv = convertToCSV(data, [{ key: "name", label: "Name" }]);
      expect(csv).toBe("Name\n");
    });

    it("quotes values containing commas", () => {
      const data = [{ name: "one, two", price: 0, category: { name: "" } }];
      const csv = convertToCSV(data, [{ key: "name", label: "Name" }]);
      expect(csv).toBe('Name\n"one, two"');
    });

    it("doubles quotes and wraps in quotes for values containing double quotes", () => {
      const data = [{ name: 'say "hello"', price: 0, category: { name: "" } }];
      const csv = convertToCSV(data, [{ key: "name", label: "Name" }]);
      expect(csv).toBe('Name\n"say ""hello"""');
    });

    it("quotes values containing newlines", () => {
      const data = [{ name: "line1\nline2", price: 0, category: { name: "" } }];
      const csv = convertToCSV(data, [{ key: "name", label: "Name" }]);
      expect(csv).toBe('Name\n"line1\nline2"');
    });
  });
});

// ---------- generateFilename ----------

describe("generateFilename", () => {
  it("returns a string starting with the prefix and ending with .csv", () => {
    const result = generateFilename("items");
    expect(result).toMatch(/^items-/);
    expect(result).toMatch(/\.csv$/);
  });

  it("contains a date-time segment between prefix and extension", () => {
    const result = generateFilename("export");
    // Expected format: export-YYYY-MM-DD-HHmmss.csv
    expect(result).toMatch(/^export-\d{4}-\d{2}-\d{2}-\d{6}\.csv$/);
  });
});

// ---------- exportToCSV ----------

describe("exportToCSV", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("logs a warning and does not download when data is empty", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // We need a minimal DOM mock so downloadCSV would not crash if called.
    // But it should NOT be called, so we just verify the warning.
    exportToCSV([], [{ key: "a", label: "A" }], "test.csv");

    expect(warnSpy).toHaveBeenCalledWith("No data to export");
  });

  it("appends .csv extension when filename does not end with .csv", () => {
    // Mock DOM APIs so downloadCSV doesn't blow up
    const mockLink = {
      setAttribute: vi.fn(),
      click: vi.fn(),
      style: {} as CSSStyleDeclaration,
    };
    vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLElement);
    vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    exportToCSV([{ x: 1 }], [{ key: "x", label: "X" }], "report");

    // The download attribute should have .csv appended
    expect(mockLink.setAttribute).toHaveBeenCalledWith("download", "report.csv");
  });
});

// ---------- downloadCSV ----------

describe("downloadCSV", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an anchor element, triggers download, and cleans up", () => {
    const mockLink = {
      setAttribute: vi.fn(),
      click: vi.fn(),
      style: {} as CSSStyleDeclaration,
    };

    vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLAnchorElement);
    vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    const removeChildSpy = vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);
    const createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/fake-id");
    const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    downloadCSV("col1,col2\na,b", "data.csv");

    expect(document.createElement).toHaveBeenCalledWith("a");
    expect(createObjectURLSpy).toHaveBeenCalledOnce();
    expect(mockLink.setAttribute).toHaveBeenCalledWith("href", "blob:http://localhost/fake-id");
    expect(mockLink.setAttribute).toHaveBeenCalledWith("download", "data.csv");
    expect(mockLink.click).toHaveBeenCalledOnce();
    expect(removeChildSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:http://localhost/fake-id");
  });
});
