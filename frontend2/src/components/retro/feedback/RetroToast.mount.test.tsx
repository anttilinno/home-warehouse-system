import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { act, render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { RetroToaster } from "./RetroToast";
import { retroToast } from "./retroToast";

// PROV-04 mount proof (SC4): the RetroToaster mounted in App.tsx + the
// `retroToast.promise(...)` ergonomic. This exercises the loading → success
// transition against the live, mounted Toaster (not just the re-export
// signature, which RetroToast.test.tsx already guards). A resolving promise must
// first paint the `loading` message, then swap it for `success` once it settles.

function renderToaster() {
  return render(
    <I18nProvider i18n={i18n}>
      <RetroToaster />
    </I18nProvider>,
  );
}

describe("RetroToaster — retroToast.promise mount ergonomics (PROV-04)", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      retroToast.dismiss();
    });
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders the loading message, then swaps to success when the promise resolves", async () => {
    renderToaster();

    // A promise we control: it stays pending until we resolve it explicitly so
    // we can observe the `loading` frame before the `success` frame.
    let resolvePromise!: (value: string) => void;
    const pending = new Promise<string>((resolve) => {
      resolvePromise = resolve;
    });

    act(() => {
      retroToast.promise(pending, {
        loading: "Saving…",
        success: "Saved!",
        error: "Failed",
      });
    });

    // Flush sonner's mount/queue tick — the loading toast paints first.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    expect(screen.queryByText("Saved!")).not.toBeInTheDocument();

    // Resolve → sonner transitions the SAME toast to its success message.
    await act(async () => {
      resolvePromise("ok");
      await pending;
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.getByText("Saved!")).toBeInTheDocument();
    expect(screen.queryByText("Saving…")).not.toBeInTheDocument();
  });
});
