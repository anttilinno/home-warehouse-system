import { defineConfig } from "@lingui/cli";
import { formatter } from "@lingui/format-po";

// Lingui v6 requires `format` to be a formatter function from a separate
// package (`@lingui/format-po`); the v5 string `"po"` was removed.
// See I18N-DECISION.md spike findings.
export default defineConfig({
  sourceLocale: "en",
  locales: ["en", "et", "ru"],
  catalogs: [
    { path: "<rootDir>/src/locales/{locale}/messages", include: ["src"] },
  ],
  format: formatter({ lineNumbers: false }),
});
