import { describe, it, expect, vi } from "vitest";
import { type ReactElement } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ItemPhotoTile } from "./ItemPhotoTile";
import { makeItemPhoto } from "../__tests__/fixtures";

// Minimal i18n activation — matches other retro-family tests in the repo
i18n.load("en", {});
i18n.activate("en");

function renderTile(ui: ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

describe("ItemPhotoTile", () => {
  it("renders the thumbnail when thumbnail_status is complete", () => {
    const photo = makeItemPhoto({
      thumbnail_url: "https://cdn.example.com/thumb.jpg",
      thumbnail_status: "complete",
    });
    renderTile(
      <ItemPhotoTile photo={photo} isPrimary={false} onClick={vi.fn()} />
    );
    const img = document.querySelector("img") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.src).toContain("https://cdn.example.com/thumb.jpg");
    // jsdom does not implement the HTMLImageElement.loading IDL property,
    // but it does reflect the attribute; check via getAttribute.
    expect(img!.getAttribute("loading")).toBe("lazy");
    expect(screen.queryByText(/PROCESSING/i)).toBeNull();
  });

  it("renders the PROCESSING placeholder when thumbnail_status is pending", () => {
    const photo = makeItemPhoto({
      thumbnail_url: "https://cdn.example.com/thumb.jpg",
      thumbnail_status: "pending",
    });
    renderTile(
      <ItemPhotoTile photo={photo} isPrimary={false} onClick={vi.fn()} />
    );
    expect(screen.getByText(/PROCESSING/i)).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
  });

  it("renders the PROCESSING placeholder when thumbnail_status is processing", () => {
    const photo = makeItemPhoto({
      thumbnail_url: "https://cdn.example.com/thumb.jpg",
      thumbnail_status: "processing",
    });
    renderTile(
      <ItemPhotoTile photo={photo} isPrimary={false} onClick={vi.fn()} />
    );
    expect(screen.getByText(/PROCESSING/i)).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
  });

  it("renders the PROCESSING placeholder when thumbnail_url is empty", () => {
    const photo = makeItemPhoto({
      thumbnail_url: "",
      thumbnail_status: "complete",
    });
    renderTile(
      <ItemPhotoTile photo={photo} isPrimary={false} onClick={vi.fn()} />
    );
    expect(screen.getByText(/PROCESSING/i)).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
  });

  it("renders the PRIMARY badge with a star glyph when isPrimary is true", () => {
    const photo = makeItemPhoto({
      thumbnail_url: "https://x.test/t.jpg",
      thumbnail_status: "complete",
    });
    renderTile(
      <ItemPhotoTile photo={photo} isPrimary onClick={vi.fn()} />
    );
    expect(screen.getByText(/PRIMARY/)).toBeTruthy();
    expect(screen.getByText(/★/)).toBeTruthy();
  });

  it("does not render the PRIMARY badge when isPrimary is false", () => {
    const photo = makeItemPhoto({
      thumbnail_url: "https://x.test/t.jpg",
      thumbnail_status: "complete",
    });
    renderTile(
      <ItemPhotoTile photo={photo} isPrimary={false} onClick={vi.fn()} />
    );
    expect(screen.queryByText(/PRIMARY/)).toBeNull();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    const photo = makeItemPhoto();
    renderTile(
      <ItemPhotoTile photo={photo} isPrimary={false} onClick={onClick} />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
