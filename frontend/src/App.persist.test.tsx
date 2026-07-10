import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { queryClient } from "@/lib/queryClient";
import { CACHE_BUSTER } from "@/lib/offline/persister";

// App.tsx:70-90 persist wiring — PROV-01 offline-first PWA Phase 1 contract.
// Mocks every sibling provider down to a pass-through so the only thing under
// test is the props App.tsx hands PersistQueryClientProvider.

let capturedProps: Record<string, unknown> | undefined;

vi.mock("@tanstack/react-query-persist-client", () => ({
  PersistQueryClientProvider: (props: {
    children: unknown;
    [key: string]: unknown;
  }) => {
    capturedProps = props;
    return props.children;
  },
}));

vi.mock("react-router", () => ({
  BrowserRouter: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/routes", () => ({
  AppRoutes: () => null,
}));

vi.mock("@/components/shortcuts", () => ({
  ShortcutsProvider: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/components/modal", () => ({
  ModalStackProvider: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/components/retro", () => ({
  RetroToaster: () => null,
}));

vi.mock("@/lib/useTheme", () => ({
  ThemeProvider: ({ children }: { children: unknown }) => children,
}));

const App = (await import("@/App")).default;

describe("App PersistQueryClientProvider wiring", () => {
  beforeEach(() => {
    capturedProps = undefined;
  });

  it("passes buster, maxAge, dehydrateOptions and onSuccess as documented", () => {
    render(<App />);

    expect(capturedProps).toBeDefined();
    const persistOptions = capturedProps?.persistOptions as {
      buster: string;
      maxAge: number;
      dehydrateOptions: {
        shouldDehydrateMutation: (m: {
          state: { isPaused: boolean };
        }) => boolean;
      };
    };

    expect(persistOptions.buster).toBe(CACHE_BUSTER);
    expect(persistOptions.maxAge).toBe(7 * 24 * 60 * 60 * 1000);

    const shouldDehydrateMutation =
      persistOptions.dehydrateOptions.shouldDehydrateMutation;
    expect(shouldDehydrateMutation({ state: { isPaused: true } })).toBe(true);
    expect(shouldDehydrateMutation({ state: { isPaused: false } })).toBe(false);

    const resumeSpy = vi
      .spyOn(queryClient, "resumePausedMutations")
      .mockResolvedValue(undefined);

    (capturedProps?.onSuccess as () => void)();

    expect(resumeSpy).toHaveBeenCalledTimes(1);
    resumeSpy.mockRestore();
  });
});
