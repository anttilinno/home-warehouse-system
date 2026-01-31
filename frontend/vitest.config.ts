import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: [
      "lib/**/__tests__/**/*.test.ts",
      "components/**/__tests__/**/*.test.tsx",
    ],
    exclude: ["node_modules", "e2e"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "lib/**/*.ts",
        "lib/**/*.tsx",
        "components/**/*.tsx",
        "hooks/**/*.ts",
      ],
      exclude: [
        "**/*.d.ts",
        "**/types/**",
        "**/__tests__/**",
        "**/node_modules/**",
        "lib/test-utils/**",
      ],
      // Thresholds will be enforced after Phase 25 reaches targets
      // thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
