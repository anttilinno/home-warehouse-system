import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ItemPhotoLightbox } from "./ItemPhotoLightbox";
import { makeItemPhoto, setupDialogMocks } from "../__tests__/fixtures";

i18n.load("en", {});
i18n.activate("en");

type LightboxProps = React.ComponentProps<typeof ItemPhotoLightbox>;

function renderLightbox(overrides: Partial<LightboxProps> = {}) {
  const props: LightboxProps = {
    open: true,
    photos: [
      makeItemPhoto({ id: "p1", filename: "a.jpg", is_primary: true }),
      makeItemPhoto({ id: "p2", filename: "b.jpg" }),
      makeItemPhoto({ id: "p3", filename: "c.jpg" }),
    ],
    initialIndex: 1,
    itemName: "Drill",
    readOnly: false,
    onClose: vi.fn(),
    onSetPrimary: vi.fn(),
    onDelete: vi.fn().mockResolvedValue(undefined),
    isSettingPrimary: false,
    isDeleting: false,
    ...overrides,
  };
  const result = render(
    <I18nProvider i18n={i18n}>
      <ItemPhotoLightbox {...props} />
    </I18nProvider>
  );
  return { props, ...result };
}

describe("ItemPhotoLightbox", () => {
  beforeEach(() => {
    setupDialogMocks();
  });

  it("renders the photo at initialIndex and shows 'N / M' counter", () => {
    renderLightbox({ initialIndex: 1 });
    expect(screen.getByText("2 / 3")).toBeTruthy();
  });

  it("advances to next photo on ArrowRight", () => {
    renderLightbox({ initialIndex: 0 });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("2 / 3")).toBeTruthy();
  });

  it("goes to previous on ArrowLeft; no wrap at index 0", () => {
    renderLightbox({ initialIndex: 0 });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("1 / 3")).toBeTruthy();
  });

  it("clamps at last index when ArrowRight pressed past end", () => {
    renderLightbox({ initialIndex: 2 });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("3 / 3")).toBeTruthy();
  });

  it("closes on Escape", () => {
    const { props } = renderLightbox();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalled();
  });

  it("fires onSetPrimary when SET AS PRIMARY clicked on a non-primary photo", () => {
    const { props } = renderLightbox({ initialIndex: 1 }); // p2 is not primary
    const btn = screen.getByRole("button", { name: /SET AS PRIMARY/i });
    fireEvent.click(btn);
    expect(props.onSetPrimary).toHaveBeenCalledWith("p2");
  });

  it("disables SET AS PRIMARY on a photo that is already primary", () => {
    renderLightbox({ initialIndex: 0 }); // p1 is primary
    const btn = screen.getByRole("button", { name: /PRIMARY/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("opens RetroConfirmDialog on DELETE PHOTO click (does NOT delete inline)", () => {
    const { props } = renderLightbox({ initialIndex: 1 });
    const deleteBtn = screen.getByRole("button", { name: /DELETE PHOTO/i });
    fireEvent.click(deleteBtn);
    // Dialog heading should be visible now (CONFIRM DELETE) but onDelete NOT called yet.
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(screen.getByText(/CONFIRM DELETE/i)).toBeTruthy();
  });

  it("hides SET AS PRIMARY and DELETE PHOTO when readOnly is true", () => {
    renderLightbox({ readOnly: true });
    expect(
      screen.queryByRole("button", { name: /SET AS PRIMARY/i })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /DELETE PHOTO/i })
    ).toBeNull();
  });

  it("returns null when photos array is empty", () => {
    const { container } = renderLightbox({ photos: [], initialIndex: 0 });
    expect(container.querySelector("[role='dialog']")).toBeNull();
  });

  it("uses the full-size `url` field (not thumbnail_url) for the lightbox image per D-11", () => {
    renderLightbox({
      initialIndex: 0,
      photos: [
        makeItemPhoto({
          id: "p1",
          url: "https://full/size.jpg",
          thumbnail_url: "https://thumb/size.jpg",
        }),
      ],
    });
    const img = document.querySelector(
      "[role='dialog'] img"
    ) as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.src).toBe("https://full/size.jpg");
  });
});
