import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { RetroStatusDot } from "./RetroStatusDot";

function renderDot(ui: React.ReactNode) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

describe("RetroStatusDot", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders the mono `sse:` key", () => {
    renderDot(<RetroStatusDot state="live" />);
    expect(screen.getByText("sse:")).toBeInTheDocument();
  });

  it("state=live renders a mint dot with the live blink class and the `live` word", () => {
    const { container } = renderDot(<RetroStatusDot state="live" />);
    const dot = container.querySelector('[data-testid="status-dot"]');
    expect(dot).not.toBeNull();
    expect(dot).toHaveClass("bg-titlebar-mint");
    expect(dot).toHaveClass("status-dot--live");
    // 8px square: fixed h-2 w-2 (radius 0, ink-bordered)
    expect(dot).toHaveClass("h-2", "w-2", "border", "border-border-ink");
    const word = screen.getByText("live");
    expect(word).toHaveClass("text-accent-mint-deep");
  });

  it("state=idle renders a faint dot, the `offline` word, and NO blink class", () => {
    const { container } = renderDot(<RetroStatusDot state="idle" />);
    const dot = container.querySelector('[data-testid="status-dot"]');
    expect(dot).toHaveClass("bg-fg-faint");
    expect(dot).not.toHaveClass("status-dot--live");
    const word = screen.getByText("offline");
    expect(word).toHaveClass("text-fg-muted");
  });

  it("state=error renders a danger dot and the `error` word", () => {
    const { container } = renderDot(<RetroStatusDot state="error" />);
    const dot = container.querySelector('[data-testid="status-dot"]');
    expect(dot).toHaveClass("bg-danger");
    expect(dot).not.toHaveClass("status-dot--live");
    const word = screen.getByText("error");
    expect(word).toHaveClass("text-danger");
  });

  it("marks the dot decorative (aria-hidden); the state word carries the meaning", () => {
    const { container } = renderDot(<RetroStatusDot state="live" />);
    const dot = container.querySelector('[data-testid="status-dot"]');
    expect(dot).toHaveAttribute("aria-hidden", "true");
  });

  it("does not couple to SSE — no useSSE / EventSource import in the source", () => {
    const src = readFileSync(
      resolve(
        process.cwd(),
        "src/components/retro/feedback/RetroStatusDot.tsx",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/useSSE|sseStatus|EventSource/);
  });
});
