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
import { Clock } from "./Clock";

// Render under the i18n singleton so <Trans> resolves to its source message.
function renderClock(ui: React.ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

describe("Clock", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  beforeEach(() => {
    vi.useFakeTimers();
    // Pin wall clock so LOCAL is deterministic.
    vi.setSystemTime(new Date("2026-06-12T10:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a SESSION key + hh:mm:ss value and a LOCAL key + hh:mm:ss value", () => {
    renderClock(<Clock />);
    expect(screen.getByText("SESSION")).toBeInTheDocument();
    expect(screen.getByText("LOCAL")).toBeInTheDocument();
    // SESSION starts at 00:00:00.
    expect(screen.getByTestId("clock-session")).toHaveTextContent("00:00:00");
  });

  it("advances the SESSION value each second under fake timers", () => {
    renderClock(<Clock />);
    expect(screen.getByTestId("clock-session")).toHaveTextContent("00:00:00");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId("clock-session")).toHaveTextContent("00:00:01");
    act(() => {
      vi.advanceTimersByTime(3600_000);
    });
    expect(screen.getByTestId("clock-session")).toHaveTextContent("01:00:01");
  });

  it("re-renders ONLY the Clock leaf on a tick — parent render-count stays 1 (Pitfall 5)", () => {
    const parentRenders = vi.fn();
    function Parent() {
      parentRenders();
      return (
        <div>
          <Clock />
        </div>
      );
    }
    renderClock(<Parent />);
    expect(parentRenders).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // The tick re-rendered the Clock leaf; the parent did NOT re-render.
    expect(screen.getByTestId("clock-session")).toHaveTextContent("00:00:01");
    expect(parentRenders).toHaveBeenCalledTimes(1);
  });

  it("clears its interval on unmount (no leaked timer)", () => {
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    const { unmount } = renderClock(<Clock />);
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });

  it("renders only the SESSION readout when local={false}", () => {
    renderClock(<Clock local={false} />);
    expect(screen.getByText("SESSION")).toBeInTheDocument();
    expect(screen.queryByText("LOCAL")).not.toBeInTheDocument();
  });
});
