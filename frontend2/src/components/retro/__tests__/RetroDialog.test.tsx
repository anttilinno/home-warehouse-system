import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { RetroDialog, type RetroDialogHandle } from "../RetroDialog";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (
    this: HTMLDialogElement
  ) {
    this.removeAttribute("open");
  });
});

describe("RetroDialog", () => {
  it("renders a dialog element", () => {
    render(<RetroDialog>Content</RetroDialog>);
    expect(document.querySelector("dialog")).toBeInTheDocument();
  });

  it("open() calls showModal on the dialog", () => {
    const ref = createRef<RetroDialogHandle>();
    render(<RetroDialog ref={ref}>Content</RetroDialog>);
    ref.current!.open();
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
  });

  it("close() calls native close on the dialog", () => {
    const ref = createRef<RetroDialogHandle>();
    render(<RetroDialog ref={ref}>Content</RetroDialog>);
    ref.current!.close();
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });

  it("renders hazard stripe inside dialog", () => {
    render(<RetroDialog>Content</RetroDialog>);
    const stripe = document.querySelector(".bg-hazard-stripe");
    expect(stripe).toBeInTheDocument();
  });

  it("renders close button with aria-label Close", () => {
    render(<RetroDialog>Content</RetroDialog>);
    expect(screen.getByLabelText("Close")).toBeInTheDocument();
  });

  it("renders children", () => {
    render(<RetroDialog>Dialog body text</RetroDialog>);
    expect(screen.getByText("Dialog body text")).toBeInTheDocument();
  });

  it("close button has bg-retro-red class", () => {
    render(<RetroDialog>Content</RetroDialog>);
    const closeBtn = screen.getByLabelText("Close");
    expect(closeBtn.className).toContain("bg-retro-red");
  });
});
