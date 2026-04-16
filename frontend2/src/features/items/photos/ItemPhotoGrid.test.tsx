import { describe, it, expect, vi } from "vitest";
import { type ReactElement } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ItemPhotoGrid } from "./ItemPhotoGrid";
import { makeItemPhoto } from "../__tests__/fixtures";

i18n.load("en", {});
i18n.activate("en");

function renderGrid(ui: ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

describe("ItemPhotoGrid", () => {
  it("renders one tile per photo", () => {
    const photos = [
      makeItemPhoto({ id: "p1" }),
      makeItemPhoto({ id: "p2" }),
      makeItemPhoto({ id: "p3" }),
      makeItemPhoto({ id: "p4" }),
      makeItemPhoto({ id: "p5" }),
    ];
    renderGrid(<ItemPhotoGrid photos={photos} onTileClick={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(5);
  });

  it("calls onTileClick with the correct (zero-based) index", () => {
    const onTileClick = vi.fn();
    const photos = [
      makeItemPhoto({ id: "p1" }),
      makeItemPhoto({ id: "p2" }),
      makeItemPhoto({ id: "p3" }),
    ];
    renderGrid(<ItemPhotoGrid photos={photos} onTileClick={onTileClick} />);
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]);
    expect(onTileClick).toHaveBeenCalledTimes(1);
    expect(onTileClick).toHaveBeenCalledWith(1);
  });

  it("fires index 0 for the first tile", () => {
    const onTileClick = vi.fn();
    const photos = [makeItemPhoto({ id: "p1" }), makeItemPhoto({ id: "p2" })];
    renderGrid(<ItemPhotoGrid photos={photos} onTileClick={onTileClick} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onTileClick).toHaveBeenCalledWith(0);
  });

  it("renders no buttons when photos is an empty array", () => {
    renderGrid(<ItemPhotoGrid photos={[]} onTileClick={vi.fn()} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("passes is_primary through to the underlying tile (PRIMARY badge appears)", () => {
    const photos = [
      makeItemPhoto({ id: "p1", is_primary: false }),
      makeItemPhoto({ id: "p2", is_primary: true }),
    ];
    renderGrid(<ItemPhotoGrid photos={photos} onTileClick={vi.fn()} />);
    // Exactly one PRIMARY badge appears across the grid.
    expect(screen.getAllByText(/PRIMARY/)).toHaveLength(1);
  });
});
