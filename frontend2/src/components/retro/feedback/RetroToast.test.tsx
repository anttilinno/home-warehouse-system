import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { RetroToaster } from "./RetroToast";
import { retroToast } from "./retroToast";

const SRC = resolve(
  process.cwd(),
  "src/components/retro/feedback/RetroToast.tsx",
);

function renderToaster() {
  return render(
    <I18nProvider i18n={i18n}>
      <RetroToaster />
    </I18nProvider>,
  );
}

describe("RetroToaster", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  afterEach(() => {
    // Clear any toasts queued during a test so they never leak across cases.
    act(() => {
      retroToast.dismiss();
    });
  });

  describe("skin wiring (Pitfall 4 guards)", () => {
    const src = readFileSync(SRC, "utf8");

    it("mounts sonner's Toaster unstyled with the ink-bevel mini-Window skin", () => {
      expect(src).toMatch(/from\s+"sonner"/);
      expect(src).toMatch(/unstyled:\s*true/);
      expect(src).toMatch(/border-2/);
      expect(src).toMatch(/border-border-ink/);
      expect(src).toMatch(/bevel-raised/);
    });

    it("pins the region bottom-right above the Bottombar / FAB", () => {
      expect(src).toMatch(/position="bottom-right"/);
    });

    it("uses NO rounded utility anywhere (radius 0 hard rule)", () => {
      expect(src).not.toMatch(/rounded/i);
    });

    it("adds no motion library — CSS transitions only", () => {
      expect(src).not.toMatch(/framer-motion|react-spring|\bmotion\//);
    });
  });

  describe("toast behavior", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    });

    it("renders a success (DONE/mint) toast announced politely", async () => {
      renderToaster();
      act(() => {
        retroToast.success("Saved");
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(screen.getByText("Saved")).toBeInTheDocument();
      // success/info live region is polite (role="status")
      expect(screen.getByText("DONE")).toBeInTheDocument();
    });

    it("error (ERROR/pink) toast persists past the default auto-dismiss window", async () => {
      renderToaster();
      act(() => {
        retroToast.error("Boom");
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(screen.getByText("Boom")).toBeInTheDocument();
      expect(screen.getByText("ERROR")).toBeInTheDocument();

      // Advance well past sonner's default ~4s auto-dismiss — danger never auto-dismisses.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15000);
      });
      expect(screen.getByText("Boom")).toBeInTheDocument();
    });

    it("non-danger toast auto-dismisses after its timer elapses", async () => {
      renderToaster();
      act(() => {
        retroToast.success("Ephemeral");
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(screen.getByText("Ephemeral")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15000);
      });
      await waitFor(() => {
        expect(screen.queryByText("Ephemeral")).not.toBeInTheDocument();
      });
    });

    it("each toast exposes a close box labelled Dismiss", async () => {
      renderToaster();
      act(() => {
        retroToast.success("Closable");
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(
        screen.getByRole("button", { name: /dismiss/i }),
      ).toBeInTheDocument();
    });
  });

  describe("retroToast re-export", () => {
    it("is the sonner toast function and exposes .promise", () => {
      expect(typeof retroToast).toBe("function");
      expect(typeof retroToast.promise).toBe("function");
      expect(typeof retroToast.success).toBe("function");
      expect(typeof retroToast.error).toBe("function");
    });
  });
});
