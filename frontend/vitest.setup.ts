import { beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// Reset all mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.resetAllMocks();
});
