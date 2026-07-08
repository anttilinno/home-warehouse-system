import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { TokenField, type FieldToken } from "./TokenField";

function wrap(ui: React.ReactNode) {
  return <I18nProvider i18n={i18n}>{ui}</I18nProvider>;
}

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

const token = (over: Partial<FieldToken> = {}): FieldToken => ({
  key: "category",
  label: "Category",
  displayValue: "Tools",
  onRemove: vi.fn(),
  ...over,
});

describe("TokenField", () => {
  it("commits the trimmed live value on Enter", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      wrap(
        <TokenField
          tokens={[]}
          value="  drill  "
          onChange={vi.fn()}
          onCommit={onCommit}
          onClearAll={vi.fn()}
        />,
      ),
    );
    await user.type(screen.getByRole("searchbox"), "{Enter}");
    expect(onCommit).toHaveBeenCalledWith("drill");
  });

  it("does not commit an empty/whitespace value", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      wrap(
        <TokenField
          tokens={[]}
          value="   "
          onChange={vi.fn()}
          onCommit={onCommit}
          onClearAll={vi.fn()}
        />,
      ),
    );
    await user.type(screen.getByRole("searchbox"), "{Enter}");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("removes the last token on Backspace when the input is empty", async () => {
    const user = userEvent.setup();
    const onBackspaceEmpty = vi.fn();
    render(
      wrap(
        <TokenField
          tokens={[token()]}
          value=""
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onClearAll={vi.fn()}
          onBackspaceEmpty={onBackspaceEmpty}
        />,
      ),
    );
    await user.type(screen.getByRole("searchbox"), "{Backspace}");
    expect(onBackspaceEmpty).toHaveBeenCalled();
  });

  it("does NOT backspace-remove when the input has text", async () => {
    const user = userEvent.setup();
    const onBackspaceEmpty = vi.fn();
    render(
      wrap(
        <TokenField
          tokens={[token()]}
          value="x"
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onClearAll={vi.fn()}
          onBackspaceEmpty={onBackspaceEmpty}
        />,
      ),
    );
    await user.type(screen.getByRole("searchbox"), "{Backspace}");
    expect(onBackspaceEmpty).not.toHaveBeenCalled();
  });

  it("removes a token via its ✕ (labelled by the filter name)", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      wrap(
        <TokenField
          tokens={[token({ onRemove })]}
          value=""
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onClearAll={vi.fn()}
        />,
      ),
    );
    await user.click(
      screen.getByRole("button", { name: /remove category filter/i }),
    );
    expect(onRemove).toHaveBeenCalled();
  });

  it("shows CLEAR only when there is content, and it wipes everything", async () => {
    const user = userEvent.setup();
    const onClearAll = vi.fn();
    const { rerender } = render(
      wrap(
        <TokenField
          tokens={[]}
          value=""
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onClearAll={onClearAll}
        />,
      ),
    );
    // Nothing active → no CLEAR.
    expect(
      screen.queryByRole("button", { name: /^clear$/i }),
    ).not.toBeInTheDocument();

    rerender(
      wrap(
        <TokenField
          tokens={[token()]}
          value=""
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onClearAll={onClearAll}
        />,
      ),
    );
    await user.click(screen.getByRole("button", { name: /^clear$/i }));
    expect(onClearAll).toHaveBeenCalled();
  });
});
