import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ItemThumbnailCell } from "./ItemThumbnailCell";
import { ItemHeaderThumbnail } from "./ItemHeaderThumbnail";

describe("ItemThumbnailCell", () => {
  it("renders img when thumbnailUrl is provided", () => {
    const { container } = render(
      <ItemThumbnailCell thumbnailUrl="https://x.test/thumb.jpg" />
    );
    const img = container.querySelector("img") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.src).toContain("https://x.test/thumb.jpg");
    expect(img!.alt).toBe("");
    expect(img!.getAttribute("loading")).toBe("lazy");
  });

  it("renders ImageOff placeholder when thumbnailUrl is null", () => {
    const { container } = render(<ItemThumbnailCell thumbnailUrl={null} />);
    expect(container.querySelector("img")).toBeNull();
    // lucide renders an inline <svg>
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders ImageOff placeholder when thumbnailUrl is undefined", () => {
    const { container } = render(<ItemThumbnailCell thumbnailUrl={undefined} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders ImageOff placeholder when thumbnailUrl is an empty string", () => {
    const { container } = render(<ItemThumbnailCell thumbnailUrl="" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("applies the 40x40 sizing (w-10 h-10) on the outer box", () => {
    const { container } = render(
      <ItemThumbnailCell thumbnailUrl="https://x.test/t.jpg" />
    );
    expect(container.querySelector(".w-10.h-10")).not.toBeNull();
  });

  it("applies opacity-50 when dimmed is true", () => {
    const { container } = render(
      <ItemThumbnailCell thumbnailUrl="https://x.test/t.jpg" dimmed />
    );
    expect(container.querySelector(".opacity-50")).not.toBeNull();
  });

  it("does not apply opacity-50 when dimmed is false or omitted", () => {
    const { container } = render(
      <ItemThumbnailCell thumbnailUrl="https://x.test/t.jpg" />
    );
    expect(container.querySelector(".opacity-50")).toBeNull();
  });
});

describe("ItemHeaderThumbnail", () => {
  it("renders img at 64x64 (w-16 h-16) when thumbnailUrl is provided", () => {
    const { container } = render(
      <ItemHeaderThumbnail thumbnailUrl="https://x.test/big.jpg" />
    );
    const img = container.querySelector("img") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.src).toContain("https://x.test/big.jpg");
    expect(container.querySelector(".w-16.h-16")).not.toBeNull();
  });

  it("renders ImageOff placeholder when thumbnailUrl is undefined", () => {
    const { container } = render(
      <ItemHeaderThumbnail thumbnailUrl={undefined} />
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders ImageOff placeholder when thumbnailUrl is null", () => {
    const { container } = render(<ItemHeaderThumbnail thumbnailUrl={null} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("applies opacity-50 when dimmed is true", () => {
    const { container } = render(
      <ItemHeaderThumbnail thumbnailUrl="https://x.test/big.jpg" dimmed />
    );
    expect(container.querySelector(".opacity-50")).not.toBeNull();
  });
});
