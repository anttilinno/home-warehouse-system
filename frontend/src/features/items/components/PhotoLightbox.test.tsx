import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import type { Photo } from "@/lib/types";
import { PhotoLightbox } from "./PhotoLightbox";

// Phase 7 Plan 04 Task 3 — PhotoLightbox: opens at index, arrow + ESC nav via
// the modal stack, AA panel-strip chrome, focus trap. jsdom (no canvas, no real
// network — download-original is not exercised here).

function photo(id: string, caption?: string): Photo {
  return {
    id,
    item_id: "it-1",
    workspace_id: "ws-1",
    filename: `${id}.jpg`,
    file_size: 1000,
    mime_type: "image/jpeg",
    width: 800,
    height: 600,
    display_order: 0,
    is_primary: false,
    caption,
    url: `/api/photos/${id}`,
    thumbnail_url: `/api/photos/${id}/thumb`,
    thumbnail_status: "ready",
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
  };
}

const PHOTOS = [photo("p-1", "first"), photo("p-2"), photo("p-3", "third")];

function renderLightbox(index: number | null, onClose = vi.fn()) {
  render(
    <I18nProvider i18n={i18n}>
      <ModalStackProvider>
        <PhotoLightbox photos={PHOTOS} index={index} onClose={onClose} />
      </ModalStackProvider>
    </I18nProvider>,
  );
  return onClose;
}

describe("PhotoLightbox", () => {
  it("renders nothing when closed", () => {
    renderLightbox(null);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens at the given index with the right image + index label", () => {
    renderLightbox(1);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("src", "/api/photos/p-2");
  });

  it("◂ / ▸ buttons navigate and clamp at the bounds", async () => {
    renderLightbox(0);
    // At the first photo, Previous is disabled.
    expect(screen.getByRole("button", { name: /previous photo/i })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /next photo/i }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /next photo/i }));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    // At the last photo, Next is disabled (clamped).
    expect(screen.getByRole("button", { name: /next photo/i })).toBeDisabled();
  });

  it("ArrowLeft / ArrowRight keys navigate", async () => {
    renderLightbox(1);
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    await userEvent.keyboard("{ArrowLeft}");
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("+ / - / 0 zoom keys adjust the zoom percentage", async () => {
    renderLightbox(0);
    expect(screen.getByText("100%")).toBeInTheDocument();
    await userEvent.keyboard("{+}");
    expect(screen.getByText("150%")).toBeInTheDocument();
    await userEvent.keyboard("{0}");
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("ESC closes through the modal stack", async () => {
    const onClose = renderLightbox(0);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("✕ CLOSE invokes onClose", async () => {
    const onClose = renderLightbox(0);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("is an accessible modal dialog labelled with the photo position", () => {
    renderLightbox(1);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Photo 2 of 3");
  });

  it("renders chrome on opaque panel strips (no white-on-photo)", () => {
    const { container } = render(
      <I18nProvider i18n={i18n}>
        <ModalStackProvider>
          <PhotoLightbox photos={PHOTOS} index={0} onClose={vi.fn()} />
        </ModalStackProvider>
      </I18nProvider>,
    );
    // The index label sits on a bg-bg-panel strip, never on a translucent
    // white-on-photo gradient.
    const strip = screen.getByText("1 / 3").closest("div")!;
    expect(strip.className).toContain("bg-bg-panel");
    expect(strip.className).not.toContain("text-white");
    expect(container.querySelector(".text-white")).toBeNull();
  });

  it("shows the caption strip when the active photo has a caption", () => {
    renderLightbox(0);
    expect(screen.getByText("first")).toBeInTheDocument();
  });
});
