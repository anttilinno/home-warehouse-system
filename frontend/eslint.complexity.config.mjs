// Scoped ESLint config: ONLY complexity/dup signals Biome lacks.
// Not a full lint setup — run via `bunx eslint -c eslint.complexity.config.mjs src`.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";

export default tseslint.config(
  {
    ignores: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "src/test/**",
      "**/*.d.ts",
    ],
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: { sonarjs },
    rules: {
      // Gating rules (mirror golangci gocognit / gocyclo): these ERROR so the
      // pre-push hook blocks on any function over the 15 threshold.
      complexity: ["error", 15],
      "sonarjs/cognitive-complexity": ["error", 15],
      // Informational only (goconst / dupl analogs) — reported, never blocking.
      "sonarjs/no-duplicate-string": ["warn", { threshold: 5 }],
      "sonarjs/no-identical-functions": "warn",
      // Biome already gates unused vars; silence the tseslint-recommended copy
      // so this config exits non-zero ONLY on a complexity regression.
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
