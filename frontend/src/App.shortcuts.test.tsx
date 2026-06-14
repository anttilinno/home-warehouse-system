import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// PROV-03 (verify-only): ShortcutsProvider was SHIPPED in Plan 03-01 and mounted
// in App.tsx in Plan 03-06. Phase 6 must NOT move or rebuild it — this spec pins
// its canonical position in the composed App tree (inside BrowserRouter, below
// QueryClientProvider, ABOVE ModalStackProvider + AppRoutes).
//
// The render-and-assert "a useShortcuts consumer mounts without throwing under
// ShortcutsProvider" guarantee is already covered by AppShell.test.tsx: that
// spec renders the REAL shell — whose Bottombar consumes useShortcutsContext()
// (which throws outside the provider) — under ShortcutsProvider without error.
// Re-mounting the full provider graph here only to assert non-throw is redundant
// (and leaves an open fork-worker handle), so PROV-03 is verified structurally.

const APP_SRC = resolve(process.cwd(), "src/App.tsx");

describe("App ShortcutsProvider position (PROV-03)", () => {
  it("keeps ShortcutsProvider inside the router, wrapping ModalStackProvider > AppRoutes", () => {
    const src = readFileSync(APP_SRC, "utf8");
    // The shipped nesting (Plan 03-06): BrowserRouter > QueryClientProvider >
    // ShortcutsProvider > ModalStackProvider > AppRoutes. Phase 6 only appended
    // RetroToaster (App root) — this relative order must be intact (not moved).
    const routerOpen = src.indexOf("<BrowserRouter>");
    const queryOpen = src.indexOf("<QueryClientProvider");
    const shortcutsOpen = src.indexOf("<ShortcutsProvider>");
    const modalOpen = src.indexOf("<ModalStackProvider>");
    const routes = src.indexOf("<AppRoutes />");

    expect(shortcutsOpen).toBeGreaterThan(-1);
    // ShortcutsProvider sits below the router + query client…
    expect(shortcutsOpen).toBeGreaterThan(routerOpen);
    expect(shortcutsOpen).toBeGreaterThan(queryOpen);
    // …and above ModalStackProvider + the routes.
    expect(shortcutsOpen).toBeLessThan(modalOpen);
    expect(modalOpen).toBeLessThan(routes);
  });

  it("did not rebuild ShortcutsProvider — it is imported from the shipped barrel", () => {
    const src = readFileSync(APP_SRC, "utf8");
    expect(src).toMatch(
      /import\s+\{\s*ShortcutsProvider\s*\}\s+from\s+"@\/components\/shortcuts"/,
    );
  });
});
